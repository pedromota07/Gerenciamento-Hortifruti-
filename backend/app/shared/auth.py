from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import db
from ..models import PerfilUsuario, Usuario
from .http import json_error


def _carregar_usuario_autenticado():
    verify_jwt_in_request()

    try:
        usuario_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None

    return db.session.get(Usuario, usuario_id)


def usuario_ativo_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        usuario = _carregar_usuario_autenticado()
        if usuario is None or not usuario.ativo:
            return json_error("Usuario autenticado invalido ou inativo.", 401)

        g.usuario_autenticado = usuario
        return view(*args, **kwargs)

    return wrapped


def gerente_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        usuario = _carregar_usuario_autenticado()
        if usuario is None or not usuario.ativo:
            return json_error("Usuario autenticado invalido ou inativo.", 401)
        if usuario.perfil != PerfilUsuario.GERENTE:
            return json_error("Acesso restrito a usuarios gerentes.", 403)

        g.usuario_autenticado = usuario
        return view(*args, **kwargs)

    return wrapped
