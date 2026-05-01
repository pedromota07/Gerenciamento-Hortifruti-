from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError
from sqlalchemy import func, select

from ..extensions import db
from ..models import CamadaEstoque, Movimentacao, Produto, SubtipoMovimentacao, TipoMovimentacao

relatorios_bp = Blueprint("relatorios", __name__)


def _json_error(message, status_code):
    return jsonify({"error": message}), status_code


def _parse_optional_positive_int_arg(arg_name):
    raw_value = request.args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        value = int(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    if value < 1:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    return value


def _parse_optional_date_arg(arg_name):
    raw_value = request.args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        return date.fromisoformat(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve estar no formato YYYY-MM-DD."]})


def _apply_period_filters(statement, data_inicial, data_final):
    if data_inicial is not None:
        statement = statement.where(Movimentacao.data >= data_inicial)
    if data_final is not None:
        statement = statement.where(Movimentacao.data <= data_final)
    return statement


def _build_validade_statement(data_minima, data_maxima=None):
    valor_custo = func.sum(CamadaEstoque.quantidade_disponivel * CamadaEstoque.custo_unitario)
    valor_venda = func.sum(CamadaEstoque.quantidade_disponivel * Produto.preco_venda_padrao)

    statement = (
        select(
            Produto.id.label("produto_id"),
            Produto.nome.label("produto_nome"),
            Produto.categoria.label("categoria"),
            Produto.unidade_medida.label("unidade_medida"),
            func.sum(CamadaEstoque.quantidade_disponivel).label("quantidade_total"),
            valor_custo.label("valor_custo"),
            valor_venda.label("valor_venda"),
            func.min(CamadaEstoque.data_validade).label("proxima_validade"),
        )
        .join(Produto, Produto.id == CamadaEstoque.produto_id)
        .where(CamadaEstoque.quantidade_disponivel > 0)
        .group_by(
            Produto.id,
            Produto.nome,
            Produto.categoria,
            Produto.unidade_medida,
        )
        .order_by(func.min(CamadaEstoque.data_validade).asc(), Produto.nome.asc())
    )

    if data_minima is not None:
        statement = statement.where(CamadaEstoque.data_validade >= data_minima)

    if data_maxima is not None:
        statement = statement.where(CamadaEstoque.data_validade <= data_maxima)

    return statement


@relatorios_bp.get("/mais-vendidos")
def get_mais_vendidos():
    try:
        limite = _parse_optional_positive_int_arg("limite") or 10
        data_inicial = _parse_optional_date_arg("data_inicial")
        data_final = _parse_optional_date_arg("data_final")
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    total_vendido = func.sum(Movimentacao.quantidade)
    receita_total = func.sum(Movimentacao.receita_total)
    lucro_bruto_total = func.sum(Movimentacao.lucro_bruto)

    statement = (
        select(
            Produto.id.label("produto_id"),
            Produto.nome.label("produto_nome"),
            Produto.categoria.label("categoria"),
            Produto.unidade_medida.label("unidade_medida"),
            total_vendido.label("total_vendido"),
            receita_total.label("receita_total"),
            lucro_bruto_total.label("lucro_bruto_total"),
            func.count(Movimentacao.id).label("total_movimentacoes"),
        )
        .join(Produto, Produto.id == Movimentacao.produto_id)
        .where(
            Movimentacao.tipo == TipoMovimentacao.SAIDA,
            Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
        )
        .group_by(
            Produto.id,
            Produto.nome,
            Produto.categoria,
            Produto.unidade_medida,
        )
        .order_by(total_vendido.desc(), Produto.nome.asc())
    )
    statement = _apply_period_filters(statement, data_inicial, data_final)
    statement = statement.limit(limite)

    rows = db.session.execute(statement).all()

    return (
        jsonify(
            [
                {
                    "produto_id": produto_id,
                    "produto_nome": produto_nome,
                    "categoria": categoria.value,
                    "unidade_medida": unidade_medida.value,
                    "total_vendido": float(total_vendido),
                    "receita_total": float(receita_total or 0),
                    "lucro_bruto_total": float(lucro_bruto_total or 0),
                    "total_movimentacoes": total_movimentacoes,
                }
                for (
                    produto_id,
                    produto_nome,
                    categoria,
                    unidade_medida,
                    total_vendido,
                    receita_total,
                    lucro_bruto_total,
                    total_movimentacoes,
                ) in rows
            ]
        ),
        200,
    )


@relatorios_bp.get("/financeiro")
def get_financeiro():
    try:
        data_inicial = _parse_optional_date_arg("data_inicial")
        data_final = _parse_optional_date_arg("data_final")
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    vendas_statement = select(
        func.coalesce(func.sum(Movimentacao.receita_total), 0),
        func.coalesce(func.sum(Movimentacao.custo_total), 0),
        func.coalesce(func.sum(Movimentacao.lucro_bruto), 0),
    ).where(
        Movimentacao.tipo == TipoMovimentacao.SAIDA,
        Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
    )
    vendas_statement = _apply_period_filters(vendas_statement, data_inicial, data_final)

    perdas_statement = select(
        func.coalesce(func.sum(Movimentacao.custo_total), 0),
        func.count(Movimentacao.id),
    ).where(
        Movimentacao.tipo == TipoMovimentacao.SAIDA,
        Movimentacao.subtipo == SubtipoMovimentacao.PERDA,
    )
    perdas_statement = _apply_period_filters(perdas_statement, data_inicial, data_final)

    valor_estoque_custo_stmt = select(
        func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel * CamadaEstoque.custo_unitario), 0)
    ).where(CamadaEstoque.quantidade_disponivel > 0)

    hoje = date.today()
    valor_estoque_venda_stmt = (
        select(func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel * Produto.preco_venda_padrao), 0))
        .join(Produto, Produto.id == CamadaEstoque.produto_id)
        .where(
            CamadaEstoque.quantidade_disponivel > 0,
            CamadaEstoque.data_validade >= hoje,
        )
    )

    receita_total, custo_total_vendas, lucro_bruto_total = db.session.execute(vendas_statement).one()
    perdas_total_custo, perdas_total_registros = db.session.execute(perdas_statement).one()
    valor_estoque_custo = db.session.execute(valor_estoque_custo_stmt).scalar_one()
    valor_estoque_venda = db.session.execute(valor_estoque_venda_stmt).scalar_one()

    return (
        jsonify(
            {
                "receita_total": float(receita_total),
                "custo_total_vendas": float(custo_total_vendas),
                "lucro_bruto_total": float(lucro_bruto_total),
                "perdas_total_custo": float(perdas_total_custo),
                "perdas_total_registros": perdas_total_registros,
                "valor_estoque_custo": float(valor_estoque_custo),
                "valor_estoque_venda": float(valor_estoque_venda),
            }
        ),
        200,
    )


@relatorios_bp.get("/validade")
def get_validade():
    try:
        dias = _parse_optional_positive_int_arg("dias") or 3
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    hoje = date.today()
    limite = hoje + timedelta(days=dias)

    vencidos_rows = db.session.execute(
        _build_validade_statement(None, hoje - timedelta(days=1))
    ).all()
    proximos_rows = db.session.execute(
        _build_validade_statement(hoje, limite)
    ).all()

    def serialize(rows):
        return [
            {
                "produto_id": produto_id,
                "produto_nome": produto_nome,
                "categoria": categoria.value,
                "unidade_medida": unidade_medida.value,
                "quantidade_total": float(quantidade_total),
                "valor_custo": float(valor_custo or 0),
                "valor_venda": float(valor_venda or 0),
                "proxima_validade": proxima_validade.isoformat() if proxima_validade else None,
            }
            for (
                produto_id,
                produto_nome,
                categoria,
                unidade_medida,
                quantidade_total,
                valor_custo,
                valor_venda,
                proxima_validade,
            ) in rows
        ]

    vencidos = serialize(vencidos_rows)
    proximos_vencimento = serialize(proximos_rows)

    return (
        jsonify(
            {
                "dias_alerta": dias,
                "vencidos": vencidos,
                "proximos_vencimento": proximos_vencimento,
                "total_vencido_custo": float(sum(item["valor_custo"] for item in vencidos)),
                "total_em_risco_custo": float(sum(item["valor_custo"] for item in proximos_vencimento)),
            }
        ),
        200,
    )
