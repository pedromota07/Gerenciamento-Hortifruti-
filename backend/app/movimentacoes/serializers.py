from ..serializers.produto import serialize_produto


def serialize_movimentacao_result(result):
    payload = {
        "movimentacao": result.movimentacao.to_dict(),
        "produto": serialize_produto(result.produto),
    }

    if result.camada_estoque is not None:
        payload["camada_estoque"] = result.camada_estoque.to_dict()
    if result.consumos_saida:
        payload["consumos_saida"] = [consumo.to_dict() for consumo in result.consumos_saida]

    return payload
