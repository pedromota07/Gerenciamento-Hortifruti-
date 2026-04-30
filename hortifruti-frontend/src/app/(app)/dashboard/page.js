"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { Panel } from "primereact/panel";
import { Tag } from "primereact/tag";

import { getProdutos } from "@/services/produtosService";
import { getFinanceiro, getHistoricoGeral, getValidade } from "@/services/relatoriosService";

import styles from "./page.module.css";

function formatQuantidade(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDataHora(value) {
  if (!value) {
    return "-";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatMoeda(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function isEstoqueBaixo(produto) {
  return Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0) < Number(produto.estoque_minimo ?? 0);
}

export default function DashboardPage() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true);

      try {
        const [produtosData, movimentacoesData, financeiroData, validadeData] = await Promise.all([
          getProdutos(),
          getHistoricoGeral({ limite: 10 }),
          getFinanceiro(),
          getValidade(3)
        ]);

        setProdutos(produtosData.filter((produto) => produto.ativo));
        setMovimentacoes(movimentacoesData);
        setFinanceiro(financeiroData);
        setValidade(validadeData);
      } catch (error) {
        setFeedback({ severity: "error", text: error.message });
      } finally {
        setLoading(false);
      }
    }

    carregarDashboard();
  }, []);

  const produtosEmAlerta = useMemo(
    () => produtos.filter((produto) => isEstoqueBaixo(produto)),
    [produtos]
  );

  const movimentacoesHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString("en-CA");
    return movimentacoes.filter((movimentacao) => movimentacao.data === hoje).length;
  }, [movimentacoes]);

  const produtosComVencidos = useMemo(
    () => produtos.filter((produto) => Number(produto.quantidade_vencida ?? 0) > 0),
    [produtos]
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Visao rapida do estoque, alertas e ultimas movimentacoes do sistema.</p>
        </div>
      </header>

      {feedback ? <Message severity={feedback.severity} text={feedback.text} /> : null}

      <div className={styles.cards}>
        <article className={styles.card}>
          <span>Total de produtos ativos</span>
          <strong>{loading ? "--" : produtos.length}</strong>
        </article>

        <article className={styles.card}>
          <span>Produtos com estoque baixo</span>
          <strong>{loading ? "--" : produtosEmAlerta.length}</strong>
          {produtosEmAlerta.length > 0 ? <Tag value="Atencao" severity="danger" /> : null}
        </article>

        <article className={styles.card}>
          <span>Movimentacoes de hoje</span>
          <strong>{loading ? "--" : movimentacoesHoje}</strong>
        </article>

        <article className={styles.card}>
          <span>Valor do estoque a custo</span>
          <strong>{loading ? "--" : formatMoeda(financeiro?.valor_estoque_custo)}</strong>
        </article>

        <article className={styles.card}>
          <span>Valor do estoque a venda</span>
          <strong>{loading ? "--" : formatMoeda(financeiro?.valor_estoque_venda)}</strong>
        </article>

        <article className={styles.card}>
          <span>Lucro bruto acumulado</span>
          <strong>{loading ? "--" : formatMoeda(financeiro?.lucro_bruto_total)}</strong>
        </article>

        <article className={styles.card}>
          <span>Perdas registradas</span>
          <strong>{loading ? "--" : formatMoeda(financeiro?.perdas_total_custo)}</strong>
        </article>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ultimas movimentacoes</h2>
            <Link className={styles.inlineLink} href="/relatorios">
              Ver todos →
            </Link>
          </div>

          <DataTable
            value={movimentacoes}
            dataKey="id"
            loading={loading}
            emptyMessage="Nenhuma movimentacao recente encontrada."
            responsiveLayout="scroll"
          >
            <Column field="data" header="Data" body={(row) => formatDataHora(row.data)} />
            <Column field="produto_nome" header="Produto" />
            <Column field="tipo" header="Tipo" />
            <Column
              field="quantidade"
              header="Quantidade"
              body={(row) => formatQuantidade(row.quantidade)}
            />
          </DataTable>
        </div>

        <Panel
          header="Atencao: Estoque Baixo"
          toggleable
          collapsed={produtosEmAlerta.length === 0}
          className={styles.alertPanel}
        >
          {produtosEmAlerta.length === 0 ? (
            <p className={styles.empty}>Nenhum produto em alerta no momento.</p>
          ) : (
            <div className={styles.alertList}>
              {produtosEmAlerta.map((produto) => (
                <article className={styles.alertItem} key={produto.id}>
                  <div>
                    <strong>{produto.nome}</strong>
                    <p>
                      Venda: {formatQuantidade(produto.quantidade_disponivel_venda)} | Minimo:{" "}
                      {formatQuantidade(produto.estoque_minimo)}
                    </p>
                  </div>
                  <Link className={styles.inlineLink} href={`/produtos/${produto.id}`}>
                    Ver detalhe
                  </Link>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className={styles.grid}>
        <Panel
          header="Validade e perdas"
          toggleable
          collapsed={false}
          className={styles.alertPanel}
        >
          <div className={styles.alertList}>
            <article className={styles.alertItem}>
              <div>
                <strong>Produtos vencidos</strong>
                <p>{loading ? "--" : `${validade?.vencidos.length ?? 0} item(ns) com custo parado em estoque.`}</p>
              </div>
              <Tag value={loading ? "--" : formatMoeda(validade?.total_vencido_custo)} severity="danger" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos em risco nos proximos 3 dias</strong>
                <p>{loading ? "--" : `${validade?.proximos_vencimento.length ?? 0} item(ns) proximos do vencimento.`}</p>
              </div>
              <Tag value={loading ? "--" : formatMoeda(validade?.total_em_risco_custo)} severity="warning" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos com estoque vencido</strong>
                <p>
                  {loading
                    ? "--"
                    : `${produtosComVencidos.length} produto(s) possuem quantidade vencida registrada.`}
                </p>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Abrir relatorios
              </Link>
            </article>
          </div>
        </Panel>

        <Panel
          header="Atalhos gerenciais"
          toggleable
          collapsed={false}
          className={styles.alertPanel}
        >
          <div className={styles.alertList}>
            <article className={styles.alertItem}>
              <div>
                <strong>Receita total</strong>
                <p>{loading ? "--" : formatMoeda(financeiro?.receita_total)}</p>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Ver financeiro
              </Link>
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Mais vendidos</strong>
                <p>Use os relatorios para cruzar quantidade vendida, receita e lucro bruto.</p>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Abrir ranking
              </Link>
            </article>
          </div>
        </Panel>
      </div>
    </section>
  );
}
