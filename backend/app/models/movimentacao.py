from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .produto import _enum_values


class TipoMovimentacao(Enum):
    ENTRADA = "entrada"
    SAIDA = "saida"


class SubtipoMovimentacao(Enum):
    COMPRA = "compra"
    VENDA = "venda"
    PERDA = "perda"


class Movimentacao(db.Model):
    __tablename__ = "movimentacoes"
    __table_args__ = (
        CheckConstraint("quantidade > 0", name="ck_movimentacoes_quantidade_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    tipo: Mapped[TipoMovimentacao] = mapped_column(
        db.Enum(
            TipoMovimentacao,
            values_callable=_enum_values,
            native_enum=False,
            name="tipo_movimentacao_enum",
        ),
        nullable=False,
    )
    subtipo: Mapped[SubtipoMovimentacao | None] = mapped_column(
        db.Enum(
            SubtipoMovimentacao,
            values_callable=_enum_values,
            native_enum=False,
            name="subtipo_movimentacao_enum",
        ),
        nullable=True,
    )
    quantidade: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    custo_unitario: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    preco_unitario_venda: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    receita_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    custo_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    lucro_bruto: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        nullable=False,
    )

    produto = relationship("Produto", back_populates="movimentacoes")
    usuario = relationship("Usuario", back_populates="movimentacoes")
    camada_estoque = relationship("CamadaEstoque", back_populates="movimentacao_entrada", uselist=False)
    consumos_saida = relationship(
        "ConsumoSaida",
        back_populates="movimentacao_saida",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "produto_id": self.produto_id,
            "usuario_id": self.usuario_id,
            "tipo": self.tipo.value,
            "subtipo": self.subtipo.value if self.subtipo else None,
            "quantidade": float(self.quantidade),
            "custo_unitario": float(self.custo_unitario) if self.custo_unitario is not None else None,
            "preco_unitario_venda": float(self.preco_unitario_venda) if self.preco_unitario_venda is not None else None,
            "receita_total": float(self.receita_total) if self.receita_total is not None else None,
            "custo_total": float(self.custo_total) if self.custo_total is not None else None,
            "lucro_bruto": float(self.lucro_bruto) if self.lucro_bruto is not None else None,
            "data": self.data.isoformat() if self.data else None,
            "observacao": self.observacao,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
