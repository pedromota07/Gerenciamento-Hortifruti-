import sys
from pathlib import Path

import bcrypt
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import create_app
from app.extensions import db
from app.models import PerfilUsuario, Usuario


class TestConfig:
    TESTING = True
    SECRET_KEY = "test-secret-with-at-least-32-bytes"
    JWT_SECRET_KEY = "test-jwt-secret-with-at-least-32-bytes"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    CORS_ORIGINS = ["http://localhost:3000"]


@pytest.fixture()
def app():
    app = create_app(TestConfig)

    with app.app_context():
        db.create_all()
        db.session.add(
            Usuario(
                nome="Administrador Teste",
                email="admin@hortifruti.local",
                senha_hash=bcrypt.hashpw(b"teste123", bcrypt.gensalt()).decode("utf-8"),
                perfil=PerfilUsuario.GERENTE,
                ativo=True,
            )
        )
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()
