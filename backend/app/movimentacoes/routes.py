from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from ..extensions import db
from ..models import SubtipoMovimentacao, TipoMovimentacao
from ..schemas.movimentacao import MovimentacaoCreateSchema
from ..shared.errors import DomainError
from ..shared.http import json_error, load_payload
from ..shared.query_params import (
    parse_optional_date_arg,
    parse_optional_enum_arg,
    parse_optional_positive_int_arg,
)
from .serializers import serialize_movimentacao_result
from .service import MovimentacaoService

movimentacoes_bp = Blueprint("movimentacoes", __name__)

_movimentacao_create_schema = MovimentacaoCreateSchema()


@movimentacoes_bp.get("")
def list_movimentacoes():
    try:
        filtros = {
            "produto_id": parse_optional_positive_int_arg(request.args, "produto_id"),
            "limite": parse_optional_positive_int_arg(request.args, "limite"),
            "tipo": parse_optional_enum_arg(request.args, "tipo", TipoMovimentacao),
            "subtipo": parse_optional_enum_arg(request.args, "subtipo", SubtipoMovimentacao),
            "data_inicial": parse_optional_date_arg(request.args, "data_inicial"),
            "data_final": parse_optional_date_arg(request.args, "data_final"),
        }
    except ValidationError as exc:
        return json_error(exc.messages, 400)

    movimentacoes = MovimentacaoService(db.session).listar(filtros)
    return jsonify(movimentacoes), 200


@movimentacoes_bp.post("/entrada")
def create_entrada():
    try:
        data = load_payload(_movimentacao_create_schema)
        resultado = MovimentacaoService(db.session).registrar_entrada(data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_movimentacao_result(resultado)), 201


@movimentacoes_bp.post("/saida")
def create_saida():
    try:
        data = load_payload(_movimentacao_create_schema)
        resultado = MovimentacaoService(db.session).registrar_saida(data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_movimentacao_result(resultado)), 201
