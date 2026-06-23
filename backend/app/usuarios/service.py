import bcrypt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import PerfilUsuario, Usuario
from ..shared.errors import DomainError


class UsuarioService:
    def __init__(self, session):
        self.session = session

    def listar(self):
        statement = select(Usuario).order_by(Usuario.nome.asc(), Usuario.id.asc())
        return list(self.session.execute(statement).scalars())

    def criar(self, data):
        usuario = Usuario(
            nome=data["nome"],
            email=data["email"],
            senha_hash=bcrypt.hashpw(data["senha"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
            perfil=PerfilUsuario(data["perfil"]),
            ativo=data["ativo"],
        )

        self.session.add(usuario)
        return self._commit(usuario, "Já existe usuário com o mesmo email.")

    def atualizar(self, usuario_id, data):
        usuario = self.session.get(Usuario, usuario_id)
        if usuario is None:
            raise DomainError("Usuário não encontrado.", 404)

        if "perfil" in data:
            usuario.perfil = PerfilUsuario(data["perfil"])
        if "ativo" in data:
            usuario.ativo = data["ativo"]

        return self._commit(usuario, "Já existe usuário com o mesmo email.")

    def _commit(self, usuario, conflict_message):
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            raise DomainError(conflict_message, 409)

        return usuario
