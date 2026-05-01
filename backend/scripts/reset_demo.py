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


def reset_auto_increment_if_mysql():
    if db.engine.dialect.name != "mysql":
        return

    for table_name in ("consumos_saida", "camadas_estoque", "movimentacoes", "produtos", "usuarios"):
        db.session.execute(text(f"ALTER TABLE {table_name} AUTO_INCREMENT = 1"))


def ensure_admin():
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


def main():
    app = create_app()

    with app.app_context():
        db.session.query(ConsumoSaida).delete()
        db.session.query(CamadaEstoque).delete()
        db.session.query(Movimentacao).delete()
        db.session.query(Produto).delete()
        db.session.query(Usuario).delete()
        db.session.flush()

        reset_auto_increment_if_mysql()
        ensure_admin()

        db.session.commit()
        print("Reset demo concluido. Base limpa com usuario admin recriado.")


if __name__ == "__main__":
    main()
