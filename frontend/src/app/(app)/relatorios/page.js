"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import { buscarProdutos } from "@/services/servicoProdutos";
import {
  buscarFinanceiro,
  buscarHistoricoGeral,
  buscarMaisVendidos,
  buscarValidade
} from "@/services/servicoRelatorios";
import { formatarData, formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";

import styles from "./page.module.css";

const FILTROS_INICIAIS = {
  produto_id: null,
  subtipo: "",
  data_inicial: "",
  data_final: "",
  dias_alerta: 3
};

function montarFiltrosPeriodo(filtros) {
  return {
    data_inicial: filtros.data_inicial,
    data_final: filtros.data_final
  };
}

function formatarDataIso(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterPeriodoRapido(tipo) {
  const hoje = new Date();
  const inicio = new Date(hoje);

  if (tipo === "7d") {
    inicio.setDate(hoje.getDate() - 6);
  } else if (tipo === "30d") {
    inicio.setDate(hoje.getDate() - 29);
  } else if (tipo === "mes") {
    inicio.setDate(1);
  }

  return {
    data_inicial: formatarDataIso(inicio),
    data_final: formatarDataIso(hoje)
  };
}

function escaparCsv(valor) {
  const texto = String(valor ?? "");
  return `"${texto.replaceAll('"', '""')}"`;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function baixarArquivo(conteudo, nomeArquivo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

export default function PaginaRelatorios() {
  const notificacaoRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [maisVendidos, setMaisVendidos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [financeiro, setFinanceiro] = useState(null);
  const [validade, setValidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(true);

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
            limite: 50,
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

  useEffect(() => {
    if (window.matchMedia("(max-width: 680px)").matches) {
      setFiltrosVisiveis(false);
    }
  }, []);

  const opcoesProdutos = useMemo(
    () => produtos.map((produto) => ({ label: produto.nome, value: produto.id })),
    [produtos]
  );

  const indicadoresPrincipais = useMemo(
    () => [
      {
        label: "Receita total",
        valor: Number(financeiro?.receita_total ?? 0),
        icone: "pi pi-wallet",
        tom: "positive"
      },
      {
        label: "Lucro bruto",
        valor: Number(financeiro?.lucro_bruto_total ?? 0),
        icone: "pi pi-arrow-up-right",
        tom: "positive"
      },
      {
        label: "Perdas no período",
        valor: Number(financeiro?.perdas_total_custo ?? 0),
        icone: "pi pi-exclamation-circle",
        tom: "danger"
      },
      {
        label: "Estoque a custo",
        valor: Number(financeiro?.valor_estoque_custo ?? 0),
        icone: "pi pi-box",
        tom: "neutral"
      }
    ],
    [financeiro]
  );

  const indicadoresSecundarios = useMemo(
    () => [
      { label: "Custo das vendas", valor: Number(financeiro?.custo_total_vendas ?? 0) },
      { label: "Estoque à venda", valor: Number(financeiro?.valor_estoque_venda ?? 0) }
    ],
    [financeiro]
  );

  const periodoSelecionado =
    filtros.data_inicial || filtros.data_final
      ? `${filtros.data_inicial ? formatarData(filtros.data_inicial) : "Início"} até ${
          filtros.data_final ? formatarData(filtros.data_final) : "hoje"
        }`
      : "Todo o período";

  const dadosGrafico = useMemo(
    () => [
      { label: "Receita", valor: Number(financeiro?.receita_total ?? 0), tom: "receita" },
      { label: "Custo", valor: Number(financeiro?.custo_total_vendas ?? 0), tom: "custo" },
      { label: "Lucro", valor: Number(financeiro?.lucro_bruto_total ?? 0), tom: "lucro" },
      { label: "Perdas", valor: Number(financeiro?.perdas_total_custo ?? 0), tom: "perda" }
    ],
    [financeiro]
  );

  const maiorValorGrafico = useMemo(
    () => Math.max(...dadosGrafico.map((item) => item.valor), 1),
    [dadosGrafico]
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

  async function aplicarPeriodoRapido(tipo) {
    const periodo = obterPeriodoRapido(tipo);
    const proximosFiltros = { ...filtros, ...periodo };
    setFiltros(proximosFiltros);
    await carregarDados(proximosFiltros);
  }

  function renderizarTipo(linha) {
    const rotulo =
      linha.tipo === "entrada"
        ? "Entrada"
        : linha.subtipo === "venda"
          ? "Venda"
          : linha.subtipo === "perda"
            ? "Perda"
            : "Saída";
    const severity = linha.tipo === "entrada" ? "success" : linha.subtipo === "perda" ? "danger" : "info";

    return <Tag value={rotulo} severity={severity} />;
  }

  function exportarCsv() {
    if (movimentacoes.length === 0) {
      notificacaoRef.current?.show({
        severity: "warn",
        summary: "Nada para exportar",
        detail: "Aplique outro filtro para gerar um relatório com movimentações.",
        life: 2800
      });
      return;
    }

    const cabecalho = [
      "Data",
      "Produto",
      "Tipo",
      "Subtipo",
      "Quantidade",
      "Unidade",
      "Custo",
      "Receita",
      "Lucro Bruto",
      "Responsável"
    ];
    const linhas = movimentacoes.map((linha) => [
      linha.data,
      linha.produto_nome,
      linha.tipo,
      linha.subtipo ?? "",
      linha.quantidade,
      linha.unidade_medida,
      linha.custo_total ?? "",
      linha.receita_total ?? "",
      linha.lucro_bruto ?? "",
      linha.usuario_nome ?? ""
    ]);
    const conteudo = [cabecalho, ...linhas]
      .map((linha) => linha.map(escaparCsv).join(";"))
      .join("\n");

    baixarArquivo(`\uFEFF${conteudo}`, "relatorio-movimentacoes.csv", "text/csv;charset=utf-8;");
    notificacaoRef.current?.show({
      severity: "success",
      summary: "CSV gerado",
      detail: "O relatório detalhado foi exportado.",
      life: 2400
    });
  }

  function exportarPdf() {
    if (movimentacoes.length === 0) {
      notificacaoRef.current?.show({
        severity: "warn",
        summary: "Nada para exportar",
        detail: "Aplique outro filtro para gerar um relatório com movimentações.",
        life: 2800
      });
      return;
    }

    const janela = window.open("", "_blank", "width=960,height=720");

    if (!janela) {
      notificacaoRef.current?.show({
        severity: "error",
        summary: "Exportação bloqueada",
        detail: "Permita pop-ups para abrir a visualização de impressão.",
        life: 3200
      });
      return;
    }

    const linhas = movimentacoes
      .map(
        (linha) => `
          <tr>
            <td>${formatarData(linha.data)}</td>
            <td>${escaparHtml(linha.produto_nome)}</td>
            <td>${escaparHtml(linha.tipo)}</td>
            <td>${escaparHtml(linha.subtipo ?? "-")}</td>
            <td>${formatarQuantidadeComUnidade(linha.quantidade, linha.unidade_medida)}</td>
            <td>${formatarMoeda(linha.custo_total, { exibirVazio: true })}</td>
            <td>${formatarMoeda(linha.receita_total, { exibirVazio: true })}</td>
            <td>${formatarMoeda(linha.lucro_bruto, { exibirVazio: true })}</td>
          </tr>
        `
      )
      .join("");

    janela.document.write(`
      <html>
        <head>
          <title>Relatório de movimentações</title>
          <style>
            body { font-family: Arial, sans-serif; color: #172019; padding: 24px; }
            h1 { margin: 0 0 8px; }
            p { color: #5f6962; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
            th, td { border: 1px solid #d9dfdb; padding: 8px; text-align: left; }
            th { background: #2f6f4e; color: #ffffff; }
          </style>
        </head>
        <body>
          <h1>Relatório de movimentações</h1>
          <p>Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Subtipo</th>
                <th>Quantidade</th>
                <th>Custo</th>
                <th>Receita</th>
                <th>Lucro Bruto</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </body>
      </html>
    `);
    janela.document.close();
    janela.focus();
    janela.print();
  }

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Análise do negócio</span>
          <h1>Relatórios</h1>
          <p>Acompanhe resultado, perdas, validade e movimentações em um só lugar.</p>
        </div>
        <div className={styles.headerMeta}>
          <span>Período analisado</span>
          <strong>{periodoSelecionado}</strong>
        </div>
      </header>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={`${styles.panel} ${styles.filterPanel}`}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionIcon}><i className="pi pi-sliders-h" /></span>
            <div>
              <h2>Filtros do relatório</h2>
              <p>Refine o período e as movimentações que deseja analisar.</p>
            </div>
          </div>
          <div className={styles.actions}>
            {filtrosVisiveis ? (
              <>
                <Button label="Limpar" text onClick={limparFiltros} disabled={carregando} />
                <Button label="Atualizar" icon="pi pi-refresh" onClick={aplicarFiltros} loading={carregando} />
              </>
            ) : null}
            <Button
              label={filtrosVisiveis ? "Ocultar filtros" : "Editar filtros"}
              icon={filtrosVisiveis ? "pi pi-chevron-up" : "pi pi-sliders-h"}
              outlined
              onClick={() => setFiltrosVisiveis((valorAtual) => !valorAtual)}
            />
          </div>
        </div>

        {filtrosVisiveis ? (
          <>
          <div className={styles.quickPeriods} aria-label="Períodos rápidos">
            <span>Período rápido</span>
            <Button label="Hoje" text size="small" onClick={() => aplicarPeriodoRapido("hoje")} />
            <Button label="7 dias" text size="small" onClick={() => aplicarPeriodoRapido("7d")} />
            <Button label="30 dias" text size="small" onClick={() => aplicarPeriodoRapido("30d")} />
            <Button label="Este mês" text size="small" onClick={() => aplicarPeriodoRapido("mes")} />
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
              <label htmlFor="relatorios-subtipo">Tipo</label>
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
          </>
        ) : null}
      </div>

      <div className={styles.metrics}>
        {indicadoresPrincipais.map((indicador) => (
          <article
            className={`${styles.metricCard} ${styles[`metricCard_${indicador.tom}`]}`}
            key={indicador.label}
          >
            <div className={styles.metricTop}>
              <span>{indicador.label}</span>
              <i className={indicador.icone} aria-hidden="true" />
            </div>
            <strong className={carregando ? styles.skeletonValue : ""}>
              {carregando ? "Carregando" : formatarMoeda(indicador.valor)}
            </strong>
          </article>
        ))}
      </div>

      <div className={styles.insightsGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionIcon}><i className="pi pi-chart-bar" /></span>
              <div>
                <h2>Desempenho financeiro</h2>
                <p>Comparativo dos valores consolidados no período.</p>
              </div>
            </div>
          </div>

          <div className={styles.chart}>
            {dadosGrafico.map((item) => (
              <div className={styles.chartRow} key={item.label}>
                <span>{item.label}</span>
                <div className={styles.chartTrack}>
                  <div
                    className={`${styles.chartBar} ${styles[`chartBar_${item.tom}`]}`}
                    style={{ width: `${(item.valor / maiorValorGrafico) * 100}%` }}
                  />
                </div>
                <strong>{carregando ? "--" : formatarMoeda(item.valor)}</strong>
              </div>
            ))}
          </div>

          <div className={styles.secondaryMetrics}>
            {indicadoresSecundarios.map((indicador) => (
              <div key={indicador.label}>
                <span>{indicador.label}</span>
                <strong>{carregando ? "--" : formatarMoeda(indicador.valor)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.validityPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={`${styles.sectionIcon} ${styles.sectionIconWarning}`}>
                <i className="pi pi-clock" />
              </span>
              <div>
                <h2>Saúde do estoque</h2>
                <p>Itens vencidos ou próximos do limite definido.</p>
              </div>
            </div>
          </div>

          <div className={styles.validitySummary}>
            <article>
              <span>Itens vencidos</span>
              <strong>{carregando ? "--" : validade?.vencidos.length ?? 0}</strong>
            </article>
            <article>
              <span>Itens em risco</span>
              <strong>{carregando ? "--" : validade?.proximos_vencimento.length ?? 0}</strong>
            </article>
            <article>
              <span>Valor vencido</span>
              <strong>{carregando ? "--" : formatarMoeda(validade?.total_vencido_custo)}</strong>
            </article>
            <article>
              <span>Valor em risco</span>
              <strong>{carregando ? "--" : formatarMoeda(validade?.total_em_risco_custo)}</strong>
            </article>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionIcon}><i className="pi pi-list" /></span>
            <div>
              <h2>Movimentações detalhadas</h2>
              <p>{movimentacoes.length} registros encontrados nos filtros atuais.</p>
            </div>
          </div>
          <div className={styles.actions}>
            <Button label="Exportar CSV" icon="pi pi-download" text onClick={exportarCsv} />
            <Button label="Exportar PDF" icon="pi pi-file-pdf" onClick={exportarPdf} />
          </div>
        </div>

        {movimentacoes.length === 0 && !carregando ? (
          <EstadoVazio
            icone="pi pi-chart-bar"
            titulo="Nenhuma movimentação encontrada."
            descricao="Ajuste o período ou os filtros para visualizar o relatório detalhado."
          />
        ) : (
          <DataTable
            value={movimentacoes}
            dataKey="id"
            loading={carregando}
            responsiveLayout="scroll"
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} a {last} de {totalRecords}"
          >
            <Column field="data" header="Data" body={(linha) => formatarData(linha.data)} />
            <Column field="produto_nome" header="Produto" />
            <Column field="tipo" header="Movimentação" body={renderizarTipo} />
            <Column
              field="quantidade"
              header="Quantidade"
              body={(linha) => formatarQuantidadeComUnidade(linha.quantidade, linha.unidade_medida)}
            />
            <Column field="custo_total" header="Custo" body={(linha) => formatarMoeda(linha.custo_total, { exibirVazio: true })} />
            <Column field="receita_total" header="Receita" body={(linha) => formatarMoeda(linha.receita_total, { exibirVazio: true })} />
            <Column field="lucro_bruto" header="Lucro Bruto" body={(linha) => formatarMoeda(linha.lucro_bruto, { exibirVazio: true })} />
            <Column field="usuario_nome" header="Responsável" body={(linha) => linha.usuario_nome ?? "-"} />
          </DataTable>
        )}

        {movimentacoes.length > 0 ? (
          <div className={styles.mobileList}>
            {movimentacoes.map((linha) => (
              <article className={styles.mobileRecord} key={linha.id}>
                <div className={styles.mobileRecordHeader}>
                  <div>
                    <strong>{linha.produto_nome}</strong>
                    <span>{formatarData(linha.data)}</span>
                  </div>
                  {renderizarTipo(linha)}
                </div>
                <dl>
                  <div>
                    <dt>Quantidade</dt>
                    <dd>{formatarQuantidadeComUnidade(linha.quantidade, linha.unidade_medida)}</dd>
                  </div>
                  <div>
                    <dt>Receita</dt>
                    <dd>{formatarMoeda(linha.receita_total, { exibirVazio: true })}</dd>
                  </div>
                  <div>
                    <dt>Lucro bruto</dt>
                    <dd>{formatarMoeda(linha.lucro_bruto, { exibirVazio: true })}</dd>
                  </div>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{linha.usuario_nome ?? "-"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.tablesGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionIcon}><i className="pi pi-star" /></span>
              <div>
                <h2>Top 5 produtos vendidos</h2>
                <p>Produtos com maior saída no período.</p>
              </div>
            </div>
          </div>

          {maisVendidos.length === 0 && !carregando ? (
            <EstadoVazio
              icone="pi pi-shopping-cart"
              titulo="Nenhuma venda registrada no período."
              descricao="As vendas aparecerão aqui quando houver movimentações compatíveis com os filtros."
            />
          ) : (
            <DataTable value={maisVendidos} dataKey="produto_id" loading={carregando} responsiveLayout="scroll">
              <Column field="produto_nome" header="Produto" />
              <Column
                field="total_vendido"
                header="Quantidade"
                body={(linha) => formatarQuantidadeComUnidade(linha.total_vendido, linha.unidade_medida)}
              />
              <Column field="receita_total" header="Receita" body={(linha) => formatarMoeda(linha.receita_total)} />
              <Column field="lucro_bruto_total" header="Lucro" body={(linha) => formatarMoeda(linha.lucro_bruto_total)} />
            </DataTable>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={`${styles.sectionIcon} ${styles.sectionIconWarning}`}>
                <i className="pi pi-calendar" />
              </span>
              <div>
                <h2>Próximos do vencimento</h2>
                <p>Priorize a saída destes lotes.</p>
              </div>
            </div>
          </div>

          {(validade?.proximos_vencimento.length ?? 0) === 0 && !carregando ? (
            <EstadoVazio
              icone="pi pi-calendar"
              titulo="Nenhum produto em risco."
              descricao="Não há itens próximos do vencimento dentro do prazo selecionado."
            />
          ) : (
            <DataTable
              value={validade?.proximos_vencimento ?? []}
              dataKey="produto_id"
              loading={carregando}
              responsiveLayout="scroll"
            >
              <Column field="produto_nome" header="Produto" />
              <Column
                field="quantidade_total"
                header="Quantidade"
                body={(linha) => formatarQuantidadeComUnidade(linha.quantidade_total, linha.unidade_medida)}
              />
              <Column field="valor_custo" header="Valor Custo" body={(linha) => formatarMoeda(linha.valor_custo)} />
              <Column field="proxima_validade" header="Validade" body={(linha) => formatarData(linha.proxima_validade)} />
            </DataTable>
          )}
        </div>
      </div>
    </section>
  );
}
