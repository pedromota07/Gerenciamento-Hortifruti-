from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from ..extensions import db
from ..shared.auth import usuario_ativo_required
from ..shared.http import json_error
from ..shared.query_params import parse_optional_date_arg, parse_optional_positive_int_arg
from .service import RelatorioService

relatorios_bp = Blueprint("relatorios", __name__)


@relatorios_bp.get("/mais-vendidos")
@usuario_ativo_required
def get_mais_vendidos():
    try:
        limite = parse_optional_positive_int_arg(request.args, "limite") or 10
        data_inicial = parse_optional_date_arg(request.args, "data_inicial")
        data_final = parse_optional_date_arg(request.args, "data_final")
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).mais_vendidos(limite, data_inicial, data_final)), 200


@relatorios_bp.get("/financeiro")
@usuario_ativo_required
def get_financeiro():
    try:
        data_inicial = parse_optional_date_arg(request.args, "data_inicial")
        data_final = parse_optional_date_arg(request.args, "data_final")
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).financeiro(data_inicial, data_final)), 200


@relatorios_bp.get("/validade")
@usuario_ativo_required
def get_validade():
    try:
        dias = parse_optional_positive_int_arg(request.args, "dias") or 3
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).validade(dias)), 200


@relatorios_bp.get("/dashboard-inteligente")
@usuario_ativo_required
def get_dashboard_inteligente():
    try:
        dias_previsao = parse_optional_positive_int_arg(request.args, "dias_previsao") or 7
        dias_validade = parse_optional_positive_int_arg(request.args, "dias_validade") or 3
        data_inicial = parse_optional_date_arg(request.args, "data_inicial")
        data_final = parse_optional_date_arg(request.args, "data_final")
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    if data_inicial is not None and data_final is not None and data_inicial > data_final:
        return json_error({"data_inicial": ["Deve ser menor ou igual a data_final."]}, 400)

    return (
        jsonify(
            RelatorioService(db.session).dashboard_inteligente(
                dias_previsao=dias_previsao,
                dias_validade=dias_validade,
                data_inicial=data_inicial,
                data_final=data_final,
            )
        ),
        200,
    )
