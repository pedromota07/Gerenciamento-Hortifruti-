from __future__ import annotations

import os
import sys
from pathlib import Path

import bcrypt

BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_SQLITE_URI = f"sqlite:///{(BASE_DIR / 'instance' / 'hortifruti_dev.db').as_posix()}"

if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = LOCAL_SQLITE_URI

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app import create_app
from app.extensions import db
from app.models import CamadaEstoque, ConsumoSaida, Movimentacao, PerfilUsuario, Produto, Usuario

USERS = [
    {
        "nome": "Administrador",
        "email": "admin@hortifruti.local",
        "senha": "admin123",
        "perfil": "gerente",
        "ativo": True,
    },
    {
        "nome": "Fernanda Gerente",
        "email": "gerente@hortifruti.local",
        "senha": "demo123",
        "perfil": "gerente",
        "ativo": True,
    },
    {
        "nome": "Diego Estoque",
        "email": "estoque@hortifruti.local",
        "senha": "demo123",
        "perfil": "funcionario",
        "ativo": True,
    },
    {
        "nome": "Paula Caixa",
        "email": "caixa@hortifruti.local",
        "senha": "demo123",
        "perfil": "funcionario",
        "ativo": True,
    },
    {
        "nome": "Joao Temporario",
        "email": "temporario@hortifruti.local",
        "senha": "demo123",
        "perfil": "funcionario",
        "ativo": False,
    },
]

PRODUCTS = [
    {
        "nome": "Banana Nanica",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "18.000",
        "preco_venda_padrao": "6.90",
        "validade_dias_padrao": 5,
    },
    {
        "nome": "Morango Bandeja",
        "categoria": "fruta",
        "unidade_medida": "cx",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "12.50",
        "validade_dias_padrao": 3,
    },
    {
        "nome": "Mamao Formosa",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "8.40",
        "validade_dias_padrao": 6,
    },
    {
        "nome": "Alface Crespa",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "20.000",
        "preco_venda_padrao": "3.50",
        "validade_dias_padrao": 2,
    },
    {
        "nome": "Couve Manteiga",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "15.000",
        "preco_venda_padrao": "4.20",
        "validade_dias_padrao": 4,
    },
    {
        "nome": "Tomate Italiano",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "16.000",
        "preco_venda_padrao": "9.80",
        "validade_dias_padrao": 7,
    },
    {
        "nome": "Cenoura",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "14.000",
        "preco_venda_padrao": "5.60",
        "validade_dias_padrao": 10,
    },
    {
        "nome": "Batata Inglesa",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "25.000",
        "preco_venda_padrao": "4.80",
        "validade_dias_padrao": 20,
    },
    {
        "nome": "Abobrinha Italiana",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "7.20",
        "validade_dias_padrao": 6,
    },
    {
        "nome": "Laranja Pera",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "20.000",
        "preco_venda_padrao": "5.90",
        "validade_dias_padrao": 12,
    },
]

MOVEMENTS = [
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Cenoura",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-03-29",
        "quantidade": "40.000",
        "custo_unitario": "2.50",
        "observacao": "Carga semanal de fornecedor local.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Mamao Formosa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-03-31",
        "quantidade": "22.000",
        "custo_unitario": "4.40",
        "observacao": "Reposicao de inicio de semana.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Tomate Italiano",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-03-31",
        "quantidade": "25.000",
        "custo_unitario": "4.10",
        "observacao": "Lote promocional do produtor.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Banana Nanica",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-01",
        "quantidade": "30.000",
        "custo_unitario": "3.20",
        "observacao": "Carga de banana prata substituida por nanica.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Abobrinha Italiana",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-01",
        "quantidade": "20.000",
        "custo_unitario": "3.10",
        "observacao": "Compra inicial para abastecer a banca.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Couve Manteiga",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-02",
        "quantidade": "20.000",
        "custo_unitario": "1.80",
        "observacao": "Primeira coleta da horta parceira.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Tomate Italiano",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-02",
        "quantidade": "10.000",
        "subtipo": "venda",
        "preco_unitario_venda": "9.80",
        "observacao": "Venda para restaurante da regiao.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Batata Inglesa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-02",
        "quantidade": "60.000",
        "custo_unitario": "2.20",
        "observacao": "Carga de reposicao para o fim de semana.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Mamao Formosa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-03",
        "quantidade": "26.000",
        "custo_unitario": "4.90",
        "observacao": "Segundo lote para reforco de promocao.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Couve Manteiga",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-03",
        "quantidade": "8.000",
        "subtipo": "venda",
        "preco_unitario_venda": "4.20",
        "observacao": "Venda fracionada para clientes da manha.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Laranja Pera",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-03",
        "quantidade": "35.000",
        "custo_unitario": "2.60",
        "observacao": "Laranja para area de sucos e banca principal.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Morango Bandeja",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-04",
        "quantidade": "18.000",
        "custo_unitario": "7.20",
        "observacao": "Lote premium para exposicao frontal.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Mamao Formosa",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-04",
        "quantidade": "12.000",
        "subtipo": "venda",
        "preco_unitario_venda": "8.40",
        "observacao": "Venda de combo cafe da manha.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Batata Inglesa",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-04",
        "quantidade": "8.000",
        "subtipo": "venda",
        "preco_unitario_venda": "4.80",
        "observacao": "Venda para cozinha industrial.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Cenoura",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-04",
        "quantidade": "20.000",
        "custo_unitario": "2.80",
        "observacao": "Complemento de estoque para kits de sopa.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Banana Nanica",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-05",
        "quantidade": "45.000",
        "custo_unitario": "3.55",
        "observacao": "Novo lote com melhor calibre.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Alface Crespa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-05",
        "quantidade": "24.000",
        "custo_unitario": "1.30",
        "observacao": "Reposicao da banca de folhas.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Tomate Italiano",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-05",
        "quantidade": "30.000",
        "custo_unitario": "4.60",
        "observacao": "Entrada complementar para giro de fim de semana.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Cenoura",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-05",
        "quantidade": "12.000",
        "subtipo": "venda",
        "preco_unitario_venda": "5.60",
        "observacao": "Venda para entrega de kits de legumes.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Abobrinha Italiana",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-05",
        "quantidade": "15.000",
        "custo_unitario": "3.40",
        "observacao": "Reposicao preventiva para a semana.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Alface Crespa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "12.000",
        "custo_unitario": "1.45",
        "observacao": "Nova coleta de folhas no inicio do dia.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Banana Nanica",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "22.000",
        "subtipo": "venda",
        "preco_unitario_venda": "6.90",
        "observacao": "Venda em atacado para lanchonete escolar.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Morango Bandeja",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "6.000",
        "subtipo": "venda",
        "preco_unitario_venda": "12.50",
        "observacao": "Venda rapida de bandejas inteiras.",
    },
    {
        "endpoint": "/api/movimentacoes/entrada",
        "produto": "Couve Manteiga",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "18.000",
        "custo_unitario": "1.95",
        "observacao": "Nova remessa para repor a area refrigerada.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Tomate Italiano",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "12.000",
        "subtipo": "venda",
        "preco_unitario_venda": "9.80",
        "observacao": "Venda para restaurante parceiro.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Laranja Pera",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "9.000",
        "subtipo": "venda",
        "preco_unitario_venda": "5.90",
        "observacao": "Venda para preparo de sucos.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Alface Crespa",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "18.000",
        "subtipo": "venda",
        "preco_unitario_venda": "3.50",
        "observacao": "Venda para marmitaria local.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Mamao Formosa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-06",
        "quantidade": "4.000",
        "subtipo": "perda",
        "observacao": "Separacao de frutas amassadas no recebimento.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Banana Nanica",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "10.000",
        "subtipo": "venda",
        "preco_unitario_venda": "6.90",
        "observacao": "Venda do turno da manha no PDV.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Alface Crespa",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "5.000",
        "subtipo": "perda",
        "observacao": "Descarte de folhas fora do padrao visual.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Couve Manteiga",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "4.000",
        "subtipo": "venda",
        "preco_unitario_venda": "4.20",
        "observacao": "Venda avulsa em horario de pico.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Cenoura",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "3.000",
        "subtipo": "perda",
        "observacao": "Ajuste por avaria no transporte interno.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Batata Inglesa",
        "usuario": "caixa@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "6.000",
        "subtipo": "venda",
        "preco_unitario_venda": "4.80",
        "observacao": "Venda de reposicao para cliente recorrente.",
    },
    {
        "endpoint": "/api/movimentacoes/saida",
        "produto": "Abobrinha Italiana",
        "usuario": "estoque@hortifruti.local",
        "data": "2026-04-07",
        "quantidade": "6.000",
        "subtipo": "perda",
        "observacao": "Retirada de itens moles da banca.",
    },
]


def ensure_database_url():
    if not os.getenv("DATABASE_URL"):
        os.environ["DATABASE_URL"] = LOCAL_SQLITE_URI

    return os.environ["DATABASE_URL"]


def reset_database():
    db.session.query(ConsumoSaida).delete()
    db.session.query(CamadaEstoque).delete()
    db.session.query(Movimentacao).delete()
    db.session.query(Produto).delete()
    db.session.query(Usuario).delete()
    db.session.commit()

    if db.engine.dialect.name == "mysql":
        for table_name in ("consumos_saida", "camadas_estoque", "movimentacoes", "produtos", "usuarios"):
            db.session.execute(text(f"ALTER TABLE {table_name} AUTO_INCREMENT = 1"))
        db.session.commit()


def expect_status(response, expected_status, context):
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{context} falhou com status {response.status_code}: {response.get_data(as_text=True)}"
        )

    return response.get_json()


def authorization_headers(client, email, senha):
    response = client.post("/api/auth/login", json={"email": email, "senha": senha})
    data = expect_status(response, 200, f"login de {email}")
    return {"Authorization": f"Bearer {data['token']}"}


def bootstrap_admin():
    admin_data = USERS[0]
    admin = Usuario(
        nome=admin_data["nome"],
        email=admin_data["email"],
        senha_hash=bcrypt.hashpw(admin_data["senha"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        perfil=PerfilUsuario(admin_data["perfil"]),
        ativo=True,
    )
    db.session.add(admin)
    db.session.commit()
    return admin.to_dict()


def create_users(client, headers):
    admin = Usuario.query.filter_by(email=USERS[0]["email"]).one()
    users_by_email = {admin.email: admin.to_dict()}

    for user_payload in USERS[1:]:
        response = client.post("/api/usuarios", json=user_payload, headers=headers)
        user = expect_status(response, 201, f"criacao do usuario {user_payload['email']}")
        users_by_email[user["email"]] = user

    return users_by_email


def create_products(client, headers):
    products_by_name = {}

    for product_payload in PRODUCTS:
        response = client.post("/api/produtos", json=product_payload, headers=headers)
        product = expect_status(response, 201, f"criacao do produto {product_payload['nome']}")
        products_by_name[product["nome"]] = product

    return products_by_name


def create_movements(client, products_by_name):
    passwords_by_email = {user["email"]: user["senha"] for user in USERS}
    headers_by_email = {}

    for movement in MOVEMENTS:
        email = movement["usuario"]
        if email not in headers_by_email:
            headers_by_email[email] = authorization_headers(client, email, passwords_by_email[email])

        payload = {
            "produto_id": products_by_name[movement["produto"]]["id"],
            "data": movement["data"],
            "quantidade": movement["quantidade"],
            "observacao": movement.get("observacao"),
        }

        if "custo_unitario" in movement:
            payload["custo_unitario"] = movement["custo_unitario"]
        if "subtipo" in movement:
            payload["subtipo"] = movement["subtipo"]
        if "preco_unitario_venda" in movement:
            payload["preco_unitario_venda"] = movement["preco_unitario_venda"]

        response = client.post(movement["endpoint"], json=payload, headers=headers_by_email[email])
        expect_status(response, 201, f"movimentacao {movement['endpoint']} de {movement['produto']}")


def build_summary(client, headers):
    produtos = expect_status(client.get("/api/produtos", headers=headers), 200, "consulta de produtos")
    usuarios = expect_status(client.get("/api/usuarios", headers=headers), 200, "consulta de usuarios")
    historico = expect_status(
        client.get("/api/movimentacoes?limite=20", headers=headers),
        200,
        "consulta de historico",
    )
    mais_vendidos = expect_status(
        client.get("/api/relatorios/mais-vendidos?limite=5", headers=headers),
        200,
        "consulta de mais vendidos",
    )
    financeiro = expect_status(
        client.get("/api/relatorios/financeiro", headers=headers),
        200,
        "consulta financeira",
    )
    validade = expect_status(
        client.get("/api/relatorios/validade?dias=3", headers=headers),
        200,
        "consulta de validade",
    )

    print("Banco populado com carga demonstrativa.")
    print(f"DATABASE_URL: {os.environ['DATABASE_URL']}")
    print(f"Produtos ativos: {sum(1 for produto in produtos if produto['ativo'])}")
    print(f"Usuarios cadastrados: {len(usuarios)}")
    print(f"Movimentacoes totais: {Movimentacao.query.count()}")
    print(f"Camadas abertas: {CamadaEstoque.query.filter(CamadaEstoque.quantidade_disponivel > 0).count()}")
    print(f"Ultimas movimentacoes carregadas no historico: {len(historico)}")
    print(
        "Financeiro: "
        f"receita={financeiro['receita_total']:.2f} "
        f"lucro={financeiro['lucro_bruto_total']:.2f} "
        f"perdas={financeiro['perdas_total_custo']:.2f}"
    )
    print(
        "Validade: "
        f"vencidos={len(validade['vencidos'])} "
        f"em_risco={len(validade['proximos_vencimento'])}"
    )
    print("Top 5 mais vendidos:")
    for item in mais_vendidos:
        print(
            f"- {item['produto_nome']}: {item['total_vendido']:.3f} | "
            f"receita={item['receita_total']:.2f} | lucro={item['lucro_bruto_total']:.2f}"
        )

    print("Credenciais de demo:")
    print("- admin@hortifruti.local / admin123 (gerente)")
    print("- gerente@hortifruti.local / demo123 (gerente)")
    print("- estoque@hortifruti.local / demo123 (funcionario)")
    print("- caixa@hortifruti.local / demo123 (funcionario)")


def main():
    database_url = ensure_database_url()
    app = create_app()

    with app.app_context():
        reset_database()
        bootstrap_admin()

        with app.test_client() as client:
            headers = authorization_headers(client, USERS[0]["email"], USERS[0]["senha"])
            create_users(client, headers)
            products_by_name = create_products(client, headers)
            create_movements(client, products_by_name)
            build_summary(client, headers)

    return database_url


if __name__ == "__main__":
    main()
