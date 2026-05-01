from datetime import date, datetime
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

    def _camadas_abertas(self):
        return [camada for camada in self.camadas_estoque if camada.quantidade_disponivel > Decimal("0")]

    def _quantidade_vencida(self, reference_date):
        return sum(
            (
                camada.quantidade_disponivel
                for camada in self._camadas_abertas()
                if camada.data_validade < reference_date
            ),
            Decimal("0"),
        )

    def _quantidade_disponivel_venda(self, reference_date):
        return sum(
            (
                camada.quantidade_disponivel
                for camada in self._camadas_abertas()
                if camada.data_validade >= reference_date
            ),
            Decimal("0"),
        )

    def _valor_estoque_custo(self):
        return sum(
            (camada.quantidade_disponivel * camada.custo_unitario for camada in self._camadas_abertas()),
            Decimal("0"),
        )

    def _valor_estoque_venda(self, reference_date):
        return sum(
            (
                camada.quantidade_disponivel * self.preco_venda_padrao
                for camada in self._camadas_abertas()
                if camada.data_validade >= reference_date
            ),
            Decimal("0"),
        )

    def _proxima_validade(self, reference_date):
        datas = [
            camada.data_validade
            for camada in self._camadas_abertas()
            if camada.data_validade >= reference_date
        ]
        return min(datas) if datas else None

    def to_dict(self):
        reference_date = date.today()
        quantidade_vencida = self._quantidade_vencida(reference_date)
        quantidade_disponivel_venda = self._quantidade_disponivel_venda(reference_date)
        proxima_validade = self._proxima_validade(reference_date)

        return {
            "id": self.id,
            "nome": self.nome,
            "categoria": self.categoria.value,
            "unidade_medida": self.unidade_medida.value,
            "estoque_minimo": float(self.estoque_minimo),
            "preco_venda_padrao": float(self.preco_venda_padrao),
            "validade_dias_padrao": self.validade_dias_padrao,
            "quantidade_atual": float(self.quantidade_atual),
            "quantidade_disponivel_venda": float(quantidade_disponivel_venda),
            "quantidade_vencida": float(quantidade_vencida),
            "proxima_validade": proxima_validade.isoformat() if proxima_validade else None,
            "valor_estoque_custo": float(self._valor_estoque_custo()),
            "valor_estoque_venda": float(self._valor_estoque_venda(reference_date)),
            "ativo": self.ativo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
