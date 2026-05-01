"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";

import {
  getCamadasPorProduto,
  getMovimentacoesPorProduto,
  getProdutoById,
  postEntrada,
  postSaida
} from "@/services/produtosService";

import styles from "./page.module.css";

const subtipoSaidaOptions = [
  { label: "Venda", value: "venda" },
  { label: "Perda", value: "perda" }
];

const initialMovimentacaoForm = {
  quantidade: null,
  custo_unitario: null,
  subtipo: "venda",
  observacao: ""
};

function formatQuantidade(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatMoeda(value) {
  if (value == null) {
    return "-";
  }

  return Number(value).toLocaleString("pt-BR", {
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

function isEstoqueBaixo(produto) {
  return Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0) < Number(produto?.estoque_minimo ?? 0);
}

export default function ProdutoDetalhePage({ params }) {
  const produtoId = params?.id;

  const [produto, setProduto] = useState(null);
  const [camadas, setCamadas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [movimentacaoForm, setMovimentacaoForm] = useState(initialMovimentacaoForm);
  const [submittingMovimentacao, setSubmittingMovimentacao] = useState(false);

  async function carregarDetalhe() {
    setLoading(true);

    try {
      const [produtoData, camadasData, movimentacoesData] = await Promise.all([
        getProdutoById(produtoId),
        getCamadasPorProduto(produtoId),
        getMovimentacoesPorProduto(produtoId)
      ]);

      setProduto(produtoData);
      setCamadas(camadasData);
      setMovimentacoes(movimentacoesData);
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (produtoId) {
      carregarDetalhe();
    }
  }, [produtoId]);

  function abrirMovimentacao(tipo) {
    setMovimentacaoForm({
      quantidade: null,
      custo_unitario: null,
      subtipo: tipo === "saida" ? "venda" : "",
      observacao: ""
    });

    setModalEntrada(tipo === "entrada");
    setModalSaida(tipo === "saida");
  }

  function fecharMovimentacao() {
    setModalEntrada(false);
    setModalSaida(false);
    setMovimentacaoForm(initialMovimentacaoForm);
  }

  async function handleSubmitMovimentacao(event, tipo) {
    event.preventDefault();

    if (movimentacaoForm.quantidade == null || Number(movimentacaoForm.quantidade) <= 0) {
      setFeedback({ severity: "error", text: "Informe uma quantidade maior que zero." });
      return;
    }

    if (
      tipo === "entrada" &&
      (movimentacaoForm.custo_unitario == null || Number(movimentacaoForm.custo_unitario) <= 0)
    ) {
      setFeedback({ severity: "error", text: "Informe um custo unitario maior que zero para a entrada." });
      return;
    }

    setSubmittingMovimentacao(true);
    setFeedback(null);

    try {
      const payload = {
        produto_id: Number(produtoId),
        quantidade: Number(movimentacaoForm.quantidade).toFixed(3),
        observacao: movimentacaoForm.observacao.trim() || null,
        ...(tipo === "entrada"
          ? { custo_unitario: Number(movimentacaoForm.custo_unitario).toFixed(2) }
          : {}),
        ...(tipo === "saida" ? { subtipo: movimentacaoForm.subtipo } : {})
      };

      if (tipo === "entrada") {
        await postEntrada(payload);
      } else {
        await postSaida(payload);
      }

      fecharMovimentacao();
      await carregarDetalhe();
      setFeedback({
        severity: "success",
        text: tipo === "entrada" ? "Entrada registrada com sucesso." : "Saida registrada com sucesso."
      });
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setSubmittingMovimentacao(false);
    }
  }

  const estoqueBaixo = isEstoqueBaixo(produto);

  return (
    <section className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/estoque">
          ← Voltar ao Estoque
        </Link>
      </div>

      {feedback ? <Message severity={feedback.severity} text={feedback.text} /> : null}

      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Detalhe do produto</p>
          <h1>{produto?.nome ?? "Carregando..."}</h1>
          <div className={styles.meta}>
            <Tag value={produto?.categoria ?? "-"} />
            <Tag value={produto?.unidade_medida ?? "-"} severity="info" />
            {estoqueBaixo ? <Tag value="Estoque baixo" severity="danger" /> : null}
          </div>
        </div>

        <div className={styles.stockCard}>
          <span>Quantidade em estoque</span>
          <strong>{produto ? formatQuantidade(produto.quantidade_atual) : "--"}</strong>
          <small>Venda: {produto ? formatQuantidade(produto.quantidade_disponivel_venda) : "--"}</small>
          <small>Vencido: {produto ? formatQuantidade(produto.quantidade_vencida) : "--"}</small>
        </div>
      </div>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <span>Preco de venda</span>
          <strong>{produto ? formatMoeda(produto.preco_venda_padrao) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Valor em custo</span>
          <strong>{produto ? formatMoeda(produto.valor_estoque_custo) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Valor em venda</span>
          <strong>{produto ? formatMoeda(produto.valor_estoque_venda) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Proxima validade</span>
          <strong>{produto ? formatData(produto.proxima_validade) : "--"}</strong>
          <small>{produto ? `${produto.validade_dias_padrao} dia(s) por entrada` : "--"}</small>
        </article>
      </div>

      <div className={styles.actions}>
        <Button label="Registrar Entrada" icon="pi pi-plus" onClick={() => abrirMovimentacao("entrada")} />
        <Button
          label="Registrar Saida"
          icon="pi pi-minus"
          severity="warning"
          onClick={() => abrirMovimentacao("saida")}
        />
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Camadas abertas</h2>
          <p>Ordem FEFO por validade, mostrando o que ainda pode ser consumido do produto.</p>
        </div>

        <DataTable
          value={camadas}
          dataKey="id"
          loading={loading}
          emptyMessage="Nenhuma camada aberta encontrada para este produto."
          responsiveLayout="scroll"
        >
          <Column field="data_entrada" header="Entrada" body={(row) => formatData(row.data_entrada)} />
          <Column field="data_validade" header="Validade" body={(row) => formatData(row.data_validade)} />
          <Column
            field="quantidade_disponivel"
            header="Disponivel"
            body={(row) => formatQuantidade(row.quantidade_disponivel)}
          />
          <Column
            field="custo_unitario"
            header="Custo Unit."
            body={(row) => formatMoeda(row.custo_unitario)}
          />
        </DataTable>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Historico de movimentacoes</h2>
          <p>Ultimas movimentacoes do item, do registro mais recente para o mais antigo.</p>
        </div>

        <DataTable
          value={movimentacoes}
          dataKey="id"
          loading={loading}
          emptyMessage="Nenhuma movimentacao encontrada para este produto."
          responsiveLayout="scroll"
        >
          <Column field="data" header="Data" body={(row) => formatData(row.data)} />
          <Column field="tipo" header="Tipo" />
          <Column field="subtipo" header="Subtipo" body={(row) => row.subtipo ?? "-"} />
          <Column field="quantidade" header="Quantidade" body={(row) => formatQuantidade(row.quantidade)} />
          <Column field="custo_total" header="Custo" body={(row) => formatMoeda(row.custo_total)} />
          <Column field="receita_total" header="Receita" body={(row) => formatMoeda(row.receita_total)} />
          <Column field="lucro_bruto" header="Lucro Bruto" body={(row) => formatMoeda(row.lucro_bruto)} />
          <Column field="usuario_nome" header="Responsavel" body={(row) => row.usuario_nome ?? "-"} />
          <Column field="observacao" header="Observacao" body={(row) => row.observacao ?? "-"} />
        </DataTable>
      </div>

      <Dialog
        visible={modalEntrada || modalSaida}
        header={modalEntrada ? "Registrar Entrada" : "Registrar Saida"}
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharMovimentacao}
      >
        <form
          className={styles.form}
          onSubmit={(event) => handleSubmitMovimentacao(event, modalEntrada ? "entrada" : "saida")}
        >
          <div className={styles.field}>
            <label htmlFor="detalhe-quantidade">Quantidade</label>
            <InputNumber
              id="detalhe-quantidade"
              inputId="detalhe-quantidade-input"
              min={0}
              minFractionDigits={0}
              maxFractionDigits={3}
              mode="decimal"
              value={movimentacaoForm.quantidade}
              onValueChange={(event) =>
                setMovimentacaoForm((current) => ({ ...current, quantidade: event.value }))
              }
            />
          </div>

          {modalEntrada ? (
            <div className={styles.field}>
              <label htmlFor="detalhe-custo-unitario">Custo unitario</label>
              <InputNumber
                id="detalhe-custo-unitario"
                inputId="detalhe-custo-unitario-input"
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                mode="decimal"
                value={movimentacaoForm.custo_unitario}
                onValueChange={(event) =>
                  setMovimentacaoForm((current) => ({ ...current, custo_unitario: event.value }))
                }
              />
            </div>
          ) : null}

          {modalSaida ? (
            <div className={styles.field}>
              <label htmlFor="detalhe-subtipo">Tipo da saida</label>
              <Dropdown
                id="detalhe-subtipo"
                value={movimentacaoForm.subtipo}
                options={subtipoSaidaOptions}
                onChange={(event) => setMovimentacaoForm((current) => ({ ...current, subtipo: event.value }))}
              />
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="detalhe-observacao">Observacao</label>
            <InputTextarea
              id="detalhe-observacao"
              rows={4}
              value={movimentacaoForm.observacao}
              onChange={(event) =>
                setMovimentacaoForm((current) => ({ ...current, observacao: event.target.value }))
              }
            />
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharMovimentacao} />
            <Button
              label={modalEntrada ? "Salvar Entrada" : "Salvar Saida"}
              type="submit"
              loading={submittingMovimentacao}
            />
          </div>
        </form>
      </Dialog>
    </section>
  );
}
