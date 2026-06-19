from datetime import date
from decimal import Decimal

from app.models import CamadaEstoque, Produto
from scripts.seed_showcase import LOW_STOCK_PRODUCTS, idle_products, low_stock_products, seed_database


def test_seed_showcase_gera_base_rica_para_dashboard(app):
    summary = seed_database(app=app, output=False)

    assert summary["usuarios"] == 5
    assert summary["produtos_total"] == 42
    assert summary["produtos_ativos"] == 40
    assert summary["movimentacoes_total"] >= 300
    assert summary["vendas"] >= 150
    assert summary["perdas"] >= 20
    assert summary["produtos_vencidos"] >= 3
    assert summary["produtos_proximos_vencimento"] >= 5
    assert summary["produtos_estoque_baixo"] >= 3
    assert summary["produtos_parados"] >= 5

    assert summary["financeiro"]["receita_total"] > 0
    assert summary["financeiro"]["lucro_bruto_total"] > 0
    assert summary["financeiro"]["perdas_total_custo"] > 0

    top_names = [item["produto_nome"] for item in summary["mais_vendidos"]]
    assert top_names == [
        "Banana Nanica",
        "Tomate Italiano",
        "Alface Crespa",
        "Batata Inglesa",
        "Laranja Pera",
    ]

    low_stock_names = {produto.nome for produto in low_stock_products(date.today())}
    assert LOW_STOCK_PRODUCTS.issubset(low_stock_names)

    idle_names = {produto.nome for produto in idle_products(date.today())}
    assert {"Alho", "Cebola", "Mandioca", "Inhame", "Pera Williams"}.issubset(idle_names)

    for produto in Produto.query.order_by(Produto.nome.asc()).all():
        quantidade_camadas = sum(
            (
                camada.quantidade_disponivel
                for camada in CamadaEstoque.query.filter_by(produto_id=produto.id).all()
                if camada.quantidade_disponivel > Decimal("0")
            ),
            Decimal("0"),
        )
        assert produto.quantidade_atual == quantidade_camadas
