import bcrypt
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import PerfilUsuario, Usuario
from ..schemas.usuario import UsuarioCreateSchema, UsuarioUpdateSchema

usuarios_bp = Blueprint("usuarios", __name__)

_usuario_create_schema = UsuarioCreateSchema()
_usuario_update_schema = UsuarioUpdateSchema()


def _json_error(message, status_code):
    return jsonify({"error": message}), status_code


def _load_payload(schema):
    payload = request.get_json(silent=True)

    if payload is None:
        raise ValidationError("Payload JSON invalido ou ausente.")

    return schema.load(payload)


def _save_usuario(status_code, usuario, conflict_message="Ja existe usuario com o mesmo email."):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _json_error(conflict_message, 409)

    return jsonify(usuario.to_dict()), status_code


@usuarios_bp.get("")
def list_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nome.asc(), Usuario.id.asc()).all()
    return jsonify([usuario.to_dict() for usuario in usuarios]), 200


@usuarios_bp.post("")
def create_usuario():
    try:
        data = _load_payload(_usuario_create_schema)
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    usuario = Usuario(
        nome=data["nome"],
        email=data["email"],
        senha_hash=bcrypt.hashpw(data["senha"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        perfil=PerfilUsuario(data["perfil"]),
        ativo=data["ativo"],
    )

    db.session.add(usuario)
    return _save_usuario(201, usuario)


@usuarios_bp.put("/<int:usuario_id>")
def update_usuario(usuario_id):
    usuario = Usuario.query.get_or_404(usuario_id)

    try:
        data = _load_payload(_usuario_update_schema)
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    if "perfil" in data:
        usuario.perfil = PerfilUsuario(data["perfil"])
    if "ativo" in data:
        usuario.ativo = data["ativo"]

    return _save_usuario(200, usuario)
