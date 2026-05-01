from pathlib import Path
import sys

import bcrypt

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models import PerfilUsuario, Usuario

ADMIN_EMAIL = "admin@hortifruti.local"
ADMIN_NOME = "Administrador"
ADMIN_SENHA = "admin123"


def main():
    app = create_app()

    with app.app_context():
        usuario = Usuario.query.filter_by(email=ADMIN_EMAIL).first()
        senha_hash = bcrypt.hashpw(ADMIN_SENHA.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        if usuario is None:
            usuario = Usuario(
                nome=ADMIN_NOME,
                email=ADMIN_EMAIL,
                senha_hash=senha_hash,
                perfil=PerfilUsuario.GERENTE,
                ativo=True,
            )
            db.session.add(usuario)
        else:
            usuario.nome = ADMIN_NOME
            usuario.senha_hash = senha_hash
            usuario.perfil = PerfilUsuario.GERENTE
            usuario.ativo = True

        db.session.commit()
        print(f"Seed concluido: {ADMIN_EMAIL} / {ADMIN_SENHA}")


if __name__ == "__main__":
    main()
