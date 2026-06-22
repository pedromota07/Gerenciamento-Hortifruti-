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
const ROTULOS_UNIDADE = {
  kg: "kg",
  un: "un",
  cx: "cx"
};

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

function formatarGiroMedio(valor, unidadeMedida) {
  const quantidade = Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  const unidade = ROTULOS_UNIDADE[unidadeMedida] ?? unidadeMedida ?? "";
  return unidade ? `${quantidade} ${unidade}` : quantidade;
}

function formatarQuantidadeReposicao(valor, unidadeMedida) {
  const casas = ["un", "cx"].includes(unidadeMedida) ? 0 : 1;
  const quantidade = Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
  const unidade = ROTULOS_UNIDADE[unidadeMedida] ?? unidadeMedida ?? "";

  return unidade ? `${quantidade} ${unidade}` : quantidade;
}

function formatarCobertura(valor) {
  if (valor === null || valor === undefined) {
    return "Sem histórico";
  }

  const dias = Number(valor);
  if (dias <= 1) {
    return "até 1 dia";
  }

  const diasInteiros = Math.max(Math.round(dias), 1);
  return diasInteiros === 1 ? "1 dia" : `${diasInteiros} dias`;
}

function montarJustificativaReposicao(produto, diasPrevisao) {
  const quantidade = formatarQuantidadeReposicao(produto.quantidade_sugerida, produto.unidade_medida);
  const cobertura = formatarCobertura(produto.dias_cobertura).toLowerCase();

  return `Comprar aproximadamente ${quantidade} de ${produto.produto_nome} para cobrir ${diasPrevisao} dias de venda média; cobertura atual: ${cobertura}.`;
}

function obterRotuloPrioridade(prioridade) {
  return {
    critica: "Crítica",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa"
  }[prioridade] ?? "Baixa";
}

function obterRotuloClassificacao(classificacao) {
  return {
    critica: "crítica",
    atencao: "atenção",
    saudavel: "saudável",
    media: "média",
    baixa: "baixa",
    boa: "boa"
  }[classificacao] ?? classificacao;
}

function obterClassePrioridade(prioridade) {
  return {
    critica: styles.prioridadeCritica,
    alta: styles.prioridadeAlta,
    media: styles.prioridadeMedia,
    baixa: styles.prioridadeBaixa
  }[prioridade] ?? styles.prioridadeBaixa;
}

function obterDestinoAcao() {
  return "/estoque";
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
  const diasPrevisao = dashboard?.periodo_analise?.dias_previsao ?? filtros.dias_previsao ?? 7;
  const totalPaginasPrioridades = Math.max(Math.ceil(prioridades.length / ITENS_POR_PAGINA_PRIORIDADES), 1);
  const indiceInicialPrioridades = paginaPrioridades * ITENS_POR_PAGINA_PRIORIDADES;
  const prioridadesVisiveis = prioridades.slice(
    indiceInicialPrioridades,
    indiceInicialPrioridades + ITENS_POR_PAGINA_PRIORIDADES
  );

  const indicadores = useMemo(
    () => [
      {
        rotulo: "Receita",
        valor: formatarMoeda(kpis.receita_total),
        detalhe: "Período analisado",
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
        detalhe: "Custo no período",
        icone: "pi pi-arrow-down-right",
        tom: "danger"
      },
      {
        rotulo: "Alertas críticos",
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
          <span className={styles.eyebrow}>Regras + decisão</span>
          <h1>Dashboard Orientado à Decisão</h1>
          <p>Prioridades, riscos e recomendações automáticas da operação.</p>
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
          <span>Período rápido</span>
          <Button label="7 dias" text size="small" onClick={() => aplicarPeriodoRapido("7d")} />
          <Button label="30 dias" text size="small" onClick={() => aplicarPeriodoRapido("30d")} />
          <Button label="Este mês" text size="small" onClick={() => aplicarPeriodoRapido("mes")} />
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
            Dias de previsão
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
              <span>Saúde operacional</span>
              <strong>{saude.score ?? 0}</strong>
              <small>{obterRotuloClassificacao(saude.classificacao ?? "saudavel")}</small>
            </div>
            <div className={styles.healthCopy}>
              <h2>{saude.mensagem}</h2>
              <p>
                {kpis.alertas_criticos ?? 0} alerta(s) crítico(s), {kpis.produtos_vencidos ?? 0} produto(s)
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
          <SecaoVazia icone="pi pi-check" titulo="Sem recomendações no período." descricao="Não há alertas relevantes para resumir agora." />
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
              <p>Cada alerta vem com causa, ação sugerida e impacto estimado.</p>
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
              descricao="O backend não encontrou alertas no período analisado."
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
                      <small><b>Ação:</b> {item.acao_sugerida}</small>
                      <small><b>Impacto:</b> {item.impacto_estimado}</small>
                    </div>
                    <Link className={styles.rowAction} href={obterDestinoAcao()} aria-label={`Abrir ${item.produto_nome}`}>
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
                  <div className={styles.carouselControls} aria-label="Paginação das prioridades">
                    <Button
                      icon="pi pi-angle-left"
                      text
                      rounded
                      disabled={paginaPrioridades === 0}
                      aria-label="Página anterior"
                      onClick={() => setPaginaPrioridades((paginaAtual) => Math.max(paginaAtual - 1, 0))}
                    />
                    <strong>{paginaPrioridades + 1} / {totalPaginasPrioridades}</strong>
                    <Button
                      icon="pi pi-angle-right"
                      text
                      rounded
                      disabled={paginaPrioridades >= totalPaginasPrioridades - 1}
                      aria-label="Próxima página"
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
              <span className={styles.eyebrow}>Reposição inteligente</span>
              <h2>Comprar com prioridade</h2>
              <p>Sugestão baseada em média diária, estoque vendável e cobertura desejada.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : sugestoesReposicao.length === 0 ? (
            <SecaoVazia
              icone="pi pi-shopping-bag"
              titulo="Nenhuma reposição sugerida."
              descricao="Não há produto com giro suficiente e baixa cobertura no período."
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
                  <p>Sugerido: {formatarQuantidadeReposicao(produto.quantidade_sugerida, produto.unidade_medida)}</p>
                  <small>Média: {formatarGiroMedio(produto.media_venda_diaria, produto.unidade_medida)}/dia</small>
                  <small>Cobertura: {formatarCobertura(produto.dias_cobertura)}</small>
                  <small>{montarJustificativaReposicao(produto, diasPrevisao)}</small>
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
              <h2>Vencidos e próximos</h2>
              <p>{riscoValidade.acao_geral_sugerida ?? "Sem ação emergencial de validade."}</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : (riscoValidade.vencidos?.length ?? 0) === 0 && (riscoValidade.proximos_vencimento?.length ?? 0) === 0 ? (
            <SecaoVazia icone="pi pi-calendar" titulo="Nenhum risco de validade." descricao="Não há produtos vencidos ou próximos do vencimento." />
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
            <SecaoVazia icone="pi pi-clock" titulo="Nenhum produto parado." descricao="Todos os itens com estoque tiveram giro aceitável." />
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
              <h2>Financeiro acionável</h2>
              <p>Produtos vendidos com margem baixa e itens que concentraram perdas.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : analiseMargem.length === 0 && analisePerdas.length === 0 ? (
            <SecaoVazia icone="pi pi-chart-line" titulo="Sem análise financeira no período." descricao="Não há vendas ou perdas suficientes para destacar." />
          ) : (
            <div className={styles.compactList}>
              {analiseMargem.slice(0, 3).map((produto) => (
                <article className={styles.compactItem} key={`margem-${produto.produto_id}`}>
                  <strong>{produto.produto_nome}</strong>
                  <span>Margem {formatarPercentual(produto.margem_percentual)} | {obterRotuloClassificacao(produto.classificacao)}</span>
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

    </section>
  );
}
