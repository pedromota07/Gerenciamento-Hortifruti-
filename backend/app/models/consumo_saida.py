from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db


class ConsumoSaida(db.Model):
    __tablename__ = "consumos_saida"
    __table_args__ = (
        CheckConstraint("quantidade_consumida > 0", name="ck_consumos_saida_quantidade_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    movimentacao_saida_id: Mapped[int] = mapped_column(ForeignKey("movimentacoes.id"), nullable=False)
    camada_estoque_id: Mapped[int] = mapped_column(ForeignKey("camadas_estoque.id"), nullable=False)
    quantidade_consumida: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    custo_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    custo_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        nullable=False,
    )

    movimentacao_saida = relationship("Movimentacao", back_populates="consumos_saida")
    camada_estoque = relationship("CamadaEstoque", back_populates="consumos_saida")

    def to_dict(self):
        return {
            "id": self.id,
            "movimentacao_saida_id": self.movimentacao_saida_id,
            "camada_estoque_id": self.camada_estoque_id,
            "quantidade_consumida": float(self.quantidade_consumida),
            "custo_unitario": float(self.custo_unitario),
            "custo_total": float(self.custo_total),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
