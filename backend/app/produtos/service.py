from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import CamadaEstoque, CategoriaProduto, Produto, UnidadeMedida
from ..shared.errors import DomainError


class ProdutoService:
    def __init__(self, session):
        self.session = session

    def listar(self):
        statement = select(Produto).order_by(Produto.nome.asc(), Produto.id.asc())
        return list(self.session.execute(statement).scalars())

    def buscar(self, produto_id):
        produto = self.session.get(Produto, produto_id)
        if produto is None:
            raise DomainError("Produto não encontrado.", 404)
        return produto

    def listar_camadas_abertas(self, produto_id):
        self.buscar(produto_id)

        statement = (
            select(CamadaEstoque)
            .where(
                CamadaEstoque.produto_id == produto_id,
                CamadaEstoque.quantidade_disponivel > Decimal("0"),
            )
            .order_by(
                CamadaEstoque.data_validade.asc(),
                CamadaEstoque.data_entrada.asc(),
                CamadaEstoque.id.asc(),
            )
        )
        return list(self.session.execute(statement).scalars())

    def criar(self, data):
        produto = self._apply_data(Produto(), data)
        self.session.add(produto)
        return self._commit(produto)

    def atualizar(self, produto_id, data):
        produto = self.buscar(produto_id)
        self._apply_data(produto, data)
        return self._commit(produto)

    def inativar(self, produto_id):
        produto = self.buscar(produto_id)
        produto.ativo = False
        return self._commit(produto)

    def _apply_data(self, produto, data):
        if "nome" in data:
            produto.nome = data["nome"]
        if "categoria" in data:
            produto.categoria = CategoriaProduto(data["categoria"])
        if "unidade_medida" in data:
            produto.unidade_medida = UnidadeMedida(data["unidade_medida"])
        if "estoque_minimo" in data:
            produto.estoque_minimo = data["estoque_minimo"]
        if "preco_venda_padrao" in data:
            produto.preco_venda_padrao = data["preco_venda_padrao"]
        if "validade_dias_padrao" in data:
            produto.validade_dias_padrao = data["validade_dias_padrao"]
        if "ativo" in data:
            produto.ativo = data["ativo"]

        return produto

    def _commit(self, produto):
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            raise DomainError("Já existe produto com o mesmo nome e categoria.", 409)

        return produto
