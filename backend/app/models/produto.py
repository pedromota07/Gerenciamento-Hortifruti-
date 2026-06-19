from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import DateTime, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db


def _enum_values(enum_class):
    return [member.value for member in enum_class]


class CategoriaProduto(Enum):
    FRUTA = "fruta"
    LEGUME = "legume"
    VERDURA = "verdura"


class UnidadeMedida(Enum):
    KG = "kg"
    UN = "un"
    CX = "cx"


class Produto(db.Model):
    __tablename__ = "produtos"
    __table_args__ = (
        UniqueConstraint("nome", "categoria", name="uq_produtos_nome_categoria"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    categoria: Mapped[CategoriaProduto] = mapped_column(
        db.Enum(
            CategoriaProduto,
            values_callable=_enum_values,
            native_enum=False,
            name="categoria_produto_enum",
        ),
        nullable=False,
    )
    unidade_medida: Mapped[UnidadeMedida] = mapped_column(
        db.Enum(
            UnidadeMedida,
            values_callable=_enum_values,
            native_enum=False,
            name="unidade_medida_enum",
        ),
        nullable=False,
    )
    estoque_minimo: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    preco_venda_padrao: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0.00",
    )
    validade_dias_padrao: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
        server_default="1",
    )
    quantidade_atual: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    ativo: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    movimentacoes = relationship("Movimentacao", back_populates="produto")
    camadas_estoque = relationship(
        "CamadaEstoque",
        back_populates="produto",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self):
        from ..serializers.produto import serialize_produto

        return serialize_produto(self)
