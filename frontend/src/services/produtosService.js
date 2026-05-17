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

function obterUsuarioIdAutenticado() {
  if (typeof window === "undefined") {
    return null;
  }

  const usuarioSalvo = localStorage.getItem("usuario");
  if (!usuarioSalvo) {
    return null;
  }

  try {
    return JSON.parse(usuarioSalvo)?.id ?? null;
  } catch {
    return null;
  }
}

function incluirUsuarioAutenticado(dadosMovimentacao) {
  const usuarioId = obterUsuarioIdAutenticado();

  if (!usuarioId || dadosMovimentacao.usuario_id) {
    return dadosMovimentacao;
  }

  return {
    ...dadosMovimentacao,
    usuario_id: usuarioId
  };
}

export function registrarEntrada(dadosMovimentacao) {
  return requisitarApi("/movimentacoes/entrada", {
    method: "POST",
    body: JSON.stringify(incluirUsuarioAutenticado(dadosMovimentacao))
  });
}

export function registrarSaida(dadosMovimentacao) {
  return requisitarApi("/movimentacoes/saida", {
    method: "POST",
    body: JSON.stringify(incluirUsuarioAutenticado(dadosMovimentacao))
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
