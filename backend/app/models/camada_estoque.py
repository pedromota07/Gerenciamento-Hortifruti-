from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db


class CamadaEstoque(db.Model):
    __tablename__ = "camadas_estoque"
    __table_args__ = (
        CheckConstraint("quantidade_inicial > 0", name="ck_camadas_estoque_quantidade_inicial_positiva"),
        CheckConstraint("quantidade_disponivel >= 0", name="ck_camadas_estoque_quantidade_disponivel_nao_negativa"),
        CheckConstraint(
            "quantidade_disponivel <= quantidade_inicial",
            name="ck_camadas_estoque_quantidade_disponivel_lte_inicial",
        ),
        Index("ix_camadas_estoque_produto_validade", "produto_id", "data_validade"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"), nullable=False)
    movimentacao_entrada_id: Mapped[int] = mapped_column(
        ForeignKey("movimentacoes.id"),
        nullable=False,
        unique=True,
    )
    quantidade_inicial: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    quantidade_disponivel: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    custo_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    data_entrada: Mapped[date] = mapped_column(Date, nullable=False)
    data_validade: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        nullable=False,
    )

    produto = relationship("Produto", back_populates="camadas_estoque")
    movimentacao_entrada = relationship("Movimentacao", back_populates="camada_estoque")
    consumos_saida = relationship(
        "ConsumoSaida",
        back_populates="camada_estoque",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "produto_id": self.produto_id,
            "movimentacao_entrada_id": self.movimentacao_entrada_id,
            "quantidade_inicial": float(self.quantidade_inicial),
            "quantidade_disponivel": float(self.quantidade_disponivel),
            "custo_unitario": float(self.custo_unitario),
            "data_entrada": self.data_entrada.isoformat() if self.data_entrada else None,
            "data_validade": self.data_validade.isoformat() if self.data_validade else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
