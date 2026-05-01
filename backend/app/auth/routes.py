import bcrypt
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from ..models import Usuario

auth_bp = Blueprint("auth", __name__)


def _json_error(message, status_code):
    return jsonify({"error": message}), status_code


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True)

    if payload is None:
        return _json_error("Payload JSON invalido ou ausente.", 400)

    email = (payload.get("email") or "").strip().lower()
    senha = payload.get("senha") or ""

    if not email or not senha:
        return _json_error("Email e senha sao obrigatorios.", 400)

    usuario = Usuario.query.filter_by(email=email).first()

    if usuario is None or not usuario.ativo:
        return _json_error("Credenciais invalidas.", 401)

    senha_valida = bcrypt.checkpw(senha.encode("utf-8"), usuario.senha_hash.encode("utf-8"))
    if not senha_valida:
        return _json_error("Credenciais invalidas.", 401)

    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"perfil": usuario.perfil.value},
    )

    return (
        jsonify(
            {
                "token": token,
                "usuario": {
                    "id": usuario.id,
                    "nome": usuario.nome,
                    "perfil": usuario.perfil.value,
                },
            }
        ),
        200,
    )
