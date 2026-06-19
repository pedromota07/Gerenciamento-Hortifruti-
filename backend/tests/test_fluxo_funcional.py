from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.extensions import db
from app.models import CamadaEstoque, ConsumoSaida, Movimentacao, Produto, Usuario


def post_json(client, url, payload, headers=None):
    return client.post(url, json=payload, headers=headers)


def autenticar(client, email="admin@hortifruti.local", senha="teste123"):
    response = post_json(client, "/api/auth/login", {"email": email, "senha": senha})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.get_json()['token']}"}


def criar_usuario(client, headers, email="validacao.funcional@hortifruti.local", ativo=True):
    response = post_json(
        client,
        "/api/usuarios",
        {
            "nome": "Usuario Validacao",
            "email": email,
            "senha": "teste123",
            "perfil": "funcionario",
            "ativo": ativo,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.get_json()


def criar_produto(client, headers, nome="Produto Validacao Funcional", validade_dias=10):
    response = post_json(
        client,
        "/api/produtos",
        {
            "nome": nome,
            "categoria": "legume",
            "unidade_medida": "kg",
            "estoque_minimo": "5.000",
            "preco_venda_padrao": "10.00",
            "validade_dias_padrao": validade_dias,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.get_json()


def registrar_entrada(client, headers, produto_id, quantidade, custo, data_entrada, usuario_id=None):
    return post_json(
        client,
        "/api/movimentacoes/entrada",
        {
            "produto_id": produto_id,
            "usuario_id": usuario_id,
            "data": data_entrada.isoformat(),
            "quantidade": quantidade,
            "custo_unitario": custo,
            "observacao": "entrada teste",
        },
        headers=headers,
    )


def registrar_saida(client, headers, produto_id, quantidade, subtipo, data_saida, preco=None):
    payload = {
        "produto_id": produto_id,
        "data": data_saida.isoformat(),
        "quantidade": quantidade,
        "subtipo": subtipo,
        "observacao": "saida teste",
    }

    if preco is not None:
        payload["preco_unitario_venda"] = preco

    return post_json(client, "/api/movimentacoes/saida", payload, headers=headers)


def test_health_check(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"service": "hortifruti-backend", "status": "ok"}


def test_login_valido_e_invalido(client):
    valido = post_json(
        client,
        "/api/auth/login",
        {"email": "admin@hortifruti.local", "senha": "teste123"},
    )
    invalido = post_json(
        client,
        "/api/auth/login",
        {"email": "admin@hortifruti.local", "senha": "errada"},
    )

    assert valido.status_code == 200
    assert valido.get_json()["usuario"]["perfil"] == "gerente"
    assert "token" in valido.get_json()
    assert invalido.status_code == 401
    assert invalido.get_json()["error"] == "Credenciais invalidas."


def test_rotas_exigem_jwt_e_gestao_de_usuarios_exige_gerente(client):
    sem_token = client.get("/api/produtos")
    headers_gerente = autenticar(client)
    criar_usuario(client, headers_gerente, email="funcionario@hortifruti.local")
    headers_funcionario = autenticar(client, email="funcionario@hortifruti.local")

    produtos_autenticado = client.get("/api/produtos", headers=headers_funcionario)
    usuarios_funcionario = client.get("/api/usuarios", headers=headers_funcionario)
    usuarios_gerente = client.get("/api/usuarios", headers=headers_gerente)

    assert sem_token.status_code == 401
    assert produtos_autenticado.status_code == 200
    assert usuarios_funcionario.status_code == 403
    assert usuarios_funcionario.get_json()["error"] == "Acesso restrito a usuarios gerentes."
    assert usuarios_gerente.status_code == 200


def test_movimentacao_usa_usuario_do_token(client):
    headers_gerente = autenticar(client)
    outro_usuario = criar_usuario(client, headers_gerente)
    produto = criar_produto(client, headers_gerente)

    entrada = registrar_entrada(
        client,
        headers_gerente,
        produto["id"],
        "3.000",
        "4.00",
        date.today(),
        usuario_id=outro_usuario["id"],
    )

    with client.application.app_context():
        gerente = Usuario.query.filter_by(email="admin@hortifruti.local").one()

    assert entrada.status_code == 201
    assert entrada.get_json()["movimentacao"]["usuario_id"] == gerente.id
    assert entrada.get_json()["movimentacao"]["usuario_id"] != outro_usuario["id"]


def test_usuarios_e_produtos_bloqueiam_duplicados(client):
    headers = autenticar(client)
    criar_usuario(client, headers)
    usuario_duplicado = post_json(
        client,
        "/api/usuarios",
        {
            "nome": "Usuario Duplicado",
            "email": "validacao.funcional@hortifruti.local",
            "senha": "teste123",
            "perfil": "funcionario",
            "ativo": True,
        },
        headers=headers,
    )
    produto = criar_produto(client, headers)
    produto_duplicado = post_json(
        client,
        "/api/produtos",
        {
            "nome": produto["nome"],
            "categoria": produto["categoria"],
            "unidade_medida": produto["unidade_medida"],
            "estoque_minimo": "1.000",
            "preco_venda_padrao": "5.00",
            "validade_dias_padrao": 3,
        },
        headers=headers,
    )

    assert usuario_duplicado.get_json()["error"] == "Ja existe usuario com o mesmo email."
    assert usuario_duplicado.status_code == 409
    assert produto_duplicado.status_code == 409
    assert produto_duplicado.get_json()["error"] == "Ja existe produto com o mesmo nome e categoria."


def test_fluxo_estoque_venda_fefo_perda_e_relatorios(client, app):
    hoje = date.today()
    headers = autenticar(client)
    produto = criar_produto(client, headers, validade_dias=10)

    entrada_antiga = registrar_entrada(
        client,
        headers,
        produto["id"],
        "20.000",
        "4.00",
        hoje - timedelta(days=5),
    )
    entrada_nova = registrar_entrada(
        client,
        headers,
        produto["id"],
        "10.000",
        "5.00",
        hoje,
    )

    assert entrada_antiga.status_code == 201
    assert entrada_nova.status_code == 201

    venda = registrar_saida(
        client,
        headers,
        produto["id"],
        "5.000",
        "venda",
        hoje,
        preco="12.50",
    )
    perda = registrar_saida(
        client,
        headers,
        produto["id"],
        "2.000",
        "perda",
        hoje,
    )

    assert venda.status_code == 201
    assert perda.status_code == 201

    venda_json = venda.get_json()
    perda_json = perda.get_json()

    assert venda_json["produto"]["quantidade_atual"] == pytest.approx(25.0)
    assert venda_json["movimentacao"]["receita_total"] == pytest.approx(62.5)
    assert venda_json["movimentacao"]["custo_total"] == pytest.approx(20.0)
    assert venda_json["movimentacao"]["lucro_bruto"] == pytest.approx(42.5)
    assert perda_json["produto"]["quantidade_atual"] == pytest.approx(23.0)
    assert perda_json["movimentacao"]["receita_total"] is None
    assert perda_json["movimentacao"]["custo_total"] == pytest.approx(8.0)

    with app.app_context():
        produto_db = db.session.get(Produto, produto["id"])
        camadas = (
            CamadaEstoque.query.filter_by(produto_id=produto["id"])
            .order_by(CamadaEstoque.data_validade.asc(), CamadaEstoque.id.asc())
            .all()
        )
        consumos = (
            ConsumoSaida.query.join(Movimentacao)
            .filter(Movimentacao.produto_id == produto["id"])
            .order_by(ConsumoSaida.id.asc())
            .all()
        )

        assert produto_db.quantidade_atual == Decimal("23.000")
        assert camadas[0].quantidade_disponivel == Decimal("13.000")
        assert camadas[1].quantidade_disponivel == Decimal("10.000")
        assert [consumo.camada_estoque_id for consumo in consumos] == [camadas[0].id, camadas[0].id]

    financeiro = client.get("/api/relatorios/financeiro", headers=headers).get_json()
    mais_vendidos = client.get("/api/relatorios/mais-vendidos?limite=5", headers=headers).get_json()
    validade = client.get("/api/relatorios/validade?dias=10", headers=headers).get_json()
    historico = client.get(
        f"/api/movimentacoes?produto_id={produto['id']}&limite=10",
        headers=headers,
    ).get_json()

    assert financeiro["receita_total"] == pytest.approx(62.5)
    assert financeiro["custo_total_vendas"] == pytest.approx(20.0)
    assert financeiro["lucro_bruto_total"] == pytest.approx(42.5)
    assert financeiro["perdas_total_custo"] == pytest.approx(8.0)
    assert financeiro["valor_estoque_custo"] == pytest.approx(102.0)
    assert mais_vendidos[0]["produto_id"] == produto["id"]
    assert mais_vendidos[0]["total_vendido"] == pytest.approx(5.0)
    assert validade["total_em_risco_custo"] == pytest.approx(102.0)
    assert len(historico) == 4


def test_saidas_invalidas_nao_gravam_movimentacao(client, app):
    hoje = date.today()
    headers = autenticar(client)
    produto = criar_produto(client, headers, validade_dias=1)

    entrada = registrar_entrada(client, headers, produto["id"], "3.000", "4.00", hoje)
    assert entrada.status_code == 201

    estoque_insuficiente = registrar_saida(
        client,
        headers,
        produto["id"],
        "10.000",
        "venda",
        hoje,
        preco="12.50",
    )

    client.delete(f"/api/produtos/{produto['id']}", headers=headers)
    produto_inativo = registrar_entrada(client, headers, produto["id"], "1.000", "4.00", hoje)

    with app.app_context():
        total_movimentacoes = Movimentacao.query.count()

    assert estoque_insuficiente.status_code == 409
    assert estoque_insuficiente.get_json()["error"] == "Estoque insuficiente para a saida informada."
    assert produto_inativo.status_code == 409
    assert produto_inativo.get_json()["error"] == "Produto inativo nao pode receber movimentacao."
    assert total_movimentacoes == 1


def test_venda_nao_consome_camadas_vencidas(client):
    hoje = date.today()
    headers = autenticar(client)
    produto = criar_produto(client, headers, validade_dias=1)

    entrada = registrar_entrada(
        client,
        headers,
        produto["id"],
        "3.000",
        "4.00",
        hoje - timedelta(days=3),
    )
    venda = registrar_saida(
        client,
        headers,
        produto["id"],
        "1.000",
        "venda",
        hoje,
        preco="12.50",
    )

    assert entrada.status_code == 201
    assert venda.status_code == 409
    assert venda.get_json()["error"] == "Estoque disponivel insuficiente para a saida informada considerando a validade."
