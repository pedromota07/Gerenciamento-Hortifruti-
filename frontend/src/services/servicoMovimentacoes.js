import { requisitarApi } from "./api";

export function registrarEntrada(dadosMovimentacao) {
  return requisitarApi("/movimentacoes/entrada", {
    method: "POST",
    body: JSON.stringify(dadosMovimentacao)
  });
}

export function registrarSaida(dadosMovimentacao) {
  return requisitarApi("/movimentacoes/saida", {
    method: "POST",
    body: JSON.stringify(dadosMovimentacao)
  });
}

export function registrarVendaLote(dadosVenda) {
  return requisitarApi("/movimentacoes/venda-lote", {
    method: "POST",
    body: JSON.stringify(dadosVenda)
  });
}

export function buscarMovimentacoesPorProduto(id) {
  return requisitarApi(`/movimentacoes?produto_id=${id}`);
}
