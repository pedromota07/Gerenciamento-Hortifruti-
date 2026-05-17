from flask import Blueprint, jsonify
from marshmallow import ValidationError

from ..extensions import db
from ..schemas.usuario import UsuarioCreateSchema, UsuarioUpdateSchema
from ..shared.errors import DomainError
from ..shared.http import json_error, load_payload
from .service import UsuarioService

usuarios_bp = Blueprint("usuarios", __name__)

_usuario_create_schema = UsuarioCreateSchema()
_usuario_update_schema = UsuarioUpdateSchema()


@usuarios_bp.get("")
def list_usuarios():
    usuarios = UsuarioService(db.session).listar()
    return jsonify([usuario.to_dict() for usuario in usuarios]), 200


@usuarios_bp.post("")
def create_usuario():
    try:
        data = load_payload(_usuario_create_schema)
        usuario = UsuarioService(db.session).criar(data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(usuario.to_dict()), 201


@usuarios_bp.put("/<int:usuario_id>")
def update_usuario(usuario_id):
    try:
        data = load_payload(_usuario_update_schema)
        usuario = UsuarioService(db.session).atualizar(usuario_id, data)
    except ValidationError as exc:
        return json_error(exc.messages, 400)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

    return jsonify(usuario.to_dict()), 200
