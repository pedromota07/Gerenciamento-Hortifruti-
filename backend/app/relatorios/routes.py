from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from ..extensions import db
from ..shared.http import json_error
from ..shared.query_params import parse_optional_date_arg, parse_optional_positive_int_arg
from .service import RelatorioService

relatorios_bp = Blueprint("relatorios", __name__)


@relatorios_bp.get("/mais-vendidos")
def get_mais_vendidos():
    try:
        limite = parse_optional_positive_int_arg(request.args, "limite") or 10
        data_inicial = parse_optional_date_arg(request.args, "data_inicial")
        data_final = parse_optional_date_arg(request.args, "data_final")
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).mais_vendidos(limite, data_inicial, data_final)), 200


@relatorios_bp.get("/financeiro")
def get_financeiro():
    try:
        data_inicial = parse_optional_date_arg(request.args, "data_inicial")
        data_final = parse_optional_date_arg(request.args, "data_final")
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).financeiro(data_inicial, data_final)), 200


@relatorios_bp.get("/validade")
def get_validade():
    try:
        dias = parse_optional_positive_int_arg(request.args, "dias") or 3
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    return jsonify(RelatorioService(db.session).validade(dias)), 200
