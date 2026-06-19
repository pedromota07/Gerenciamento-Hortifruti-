import { requisitarApi } from "./api";

function montarConsulta(filtros = {}) {
  return new URLSearchParams(
    Object.entries(filtros).reduce((acumulador, [chave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== "") {
        acumulador[chave] = String(valor);
      }

      return acumulador;
    }, {})
  ).toString();
}

export function buscarHistoricoGeral(filtros = {}) {
  const consulta = montarConsulta(filtros);

  return requisitarApi(consulta ? `/movimentacoes?${consulta}` : "/movimentacoes");
}

export function buscarMaisVendidos(filtros = {}) {
  const filtrosNormalizados =
    typeof filtros === "number" ? { limite: filtros } : { limite: 10, ...filtros };
  const consulta = montarConsulta(filtrosNormalizados);

  return requisitarApi(consulta ? `/relatorios/mais-vendidos?${consulta}` : "/relatorios/mais-vendidos");
}

export function buscarFinanceiro(filtros = {}) {
  const consulta = montarConsulta(filtros);

  return requisitarApi(consulta ? `/relatorios/financeiro?${consulta}` : "/relatorios/financeiro");
}

export function buscarValidade(dias = 3) {
  return requisitarApi(`/relatorios/validade?dias=${dias}`);
}

export function buscarDashboardInteligente(filtros = {}) {
  const consulta = montarConsulta(filtros);

  return requisitarApi(
    consulta ? `/relatorios/dashboard-inteligente?${consulta}` : "/relatorios/dashboard-inteligente"
  );
}
