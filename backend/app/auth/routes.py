from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from ..shared.errors import DomainError
from ..shared.http import json_error
from .service import AuthService

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True)

    if payload is None:
        return json_error("Payload JSON invalido ou ausente.", 400)

    email = (payload.get("email") or "").strip().lower()
    senha = payload.get("senha") or ""

    if not email or not senha:
        return json_error("Email e senha sao obrigatorios.", 400)

    try:
        usuario = AuthService().autenticar(email, senha)
    except DomainError as exc:
        return json_error(exc.message, exc.status_code)

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
