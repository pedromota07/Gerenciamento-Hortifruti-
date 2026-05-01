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

import { buscarProdutos } from "@/services/produtosService";
import {
  buscarFinanceiro,
  buscarHistoricoGeral,
  buscarMaisVendidos,
  buscarValidade
} from "@/services/relatoriosService";

import styles from "./page.module.css";

const FILTROS_INICIAIS = {
  produto_id: null,
  subtipo: "",
  data_inicial: "",
  data_final: "",
  dias_alerta: 3
};

function formatarQuantidade(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarMoeda(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarData(valor) {
  if (!valor) {
    return "-";
  }

  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
}

function montarFiltrosPeriodo(filtros) {
  return {
    data_inicial: filtros.data_inicial,
    data_final: filtros.data_final
  };
}

export default function PaginaRelatorios() {
  const [produtos, setProdutos] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [maisVendidos, setMaisVendidos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);

  const carregarDados = useCallback(async (filtrosAtuais) => {
    setCarregando(true);
    setMensagem(null);

    try {
      const [dadosProdutos, dadosMaisVendidos, dadosFinanceiro, dadosValidade, dadosHistorico] =
        await Promise.all([
          buscarProdutos(),
          buscarMaisVendidos({ limite: 5, ...montarFiltrosPeriodo(filtrosAtuais) }),
          buscarFinanceiro(montarFiltrosPeriodo(filtrosAtuais)),
          buscarValidade(filtrosAtuais.dias_alerta),
          buscarHistoricoGeral({
            limite: 20,
            produto_id: filtrosAtuais.produto_id,
            subtipo: filtrosAtuais.subtipo,
            data_inicial: filtrosAtuais.data_inicial,
            data_final: filtrosAtuais.data_final
          })
        ]);

      setProdutos(dadosProdutos.filter((produto) => produto.ativo));
      setMaisVendidos(dadosMaisVendidos);
      setFinanceiro(dadosFinanceiro);
      setValidade(dadosValidade);
      setMovimentacoes(dadosHistorico);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados(FILTROS_INICIAIS);
  }, [carregarDados]);

  const opcoesProdutos = useMemo(
    () => produtos.map((produto) => ({ label: produto.nome, value: produto.id })),
    [produtos]
  );

  function atualizarFiltro(campo, valor) {
    setFiltros((formularioAtual) => ({
      ...formularioAtual,
      [campo]: valor
    }));
  }

  async function aplicarFiltros() {
    await carregarDados(filtros);
  }

  async function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    await carregarDados(FILTROS_INICIAIS);
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Relatorios</h1>
          <p>Consulte indicadores de vendas, estoque, financeiro e validade.</p>
        </div>
      </header>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Filtros</h2>
            <p>Filtre os dados por periodo, produto, subtipo e prazo de alerta.</p>
          </div>
          <div className={styles.actions}>
            <Button label="Limpar" text onClick={limparFiltros} disabled={carregando} />
            <Button
              label="Atualizar relatorios"
              icon="pi pi-refresh"
              onClick={aplicarFiltros}
              loading={carregando}
            />
          </div>
        </div>

        <div className={styles.filterGrid}>
          <div className={styles.filterField}>
            <label htmlFor="relatorios-produto">Produto</label>
            <Dropdown
              id="relatorios-produto"
              value={filtros.produto_id}
              options={opcoesProdutos}
              onChange={(evento) => atualizarFiltro("produto_id", evento.value)}
              placeholder="Todos os produtos"
              showClear
              filter
              disabled={carregando}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-subtipo">Subtipo</label>
            <Dropdown
              id="relatorios-subtipo"
              value={filtros.subtipo}
              options={[
                { label: "Todos", value: "" },
                { label: "Venda", value: "venda" },
                { label: "Perda", value: "perda" },
                { label: "Compra", value: "compra" }
              ]}
              onChange={(evento) => atualizarFiltro("subtipo", evento.value)}
              placeholder="Todos"
              disabled={carregando}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-data-inicial">Data inicial</label>
            <InputText
              id="relatorios-data-inicial"
              type="date"
              value={filtros.data_inicial}
              onChange={(evento) => atualizarFiltro("data_inicial", evento.target.value)}
              disabled={carregando}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-data-final">Data final</label>
            <InputText
              id="relatorios-data-final"
              type="date"
              value={filtros.data_final}
              onChange={(evento) => atualizarFiltro("data_final", evento.target.value)}
              disabled={carregando}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="relatorios-dias-alerta">Dias para alerta</label>
            <InputNumber
              id="relatorios-dias-alerta"
              min={1}
              useGrouping={false}
              value={filtros.dias_alerta}
              onValueChange={(evento) => atualizarFiltro("dias_alerta", evento.value ?? 3)}
              disabled={carregando}
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
              loading={carregando}
              emptyMessage="Nenhuma venda encontrada para os filtros informados."
              responsiveLayout="scroll"
            >
              <Column field="produto_nome" header="Produto" />
              <Column field="categoria" header="Categoria" />
              <Column
                field="total_vendido"
                header="Quantidade"
                body={(linha) => formatarQuantidade(linha.total_vendido)}
              />
              <Column
                field="receita_total"
                header="Receita"
                body={(linha) => formatarMoeda(linha.receita_total)}
              />
              <Column
                field="lucro_bruto_total"
                header="Lucro Bruto"
                body={(linha) => formatarMoeda(linha.lucro_bruto_total)}
              />
              <Column field="total_movimentacoes" header="Vendas" />
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel header="Financeiro">
          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <span>Receita total</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.receita_total)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Custo das vendas</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.custo_total_vendas)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Lucro bruto</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.lucro_bruto_total)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Perdas no periodo</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.perdas_total_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor do estoque a custo</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor do estoque a venda</span>
              <strong>{carregando ? "--" : formatarMoeda(financeiro?.valor_estoque_venda)}</strong>
            </article>
          </div>
        </TabPanel>

        <TabPanel header="Validade">
          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <span>Itens vencidos</span>
              <strong>{carregando ? "--" : validade?.vencidos.length ?? 0}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Itens em risco</span>
              <strong>{carregando ? "--" : validade?.proximos_vencimento.length ?? 0}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor vencido a custo</span>
              <strong>{carregando ? "--" : formatarMoeda(validade?.total_vencido_custo)}</strong>
            </article>

            <article className={styles.metricCard}>
              <span>Valor em risco a custo</span>
              <strong>{carregando ? "--" : formatarMoeda(validade?.total_em_risco_custo)}</strong>
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
                loading={carregando}
                emptyMessage="Nenhum produto vencido no momento."
                responsiveLayout="scroll"
              >
                <Column field="produto_nome" header="Produto" />
                <Column
                  field="quantidade_total"
                  header="Quantidade"
                  body={(linha) => formatarQuantidade(linha.quantidade_total)}
                />
                <Column
                  field="valor_custo"
                  header="Valor Custo"
                  body={(linha) => formatarMoeda(linha.valor_custo)}
                />
                <Column
                  field="proxima_validade"
                  header="Validade"
                  body={(linha) => formatarData(linha.proxima_validade)}
                />
              </DataTable>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Proximos do vencimento</h2>
                  <p>Produtos que vencem dentro do prazo de alerta escolhido.</p>
                </div>
              </div>

              <DataTable
                value={validade?.proximos_vencimento ?? []}
                dataKey="produto_id"
                loading={carregando}
                emptyMessage="Nenhum produto em risco dentro do prazo selecionado."
                responsiveLayout="scroll"
              >
                <Column field="produto_nome" header="Produto" />
                <Column
                  field="quantidade_total"
                  header="Quantidade"
                  body={(linha) => formatarQuantidade(linha.quantidade_total)}
                />
                <Column
                  field="valor_custo"
                  header="Valor Custo"
                  body={(linha) => formatarMoeda(linha.valor_custo)}
                />
                <Column
                  field="proxima_validade"
                  header="Validade"
                  body={(linha) => formatarData(linha.proxima_validade)}
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
                <p>Movimentacoes recentes com valores de custo, receita e lucro.</p>
              </div>
            </div>

            <DataTable
              value={movimentacoes}
              dataKey="id"
              loading={carregando}
              emptyMessage="Nenhuma movimentacao encontrada para os filtros informados."
              responsiveLayout="scroll"
            >
              <Column field="data" header="Data" body={(linha) => formatarData(linha.data)} />
              <Column field="produto_nome" header="Produto" />
              <Column field="tipo" header="Tipo" />
              <Column field="subtipo" header="Subtipo" />
              <Column
                field="quantidade"
                header="Quantidade"
                body={(linha) => formatarQuantidade(linha.quantidade)}
              />
              <Column
                field="custo_total"
                header="Custo"
                body={(linha) => formatarMoeda(linha.custo_total)}
              />
              <Column
                field="receita_total"
                header="Receita"
                body={(linha) => formatarMoeda(linha.receita_total)}
              />
              <Column
                field="lucro_bruto"
                header="Lucro Bruto"
                body={(linha) => formatarMoeda(linha.lucro_bruto)}
              />
              <Column field="usuario_nome" header="Responsavel" />
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </section>
  );
}
