from flask import Blueprint, jsonify
from marshmallow import ValidationError

from ..extensions import db
from ..schemas.produto import ProdutoCreateSchema, ProdutoUpdateSchema
from ..serializers.produto import serialize_produto
from ..shared.auth import usuario_ativo_required
from ..shared.errors import DomainError
from ..shared.http import json_error, load_payload
from .service import ProdutoService

produtos_bp = Blueprint("produtos", __name__)

_produto_create_schema = ProdutoCreateSchema()
_produto_update_schema = ProdutoUpdateSchema()


@produtos_bp.get("")
@usuario_ativo_required
def list_produtos():
    produtos = ProdutoService(db.session).listar()
    return jsonify([serialize_produto(produto) for produto in produtos]), 200


@produtos_bp.get("/<int:produto_id>")
@usuario_ativo_required
def get_produto(produto_id):
    try:
        produto = ProdutoService(db.session).buscar(produto_id)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_produto(produto)), 200


@produtos_bp.get("/<int:produto_id>/camadas")
@usuario_ativo_required
def list_produto_camadas(produto_id):
    try:
        camadas = ProdutoService(db.session).listar_camadas_abertas(produto_id)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify([camada.to_dict() for camada in camadas]), 200


@produtos_bp.post("")
@usuario_ativo_required
def create_produto():
    try:
        data = load_payload(_produto_create_schema)
        produto = ProdutoService(db.session).criar(data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_produto(produto)), 201


@produtos_bp.put("/<int:produto_id>")
@usuario_ativo_required
def update_produto(produto_id):
    try:
        data = load_payload(_produto_update_schema)
        produto = ProdutoService(db.session).atualizar(produto_id, data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_produto(produto)), 200


@produtos_bp.delete("/<int:produto_id>")
@usuario_ativo_required
def delete_produto(produto_id):
    try:
        produto = ProdutoService(db.session).inativar(produto_id)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(serialize_produto(produto)), 200
