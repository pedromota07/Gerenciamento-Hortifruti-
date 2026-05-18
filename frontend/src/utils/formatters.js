export function formatarQuantidade(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

const rotulosUnidade = {
  kg: "kg",
  un: "un",
  cx: "cx"
};

export function formatarQuantidadeComUnidade(valor, unidadeMedida) {
  const unidade = rotulosUnidade[unidadeMedida] ?? unidadeMedida ?? "";
  const quantidade = formatarQuantidade(valor);

  return unidade ? `${quantidade} ${unidade}` : quantidade;
}

export function formatarMoeda(valor, opcoes = {}) {
  if (opcoes.exibirVazio && valor == null) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(valor ?? 0));
}

export function formatarData(valor) {
  if (!valor) {
    return "-";
  }

  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
}
