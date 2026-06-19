from pathlib import Path
import sys

import bcrypt
from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models import CamadaEstoque, ConsumoSaida, Movimentacao, PerfilUsuario, Produto, Usuario

ADMIN_EMAIL = "admin@hortifruti.local"
ADMIN_NOME = "Administrador"
ADMIN_SENHA = "admin123"

USUARIOS_PADRAO = [
    {
        "nome": ADMIN_NOME,
        "email": ADMIN_EMAIL,
        "senha": ADMIN_SENHA,
        "perfil": PerfilUsuario.GERENTE,
        "ativo": True,
    },
    {
        "nome": "Fernanda Gerente",
        "email": "gerente@hortifruti.local",
        "senha": "demo123",
        "perfil": PerfilUsuario.GERENTE,
        "ativo": True,
    },
    {
        "nome": "Diego Estoque",
        "email": "estoque@hortifruti.local",
        "senha": "demo123",
        "perfil": PerfilUsuario.FUNCIONARIO,
        "ativo": True,
    },
    {
        "nome": "Paula Caixa",
        "email": "caixa@hortifruti.local",
        "senha": "demo123",
        "perfil": PerfilUsuario.FUNCIONARIO,
        "ativo": True,
    },
    {
        "nome": "Joao Temporario",
        "email": "temporario@hortifruti.local",
        "senha": "demo123",
        "perfil": PerfilUsuario.FUNCIONARIO,
        "ativo": False,
    },
]


def reset_auto_increment_if_mysql():
    if db.engine.dialect.name != "mysql":
        return

    for table_name in ("consumos_saida", "camadas_estoque", "movimentacoes", "produtos", "usuarios"):
        db.session.execute(text(f"ALTER TABLE {table_name} AUTO_INCREMENT = 1"))


def ensure_usuarios_padrao():
    for user_data in USUARIOS_PADRAO:
        usuario = Usuario.query.filter_by(email=user_data["email"]).first()
        senha_hash = bcrypt.hashpw(user_data["senha"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        if usuario is None:
            usuario = Usuario(email=user_data["email"])
            db.session.add(usuario)

        usuario.nome = user_data["nome"]
        usuario.senha_hash = senha_hash
        usuario.perfil = user_data["perfil"]
        usuario.ativo = user_data["ativo"]


def limpar_banco():
    db.session.query(ConsumoSaida).delete()
    db.session.query(CamadaEstoque).delete()
    db.session.query(Movimentacao).delete()
    db.session.query(Produto).delete()
    db.session.query(Usuario).delete()
    db.session.flush()

    reset_auto_increment_if_mysql()


def main():
    app = create_app()

    with app.app_context():
        limpar_banco()
        ensure_usuarios_padrao()

        db.session.commit()
        print("Reset concluido. Estoque limpo com usuarios padrao recriados.")


if __name__ == "__main__":
    main()
