from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

from .auth.routes import auth_bp
from .config import Config
from .extensions import db, jwt, migrate
from .movimentacoes.routes import movimentacoes_bp
from .produtos.routes import produtos_bp
from .relatorios.routes import relatorios_bp
from .usuarios.routes import usuarios_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from . import models

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(produtos_bp, url_prefix="/api/produtos")
    app.register_blueprint(movimentacoes_bp, url_prefix="/api/movimentacoes")
    app.register_blueprint(relatorios_bp, url_prefix="/api/relatorios")
    app.register_blueprint(usuarios_bp, url_prefix="/api/usuarios")

    @app.get("/api/health")
    def health():
        return jsonify({"service": "hortifruti-backend", "status": "ok"}), 200

    return app
