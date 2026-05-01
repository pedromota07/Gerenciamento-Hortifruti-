"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";

import { getProdutos } from "@/services/produtosService";
import {
  getFinanceiro,
  getHistoricoGeral,
  getMaisVendidos,
  getValidade
} from "@/services/relatoriosService";

import styles from "./page.module.css";

const INITIAL_FILTERS = {
  produto_id: null,
  subtipo: "",
  data_inicial: "",
  data_final: "",
  dias_alerta: 3
};

function formatQuantidade(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatMoeda(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatData(value) {
  if (!value) {
    return "-";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function buildPeriodoFilters(filters) {
  return {
    data_inicial: filters.data_inicial,
    data_final: filters.data_final
  };
}

export default function RelatoriosPage() {
  const [produtos, setProdutos] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [maisVendidos, setMaisVendidos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const carregarDados = useCallback(async (currentFilters) => {
    setLoading(true);
    setFeedback(null);

    try {
      const [produtosData, maisVendidosData, financeiroData, validadeData, historicoData] =
        await Promise.all([
          getProdutos(),
          getMaisVendidos({ limite: 5, ...buildPeriodoFilters(currentFilters) }),
          getFinanceiro(buildPeriodoFilters(currentFilters)),
          getValidade(currentFilters.dias_alerta),
          getHistoricoGeral({
            limite: 20,
            produto_id: currentFilters.produto_id,
            subtipo: currentFilters.subtipo,
            data_inicial: currentFilters.data_inicial,
            data_final: currentFilters.data_final
          })
        ]);

      setProdutos(produtosData.filter((produto) => produto.ativo));
      setMaisVendidos(maisVendidosData);
      setFinanceiro(financeiroData);
      setValidade(validadeData);
      setMovimentacoes(historicoData);
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados(INITIAL_FILTERS);
  }, [carregarDados]);

  const produtoOptions = useMemo(
    () => produtos.map((produto) => ({ label: produto.nome, value: produto.id })),
    [produtos]
  );

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleAplicarFiltros() {
    await carregarDados(filters);
  }

  async function handleLimparFiltros() {
    setFilters(INITIAL_FILTERS);
    await carregarDados(INITIAL_FILTERS);
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Relatorios</h1>
          <p>Visao operacional, financeira e de validade do estoque em um unico lugar.</p>
        </div>
      </header>

      {feedback ? <Message severity={feedback.severity} text={feedback.text} /> : null}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Filtros</h2>
            <p>Aplique periodo, produto e subtipo para refinar os dados do bloco.</p>
          </div>
          <div className={styles.actions}>
            <Button label="Limpar" text onClick={handleLimparFiltros} disabled={loading} />
            <Button
              label="Atualizar relatorios"
              icon="pi pi-refresh"
              onClick={handleAplicarFiltros}
              loading={loading}
            />
          </div>
        </div>

        <div className={styles.filterGrid}>
          <div className={styles.filterField}>
            <label htmlFor="relatorios-produto">Produto</label>
            <Dropdown
              id="relatorios-produto"
              value={filters.produto_id}
              options={produtoOptions}
              onChange={(event) => updateFilter("produto_id", event.value)}
              placeholder="Todos os produtos"
              showClear
              filter
              disabled={loading}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-subtipo">Subtipo</label>
            <Dropdown
              id="relatorios-subtipo"
              value={filters.subtipo}
              options={[
                { label: "Todos", value: "" },
                { label: "Venda", value: "venda" },
                { label: "Perda", value: "perda" },
                { label: "Compra", value: "compra" }
              ]}
              onChange={(event) => updateFilter("subtipo", event.value)}
              placeholder="Todos"
              disabled={loading}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-data-inicial">Data inicial</label>
            <InputText
              id="relatorios-data-inicial"
              type="date"
              value={filters.data_inicial}
              onChange={(event) => updateFilter("data_inicial", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-data-final">Data final</label>
            <InputText
              id="relatorios-data-final"
              type="date"
              value={filters.data_final}
              onChange={(event) => updateFilter("data_final", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-dias-alerta">Dias para alerta</label>
            <InputNumber
              id="relatorios-dias-alerta"
              min={1}
              useGrouping={false}
              value={filters.dias_alerta}
              onValueChange={(event) => updateFilter("dias_alerta", event.value ?? 3)}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <TabView>
        <TabPanel header="Mais Vendidos">
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Top 5 produtos vendidos</h2>
                <p>Ranking por quantidade vendida, com receita e lucro bruto acumulados.</p>
              </div>
            </div>

            <DataTable
              value={maisVendidos}
              dataKey="produto_id"
              loading={loading}
              emptyMessage="Nenhuma venda encontrada para os filtros informados."
              responsiveLayout="scroll"
            >
              <Column field="produto_nome" header="Produto" />
              <Column field="categoria" header="Categoria" />
              <Column
                field="total_vendido"
                header="Quantidade"
                body={(row) => formatQuantidade(row.total_vendido)}
              />
              <Column
                field="receita_total"
                header="Receita"
                body={(row) => formatMoeda(row.receita_total)}
              />
              <Column
                field="lucro_bruto_total"
                header="Lucro Bruto"
                body={(row) => formatMoeda(row.lucro_bruto_total)}
              />
              <Column field="total_movimentacoes" header="Vendas" />
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel header="Financeiro">
          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <span>Receita total</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.receita_total)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Custo das vendas</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.custo_total_vendas)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Lucro bruto</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.lucro_bruto_total)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Perdas no periodo</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.perdas_total_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor do estoque a custo</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.valor_estoque_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor do estoque a venda</span>
              <strong>{loading ? "--" : formatMoeda(financeiro?.valor_estoque_venda)}</strong>
            </article>
          </div>
        </TabPanel>

        <TabPanel header="Validade">
          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <span>Itens vencidos</span>
              <strong>{loading ? "--" : validade?.vencidos.length ?? 0}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Itens em risco</span>
              <strong>{loading ? "--" : validade?.proximos_vencimento.length ?? 0}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor vencido a custo</span>
              <strong>{loading ? "--" : formatMoeda(validade?.total_vencido_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor em risco a custo</span>
              <strong>{loading ? "--" : formatMoeda(validade?.total_em_risco_custo)}</strong>
            </article>
          </div>

          <div className={styles.tablesGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Produtos vencidos</h2>
                  <p>Camadas ja vencidas e o custo que ainda esta preso no estoque.</p>
                </div>
              </div>

              <DataTable
                value={validade?.vencidos ?? []}
                dataKey="produto_id"
                loading={loading}
                emptyMessage="Nenhum produto vencido no momento."
                responsiveLayout="scroll"
              >
                <Column field="produto_nome" header="Produto" />
                <Column
                  field="quantidade_total"
                  header="Quantidade"
                  body={(row) => formatQuantidade(row.quantidade_total)}
                />
                <Column
                  field="valor_custo"
                  header="Valor Custo"
                  body={(row) => formatMoeda(row.valor_custo)}
                />
                <Column
                  field="proxima_validade"
                  header="Validade"
                  body={(row) => formatData(row.proxima_validade)}
                />
              </DataTable>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Proximos do vencimento</h2>
                  <p>Produtos que vencem dentro da janela de alerta configurada.</p>
                </div>
              </div>

              <DataTable
                value={validade?.proximos_vencimento ?? []}
                dataKey="produto_id"
                loading={loading}
                emptyMessage="Nenhum produto em risco dentro do prazo selecionado."
                responsiveLayout="scroll"
              >
                <Column field="produto_nome" header="Produto" />
                <Column
                  field="quantidade_total"
                  header="Quantidade"
                  body={(row) => formatQuantidade(row.quantidade_total)}
                />
                <Column
                  field="valor_custo"
                  header="Valor Custo"
                  body={(row) => formatMoeda(row.valor_custo)}
                />
                <Column
                  field="proxima_validade"
                  header="Validade"
                  body={(row) => formatData(row.proxima_validade)}
                />
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Historico Geral">
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Ultimas 20 movimentacoes</h2>
                <p>Historico operacional com colunas financeiras para auditoria rapida.</p>
              </div>
            </div>

            <DataTable
              value={movimentacoes}
              dataKey="id"
              loading={loading}
              emptyMessage="Nenhuma movimentacao encontrada para os filtros informados."
              responsiveLayout="scroll"
            >
              <Column field="data" header="Data" body={(row) => formatData(row.data)} />
              <Column field="produto_nome" header="Produto" />
              <Column field="tipo" header="Tipo" />
              <Column field="subtipo" header="Subtipo" />
              <Column
                field="quantidade"
                header="Quantidade"
                body={(row) => formatQuantidade(row.quantidade)}
              />
              <Column
                field="custo_total"
                header="Custo"
                body={(row) => formatMoeda(row.custo_total)}
              />
              <Column
                field="receita_total"
                header="Receita"
                body={(row) => formatMoeda(row.receita_total)}
              />
              <Column
                field="lucro_bruto"
                header="Lucro Bruto"
                body={(row) => formatMoeda(row.lucro_bruto)}
              />
              <Column field="usuario_nome" header="Responsavel" />
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </section>
  );
}
