import { requisitarApi } from "./api";
import { obterUsuarioIdAutenticado } from "./authStorage";

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

export function buscarMovimentacoesPorProduto(id) {
  return requisitarApi(`/movimentacoes?produto_id=${id}`);
}
