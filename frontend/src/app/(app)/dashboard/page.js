"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { Panel } from "primereact/panel";
import { Tag } from "primereact/tag";

import EstadoVazio from "@/components/EstadoVazio";
import { buscarProdutos } from "@/services/servicoProdutos";
import { buscarFinanceiro, buscarHistoricoGeral, buscarValidade } from "@/services/servicoRelatorios";
import { formatarData, formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";

import styles from "./page.module.css";

export default function PaginaPainel() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [vendasHoje, setVendasHoje] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    async function carregarPainel() {
      setCarregando(true);

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
    }

    carregarPainel();
  }, []);

  const produtosAtivos = useMemo(() => produtos.filter((produto) => produto.ativo), [produtos]);

  const produtosEmAlerta = useMemo(
    () => produtosAtivos.filter((produto) => estoqueEstaBaixo(produto)),
    [produtosAtivos]
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Painel</h1>
        </div>
      </header>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={styles.cards}>
        <article className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.cardTop}>
            <span>Produtos cadastrados</span>
            <i className="pi pi-box" />
          </div>
          <strong>{carregando ? "--" : produtos.length}</strong>
        </article>

        <article className={`${styles.card} ${produtosEmAlerta.length > 0 ? styles.cardDanger : styles.cardHealthy}`}>
          <div className={styles.cardTop}>
            <span>Itens com estoque baixo</span>
            <i className="pi pi-exclamation-triangle" />
          </div>
          <strong>{carregando ? "--" : produtosEmAlerta.length}</strong>
        </article>

        <article className={`${styles.card} ${styles.cardWarning}`}>
          <div className={styles.cardTop}>
            <span>Produtos próximos do vencimento</span>
            <i className="pi pi-clock" />
          </div>
          <strong>{carregando ? "--" : validade?.proximos_vencimento.length ?? 0}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Vendas do dia</span>
            <i className="pi pi-shopping-cart" />
          </div>
          <strong>{carregando ? "--" : vendasHoje.length}</strong>
        </article>

        <article className={`${styles.card} ${styles.cardWarning}`}>
          <div className={styles.cardTop}>
            <span>Perdas registradas</span>
            <i className="pi pi-calendar-times" />
          </div>
          <strong>{carregando ? "--" : financeiro?.perdas_total_registros ?? 0}</strong>
          <small>{carregando ? "--" : formatarMoeda(financeiro?.perdas_total_custo)}</small>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Valor total em estoque</span>
            <i className="pi pi-wallet" />
          </div>
          <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_custo)}</strong>
          <small>Valor a custo</small>
        </article>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Últimas movimentações</h2>
            <Link className={styles.inlineLink} href="/relatorios">
              Ver todos -&gt;
            </Link>
          </div>

          {movimentacoes.length === 0 && !carregando ? (
            <EstadoVazio
              icone="pi pi-sync"
              titulo="Nenhuma movimentação registrada ainda."
              descricao="Entradas, vendas e perdas aparecerão aqui conforme o estoque começar a operar."
            />
          ) : (
            <DataTable value={movimentacoes} dataKey="id" loading={carregando} responsiveLayout="scroll">
              <Column field="data" header="Data" body={(linha) => formatarData(linha.data)} />
              <Column field="produto_nome" header="Produto" />
              <Column field="tipo" header="Tipo" />
              <Column
                field="quantidade"
                header="Quantidade"
                body={(linha) => formatarQuantidadeComUnidade(linha.quantidade, linha.unidade_medida)}
              />
            </DataTable>
          )}
        </div>

        <Panel
          header="Atenção: Estoque Baixo"
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
                    <span className={styles.metaLine}>
                      Venda: {formatarQuantidadeComUnidade(produto.quantidade_disponivel_venda, produto.unidade_medida)}
                      {" | "}
                      Mínimo: {formatarQuantidadeComUnidade(produto.estoque_minimo, produto.unidade_medida)}
                    </span>
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
        <Panel header="Validade e perdas" toggleable collapsed={false} className={styles.alertPanel}>
          <div className={styles.alertList}>
            <article className={styles.alertItem}>
              <div>
                <strong>Produtos vencidos</strong>
              </div>
              <Tag value={carregando ? "--" : formatarMoeda(validade?.total_vencido_custo)} severity="danger" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos em risco nos próximos 3 dias</strong>
              </div>
              <Tag value={carregando ? "--" : formatarMoeda(validade?.total_em_risco_custo)} severity="warning" />
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Produtos com estoque vencido</strong>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Abrir relatórios
              </Link>
            </article>
          </div>
        </Panel>

        <Panel header="Atalhos gerenciais" toggleable collapsed={false} className={styles.alertPanel}>
          <div className={styles.alertList}>
            <article className={styles.alertItem}>
              <div>
                <strong>Receita total</strong>
                <span className={styles.metaLine}>{carregando ? "--" : formatarMoeda(financeiro?.receita_total)}</span>
              </div>
              <Link className={styles.inlineLink} href="/relatorios">
                Ver financeiro
              </Link>
            </article>

            <article className={styles.alertItem}>
              <div>
                <strong>Mais vendidos</strong>
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
