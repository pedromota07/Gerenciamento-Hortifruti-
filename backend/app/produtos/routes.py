from sqlalchemy.exc import IntegrityError
from marshmallow import ValidationError
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import CamadaEstoque, CategoriaProduto, Produto, UnidadeMedida
from ..schemas.produto import ProdutoCreateSchema, ProdutoUpdateSchema

produtos_bp = Blueprint("produtos", __name__)

_produto_create_schema = ProdutoCreateSchema()
_produto_update_schema = ProdutoUpdateSchema()


def _json_error(message, status_code):
    return jsonify({"error": message}), status_code


def _load_payload(schema):
    payload = request.get_json(silent=True)

    if payload is None:
        raise ValidationError("Payload JSON invalido ou ausente.")

    return schema.load(payload)


def _apply_produto_data(produto, data):
    if "nome" in data:
        produto.nome = data["nome"]
    if "categoria" in data:
        produto.categoria = CategoriaProduto(data["categoria"])
    if "unidade_medida" in data:
        produto.unidade_medida = UnidadeMedida(data["unidade_medida"])
    if "estoque_minimo" in data:
        produto.estoque_minimo = data["estoque_minimo"]
    if "preco_venda_padrao" in data:
        produto.preco_venda_padrao = data["preco_venda_padrao"]
    if "validade_dias_padrao" in data:
        produto.validade_dias_padrao = data["validade_dias_padrao"]
    if "ativo" in data:
        produto.ativo = data["ativo"]

    return produto


def _save_produto(status_code, produto):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _json_error("Ja existe produto com o mesmo nome e categoria.", 409)

    return jsonify(produto.to_dict()), status_code


@produtos_bp.get("")
def list_produtos():
    produtos = Produto.query.order_by(Produto.nome.asc(), Produto.id.asc()).all()
    return jsonify([produto.to_dict() for produto in produtos]), 200


@produtos_bp.get("/<int:produto_id>")
def get_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    return jsonify(produto.to_dict()), 200


@produtos_bp.get("/<int:produto_id>/camadas")
def list_produto_camadas(produto_id):
    Produto.query.get_or_404(produto_id)

    camadas = (
        CamadaEstoque.query
        .filter(
            CamadaEstoque.produto_id == produto_id,
            CamadaEstoque.quantidade_disponivel > 0,
        )
        .order_by(
            CamadaEstoque.data_validade.asc(),
            CamadaEstoque.data_entrada.asc(),
            CamadaEstoque.id.asc(),
        )
        .all()
    )

    return jsonify([camada.to_dict() for camada in camadas]), 200


@produtos_bp.post("")
def create_produto():
    try:
        data = _load_payload(_produto_create_schema)
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    produto = _apply_produto_data(Produto(), data)

    db.session.add(produto)
    return _save_produto(201, produto)


@produtos_bp.put("/<int:produto_id>")
def update_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)

    try:
        data = _load_payload(_produto_update_schema)
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    _apply_produto_data(produto, data)
    return _save_produto(200, produto)


@produtos_bp.delete("/<int:produto_id>")
def delete_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    produto.ativo = False
    return _save_produto(200, produto)
