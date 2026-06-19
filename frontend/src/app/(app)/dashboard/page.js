"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";

import EstadoVazio from "@/components/EstadoVazio";
import ProdutoVisual from "@/components/ProdutoVisual";
import { buscarDashboardInteligente } from "@/services/servicoRelatorios";
import { formatarData, formatarMoeda, formatarQuantidade, formatarQuantidadeComUnidade } from "@/utils/formatters";

import styles from "./page.module.css";

const ITENS_POR_PAGINA_ALERTAS = 8;
const ITENS_POR_PAGINA_VALIDADE = 5;
const LIMITE_LISTA_RESUMIDA = 5;

function formatarPercentual(valor) {
  return `${formatarQuantidade(valor)}%`;
}

function formatarGiroMedio(valor, unidadeMedida) {
  const quantidade = Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  return unidadeMedida ? `${quantidade} ${unidadeMedida}` : quantidade;
}

function obterRotuloPrioridade(prioridade) {
  return {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa"
  }[prioridade] ?? "Baixa";
}

function obterClassePrioridade(prioridade) {
  return {
    alta: styles.prioridadeAlta,
    media: styles.prioridadeMedia,
    baixa: styles.prioridadeBaixa
  }[prioridade] ?? styles.prioridadeBaixa;
}

function obterDestinoAcao(alerta) {
  if (alerta?.acao_sugerida === "Repor estoque" || alerta?.tipo === "estoque_baixo") {
    return "/estoque";
  }

  if (alerta?.tipo === "produto_vencido" || alerta?.tipo === "proximo_vencimento") {
    return "/relatorios";
  }

  return alerta?.produto_id ? `/produtos/${alerta.produto_id}` : "/relatorios";
}

function SecaoVazia({ icone, titulo, descricao }) {
  return (
    <EstadoVazio
      icone={icone}
      titulo={titulo}
      descricao={descricao}
    />
  );
}

export default function PaginaPainel() {
  const [dashboard, setDashboard] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [paginaAlertas, setPaginaAlertas] = useState(0);
  const [paginaValidade, setPaginaValidade] = useState(0);

  const carregarPainel = useCallback(async () => {
    setCarregando(true);
    setMensagem(null);
    setPaginaAlertas(0);
    setPaginaValidade(0);

    try {
      const dados = await buscarDashboardInteligente();
      setDashboard(dados);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPainel();
  }, [carregarPainel]);

  const kpis = dashboard?.kpis ?? {};
  const resumoExecutivo = dashboard?.resumo_executivo ?? [];
  const alertas = dashboard?.alertas ?? [];
  const sugestoesReposicao = dashboard?.sugestoes_reposicao ?? [];
  const produtosParados = dashboard?.produtos_parados ?? [];
  const maisVendidos = dashboard?.mais_vendidos ?? [];
  const validade = dashboard?.validade ?? {};
  const vencidos = validade.vencidos ?? [];
  const proximosVencimento = validade.proximos_vencimento ?? [];
  const totalPaginasAlertas = Math.max(Math.ceil(alertas.length / ITENS_POR_PAGINA_ALERTAS), 1);
  const indiceInicialAlertas = paginaAlertas * ITENS_POR_PAGINA_ALERTAS;
  const alertasVisiveis = alertas.slice(indiceInicialAlertas, indiceInicialAlertas + ITENS_POR_PAGINA_ALERTAS);
  const riscosValidade = [
    ...vencidos.map((produto) => ({
      ...produto,
      chave: `vencido-${produto.produto_id}`,
      rotulo: "Vencido",
      classePrioridade: styles.prioridadeAlta,
      detalhe: formatarQuantidadeComUnidade(produto.quantidade_total, produto.unidade_medida)
    })),
    ...proximosVencimento.map((produto) => ({
      ...produto,
      chave: `proximo-${produto.produto_id}`,
      rotulo: "Próximo",
      classePrioridade: styles.prioridadeMedia,
      detalhe: `Validade: ${formatarData(produto.proxima_validade)}`
    }))
  ];
  const totalPaginasValidade = Math.max(Math.ceil(riscosValidade.length / ITENS_POR_PAGINA_VALIDADE), 1);
  const indiceInicialValidade = paginaValidade * ITENS_POR_PAGINA_VALIDADE;
  const riscosValidadeVisiveis = riscosValidade.slice(
    indiceInicialValidade,
    indiceInicialValidade + ITENS_POR_PAGINA_VALIDADE
  );
  const produtosParadosVisiveis = produtosParados.slice(0, LIMITE_LISTA_RESUMIDA);

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
        rotulo: "Valor em estoque",
        valor: formatarMoeda(kpis.valor_estoque_custo),
        detalhe: "Estoque a custo",
        icone: "pi pi-box",
        tom: "neutral"
      },
      {
        rotulo: "Perdas",
        valor: formatarMoeda(kpis.perdas_total_custo),
        detalhe: `${kpis.produtos_vencidos ?? 0} produtos vencidos`,
        icone: "pi pi-arrow-down-right",
        tom: "danger"
      },
      {
        rotulo: "Alertas",
        valor: kpis.total_alertas ?? 0,
        detalhe: "Prioridades calculadas",
        icone: "pi pi-exclamation-triangle",
        tom: (kpis.total_alertas ?? 0) > 0 ? "warning" : "healthy"
      }
    ],
    [kpis]
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Regras + insights</span>
          <h1>Dashboard Orientado à Decisão</h1>
          <p>Prioridades, riscos e recomendações automáticas da operação.</p>
        </div>

        <div className={styles.headerActions}>
          <Button
            label="Atualizar"
            icon="pi pi-refresh"
            outlined
            loading={carregando}
            onClick={carregarPainel}
          />
          <Link className={styles.primaryAction} href="/pdv">
            <i className="pi pi-shopping-cart" aria-hidden="true" />
            Nova venda
          </Link>
        </div>
      </header>

      {mensagem ? (
        <div className={styles.feedback}>
          <Message severity={mensagem.severity} text={mensagem.text} />
          <Button label="Tentar novamente" icon="pi pi-refresh" text onClick={carregarPainel} />
        </div>
      ) : null}

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
            <h2>O que fazer agora</h2>
            <p>Frases automáticas geradas a partir das regras de estoque, giro e validade.</p>
          </div>
        </div>

        {carregando ? (
          <div className={styles.summarySkeletons}>
            {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
          </div>
        ) : (
          <ul className={styles.summaryList}>
            {resumoExecutivo.map((frase) => (
              <li key={frase}>
                <i className="pi pi-check-circle" aria-hidden="true" />
                <span>{frase}</span>
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
              <h2>Alertas priorizados</h2>
              <p>Itens ordenados por impacto operacional.</p>
            </div>
            {!carregando ? (
              <span className={`${styles.alertCounter} ${alertas.length === 0 ? styles.alertCounterHealthy : ""}`}>
                {alertas.length}
              </span>
            ) : null}
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 4 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : alertas.length === 0 ? (
            <SecaoVazia
              icone="pi pi-check"
              titulo="Nenhuma prioridade para resolver agora."
              descricao="O painel não encontrou alertas críticos no período analisado."
            />
          ) : (
            <>
              <div className={styles.decisionList}>
                {alertasVisiveis.map((alerta, indice) => (
                  <article className={styles.decisionItem} key={`${alerta.tipo}-${alerta.produto_id}-${indice}`}>
                    <ProdutoVisual nome={alerta.produto_nome} categoria={alerta.categoria} />
                    <div className={styles.decisionContent}>
                      <div>
                        <strong>{alerta.produto_nome}</strong>
                        <span className={`${styles.priorityTag} ${obterClassePrioridade(alerta.prioridade)}`}>
                          {obterRotuloPrioridade(alerta.prioridade)}
                        </span>
                      </div>
                      <p>{alerta.mensagem}</p>
                      <small>{alerta.acao_sugerida}</small>
                    </div>
                    <Link className={styles.rowAction} href={obterDestinoAcao(alerta)} aria-label={`Abrir ${alerta.produto_nome}`}>
                      <i className="pi pi-arrow-right" aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>

              {alertas.length > ITENS_POR_PAGINA_ALERTAS ? (
                <div className={styles.listFooter}>
                  <span>
                    Mostrando {indiceInicialAlertas + 1}-{indiceInicialAlertas + alertasVisiveis.length} de {alertas.length}
                  </span>
                  <div className={styles.carouselControls} aria-label="Paginação dos alertas">
                    <Button
                      icon="pi pi-angle-left"
                      text
                      rounded
                      disabled={paginaAlertas === 0}
                      aria-label="Página anterior de alertas"
                      onClick={() => setPaginaAlertas((paginaAtual) => Math.max(paginaAtual - 1, 0))}
                    />
                    <strong>{paginaAlertas + 1} / {totalPaginasAlertas}</strong>
                    <Button
                      icon="pi pi-angle-right"
                      text
                      rounded
                      disabled={paginaAlertas >= totalPaginasAlertas - 1}
                      aria-label="Próxima página de alertas"
                      onClick={() => setPaginaAlertas((paginaAtual) => Math.min(paginaAtual + 1, totalPaginasAlertas - 1))}
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
              <span className={styles.eyebrow}>Sugestões de reposição</span>
              <h2>Comprar com prioridade</h2>
              <p>Baseado em giro médio e dias estimados até acabar.</p>
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
              descricao="O estoque atual cobre a previsão de venda dos próximos dias."
            />
          ) : (
            <div className={styles.repositionList}>
              {sugestoesReposicao.slice(0, 5).map((produto) => (
                <article className={styles.repositionItem} key={produto.produto_id}>
                  <div>
                    <strong>{produto.produto_nome}</strong>
                    <span className={`${styles.priorityTag} ${obterClassePrioridade(produto.prioridade)}`}>
                      {obterRotuloPrioridade(produto.prioridade)}
                    </span>
                  </div>
                  <p>
                    Sugerido: {formatarQuantidadeComUnidade(produto.quantidade_sugerida, produto.unidade_medida)}
                  </p>
                  <small>
                    Giro médio: {formatarGiroMedio(produto.media_venda_diaria, produto.unidade_medida)}/dia
                  </small>
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
              <p>Produtos que podem virar perda se nada for feito.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : vencidos.length === 0 && proximosVencimento.length === 0 ? (
            <SecaoVazia
              icone="pi pi-calendar"
              titulo="Nenhum risco de validade."
              descricao="Não há produtos vencidos ou próximos do vencimento."
            />
          ) : (
            <>
              <div className={styles.compactList}>
                {riscosValidadeVisiveis.map((produto) => (
                  <article className={styles.compactItem} key={produto.chave}>
                    <strong>{produto.produto_nome}</strong>
                    <span className={`${styles.priorityTag} ${produto.classePrioridade}`}>{produto.rotulo}</span>
                    <small>{produto.detalhe}</small>
                  </article>
                ))}
              </div>

              {riscosValidade.length > ITENS_POR_PAGINA_VALIDADE ? (
                <div className={styles.listFooter}>
                  <span>
                    Mostrando {indiceInicialValidade + 1}-{indiceInicialValidade + riscosValidadeVisiveis.length} de {riscosValidade.length}
                  </span>
                  <div className={styles.carouselControls} aria-label="Paginação dos riscos de validade">
                    <Button
                      icon="pi pi-angle-left"
                      text
                      rounded
                      disabled={paginaValidade === 0}
                      aria-label="Página anterior de validade"
                      onClick={() => setPaginaValidade((paginaAtual) => Math.max(paginaAtual - 1, 0))}
                    />
                    <strong>{paginaValidade + 1} / {totalPaginasValidade}</strong>
                    <Button
                      icon="pi pi-angle-right"
                      text
                      rounded
                      disabled={paginaValidade >= totalPaginasValidade - 1}
                      aria-label="Próxima página de validade"
                      onClick={() => setPaginaValidade((paginaAtual) => Math.min(paginaAtual + 1, totalPaginasValidade - 1))}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Produtos parados</span>
              <h2>Baixo giro</h2>
              <p>Itens com estoque e sem venda no período.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : produtosParados.length === 0 ? (
            <SecaoVazia
              icone="pi pi-clock"
              titulo="Nenhum produto parado."
              descricao="Todos os itens com estoque tiveram giro recente."
            />
          ) : (
            <div className={styles.compactList}>
              {produtosParadosVisiveis.map((produto) => (
                <article className={styles.compactItem} key={produto.produto_id}>
                  <strong>{produto.produto_nome}</strong>
                  <span>{formatarQuantidadeComUnidade(produto.estoque_atual, produto.unidade_medida)}</span>
                  <small>{formatarMoeda(produto.valor_estoque_custo)} parado</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Mais vendidos</span>
              <h2>Produtos com maior giro</h2>
              <p>Top 5 calculado pelas vendas disponíveis.</p>
            </div>
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : maisVendidos.length === 0 ? (
            <SecaoVazia
              icone="pi pi-chart-bar"
              titulo="Nenhuma venda no período."
              descricao="Os produtos mais vendidos aparecerão aqui conforme o PDV for usado."
            />
          ) : (
            <div className={styles.compactList}>
              {maisVendidos.map((produto, indice) => (
                <article className={styles.compactItem} key={produto.produto_id}>
                  <strong>{indice + 1}. {produto.produto_nome}</strong>
                  <span>{formatarQuantidadeComUnidade(produto.total_vendido, produto.unidade_medida)}</span>
                  <small>{formatarMoeda(produto.receita_total)} em receita</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
