import { apiFetch } from "./api";

export function getProdutos() {
  return apiFetch("/produtos");
}

export function criarProduto(payload) {
  return apiFetch("/produtos", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function postEntrada(payload) {
  return apiFetch("/movimentacoes/entrada", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function postSaida(payload) {
  return apiFetch("/movimentacoes/saida", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getProdutoById(id) {
  return apiFetch(`/produtos/${id}`);
}

export function getMovimentacoesPorProduto(id) {
  return apiFetch(`/movimentacoes?produto_id=${id}`);
}

export function getCamadasPorProduto(id) {
  return apiFetch(`/produtos/${id}/camadas`);
}
