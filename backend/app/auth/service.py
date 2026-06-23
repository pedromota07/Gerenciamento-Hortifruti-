import bcrypt

from ..models import Usuario
from ..shared.errors import DomainError


class AuthService:
    def autenticar(self, email, senha):
        usuario = Usuario.query.filter_by(email=email).first()

        if usuario is None or not usuario.ativo:
            raise DomainError("Credenciais inválidas.", 401)

        senha_valida = bcrypt.checkpw(senha.encode("utf-8"), usuario.senha_hash.encode("utf-8"))
        if not senha_valida:
            raise DomainError("Credenciais inválidas.", 401)

        return usuario
