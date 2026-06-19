from datetime import date
from decimal import Decimal


def _camadas_abertas(produto):
    return [camada for camada in produto.camadas_estoque if camada.quantidade_disponivel > Decimal("0")]


def _quantidade_vencida(produto, reference_date):
    return sum(
        (
            camada.quantidade_disponivel
            for camada in _camadas_abertas(produto)
            if camada.data_validade < reference_date
        ),
        Decimal("0"),
    )


def _quantidade_disponivel_venda(produto, reference_date):
    return sum(
        (
            camada.quantidade_disponivel
            for camada in _camadas_abertas(produto)
            if camada.data_validade >= reference_date
        ),
        Decimal("0"),
    )


def _valor_estoque_custo(produto):
    return sum(
        (camada.quantidade_disponivel * camada.custo_unitario for camada in _camadas_abertas(produto)),
        Decimal("0"),
    )


def _valor_estoque_venda(produto, reference_date):
    return sum(
        (
            camada.quantidade_disponivel * produto.preco_venda_padrao
            for camada in _camadas_abertas(produto)
            if camada.data_validade >= reference_date
        ),
        Decimal("0"),
    )


def _proxima_validade(produto, reference_date):
    datas = [
        camada.data_validade
        for camada in _camadas_abertas(produto)
        if camada.data_validade >= reference_date
    ]
    return min(datas) if datas else None


def serialize_produto(produto, reference_date=None):
    reference_date = reference_date or date.today()
    quantidade_vencida = _quantidade_vencida(produto, reference_date)
    quantidade_disponivel_venda = _quantidade_disponivel_venda(produto, reference_date)
    proxima_validade = _proxima_validade(produto, reference_date)

    return {
        "id": produto.id,
        "nome": produto.nome,
        "categoria": produto.categoria.value,
        "unidade_medida": produto.unidade_medida.value,
        "estoque_minimo": float(produto.estoque_minimo),
        "preco_venda_padrao": float(produto.preco_venda_padrao),
        "validade_dias_padrao": produto.validade_dias_padrao,
        "quantidade_atual": float(produto.quantidade_atual),
        "quantidade_disponivel_venda": float(quantidade_disponivel_venda),
        "quantidade_vencida": float(quantidade_vencida),
        "proxima_validade": proxima_validade.isoformat() if proxima_validade else None,
        "valor_estoque_custo": float(_valor_estoque_custo(produto)),
        "valor_estoque_venda": float(_valor_estoque_venda(produto, reference_date)),
        "ativo": produto.ativo,
        "created_at": produto.created_at.isoformat() if produto.created_at else None,
        "updated_at": produto.updated_at.isoformat() if produto.updated_at else None,
    }
