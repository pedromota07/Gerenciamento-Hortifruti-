from __future__ import annotations

import os
import sys
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_SQLITE_URI = f"sqlite:///{(BASE_DIR / 'instance' / 'hortifruti_dev.db').as_posix()}"

sys.path.append(str(BASE_DIR))

from app import create_app
from app.extensions import db
from app.models import CamadaEstoque, Movimentacao, Produto, SubtipoMovimentacao, TipoMovimentacao, Usuario
from app.relatorios.service import RelatorioService

try:
    from scripts.reset_demo import USUARIOS_PADRAO, ensure_usuarios_padrao, limpar_banco
except ModuleNotFoundError:
    from reset_demo import USUARIOS_PADRAO, ensure_usuarios_padrao, limpar_banco


PRODUCTS = [
    {
        "nome": "Banana Nanica",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "18.000",
        "preco_venda_padrao": "6.90",
        "validade_dias_padrao": 5,
        "custo_base": "3.10",
    },
    {
        "nome": "Banana Prata",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "16.000",
        "preco_venda_padrao": "7.40",
        "validade_dias_padrao": 6,
        "custo_base": "3.85",
    },
    {
        "nome": "Maca Gala",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "11.90",
        "validade_dias_padrao": 18,
        "custo_base": "7.20",
    },
    {
        "nome": "Maca Fuji",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "12.40",
        "validade_dias_padrao": 18,
        "custo_base": "7.60",
    },
    {
        "nome": "Laranja Pera",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "20.000",
        "preco_venda_padrao": "5.90",
        "validade_dias_padrao": 12,
        "custo_base": "2.70",
    },
    {
        "nome": "Limao Tahiti",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "6.80",
        "validade_dias_padrao": 15,
        "custo_base": "3.40",
    },
    {
        "nome": "Mamao Formosa",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "8.40",
        "validade_dias_padrao": 6,
        "custo_base": "4.70",
    },
    {
        "nome": "Mamao Papaya",
        "categoria": "fruta",
        "unidade_medida": "un",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "4.90",
        "validade_dias_padrao": 6,
        "custo_base": "2.80",
    },
    {
        "nome": "Manga Palmer",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "9.90",
        "validade_dias_padrao": 6,
        "custo_base": "5.20",
    },
    {
        "nome": "Melancia",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "30.000",
        "preco_venda_padrao": "3.20",
        "validade_dias_padrao": 7,
        "custo_base": "1.85",
    },
    {
        "nome": "Abacaxi",
        "categoria": "fruta",
        "unidade_medida": "un",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "8.90",
        "validade_dias_padrao": 7,
        "custo_base": "4.95",
    },
    {
        "nome": "Morango Bandeja",
        "categoria": "fruta",
        "unidade_medida": "cx",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "12.50",
        "validade_dias_padrao": 3,
        "custo_base": "7.40",
    },
    {
        "nome": "Uva Thompson",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "18.90",
        "validade_dias_padrao": 7,
        "custo_base": "11.20",
    },
    {
        "nome": "Pera Williams",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "14.90",
        "validade_dias_padrao": 9,
        "custo_base": "9.60",
    },
    {
        "nome": "Abacate",
        "categoria": "fruta",
        "unidade_medida": "kg",
        "estoque_minimo": "9.000",
        "preco_venda_padrao": "10.80",
        "validade_dias_padrao": 8,
        "custo_base": "5.90",
    },
    {
        "nome": "Tomate Italiano",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "16.000",
        "preco_venda_padrao": "9.80",
        "validade_dias_padrao": 7,
        "custo_base": "4.60",
    },
    {
        "nome": "Tomate Cereja",
        "categoria": "legume",
        "unidade_medida": "cx",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "7.90",
        "validade_dias_padrao": 5,
        "custo_base": "4.90",
    },
    {
        "nome": "Batata Inglesa",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "25.000",
        "preco_venda_padrao": "4.80",
        "validade_dias_padrao": 20,
        "custo_base": "2.15",
    },
    {
        "nome": "Batata Doce",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "14.000",
        "preco_venda_padrao": "5.60",
        "validade_dias_padrao": 18,
        "custo_base": "2.90",
    },
    {
        "nome": "Cebola",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "18.000",
        "preco_venda_padrao": "5.20",
        "validade_dias_padrao": 45,
        "custo_base": "2.75",
    },
    {
        "nome": "Alho",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "5.000",
        "preco_venda_padrao": "24.90",
        "validade_dias_padrao": 90,
        "custo_base": "18.20",
    },
    {
        "nome": "Cenoura",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "14.000",
        "preco_venda_padrao": "5.60",
        "validade_dias_padrao": 10,
        "custo_base": "2.80",
    },
    {
        "nome": "Beterraba",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "5.40",
        "validade_dias_padrao": 12,
        "custo_base": "2.75",
    },
    {
        "nome": "Pepino",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "6.30",
        "validade_dias_padrao": 7,
        "custo_base": "3.20",
    },
    {
        "nome": "Abobrinha Italiana",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "7.20",
        "validade_dias_padrao": 6,
        "custo_base": "3.40",
    },
    {
        "nome": "Chuchu",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "4.90",
        "validade_dias_padrao": 8,
        "custo_base": "2.45",
    },
    {
        "nome": "Pimentao Verde",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "7.000",
        "preco_venda_padrao": "10.90",
        "validade_dias_padrao": 7,
        "custo_base": "6.20",
    },
    {
        "nome": "Mandioca",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "6.20",
        "validade_dias_padrao": 45,
        "custo_base": "3.50",
    },
    {
        "nome": "Inhame",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "8.40",
        "validade_dias_padrao": 45,
        "custo_base": "5.30",
    },
    {
        "nome": "Berinjela",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "7.90",
        "validade_dias_padrao": 7,
        "custo_base": "4.15",
    },
    {
        "nome": "Quiabo",
        "categoria": "legume",
        "unidade_medida": "kg",
        "estoque_minimo": "5.000",
        "preco_venda_padrao": "12.80",
        "validade_dias_padrao": 5,
        "ativo": False,
        "custo_base": "7.30",
    },
    {
        "nome": "Alface Crespa",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "20.000",
        "preco_venda_padrao": "3.50",
        "validade_dias_padrao": 2,
        "custo_base": "1.35",
    },
    {
        "nome": "Alface Americana",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "16.000",
        "preco_venda_padrao": "4.20",
        "validade_dias_padrao": 3,
        "custo_base": "1.75",
    },
    {
        "nome": "Couve Manteiga",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "15.000",
        "preco_venda_padrao": "4.20",
        "validade_dias_padrao": 4,
        "custo_base": "1.95",
    },
    {
        "nome": "Coentro",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "2.90",
        "validade_dias_padrao": 3,
        "custo_base": "1.20",
    },
    {
        "nome": "Salsa",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "2.80",
        "validade_dias_padrao": 3,
        "custo_base": "1.15",
    },
    {
        "nome": "Cebolinha",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "12.000",
        "preco_venda_padrao": "2.80",
        "validade_dias_padrao": 3,
        "custo_base": "1.10",
    },
    {
        "nome": "Rucula",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "4.60",
        "validade_dias_padrao": 3,
        "custo_base": "1.95",
    },
    {
        "nome": "Espinafre",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "10.000",
        "preco_venda_padrao": "5.20",
        "validade_dias_padrao": 4,
        "custo_base": "2.20",
    },
    {
        "nome": "Agriao",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "4.70",
        "validade_dias_padrao": 3,
        "custo_base": "2.05",
    },
    {
        "nome": "Brocolis",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "8.000",
        "preco_venda_padrao": "7.90",
        "validade_dias_padrao": 5,
        "custo_base": "4.10",
    },
    {
        "nome": "Repolho Roxo",
        "categoria": "verdura",
        "unidade_medida": "un",
        "estoque_minimo": "7.000",
        "preco_venda_padrao": "6.90",
        "validade_dias_padrao": 10,
        "ativo": False,
        "custo_base": "3.90",
    },
]

LOW_STOCK_PRODUCTS = {"Banana Nanica", "Tomate Italiano", "Alface Crespa"}
TOP_PRODUCTS = {"Batata Inglesa", "Laranja Pera", "Cenoura"}
IDLE_PRODUCTS = {"Alho", "Cebola", "Mandioca", "Inhame", "Pera Williams"}
EXPIRED_PRODUCTS = {"Morango Bandeja", "Mamao Papaya", "Espinafre"}
PUBLIC_PRODUCT_FIELDS = {
    "nome",
    "categoria",
    "unidade_medida",
    "estoque_minimo",
    "preco_venda_padrao",
    "validade_dias_padrao",
    "ativo",
}
MOVEMENT_ORDER = {"entrada": 0, "venda": 1, "perda": 2}


def ensure_database_url():
    if not os.getenv("DATABASE_URL"):
        os.environ["DATABASE_URL"] = LOCAL_SQLITE_URI

    return os.environ["DATABASE_URL"]


def expect_status(response, expected_status, context):
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{context} falhou com status {response.status_code}: {response.get_data(as_text=True)}"
        )

    return response.get_json()


def authorization_headers(client, email, senha):
    response = client.post("/api/auth/login", json={"email": email, "senha": senha})
    data = expect_status(response, 200, f"login de {email}")
    return {"Authorization": f"Bearer {data['token']}"}


def product_by_name():
    return {product["nome"]: product for product in PRODUCTS}


def decimal_string(value, scale="0.001"):
    quantized = Decimal(str(value)).quantize(Decimal(scale))
    return f"{quantized:.{abs(Decimal(scale).as_tuple().exponent)}f}"


def quantity(value):
    return decimal_string(value, "0.001")


def money(value):
    return decimal_string(value, "0.01")


def product_cost(name, factor="1.00"):
    product = product_by_name()[name]
    return money(Decimal(product["custo_base"]) * Decimal(str(factor)))


def product_price(name):
    return money(product_by_name()[name]["preco_venda_padrao"])


def product_validity(name):
    return int(product_by_name()[name]["validade_dias_padrao"])


def create_users():
    limpar_banco()
    ensure_usuarios_padrao()
    db.session.commit()


def create_products(client, headers):
    products_by_name = {}

    for product in PRODUCTS:
        payload = {field: product[field] for field in PUBLIC_PRODUCT_FIELDS if field in product}
        payload.setdefault("ativo", True)
        response = client.post("/api/produtos", json=payload, headers=headers)
        created_product = expect_status(response, 201, f"criacao do produto {product['nome']}")
        products_by_name[created_product["nome"]] = created_product

    return products_by_name


def add_movement(movements, kind, product_name, movement_date, amount, **extra):
    movements.append(
        {
            "kind": kind,
            "produto": product_name,
            "data": movement_date,
            "quantidade": quantity(amount),
            "ordem": len(movements),
            **extra,
        }
    )


def add_entry(movements, today, product_name, days_ago, amount, cost_factor="1.00", note=None):
    add_movement(
        movements,
        "entrada",
        product_name,
        today - timedelta(days=days_ago),
        amount,
        custo_unitario=product_cost(product_name, cost_factor),
        observacao=note or "Reposicao planejada para abastecimento da loja.",
    )


def add_sale(movements, today, product_name, days_ago, amount, note=None):
    add_movement(
        movements,
        "venda",
        product_name,
        today - timedelta(days=days_ago),
        amount,
        subtipo="venda",
        preco_unitario_venda=product_price(product_name),
        observacao=note or "Venda registrada no PDV.",
    )


def add_loss(movements, today, product_name, days_ago, amount, note=None):
    add_movement(
        movements,
        "perda",
        product_name,
        today - timedelta(days=days_ago),
        amount,
        subtipo="perda",
        observacao=note or "Perda operacional registrada no estoque.",
    )


def add_sales_cycle(movements, today, product_name, entry_days_ago, entry_amount, sale_amounts):
    add_entry(
        movements,
        today,
        product_name,
        entry_days_ago,
        entry_amount,
        note=f"Entrada recorrente de {product_name}.",
    )

    for offset, sale_amount in enumerate(sale_amounts):
        add_sale(
            movements,
            today,
            product_name,
            entry_days_ago - offset,
            sale_amount,
            note=f"Venda recorrente de {product_name}.",
        )


def add_repeating_sales(movements, today, product_name, start_days_ago, end_days_ago, step_days, entry_amount, sales):
    current = start_days_ago
    while current >= end_days_ago:
        add_sales_cycle(movements, today, product_name, current, entry_amount, sales)
        current -= step_days


def generate_high_turnover(movements, today):
    add_repeating_sales(movements, today, "Banana Nanica", 110, 10, 5, "35.000", ["12.000", "10.000", "8.000", "5.000"])
    add_entry(movements, today, "Banana Nanica", 1, "20.000", note="Reposicao final enxuta para manter alerta de estoque baixo.")
    add_sale(movements, today, "Banana Nanica", 0, "12.000", note="Venda forte do dia para banana.")

    add_repeating_sales(movements, today, "Tomate Italiano", 108, 10, 7, "27.000", ["9.000", "8.000", "6.000", "4.000"])
    add_entry(movements, today, "Tomate Italiano", 2, "22.000", note="Reposicao final controlada para tomate.")
    add_sale(movements, today, "Tomate Italiano", 1, "8.000", note="Venda recente de tomate.")
    add_sale(movements, today, "Tomate Italiano", 0, "7.000", note="Venda do dia para tomate.")

    add_repeating_sales(movements, today, "Alface Crespa", 90, 6, 3, "13.000", ["8.000", "5.000"])
    add_entry(movements, today, "Alface Crespa", 1, "19.000", note="Entrada final curta para folha de alto giro.")
    add_sale(movements, today, "Alface Crespa", 0, "13.000", note="Venda forte do dia para alface.")


def generate_top_rank_products(movements, today):
    add_repeating_sales(movements, today, "Batata Inglesa", 112, 14, 14, "22.000", ["9.000", "7.000", "6.000"])
    add_repeating_sales(movements, today, "Laranja Pera", 108, 18, 15, "20.000", ["8.000", "7.000", "5.000"])
    add_repeating_sales(movements, today, "Cenoura", 102, 18, 14, "18.000", ["7.000", "6.000", "5.000"])


def generate_normal_sales(movements, today):
    normal_products = [
        "Banana Prata",
        "Maca Gala",
        "Maca Fuji",
        "Limao Tahiti",
        "Mamao Formosa",
        "Manga Palmer",
        "Melancia",
        "Abacaxi",
        "Tomate Cereja",
        "Batata Doce",
        "Beterraba",
        "Pepino",
        "Abobrinha Italiana",
        "Chuchu",
        "Pimentao Verde",
        "Berinjela",
        "Alface Americana",
        "Couve Manteiga",
        "Coentro",
        "Salsa",
        "Cebolinha",
        "Rucula",
        "Agriao",
        "Brocolis",
    ]

    for index, product_name in enumerate(normal_products):
        base_amount = Decimal("7.000") + Decimal(index % 4)
        add_sales_cycle(
            movements,
            today,
            product_name,
            74 - (index % 5),
            base_amount + Decimal("5.000"),
            [base_amount, Decimal("5.000")],
        )
        add_sales_cycle(
            movements,
            today,
            product_name,
            35 - (index % 4),
            base_amount + Decimal("4.000"),
            [base_amount - Decimal("1.000"), Decimal("5.000")],
        )
        add_sales_cycle(
            movements,
            today,
            product_name,
            22 - (index % 3),
            base_amount + Decimal("3.000"),
            [base_amount - Decimal("2.000"), Decimal("5.000")],
        )


def generate_expired_stock(movements, today):
    scenarios = [
        ("Morango Bandeja", "18.000", "3.000", 45, 31),
        ("Mamao Papaya", "16.000", "2.000", 48, 29),
        ("Espinafre", "14.000", "2.000", 44, 27),
    ]

    for product_name, entry_amount, loss_amount, entry_days_ago, loss_days_ago in scenarios:
        add_entry(
            movements,
            today,
            product_name,
            entry_days_ago,
            entry_amount,
            cost_factor="0.96",
            note=f"Entrada antiga mantida para cenario de vencimento: {product_name}.",
        )
        add_loss(
            movements,
            today,
            product_name,
            loss_days_ago,
            loss_amount,
            note=f"Perda parcial por vencimento de {product_name}.",
        )


def generate_upcoming_expiration(movements, today):
    scenarios = [
        ("Uva Thompson", 2, "12.000"),
        ("Manga Palmer", 2, "10.000"),
        ("Brocolis", 1, "9.000"),
        ("Rucula", 2, "11.000"),
        ("Pepino", 3, "13.000"),
    ]

    for product_name, days_until_expiration, amount in scenarios:
        entry_days_ago = product_validity(product_name) - days_until_expiration
        add_entry(
            movements,
            today,
            product_name,
            entry_days_ago,
            amount,
            cost_factor="1.03",
            note=f"Lote em monitoramento de validade: {product_name}.",
        )


def generate_current_stock(movements, today):
    for product in PRODUCTS:
        product_name = product["nome"]
        if product_name in LOW_STOCK_PRODUCTS or product.get("ativo") is False:
            continue

        validity = int(product["validade_dias_padrao"])
        days_ago = max(validity - 8, 0)
        amount = Decimal(product["estoque_minimo"]) + Decimal("8.000")
        add_entry(
            movements,
            today,
            product_name,
            days_ago,
            amount,
            cost_factor="1.01",
            note=f"Estoque atual saudavel para {product_name}.",
        )


def generate_losses(movements, today):
    loss_products = [
        "Maca Gala",
        "Maca Fuji",
        "Mamao Formosa",
        "Manga Palmer",
        "Melancia",
        "Abacaxi",
        "Tomate Cereja",
        "Batata Doce",
        "Beterraba",
        "Pepino",
        "Abobrinha Italiana",
        "Chuchu",
        "Pimentao Verde",
        "Berinjela",
        "Alface Americana",
        "Couve Manteiga",
        "Coentro",
        "Salsa",
        "Cebolinha",
        "Rucula",
        "Agriao",
        "Brocolis",
    ]
    notes = [
        "Perda por avaria no recebimento.",
        "Descarte por dano visual na banca.",
        "Quebra operacional no manuseio.",
        "Retirada preventiva por perda de qualidade.",
        "Perda por vencimento identificado na conferencia.",
    ]

    for index, product_name in enumerate(loss_products):
        loss_days_ago = 45 - (index * 2)
        loss_amount = Decimal("1.000") + Decimal(index % 3)
        add_entry(
            movements,
            today,
            product_name,
            loss_days_ago + 1,
            loss_amount + Decimal("3.000"),
            cost_factor="1.04",
            note=f"Reserva para registrar perda operacional de {product_name}.",
        )
        add_loss(
            movements,
            today,
            product_name,
            max(loss_days_ago, 3),
            loss_amount,
            note=notes[index % len(notes)],
        )


def build_movements(today):
    movements = []
    generate_high_turnover(movements, today)
    generate_top_rank_products(movements, today)
    generate_normal_sales(movements, today)
    generate_expired_stock(movements, today)
    generate_upcoming_expiration(movements, today)
    generate_losses(movements, today)
    generate_current_stock(movements, today)
    return sorted(movements, key=lambda item: (item["data"], MOVEMENT_ORDER[item["kind"]], item["ordem"]))


def create_movements(client, products_by_name, today, headers_by_role):
    for movement in build_movements(today):
        payload = {
            "produto_id": products_by_name[movement["produto"]]["id"],
            "data": movement["data"].isoformat(),
            "quantidade": movement["quantidade"],
            "observacao": movement.get("observacao"),
        }

        if movement["kind"] == "entrada":
            endpoint = "/api/movimentacoes/entrada"
            payload["custo_unitario"] = movement["custo_unitario"]
            headers = headers_by_role["estoque"]
        else:
            endpoint = "/api/movimentacoes/saida"
            payload["subtipo"] = movement["subtipo"]
            headers = headers_by_role["caixa"] if movement["subtipo"] == "venda" else headers_by_role["estoque"]
            if movement["subtipo"] == "venda":
                payload["preco_unitario_venda"] = movement["preco_unitario_venda"]

        response = client.post(endpoint, json=payload, headers=headers)
        expect_status(response, 201, f"{movement['kind']} de {movement['produto']} em {payload['data']}")


def open_quantity(produto, today, only_sellable=False):
    total = Decimal("0")
    for camada in produto.camadas_estoque:
        if camada.quantidade_disponivel <= Decimal("0"):
            continue
        if only_sellable and camada.data_validade < today:
            continue
        total += camada.quantidade_disponivel
    return total


def low_stock_products(today):
    produtos = Produto.query.filter_by(ativo=True).all()
    return [
        produto
        for produto in produtos
        if open_quantity(produto, today, only_sellable=True) < produto.estoque_minimo
    ]


def idle_products(today):
    cutoff = today - timedelta(days=30)
    sale_product_ids = {
        produto_id
        for (produto_id,) in db.session.query(Movimentacao.produto_id)
        .filter(
            Movimentacao.tipo == TipoMovimentacao.SAIDA,
            Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
            Movimentacao.data >= cutoff,
        )
        .distinct()
        .all()
    }

    produtos = Produto.query.filter_by(ativo=True).all()
    return [
        produto
        for produto in produtos
        if produto.id not in sale_product_ids and open_quantity(produto, today, only_sellable=True) > Decimal("0")
    ]


def validate_product_balances():
    failures = []
    for produto in Produto.query.order_by(Produto.nome.asc()).all():
        camada_total = open_quantity(produto, date.today(), only_sellable=False)
        if produto.quantidade_atual != camada_total:
            failures.append(
                f"{produto.nome}: quantidade_atual={produto.quantidade_atual} camadas_abertas={camada_total}"
            )

    return failures


def build_summary(today):
    relatorio_service = RelatorioService(db.session, today_provider=lambda: today)
    financeiro = relatorio_service.financeiro()
    validade = relatorio_service.validade(3)
    mais_vendidos = relatorio_service.mais_vendidos(5)

    movimento_counts = Counter(
        {
            "entradas": Movimentacao.query.filter_by(tipo=TipoMovimentacao.ENTRADA).count(),
            "vendas": Movimentacao.query.filter_by(
                tipo=TipoMovimentacao.SAIDA,
                subtipo=SubtipoMovimentacao.VENDA,
            ).count(),
            "perdas": Movimentacao.query.filter_by(
                tipo=TipoMovimentacao.SAIDA,
                subtipo=SubtipoMovimentacao.PERDA,
            ).count(),
        }
    )

    summary = {
        "usuarios": Usuario.query.count(),
        "produtos_total": Produto.query.count(),
        "produtos_ativos": Produto.query.filter_by(ativo=True).count(),
        "movimentacoes_total": Movimentacao.query.count(),
        "entradas": movimento_counts["entradas"],
        "vendas": movimento_counts["vendas"],
        "perdas": movimento_counts["perdas"],
        "camadas_abertas": CamadaEstoque.query.filter(CamadaEstoque.quantidade_disponivel > 0).count(),
        "produtos_vencidos": len(validade["vencidos"]),
        "produtos_proximos_vencimento": len(validade["proximos_vencimento"]),
        "produtos_estoque_baixo": len(low_stock_products(today)),
        "produtos_parados": len(idle_products(today)),
        "financeiro": financeiro,
        "validade": validade,
        "mais_vendidos": mais_vendidos,
    }
    return summary


def validate_summary(summary):
    errors = []

    expectations = [
        (summary["produtos_total"] >= 35, "Seed deve criar pelo menos 35 produtos."),
        (summary["movimentacoes_total"] >= 300, "Seed deve criar pelo menos 300 movimentacoes."),
        (summary["vendas"] >= 150, "Seed deve criar pelo menos 150 vendas."),
        (summary["perdas"] >= 20, "Seed deve criar pelo menos 20 perdas."),
        (summary["produtos_vencidos"] > 0, "Seed deve criar produtos vencidos."),
        (
            summary["produtos_proximos_vencimento"] > 0,
            "Seed deve criar produtos proximos do vencimento.",
        ),
        (summary["produtos_estoque_baixo"] > 0, "Seed deve criar produtos com estoque baixo."),
        (summary["produtos_parados"] > 0, "Seed deve criar produtos parados."),
    ]

    for passed, message in expectations:
        if not passed:
            errors.append(message)

    errors.extend(validate_product_balances())

    if errors:
        formatted_errors = "\n".join(f"- {error}" for error in errors)
        raise RuntimeError(f"Validacao do seed falhou:\n{formatted_errors}")


def print_summary(summary):
    financeiro = summary["financeiro"]

    print("Banco populado com carga demonstrativa rica.")
    print(f"DATABASE_URL: {os.environ.get('DATABASE_URL', 'configuracao da aplicacao')}")
    print(f"Usuarios cadastrados: {summary['usuarios']}")
    print(f"Produtos ativos: {summary['produtos_ativos']}")
    print(f"Movimentacoes totais: {summary['movimentacoes_total']}")
    print(f"Entradas: {summary['entradas']}")
    print(f"Vendas: {summary['vendas']}")
    print(f"Perdas: {summary['perdas']}")
    print(f"Camadas abertas: {summary['camadas_abertas']}")
    print(f"Produtos vencidos: {summary['produtos_vencidos']}")
    print(f"Produtos proximos do vencimento: {summary['produtos_proximos_vencimento']}")
    print(f"Produtos com estoque baixo: {summary['produtos_estoque_baixo']}")
    print(f"Produtos parados: {summary['produtos_parados']}")
    print(f"Receita total: {financeiro['receita_total']:.2f}")
    print(f"Lucro bruto total: {financeiro['lucro_bruto_total']:.2f}")
    print(f"Custo total de perdas: {financeiro['perdas_total_custo']:.2f}")
    print("Top 5 mais vendidos:")
    for item in summary["mais_vendidos"]:
        print(
            f"- {item['produto_nome']}: {item['total_vendido']:.3f} "
            f"{item['unidade_medida']} | receita={item['receita_total']:.2f} "
            f"| lucro={item['lucro_bruto_total']:.2f}"
        )

    print("Credenciais de demo:")
    print("- admin@hortifruti.local / admin123 (gerente)")
    print("- gerente@hortifruti.local / demo123 (gerente)")
    print("- estoque@hortifruti.local / demo123 (funcionario)")
    print("- caixa@hortifruti.local / demo123 (funcionario)")


def seed_database(app=None, today=None, output=True):
    app = app or create_app()
    today = today or date.today()
    passwords_by_email = {user["email"]: user["senha"] for user in USUARIOS_PADRAO}

    with app.app_context():
        create_users()

        with app.test_client() as client:
            headers_by_role = {
                "admin": authorization_headers(
                    client,
                    "admin@hortifruti.local",
                    passwords_by_email["admin@hortifruti.local"],
                ),
                "estoque": authorization_headers(
                    client,
                    "estoque@hortifruti.local",
                    passwords_by_email["estoque@hortifruti.local"],
                ),
                "caixa": authorization_headers(
                    client,
                    "caixa@hortifruti.local",
                    passwords_by_email["caixa@hortifruti.local"],
                ),
            }

            products_by_name = create_products(client, headers_by_role["admin"])
            create_movements(client, products_by_name, today, headers_by_role)

        summary = build_summary(today)
        validate_summary(summary)

        if output:
            print_summary(summary)

        return summary


def main():
    ensure_database_url()
    return seed_database()


if __name__ == "__main__":
    main()
