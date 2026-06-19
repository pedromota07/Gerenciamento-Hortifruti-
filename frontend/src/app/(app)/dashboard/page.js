"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";

import EstadoVazio from "@/components/EstadoVazio";
import ProdutoVisual from "@/components/ProdutoVisual";
import { buscarDashboardInteligente } from "@/services/servicoRelatorios";
import { formatarData, formatarMoeda, formatarQuantidade, formatarQuantidadeComUnidade } from "@/utils/formatters";

import styles from "./page.module.css";

const ITENS_POR_PAGINA_PRIORIDADES = 8;
const LIMITE_LISTA = 6;

function formatarDataIso(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterPeriodoInicial() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 29);

  return {
    data_inicial: formatarDataIso(inicio),
    data_final: formatarDataIso(hoje),
    dias_previsao: 7,
    dias_validade: 3,
    limite: 10
  };
}

function obterPeriodoRapido(tipo) {
  const hoje = new Date();
  const inicio = new Date(hoje);

  if (tipo === "7d") {
    inicio.setDate(hoje.getDate() - 6);
  } else if (tipo === "mes") {
    inicio.setDate(1);
  } else {
    inicio.setDate(hoje.getDate() - 29);
  }

  return {
    data_inicial: formatarDataIso(inicio),
    data_final: formatarDataIso(hoje)
  };
}

function formatarPercentual(valor) {
  return `${formatarQuantidade(valor)}%`;
}

function formatarCobertura(valor) {
  if (valor === null || valor === undefined) {
    return "Sem historico";
  }

  return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia(s)`;
}

function obterRotuloPrioridade(prioridade) {
  return {
    critica: "Critica",
    alta: "Alta",
    media: "Media",
    baixa: "Baixa"
  }[prioridade] ?? "Baixa";
}

function obterClassePrioridade(prioridade) {
  return {
    critica: styles.prioridadeCritica,
    alta: styles.prioridadeAlta,
    media: styles.prioridadeMedia,
    baixa: styles.prioridadeBaixa
  }[prioridade] ?? styles.prioridadeBaixa;
}

function obterDestinoAcao(item) {
  if (["estoque_baixo", "ruptura_prevista"].includes(item?.tipo)) {
    return "/estoque";
  }

  if (["validade_vencida", "validade_proxima", "perda_alta"].includes(item?.tipo)) {
    return "/relatorios";
  }

  return item?.produto_id ? `/produtos/${item.produto_id}` : "/relatorios";
}

function SecaoVazia({ icone, titulo, descricao }) {
  return <EstadoVazio icone={icone} titulo={titulo} descricao={descricao} />;
}

export default function PaginaPainel() {
  const [dashboard, setDashboard] = useState(null);
  const [filtros, setFiltros] = useState(obterPeriodoInicial);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [paginaPrioridades, setPaginaPrioridades] = useState(0);

  const carregarPainel = useCallback(async (proximosFiltros = filtros) => {
    setCarregando(true);
    setMensagem(null);
    setPaginaPrioridades(0);

    try {
      const dados = await buscarDashboardInteligente(proximosFiltros);
      setDashboard(dados);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarPainel(filtros);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function atualizarFiltro(campo, valor) {
    setFiltros((filtrosAtuais) => ({
      ...filtrosAtuais,
      [campo]: valor
    }));
  }

  async function aplicarPeriodoRapido(tipo) {
    const proximosFiltros = { ...filtros, ...obterPeriodoRapido(tipo) };
    setFiltros(proximosFiltros);
    await carregarPainel(proximosFiltros);
  }

  const kpis = dashboard?.kpis ?? {};
  const saude = dashboard?.saude_operacional ?? {};
  const resumoExecutivo = dashboard?.resumo_executivo ?? [];
  const prioridades = dashboard?.prioridades_hoje ?? [];
  const sugestoesReposicao = dashboard?.sugestoes_reposicao ?? [];
  const riscoValidade = dashboard?.risco_validade ?? {};
  const produtosParados = dashboard?.produtos_parados ?? [];
  const analiseMargem = dashboard?.analise_margem ?? [];
  const analisePerdas = dashboard?.analise_perdas ?? [];
  const maisVendidos = dashboard?.mais_vendidos ?? [];
  const series = dashboard?.series_graficos ?? {};
  const vendasPorDia = series.vendas_por_dia ?? [];
  const alertasPorTipo = series.alertas_por_tipo ?? [];
  const perdasPorTipo = series.perdas_por_tipo ?? [];
  const totalPaginasPrioridades = Math.max(Math.ceil(prioridades.length / ITENS_POR_PAGINA_PRIORIDADES), 1);
  const indiceInicialPrioridades = paginaPrioridades * ITENS_POR_PAGINA_PRIORIDADES;
  const prioridadesVisiveis = prioridades.slice(
    indiceInicialPrioridades,
    indiceInicialPrioridades + ITENS_POR_PAGINA_PRIORIDADES
  );
  const maiorReceitaSerie = useMemo(
    () => Math.max(...vendasPorDia.map((item) => Number(item.receita_total ?? 0)), 1),
    [vendasPorDia]
  );

  const indicadores = useMemo(
    () => [
      {
        rotulo: "Receita",
        valor: formatarMoeda(kpis.receita_total),
        detalhe: "Periodo analisado",
        icone: "pi pi-wallet",
        tom: "primary"
      },
      {
        rotulo: "Lucro bruto",
        valor: formatarMoeda(kpis.lucro_bruto_total),
        detalhe: "Resultado antes das despesas",
        icone: "pi pi-chart-line",
        tom: "healthy"
      },
      {
        rotulo: "Margem",
        valor: formatarPercentual(kpis.margem_lucro_percentual),
        detalhe: "Lucro sobre receita",
        icone: "pi pi-percentage",
        tom: "neutral"
      },
      {
        rotulo: "Estoque",
        valor: formatarMoeda(kpis.valor_estoque_custo),
        detalhe: "Valor a custo",
        icone: "pi pi-box",
        tom: "neutral"
      },
      {
        rotulo: "Perdas",
        valor: formatarMoeda(kpis.perdas_total_custo),
        detalhe: "Custo no periodo",
        icone: "pi pi-arrow-down-right",
        tom: "danger"
      },
      {
        rotulo: "Alertas criticos",
        valor: kpis.alertas_criticos ?? 0,
        detalhe: `${kpis.alertas_total ?? 0} alertas totais`,
        icone: "pi pi-exclamation-triangle",
        tom: (kpis.alertas_criticos ?? 0) > 0 ? "warning" : "healthy"
      }
    ],
    [kpis]
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Regras + decisao</span>
          <h1>Dashboard Orientado a Decisao</h1>
          <p>Prioridades, riscos e recomendacoes automaticas da operacao.</p>
        </div>

        <div className={styles.headerActions}>
          <Button
            label="Atualizar"
            icon="pi pi-refresh"
            outlined
            loading={carregando}
            onClick={() => carregarPainel(filtros)}
          />
          <Link className={styles.primaryAction} href="/pdv">
            <i className="pi pi-shopping-cart" aria-hidden="true" />
            Nova venda
          </Link>
        </div>
      </header>

      <section className={styles.filterPanel} aria-label="Filtros do dashboard">
        <div className={styles.quickPeriods}>
          <span>Periodo rapido</span>
          <Button label="7 dias" text size="small" onClick={() => aplicarPeriodoRapido("7d")} />
          <Button label="30 dias" text size="small" onClick={() => aplicarPeriodoRapido("30d")} />
          <Button label="Este mes" text size="small" onClick={() => aplicarPeriodoRapido("mes")} />
        </div>
        <div className={styles.filterGrid}>
          <label>
            Data inicial
            <InputText
              type="date"
              value={filtros.data_inicial}
              onChange={(evento) => atualizarFiltro("data_inicial", evento.target.value)}
              disabled={carregando}
            />
          </label>
          <label>
            Data final
            <InputText
              type="date"
              value={filtros.data_final}
              onChange={(evento) => atualizarFiltro("data_final", evento.target.value)}
              disabled={carregando}
            />
          </label>
          <label>
            Dias previsao
            <InputNumber
              min={1}
              useGrouping={false}
              value={filtros.dias_previsao}
              onValueChange={(evento) => atualizarFiltro("dias_previsao", evento.value ?? 7)}
              disabled={carregando}
            />
          </label>
          <label>
            Dias validade
            <InputNumber
              min={1}
              useGrouping={false}
              value={filtros.dias_validade}
              onValueChange={(evento) => atualizarFiltro("dias_validade", evento.value ?? 3)}
              disabled={carregando}
            />
          </label>
          <Button label="Aplicar" icon="pi pi-filter" onClick={() => carregarPainel(filtros)} loading={carregando} />
        </div>
      </section>

      {mensagem ? (
        <div className={styles.feedback}>
          <Message severity={mensagem.severity} text={mensagem.text} />
          <Button label="Tentar novamente" icon="pi pi-refresh" text onClick={() => carregarPainel(filtros)} />
        </div>
      ) : null}

      <section className={`${styles.healthPanel} ${styles[`health_${saude.classificacao ?? "saudavel"}`]}`}>
        {carregando ? (
          <div className={styles.rowSkeleton} />
        ) : (
          <>
            <div className={styles.healthScore}>
              <span>Saude operacional</span>
              <strong>{saude.score ?? 0}</strong>
              <small>{saude.classificacao ?? "saudavel"}</small>
            </div>
            <div className={styles.healthCopy}>
              <h2>{saude.mensagem}</h2>
              <p>
                {kpis.alertas_criticos ?? 0} alerta(s) critico(s), {kpis.produtos_vencidos ?? 0} produto(s)
                vencido(s), {kpis.produtos_estoque_baixo ?? 0} produto(s) com estoque baixo.
              </p>
            </div>
          </>
        )}
      </section>

      <section className={styles.metrics} aria-label="Indicadores principais" aria-live="polite">
        {carregando
          ? Array.from({ length: 6 }, (_, indice) => <div className={styles.metricSkeleton} key={indice} />)
          : indicadores.map((indicador) => (
              <article className={`${styles.metricCard} ${styles[`metric_${indicador.tom}`]}`} key={indicador.rotulo}>
                <div className={styles.metricTop}>
                  <span>{indicador.rotulo}</span>
                  <i className={indicador.icone} aria-hidden="true" />
                </div>
                <strong>{indicador.valor}</strong>
                <small>{indicador.detalhe}</small>
              </article>
            ))}
      </section>

      <section className={styles.executivePanel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.eyebrow}>Resumo executivo</span>
            <h2>O que o gerente precisa fazer hoje</h2>
            <p>Frases geradas pelo backend a partir de estoque, giro, margem, perdas e validade.</p>
          </div>
        </div>

        {carregando ? (
          <div className={styles.summarySkeletons}>
            {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
          </div>
        ) : resumoExecutivo.length === 0 ? (
          <SecaoVazia icone="pi pi-check" titulo="Sem recomendacoes no periodo." descricao="Nao ha alertas relevantes para resumir agora." />
        ) : (
          <ul className={styles.summaryList}>
            {resumoExecutivo.map((item, indice) => (
              <li key={`${item.tipo}-${indice}`}>
                <span className={`${styles.priorityTag} ${obterClassePrioridade(item.prioridade)}`}>
                  {obterRotuloPrioridade(item.prioridade)}
                </span>
                <strong>{item.mensagem}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.attentionPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Prioridades de hoje</span>
              <h2>Problemas ordenados por risco</h2>
              <p>Cada alerta vem com causa, acao sugerida e impacto estimado.</p>
            </div>
            {!carregando ? (
              <span className={`${styles.alertCounter} ${prioridades.length === 0 ? styles.alertCounterHealthy : ""}`}>
                {prioridades.length}
              </span>
            ) : null}
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 4 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : prioridades.length === 0 ? (
            <SecaoVazia
              icone="pi pi-check"
              titulo="Nenhuma prioridade para resolver agora."
              descricao="O backend nao encontrou alertas no periodo analisado."
            />
          ) : (
            <>
              <div className={styles.decisionList}>
                {prioridadesVisiveis.map((item, indice) => (
                  <article className={styles.decisionItem} key={`${item.tipo}-${item.produto_id}-${indice}`}>
                    <ProdutoVisual nome={item.produto_nome} categoria={item.metricas?.categoria} />
                    <div className={styles.decisionContent}>
                      <div>
                        <strong>{item.produto_nome}</strong>
                        <span className={`${styles.priorityTag} ${obterClassePrioridade(item.prioridade)}`}>
                          {obterRotuloPrioridade(item.prioridade)} | {item.pontuacao}
                        </span>
                      </div>
                      <p>{item.mensagem}</p>
                      <small><b>Causa:</b> {item.causa}</small>
                      <small><b>Acao:</b> {item.acao_sugerida}</small>
                      <small><b>Impacto:</b> {item.impacto_estimado}</small>
                    </div>
                    <Link className={styles.rowAction} href={obterDestinoAcao(item)} aria-label={`Abrir ${item.produto_nome}`}>
                      <i className="pi pi-arrow-right" aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>

              {prioridades.length > ITENS_POR_PAGINA_PRIORIDADES ? (
                <div className={styles.listFooter}>
                  <span>
                    Mostrando {indiceInicialPrioridades + 1}-{indiceInicialPrioridades + prioridadesVisiveis.length} de {prioridades.length}
                  </span>
                  <div className={styles.carouselControls} aria-label="Paginacao das prioridades">
                    <Button
                      icon="pi pi-angle-left"
                      text
                      rounded
                      disabled={paginaPrioridades === 0}
                      aria-label="Pagina anterior"
                      onClick={() => setPaginaPrioridades((paginaAtual) => Math.max(paginaAtual - 1, 0))}
                    />
                    <strong>{paginaPrioridades + 1} / {totalPaginasPrioridades}</strong>
                    <Button
                      icon="pi pi-angle-right"
                      text
                      rounded
                      disabled={paginaPrioridades >= totalPaginasPrioridades - 1}
                      aria-label="Proxima pagina"
                      onClick={() => setPaginaPrioridades((paginaAtual) => Math.min(paginaAtual + 1, totalPaginasPrioridades - 1))}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className={styles.recommendationPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Reposicao inteligente</span>
              <h2>Comprar com prioridade</h2>
              <p>Sugestao baseada em media diaria, estoque vendavel e cobertura desejada.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : sugestoesReposicao.length === 0 ? (
            <SecaoVazia
              icone="pi pi-shopping-bag"
              titulo="Nenhuma reposicao sugerida."
              descricao="Nao ha produto com giro suficiente e baixa cobertura no periodo."
            />
          ) : (
            <div className={styles.repositionList}>
              {sugestoesReposicao.slice(0, LIMITE_LISTA).map((produto) => (
                <article className={styles.repositionItem} key={produto.produto_id}>
                  <div>
                    <strong>{produto.produto_nome}</strong>
                    <span className={`${styles.priorityTag} ${obterClassePrioridade(produto.prioridade)}`}>
                      {obterRotuloPrioridade(produto.prioridade)}
                    </span>
                  </div>
                  <p>Sugerido: {formatarQuantidadeComUnidade(produto.quantidade_sugerida, produto.unidade_medida)}</p>
                  <small>Media: {formatarQuantidadeComUnidade(produto.media_venda_diaria, produto.unidade_medida)}/dia</small>
                  <small>Cobertura: {formatarCobertura(produto.dias_cobertura)}</small>
                  <small>{produto.justificativa}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Risco de validade</span>
              <h2>Vencidos e proximos</h2>
              <p>{riscoValidade.acao_geral_sugerida ?? "Sem acao emergencial de validade."}</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : (riscoValidade.vencidos?.length ?? 0) === 0 && (riscoValidade.proximos_vencimento?.length ?? 0) === 0 ? (
            <SecaoVazia icone="pi pi-calendar" titulo="Nenhum risco de validade." descricao="Nao ha produtos vencidos ou proximos do vencimento." />
          ) : (
            <div className={styles.compactList}>
              {[...(riscoValidade.vencidos ?? []), ...(riscoValidade.proximos_vencimento ?? [])].slice(0, LIMITE_LISTA).map((produto) => (
                <article className={styles.compactItem} key={`${produto.data_validade}-${produto.produto_id}`}>
                  <strong>{produto.produto_nome}</strong>
                  <span>{formatarQuantidadeComUnidade(produto.quantidade_em_risco, produto.unidade_medida)}</span>
                  <small>{formatarMoeda(produto.valor_em_risco)} em risco | {formatarData(produto.data_validade)}</small>
                  <small>{produto.acao_sugerida}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Produtos parados</span>
              <h2>Baixo giro</h2>
              <p>Itens ativos com estoque e pouca ou nenhuma venda recente.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : produtosParados.length === 0 ? (
            <SecaoVazia icone="pi pi-clock" titulo="Nenhum produto parado." descricao="Todos os itens com estoque tiveram giro aceitavel." />
          ) : (
            <div className={styles.compactList}>
              {produtosParados.slice(0, LIMITE_LISTA).map((produto) => (
                <article className={styles.compactItem} key={produto.produto_id}>
                  <strong>{produto.produto_nome}</strong>
                  <span>{formatarQuantidadeComUnidade(produto.estoque_atual, produto.unidade_medida)}</span>
                  <small>{formatarMoeda(produto.valor_parado_custo)} parado</small>
                  <small>{produto.acao_sugerida}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Margem e perdas</span>
              <h2>Financeiro acionavel</h2>
              <p>Produtos vendidos com margem baixa e itens que concentraram perdas.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : analiseMargem.length === 0 && analisePerdas.length === 0 ? (
            <SecaoVazia icone="pi pi-chart-line" titulo="Sem analise financeira no periodo." descricao="Nao ha vendas ou perdas suficientes para destacar." />
          ) : (
            <div className={styles.compactList}>
              {analiseMargem.slice(0, 3).map((produto) => (
                <article className={styles.compactItem} key={`margem-${produto.produto_id}`}>
                  <strong>{produto.produto_nome}</strong>
                  <span>Margem {formatarPercentual(produto.margem_percentual)} | {produto.classificacao}</span>
                  <small>{produto.acao_sugerida}</small>
                </article>
              ))}
              {analisePerdas.slice(0, 3).map((produto) => (
                <article className={styles.compactItem} key={`perda-${produto.produto_id}`}>
                  <strong>{produto.produto_nome}</strong>
                  <span>{formatarMoeda(produto.custo_total)} em perdas</span>
                  <small>{produto.principal_tipo} | {produto.acao_sugerida}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Mais vendidos</span>
              <h2>Produtos com maior giro</h2>
              <p>Ranking do periodo analisado.</p>
            </div>
          </div>
          {carregando ? (
            <div className={styles.rowSkeleton} />
          ) : maisVendidos.length === 0 ? (
            <SecaoVazia icone="pi pi-chart-bar" titulo="Sem vendas no periodo." descricao="Use outro periodo ou registre vendas no PDV." />
          ) : (
            <div className={styles.compactList}>
              {maisVendidos.slice(0, LIMITE_LISTA).map((produto, indice) => (
                <article className={styles.compactItem} key={produto.produto_id}>
                  <strong>{indice + 1}. {produto.produto_nome}</strong>
                  <span>{formatarQuantidadeComUnidade(produto.total_vendido, produto.unidade_medida)}</span>
                  <small>{formatarMoeda(produto.receita_total)} em receita</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={`${styles.infoPanel} ${styles.widePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Series do periodo</span>
              <h2>Vendas, alertas e perdas</h2>
              <p>Graficos simples sem dependencia nova.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 4 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : vendasPorDia.every((item) => Number(item.receita_total ?? 0) === 0) && alertasPorTipo.length === 0 ? (
            <SecaoVazia icone="pi pi-chart-bar" titulo="Sem serie para exibir." descricao="Nao ha vendas nem alertas no periodo selecionado." />
          ) : (
            <div className={styles.chartGrid}>
              <div className={styles.chartList}>
                <strong>Receita por dia</strong>
                {vendasPorDia.slice(-10).map((item) => (
                  <div className={styles.chartRow} key={item.data}>
                    <span>{formatarData(item.data)}</span>
                    <div>
                      <i style={{ width: `${(Number(item.receita_total ?? 0) / maiorReceitaSerie) * 100}%` }} />
                    </div>
                    <small>{formatarMoeda(item.receita_total)}</small>
                  </div>
                ))}
              </div>
              <div className={styles.chartList}>
                <strong>Alertas e perdas</strong>
                {[...alertasPorTipo, ...perdasPorTipo.map((item) => ({ tipo: `perda_${item.tipo}`, total: item.total_registros }))].map((item) => (
                  <div className={styles.miniStat} key={item.tipo}>
                    <span>{item.tipo}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
