import { apiFetch } from "./api";

function buildQueryString(filtros = {}) {
  return new URLSearchParams(
    Object.entries(filtros).reduce((accumulator, [key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        accumulator[key] = String(value);
      }

      return accumulator;
    }, {})
  ).toString();
}

export function getHistoricoGeral(filtros = {}) {
  const query = buildQueryString(filtros);

  return apiFetch(query ? `/movimentacoes?${query}` : "/movimentacoes");
}

export function getMaisVendidos(filtros = {}) {
  const normalizedFilters =
    typeof filtros === "number" ? { limite: filtros } : { limite: 10, ...filtros };
  const query = buildQueryString(normalizedFilters);

  return apiFetch(query ? `/relatorios/mais-vendidos?${query}` : "/relatorios/mais-vendidos");
}

export function getFinanceiro(filtros = {}) {
  const query = buildQueryString(filtros);

  return apiFetch(query ? `/relatorios/financeiro?${query}` : "/relatorios/financeiro");
}

export function getValidade(dias = 3) {
  return apiFetch(`/relatorios/validade?dias=${dias}`);
}
