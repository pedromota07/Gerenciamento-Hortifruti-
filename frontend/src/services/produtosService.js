import { requisitarApi } from "./api";

export function buscarProdutos() {
  return requisitarApi("/produtos");
}

export function criarProduto(dadosProduto) {
  return requisitarApi("/produtos", {
    method: "POST",
    body: JSON.stringify(dadosProduto)
  });
}

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

export function buscarProdutoPorId(id) {
  return requisitarApi(`/produtos/${id}`);
}

export function buscarMovimentacoesPorProduto(id) {
  return requisitarApi(`/movimentacoes?produto_id=${id}`);
}

export function buscarCamadasPorProduto(id) {
  return requisitarApi(`/produtos/${id}/camadas`);
}
