"""Add value, validity and FEFO foundation

Revision ID: 5e2d3f4a6b7c
Revises: 2ff02cf4e26c
Create Date: 2026-04-06 21:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5e2d3f4a6b7c"
down_revision = "2ff02cf4e26c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "produtos",
        sa.Column("preco_venda_padrao", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "produtos",
        sa.Column("validade_dias_padrao", sa.Integer(), server_default="1", nullable=False),
    )

    op.add_column("movimentacoes", sa.Column("custo_unitario", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column(
        "movimentacoes",
        sa.Column("preco_unitario_venda", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column("movimentacoes", sa.Column("receita_total", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("movimentacoes", sa.Column("custo_total", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("movimentacoes", sa.Column("lucro_bruto", sa.Numeric(precision=12, scale=2), nullable=True))

    op.create_table(
        "camadas_estoque",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("produto_id", sa.Integer(), nullable=False),
        sa.Column("movimentacao_entrada_id", sa.Integer(), nullable=False),
        sa.Column("quantidade_inicial", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("quantidade_disponivel", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("custo_unitario", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("data_entrada", sa.Date(), nullable=False),
        sa.Column("data_validade", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("quantidade_inicial > 0", name="ck_camadas_estoque_quantidade_inicial_positiva"),
        sa.CheckConstraint(
            "quantidade_disponivel >= 0",
            name="ck_camadas_estoque_quantidade_disponivel_nao_negativa",
        ),
        sa.CheckConstraint(
            "quantidade_disponivel <= quantidade_inicial",
            name="ck_camadas_estoque_quantidade_disponivel_lte_inicial",
        ),
        sa.ForeignKeyConstraint(["movimentacao_entrada_id"], ["movimentacoes.id"]),
        sa.ForeignKeyConstraint(["produto_id"], ["produtos.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("movimentacao_entrada_id"),
    )
    op.create_index(
        "ix_camadas_estoque_produto_validade",
        "camadas_estoque",
        ["produto_id", "data_validade"],
        unique=False,
    )

    op.create_table(
        "consumos_saida",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("movimentacao_saida_id", sa.Integer(), nullable=False),
        sa.Column("camada_estoque_id", sa.Integer(), nullable=False),
        sa.Column("quantidade_consumida", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("custo_unitario", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("custo_total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("quantidade_consumida > 0", name="ck_consumos_saida_quantidade_positiva"),
        sa.ForeignKeyConstraint(["camada_estoque_id"], ["camadas_estoque.id"]),
        sa.ForeignKeyConstraint(["movimentacao_saida_id"], ["movimentacoes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("consumos_saida")
    op.drop_index("ix_camadas_estoque_produto_validade", table_name="camadas_estoque")
    op.drop_table("camadas_estoque")

    op.drop_column("movimentacoes", "lucro_bruto")
    op.drop_column("movimentacoes", "custo_total")
    op.drop_column("movimentacoes", "receita_total")
    op.drop_column("movimentacoes", "preco_unitario_venda")
    op.drop_column("movimentacoes", "custo_unitario")

    op.drop_column("produtos", "validade_dias_padrao")
    op.drop_column("produtos", "preco_venda_padrao")
