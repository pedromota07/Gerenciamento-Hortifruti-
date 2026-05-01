"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { Panel } from "primereact/panel";
import { Tag } from "primereact/tag";

import { buscarProdutos } from "@/services/produtosService";
import { buscarFinanceiro, buscarHistoricoGeral, buscarValidade } from "@/services/relatoriosService";

import styles from "./page.module.css";

function formatarQuantidade(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarDataHora(valor) {
  if (!valor) {
    return "-";
  }

  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatarMoeda(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function estoqueEstaBaixo(produto) {
  return Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0) < Number(produto.estoque_minimo ?? 0);
}

export default function PaginaDashboard() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    async function carregarDashboard() {
      setCarregando(true);

      try {
        const [dadosProdutos, dadosMovimentacoes, dadosFinanceiro, dadosValidade] = await Promise.all([
          buscarProdutos(),
          buscarHistoricoGeral({ limite: 10 }),
          buscarFinanceiro(),
          buscarValidade(3)
        ]);

        setProdutos(dadosProdutos.filter((produto) => produto.ativo));
        setMovimentacoes(dadosMovimentacoes);
        setFinanceiro(dadosFinanceiro);
        setValidade(dadosValidade);
      } catch (erro) {
        setMensagem({ severity: "error", text: erro.message });
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, []);

  const produtosEmAlerta = useMemo(
    () => produtos.filter((produto) => estoqueEstaBaixo(produto)),
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

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={styles.cards}>
        <article className={styles.card}>
          <span>Total de produtos ativos</span>
          <strong>{carregando ? "--" : produtos.length}</strong>
        </article>

        <article className={styles.card}>
          <span>Produtos com estoque baixo</span>
          <strong>{carregando ? "--" : produtosEmAlerta.length}</strong>
          {produtosEmAlerta.length > 0 ? <Tag value="Atencao" severity="danger" /> : null}
        </article>

        <article className={styles.card}>
          <span>Movimentacoes de hoje</span>
          <strong>{carregando ? "--" : movimentacoesHoje}</strong>
        </article>

        <article className={styles.card}>
          <span>Valor do estoque a custo</span>
          <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_custo)}</strong>
        </article>

        <article className={styles.card}>
          <span>Valor do estoque a venda</span>
          <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_venda)}</strong>
        </article>

        <article className={styles.card}>
          <span>Lucro bruto acumulado</span>
          <strong>{carregando ? "--" : formatarMoeda(financeiro?.lucro_bruto_total)}</strong>
        </article>

        <article className={styles.card}>
          <span>Perdas registradas</span>
          <strong>{carregando ? "--" : formatarMoeda(financeiro?.perdas_total_custo)}</strong>
        </article>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ultimas movimentacoes</h2>
            <Link className={styles.inlineLink} href="/relatorios">
              Ver todos -&gt;
            </Link>
          </div>

          <DataTable
            value={movimentacoes}
            dataKey="id"
            loading={carregando}
            emptyMessage="Nenhuma movimentacao recente encontrada."
            responsiveLayout="scroll"
          >
            <Column field="data" header="Data" body={(linha) => formatarDataHora(linha.data)} />
            <Column field="produto_nome" header="Produto" />
            <Column field="tipo" header="Tipo" />
            <Column
              field="quantidade"
              header="Quantidade"
              body={(linha) => formatarQuantidade(linha.quantidade)}
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
                      Venda: {formatarQuantidade(produto.quantidade_disponivel_venda)} | Minimo:{" "}
                      {formatarQuantidade(produto.estoque_minimo)}
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
                <p>{carregando ? "--" : `${validade?.vencidos.length ?? 0} item(ns) com custo parado em estoque.`}</p>
              </div>
              <Tag value={carregando ? "--" : formatarMoeda(validade?.total_vencido_custo)} severity="danger" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos em risco nos proximos 3 dias</strong>
                <p>{carregando ? "--" : `${validade?.proximos_vencimento.length ?? 0} item(ns) proximos do vencimento.`}</p>
              </div>
              <Tag value={carregando ? "--" : formatarMoeda(validade?.total_em_risco_custo)} severity="warning" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos com estoque vencido</strong>
                <p>
                  {carregando
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
                <p>{carregando ? "--" : formatarMoeda(financeiro?.receita_total)}</p>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Ver financeiro
              </Link>
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Mais vendidos</strong>
                <p>Compare quantidade vendida, receita e lucro bruto.</p>
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
