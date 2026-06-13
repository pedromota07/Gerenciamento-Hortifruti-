"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";

import EstadoVazio from "@/components/EstadoVazio";
import { buscarProdutos } from "@/services/servicoProdutos";
import { buscarFinanceiro, buscarHistoricoGeral, buscarValidade } from "@/services/servicoRelatorios";
import { formatarData, formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";

import styles from "./page.module.css";

function obterContextoDoDia() {
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const data = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });

  return { saudacao, data };
}

function obterRotuloMovimentacao(movimentacao) {
  if (movimentacao.tipo === "entrada") {
    return "Entrada";
  }

  if (movimentacao.subtipo === "venda") {
    return "Venda";
  }

  if (movimentacao.subtipo === "perda") {
    return "Perda";
  }

  return "Saída";
}

function obterTomMovimentacao(movimentacao) {
  if (movimentacao.tipo === "entrada") {
    return "entry";
  }

  if (movimentacao.subtipo === "perda") {
    return "loss";
  }

  return "sale";
}

export default function PaginaPainel() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [vendasHoje, setVendasHoje] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);

  const carregarPainel = useCallback(async () => {
    setCarregando(true);
    setMensagem(null);

    try {
      const hoje = new Date().toLocaleDateString("en-CA");
      const [dadosProdutos, dadosMovimentacoes, dadosVendasHoje, dadosFinanceiro, dadosValidade] =
        await Promise.all([
          buscarProdutos(),
          buscarHistoricoGeral({ limite: 10 }),
          buscarHistoricoGeral({
            tipo: "saida",
            subtipo: "venda",
            data_inicial: hoje,
            data_final: hoje
          }),
          buscarFinanceiro(),
          buscarValidade(3)
        ]);

      setProdutos(dadosProdutos);
      setMovimentacoes(dadosMovimentacoes);
      setVendasHoje(dadosVendasHoje);
      setFinanceiro(dadosFinanceiro);
      setValidade(dadosValidade);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPainel();
  }, [carregarPainel]);

  const contexto = useMemo(obterContextoDoDia, []);
  const produtosAtivos = useMemo(() => produtos.filter((produto) => produto.ativo), [produtos]);
  const produtosEmAlerta = useMemo(
    () => produtosAtivos.filter((produto) => estoqueEstaBaixo(produto)),
    [produtosAtivos]
  );
  const receitaHoje = useMemo(
    () => vendasHoje.reduce((total, venda) => total + Number(venda.receita_total ?? 0), 0),
    [vendasHoje]
  );

  const vencidos = validade?.vencidos ?? [];
  const proximosDoVencimento = validade?.proximos_vencimento ?? [];
  const totalAlertas = produtosEmAlerta.length + vencidos.length + proximosDoVencimento.length;

  const indicadores = [
    {
      rotulo: "Receita hoje",
      valor: formatarMoeda(receitaHoje),
      detalhe: `${vendasHoje.length} ${vendasHoje.length === 1 ? "venda registrada" : "vendas registradas"}`,
      icone: "pi pi-wallet",
      tom: "primary"
    },
    {
      rotulo: "Estoque em risco",
      valor: totalAlertas,
      detalhe: totalAlertas === 0 ? "Operação sem alertas" : "Itens que precisam de atenção",
      icone: "pi pi-exclamation-triangle",
      tom: totalAlertas > 0 ? "warning" : "healthy"
    },
    {
      rotulo: "Perdas acumuladas",
      valor: formatarMoeda(financeiro?.perdas_total_custo),
      detalhe: `${financeiro?.perdas_total_registros ?? 0} registros de perda`,
      icone: "pi pi-arrow-down-right",
      tom: "danger"
    },
    {
      rotulo: "Valor em estoque",
      valor: formatarMoeda(financeiro?.valor_estoque_custo),
      detalhe: `${produtosAtivos.length} produtos ativos`,
      icone: "pi pi-box",
      tom: "neutral"
    }
  ];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{contexto.data}</span>
          <h1>{contexto.saudacao}, acompanhe sua operação.</h1>
          <p>Veja primeiro o que exige ação e siga para os detalhes quando necessário.</p>
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

      <section className={styles.metrics} aria-label="Resumo da operação" aria-live="polite">
        {carregando
          ? Array.from({ length: 4 }, (_, indice) => <div className={styles.metricSkeleton} key={indice} />)
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

      <div className={styles.mainGrid}>
        <section className={styles.attentionPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Prioridade do dia</span>
              <h2>Precisa de atenção</h2>
              <p>Alertas que podem afetar vendas, validade ou reposição.</p>
            </div>
            {!carregando ? (
              <span className={`${styles.alertCounter} ${totalAlertas === 0 ? styles.alertCounterHealthy : ""}`}>
                {totalAlertas}
              </span>
            ) : null}
          </div>

          {carregando ? (
            <div className={styles.alertSkeletons}>
              {Array.from({ length: 3 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
            </div>
          ) : totalAlertas === 0 ? (
            <div className={styles.healthyState}>
              <span>
                <i className="pi pi-check" aria-hidden="true" />
              </span>
              <div>
                <strong>Operação sob controle</strong>
                <p>Não há alertas de estoque ou validade para resolver agora.</p>
              </div>
            </div>
          ) : (
            <div className={styles.attentionList}>
              {produtosEmAlerta.slice(0, 4).map((produto) => (
                <article className={styles.attentionItem} key={`estoque-${produto.id}`}>
                  <span className={`${styles.attentionIcon} ${styles.attentionWarning}`}>
                    <i className="pi pi-box" aria-hidden="true" />
                  </span>
                  <div className={styles.attentionContent}>
                    <div>
                      <strong>{produto.nome}</strong>
                      <span className={styles.attentionType}>Estoque baixo</span>
                    </div>
                    <p>
                      {formatarQuantidadeComUnidade(
                        produto.quantidade_disponivel_venda,
                        produto.unidade_medida
                      )}{" "}
                      disponíveis. Mínimo de{" "}
                      {formatarQuantidadeComUnidade(produto.estoque_minimo, produto.unidade_medida)}.
                    </p>
                  </div>
                  <Link className={styles.rowAction} href={`/produtos/${produto.id}`} aria-label={`Ver ${produto.nome}`}>
                    <i className="pi pi-arrow-right" aria-hidden="true" />
                  </Link>
                </article>
              ))}

              {vencidos.slice(0, 3).map((produto) => (
                <article className={styles.attentionItem} key={`vencido-${produto.produto_id}`}>
                  <span className={`${styles.attentionIcon} ${styles.attentionDanger}`}>
                    <i className="pi pi-calendar-times" aria-hidden="true" />
                  </span>
                  <div className={styles.attentionContent}>
                    <div>
                      <strong>{produto.produto_nome}</strong>
                      <span className={`${styles.attentionType} ${styles.attentionTypeDanger}`}>Vencido</span>
                    </div>
                    <p>
                      {formatarQuantidadeComUnidade(produto.quantidade_total, produto.unidade_medida)} fora da
                      validade.
                    </p>
                  </div>
                  <Link className={styles.rowAction} href="/relatorios" aria-label="Abrir relatório de validade">
                    <i className="pi pi-arrow-right" aria-hidden="true" />
                  </Link>
                </article>
              ))}

              {proximosDoVencimento.slice(0, 3).map((produto) => (
                <article className={styles.attentionItem} key={`validade-${produto.produto_id}`}>
                  <span className={`${styles.attentionIcon} ${styles.attentionWarning}`}>
                    <i className="pi pi-clock" aria-hidden="true" />
                  </span>
                  <div className={styles.attentionContent}>
                    <div>
                      <strong>{produto.produto_nome}</strong>
                      <span className={styles.attentionType}>Vence em breve</span>
                    </div>
                    <p>Validade mais próxima em {formatarData(produto.proxima_validade)}.</p>
                  </div>
                  <Link className={styles.rowAction} href="/relatorios" aria-label="Abrir relatório de validade">
                    <i className="pi pi-arrow-right" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          )}

          {totalAlertas > 0 && !carregando ? (
            <Link className={styles.panelFooterLink} href="/relatorios">
              Ver todos os {totalAlertas} alertas
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </Link>
          ) : null}
        </section>

        <aside className={styles.shortcutsPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Acesso rápido</span>
              <h2>Atalhos operacionais</h2>
              <p>Continue o trabalho pelas ações mais usadas.</p>
            </div>
          </div>

          <nav className={styles.shortcuts} aria-label="Atalhos operacionais">
            <Link className={`${styles.shortcut} ${styles.shortcutPrimary}`} href="/pdv">
              <span>
                <i className="pi pi-shopping-cart" aria-hidden="true" />
              </span>
              <div>
                <strong>Registrar venda</strong>
                <small>Abrir o caixa rápido</small>
              </div>
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </Link>

            <Link className={styles.shortcut} href="/estoque">
              <span>
                <i className="pi pi-plus-circle" aria-hidden="true" />
              </span>
              <div>
                <strong>Movimentar estoque</strong>
                <small>Entrada, saída ou perda</small>
              </div>
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </Link>

            <Link className={styles.shortcut} href="/relatorios">
              <span>
                <i className="pi pi-chart-bar" aria-hidden="true" />
              </span>
              <div>
                <strong>Consultar resultados</strong>
                <small>Financeiro e validade</small>
              </div>
              <i className="pi pi-arrow-right" aria-hidden="true" />
            </Link>
          </nav>

          <div className={styles.stockSummary}>
            <div>
              <span>Estoque a custo</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_custo)}</strong>
            </div>
            <Link href="/estoque">Ver estoque</Link>
          </div>
        </aside>
      </div>

      <section className={styles.activityPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.eyebrow}>Visão recente</span>
            <h2>Atividade da operação</h2>
            <p>As dez movimentações mais recentes do estoque.</p>
          </div>
          <Link className={styles.headerLink} href="/relatorios">
            Ver histórico
            <i className="pi pi-arrow-right" aria-hidden="true" />
          </Link>
        </div>

        {carregando ? (
          <div className={styles.activityList}>
            {Array.from({ length: 4 }, (_, indice) => <div className={styles.rowSkeleton} key={indice} />)}
          </div>
        ) : movimentacoes.length === 0 ? (
          <EstadoVazio
            icone="pi pi-sync"
            titulo="Nenhuma movimentação registrada ainda."
            descricao="Entradas, vendas e perdas aparecerão aqui conforme o estoque começar a operar."
          />
        ) : (
          <div className={styles.activityList}>
            {movimentacoes.map((movimentacao) => {
              const tom = obterTomMovimentacao(movimentacao);

              return (
                <article className={styles.activityItem} key={movimentacao.id}>
                  <span className={`${styles.activityIcon} ${styles[`activityIcon_${tom}`]}`}>
                    <i
                      className={
                        tom === "entry"
                          ? "pi pi-arrow-down"
                          : tom === "loss"
                            ? "pi pi-times"
                            : "pi pi-arrow-up"
                      }
                      aria-hidden="true"
                    />
                  </span>
                  <div className={styles.activityProduct}>
                    <strong>{movimentacao.produto_nome}</strong>
                    <span>{formatarData(movimentacao.data)}</span>
                  </div>
                  <span className={`${styles.movementTag} ${styles[`movementTag_${tom}`]}`}>
                    {obterRotuloMovimentacao(movimentacao)}
                  </span>
                  <strong className={styles.activityQuantity}>
                    {formatarQuantidadeComUnidade(movimentacao.quantidade, movimentacao.unidade_medida)}
                  </strong>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
