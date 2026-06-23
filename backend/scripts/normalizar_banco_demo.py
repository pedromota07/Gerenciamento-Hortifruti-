from __future__ import annotations

import os
import shutil
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import func, select, text


BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_SQLITE_URI = f"sqlite:///{(BASE_DIR / 'instance' / 'hortifruti_dev.db').as_posix()}"

sys.path.append(str(BASE_DIR))
os.environ.setdefault("DATABASE_URL", LOCAL_SQLITE_URI)

from app import create_app
from app.extensions import db
from app.models import CamadaEstoque, ConsumoSaida, Movimentacao, Produto, Usuario
from app.movimentacoes.service import MovimentacaoService
from app.relatorios.service import RelatorioService
from app.shared.errors import DomainError


DATA_REFERENCIA = date(2026, 6, 22)
DATA_INICIAL = DATA_REFERENCIA - timedelta(days=29)
CRITICOS_POR_VALIDADE = {
    "Morango Bandeja",
    "Alface Crespa",
    "Tomate Italiano",
    "Mamao Papaya",
    "Espinafre",
}
GIRO_ALTO = {
    "Banana Nanica",
    "Tomate Italiano",
    "Alface Crespa",
    "Morango Bandeja",
    "Laranja Pera",
    "Batata Inglesa",
    "Cenoura",
}
REPOSICAO_PRIORITARIA = {
    "Banana Nanica",
    "Batata Inglesa",
    "Cenoura",
}
MARGEM_APERTADA = {"Morango Bandeja", "Tomate Italiano", "Alface Crespa", "Banana Nanica"}
MIN_MOVIMENTACOES = 300
MAX_MOVIMENTACOES = 450


def dec(value) -> Decimal:
    return Decimal(str(value))


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantidade(value: Decimal, unidade: str) -> Decimal:
    if unidade in {"un", "cx"}:
        return max(value.to_integral_value(rounding=ROUND_HALF_UP), Decimal("1"))

    return max(value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP), Decimal("0.1"))


def unidade(produto: Produto) -> str:
    return produto.unidade_medida.value


def preco(produto: Produto) -> Decimal:
    return dec(produto.preco_venda_padrao)


def backup_banco() -> Path:
    database_path = Path(db.engine.url.database)
    if not database_path.is_absolute():
        database_path = (BASE_DIR / database_path).resolve()

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = database_path.with_name(f"{database_path.stem}.backup-normalizacao-{timestamp}{database_path.suffix}")
    shutil.copy2(database_path, backup_path)
    return backup_path


def usuario_operacao() -> Usuario:
    usuario = Usuario.query.filter_by(email="admin@hortifruti.local").first()
    if usuario is None:
        usuario = Usuario.query.filter_by(ativo=True).order_by(Usuario.id.asc()).first()

    if usuario is None:
        raise RuntimeError("Nao ha usuario ativo para registrar a carga.")

    return usuario


def limpar_movimentacoes() -> None:
    db.session.query(ConsumoSaida).delete()
    db.session.query(CamadaEstoque).delete()
    db.session.query(Movimentacao).delete()

    for produto in db.session.execute(select(Produto)).scalars():
        produto.quantidade_atual = Decimal("0")

    db.session.commit()


def custo_unitario(produto: Produto, indice_dia: int) -> Decimal:
    fator = Decimal("0.46") + Decimal(produto.id % 6) * Decimal("0.025")
    fator += Decimal(indice_dia % 4) * Decimal("0.006")

    if produto.nome in MARGEM_APERTADA:
        fator += Decimal("0.16")

    fator = min(fator, Decimal("0.84"))
    return money(preco(produto) * fator)


def preco_venda(produto: Produto, indice_dia: int) -> Decimal:
    fator = Decimal("1.00")
    if indice_dia % 9 == 0:
        fator = Decimal("0.94")
    if produto.nome in {"Morango Bandeja", "Alface Crespa"} and indice_dia % 11 == 0:
        fator = Decimal("0.90")

    return money(preco(produto) * fator)


def quantidade_entrada(produto: Produto, perfil: str, indice_dia: int) -> Decimal:
    uni = unidade(produto)

    if perfil == "alto":
        base = Decimal("16") + Decimal((produto.id + indice_dia) % 5)
    elif perfil == "medio":
        base = Decimal("10") + Decimal((produto.id + indice_dia) % 4)
    else:
        base = Decimal("7") + Decimal((produto.id + indice_dia) % 3)

    if uni == "kg":
        return quantidade(base, uni)
    if uni == "cx":
        return quantidade(base * Decimal("0.7"), uni)
    return quantidade(base, uni)


def quantidade_venda(produto: Produto, perfil: str, indice_dia: int) -> Decimal:
    uni = unidade(produto)

    if perfil == "alto":
        if uni == "kg":
            base = Decimal("2.4") + Decimal((produto.id + indice_dia) % 4) * Decimal("0.4")
        else:
            base = Decimal("2") + Decimal((produto.id + indice_dia) % 3)
    elif perfil == "medio":
        if uni == "kg":
            base = Decimal("1.0") + Decimal((produto.id + indice_dia) % 4) * Decimal("0.3")
        else:
            base = Decimal("1") + Decimal((produto.id + indice_dia) % 2)
    else:
        if uni == "kg":
            base = Decimal("0.7") + Decimal((produto.id + indice_dia) % 2) * Decimal("0.3")
        else:
            base = Decimal("1")

    return quantidade(base, uni)


def quantidade_perda(produto: Produto, indice_dia: int) -> Decimal:
    uni = unidade(produto)
    if uni == "kg":
        return quantidade(Decimal("0.4") + Decimal(indice_dia % 2) * Decimal("0.2"), uni)
    return Decimal("1")


def registrar_entrada(service: MovimentacaoService, produto: Produto, data_movimento: date, indice_dia: int, usuario_id: int, perfil: str) -> bool:
    service.registrar_entrada(
        {
            "produto_id": produto.id,
            "usuario_id": usuario_id,
            "quantidade": quantidade_entrada(produto, perfil, indice_dia),
            "custo_unitario": custo_unitario(produto, indice_dia),
            "data": data_movimento,
            "observacao": None,
        }
    )
    return True


def tentar_venda(service: MovimentacaoService, produto: Produto, data_movimento: date, indice_dia: int, usuario_id: int, perfil: str) -> bool:
    try:
        service.registrar_saida(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "subtipo": "venda",
                "quantidade": quantidade_venda(produto, perfil, indice_dia),
                "preco_unitario_venda": preco_venda(produto, indice_dia),
                "data": data_movimento,
                "observacao": None,
            }
        )
        return True
    except DomainError:
        return False


def tentar_perda(service: MovimentacaoService, produto: Produto, data_movimento: date, indice_dia: int, usuario_id: int) -> bool:
    try:
        service.registrar_saida(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "subtipo": "perda",
                "quantidade": quantidade_perda(produto, indice_dia),
                "data": data_movimento,
                "observacao": None,
            }
        )
        return True
    except DomainError:
        return False


def agrupar_produtos(produtos: list[Produto]) -> tuple[list[Produto], list[Produto], list[Produto]]:
    altos = [produto for produto in produtos if produto.nome in GIRO_ALTO]
    restantes = [produto for produto in produtos if produto.nome not in GIRO_ALTO]
    restantes.sort(key=lambda produto: (produto.categoria.value, produto.nome, produto.id))

    medios = restantes[:16]
    lentos = restantes[16:]
    return altos, medios, lentos


def gerar_historico(produtos: list[Produto], usuario_id: int) -> None:
    service = MovimentacaoService(db.session, today_provider=lambda: DATA_REFERENCIA)
    altos, medios, lentos = agrupar_produtos(produtos)
    perdas_planejadas = {5, 11, 18, 24}

    for indice_dia in range(30):
        data_movimento = DATA_INICIAL + timedelta(days=indice_dia)

        if indice_dia in {0, 6, 12, 18, 24}:
            for produto in altos:
                registrar_entrada(service, produto, data_movimento, indice_dia, usuario_id, "alto")

        if indice_dia in {0, 10, 20}:
            for produto in medios:
                registrar_entrada(service, produto, data_movimento, indice_dia, usuario_id, "medio")

        if indice_dia == 20:
            for produto in lentos:
                registrar_entrada(service, produto, data_movimento, indice_dia, usuario_id, "lento")

        if indice_dia % 5 != 0:
            for produto in altos:
                tentar_venda(service, produto, data_movimento, indice_dia, usuario_id, "alto")

        for produto in medios:
            venda_dias = {
                2 + (produto.id % 3),
                9 + (produto.id % 3),
                16 + (produto.id % 3),
                23 + (produto.id % 3),
            }
            if indice_dia in venda_dias:
                tentar_venda(service, produto, data_movimento, indice_dia, usuario_id, "medio")

        for produto in lentos:
            venda_dias = {22 + (produto.id % 2), 27 + (produto.id % 2)}
            if indice_dia in venda_dias:
                tentar_venda(service, produto, data_movimento, indice_dia, usuario_id, "lento")

        if indice_dia in perdas_planejadas:
            candidatos = [produto for produto in produtos if (produto.id + indice_dia) % 9 == 0]
            for produto in candidatos[:4]:
                tentar_perda(service, produto, data_movimento, indice_dia, usuario_id)


def soma_vencida(produto_id: int, antes_de: date) -> Decimal:
    total = db.session.execute(
        select(func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel), 0)).where(
            CamadaEstoque.produto_id == produto_id,
            CamadaEstoque.quantidade_disponivel > 0,
            CamadaEstoque.data_validade < antes_de,
        )
    ).scalar_one()
    return dec(total)


def soma_vendavel(produto_id: int, data_referencia: date) -> Decimal:
    total = db.session.execute(
        select(func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel), 0)).where(
            CamadaEstoque.produto_id == produto_id,
            CamadaEstoque.quantidade_disponivel > 0,
            CamadaEstoque.data_validade >= data_referencia,
        )
    ).scalar_one()
    return dec(total)


def total_vendido(produto_id: int) -> Decimal:
    total = db.session.execute(
        select(func.coalesce(func.sum(Movimentacao.quantidade), 0)).where(
            Movimentacao.produto_id == produto_id,
            Movimentacao.tipo == "saida",
            Movimentacao.subtipo == "venda",
            Movimentacao.data >= DATA_INICIAL,
            Movimentacao.data <= DATA_REFERENCIA,
        )
    ).scalar_one()
    return dec(total)


def remover_vencidos_gerados(produtos: list[Produto], usuario_id: int) -> None:
    service = MovimentacaoService(db.session, today_provider=lambda: DATA_REFERENCIA)

    for produto in produtos:
        vencida = soma_vencida(produto.id, DATA_REFERENCIA)
        if vencida <= 0:
            continue

        service.registrar_saida(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "subtipo": "perda",
                "quantidade": quantidade(vencida, unidade(produto)),
                "data": DATA_REFERENCIA,
                "observacao": None,
            }
        )


def adicionar_lotes_vencidos_criticos(produtos_por_nome: dict[str, Produto], usuario_id: int) -> None:
    service = MovimentacaoService(db.session, today_provider=lambda: DATA_REFERENCIA)

    for nome in sorted(CRITICOS_POR_VALIDADE):
        produto = produtos_por_nome[nome]
        data_entrada = DATA_REFERENCIA - timedelta(days=produto.validade_dias_padrao + 4)
        base = max(dec(produto.estoque_minimo) * Decimal("0.45"), Decimal("3"))
        qtd = quantidade(base, unidade(produto))

        service.registrar_entrada(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "quantidade": qtd,
                "custo_unitario": custo_unitario(produto, 26),
                "data": data_entrada,
                "observacao": None,
            }
        )


def repor_estoque_final(produtos: list[Produto], usuario_id: int) -> None:
    service = MovimentacaoService(db.session, today_provider=lambda: DATA_REFERENCIA)

    for produto in produtos:
        vendavel = soma_vendavel(produto.id, DATA_REFERENCIA)
        media = total_vendido(produto.id) / Decimal("30")
        minimo = dec(produto.estoque_minimo)

        alvo = max(
            minimo + Decimal("8"),
            media * Decimal("4"),
            Decimal("10"),
        )
        alvo = quantidade(alvo, unidade(produto))

        if vendavel >= alvo:
            continue

        service.registrar_entrada(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "quantidade": quantidade(alvo - vendavel, unidade(produto)),
                "custo_unitario": custo_unitario(produto, 29),
                "data": DATA_REFERENCIA,
                "observacao": None,
            }
        )


def ajustar_reposicao_prioritaria(produtos_por_nome: dict[str, Produto], usuario_id: int) -> None:
    service = MovimentacaoService(db.session, today_provider=lambda: DATA_REFERENCIA)

    for nome in sorted(REPOSICAO_PRIORITARIA):
        produto = produtos_por_nome[nome]
        vendido = total_vendido(produto.id)
        media = vendido / Decimal("30") if vendido > 0 else Decimal("1")
        alvo = quantidade(max(media * Decimal("2.5"), Decimal("4")), unidade(produto))
        vendavel = soma_vendavel(produto.id, DATA_REFERENCIA)
        excedente_bruto = vendavel - alvo

        if excedente_bruto <= 0:
            continue

        excedente = quantidade(excedente_bruto, unidade(produto))

        service.registrar_saida(
            {
                "produto_id": produto.id,
                "usuario_id": usuario_id,
                "subtipo": "venda",
                "quantidade": excedente,
                "preco_unitario_venda": preco_venda(produto, 29),
                "data": DATA_REFERENCIA,
                "observacao": None,
            }
        )


def limpar_observacoes() -> None:
    db.session.execute(text("UPDATE movimentacoes SET observacao = NULL"))
    db.session.commit()


def validar_resultado(produtos_antes: int, ativos_antes: int) -> dict:
    total_produtos = db.session.execute(select(func.count(Produto.id))).scalar_one()
    total_ativos = db.session.execute(
        select(func.count(Produto.id)).where(Produto.ativo.is_(True))
    ).scalar_one()
    total_movimentacoes = db.session.execute(select(func.count(Movimentacao.id))).scalar_one()
    com_observacao = db.session.execute(
        select(func.count(Movimentacao.id)).where(
            Movimentacao.observacao.is_not(None),
            func.trim(Movimentacao.observacao) != "",
        )
    ).scalar_one()

    dashboard = RelatorioService(db.session, today_provider=lambda: DATA_REFERENCIA).dashboard_inteligente(
        data_inicial=DATA_INICIAL,
        data_final=DATA_REFERENCIA,
        dias_previsao=7,
        dias_validade=3,
        limite=None,
    )
    prioridades = dashboard["prioridades_hoje"]
    criticos = [item for item in prioridades if item["prioridade"] == "critica"]
    rupturas_criticas = [item for item in criticos if item["tipo"] == "ruptura_prevista"]
    sugestoes = dashboard["sugestoes_reposicao"]
    sugestoes_nomes = {item["produto_nome"] for item in sugestoes}
    saude = dashboard["saude_operacional"]
    score_saude = saude["score"]

    erros = []
    if total_produtos != produtos_antes:
        erros.append(f"Produtos alterados: esperado {produtos_antes}, encontrado {total_produtos}.")
    if total_ativos != ativos_antes:
        erros.append(f"Produtos ativos alterados: esperado {ativos_antes}, encontrado {total_ativos}.")
    if com_observacao != 0:
        erros.append(f"Ainda existem {com_observacao} movimentacoes com observacao.")
    if not (MIN_MOVIMENTACOES <= total_movimentacoes <= MAX_MOVIMENTACOES):
        erros.append(
            f"Total de movimentacoes fora da faixa: {total_movimentacoes} "
            f"(esperado {MIN_MOVIMENTACOES}-{MAX_MOVIMENTACOES})."
        )
    if dashboard["kpis"]["alertas_criticos"] != 5:
        erros.append(f"KPI alertas_criticos esperado 5, encontrado {dashboard['kpis']['alertas_criticos']}.")
    if len(criticos) != 5:
        erros.append(f"Lista de prioridades criticas esperada 5, encontrada {len(criticos)}.")
    if rupturas_criticas:
        nomes = ", ".join(item["produto_nome"] for item in rupturas_criticas)
        erros.append(f"Existem rupturas criticas: {nomes}.")
    if sugestoes_nomes != REPOSICAO_PRIORITARIA:
        esperado = ", ".join(sorted(REPOSICAO_PRIORITARIA))
        encontrado = ", ".join(sorted(sugestoes_nomes)) or "nenhuma"
        erros.append(f"Sugestoes de reposicao esperadas [{esperado}], encontradas [{encontrado}].")
    if not (45 <= score_saude <= 65):
        erros.append(f"Saude operacional esperada entre 45 e 65, encontrada {score_saude}.")

    if erros:
        raise RuntimeError("\n".join(erros))

    return {
        "total_produtos": total_produtos,
        "total_ativos": total_ativos,
        "total_movimentacoes": total_movimentacoes,
        "alertas_criticos": dashboard["kpis"]["alertas_criticos"],
        "saude_score": score_saude,
        "saude_classificacao": saude["classificacao"],
        "saude_pilares": {
            chave: pilar["score"]
            for chave, pilar in saude["pilares"].items()
        },
        "criticos": [(item["produto_id"], item["produto_nome"], item["tipo"]) for item in criticos],
        "sugestoes_reposicao": [
            (item["produto_id"], item["produto_nome"], item["prioridade"], item["dias_cobertura"])
            for item in sugestoes
        ],
        "receita_total": dashboard["kpis"]["receita_total"],
        "perdas_total_custo": dashboard["kpis"]["perdas_total_custo"],
    }


def main() -> None:
    app = create_app()

    with app.app_context():
        produtos_antes = db.session.execute(select(func.count(Produto.id))).scalar_one()
        ativos_antes = db.session.execute(
            select(func.count(Produto.id)).where(Produto.ativo.is_(True))
        ).scalar_one()
        produtos = list(
            db.session.execute(
                select(Produto).where(Produto.ativo.is_(True)).order_by(Produto.id.asc())
            ).scalars()
        )
        produtos_por_nome = {produto.nome: produto for produto in produtos}
        faltantes = sorted(CRITICOS_POR_VALIDADE - set(produtos_por_nome))
        if faltantes:
            raise RuntimeError(f"Produtos criticos nao encontrados: {', '.join(faltantes)}")

        backup_path = backup_banco()
        usuario_id = usuario_operacao().id

        limpar_movimentacoes()
        gerar_historico(produtos, usuario_id)
        remover_vencidos_gerados(produtos, usuario_id)
        adicionar_lotes_vencidos_criticos(produtos_por_nome, usuario_id)
        repor_estoque_final(produtos, usuario_id)
        ajustar_reposicao_prioritaria(produtos_por_nome, usuario_id)
        limpar_observacoes()

        resumo = validar_resultado(produtos_antes, ativos_antes)

        print(f"Backup criado: {backup_path}")
        print(f"Produtos preservados: {resumo['total_produtos']} ({resumo['total_ativos']} ativos)")
        print(f"Movimentacoes geradas: {resumo['total_movimentacoes']}")
        print(f"Alertas criticos: {resumo['alertas_criticos']}")
        print(f"Saude operacional: {resumo['saude_score']} ({resumo['saude_classificacao']})")
        print(f"Pilares da saude: {resumo['saude_pilares']}")
        print(f"Receita no periodo: R$ {resumo['receita_total']:.2f}")
        print(f"Perdas no periodo: R$ {resumo['perdas_total_custo']:.2f}")
        print("Criticos:")
        for produto_id, nome, tipo in resumo["criticos"]:
            print(f"- {produto_id}: {nome} ({tipo})")
        print("Comprar com prioridade:")
        for produto_id, nome, prioridade, cobertura in resumo["sugestoes_reposicao"]:
            print(f"- {produto_id}: {nome} ({prioridade}, cobertura {cobertura} dia(s))")


if __name__ == "__main__":
    main()
