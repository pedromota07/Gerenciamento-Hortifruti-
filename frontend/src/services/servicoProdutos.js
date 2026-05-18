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

export function buscarProdutoPorId(id) {
  return requisitarApi(`/produtos/${id}`);
}

export function buscarCamadasPorProduto(id) {
  return requisitarApi(`/produtos/${id}/camadas`);
}
