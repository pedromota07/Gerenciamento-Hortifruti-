export function formatarQuantidade(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatarMoeda(valor, opcoes = {}) {
  if (opcoes.exibirVazio && valor == null) {
    return "-";
  }

  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatarData(valor) {
  if (!valor) {
    return "-";
  }

  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
}
