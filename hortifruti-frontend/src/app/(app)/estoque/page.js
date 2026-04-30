"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";

import {
  criarProduto,
  getProdutos,
  postEntrada,
  postSaida
} from "@/services/produtosService";

import styles from "./page.module.css";

const categoriaOptions = [
  { label: "Fruta", value: "fruta" },
  { label: "Legume", value: "legume" },
  { label: "Verdura", value: "verdura" }
];

const unidadeOptions = [
  { label: "Kg", value: "kg" },
  { label: "Unidade", value: "un" },
  { label: "Caixa", value: "cx" }
];

const subtipoSaidaOptions = [
  { label: "Venda", value: "venda" },
  { label: "Perda", value: "perda" }
];

const initialProdutoForm = {
  nome: "",
  categoria: "fruta",
  unidade_medida: "kg",
  estoque_minimo: 0,
  preco_venda_padrao: 0,
  validade_dias_padrao: 1
};

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

function isEstoqueBaixo(produto) {
  return Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0) < Number(produto.estoque_minimo ?? 0);
}

function validarProdutoForm(form) {
  if (!form.nome.trim()) {
    return "Informe o nome do produto.";
  }

  if (form.estoque_minimo == null || Number(form.estoque_minimo) < 0) {
    return "O estoque minimo deve ser zero ou maior.";
  }

  if (form.preco_venda_padrao == null || Number(form.preco_venda_padrao) < 0) {
    return "Informe um preco de venda valido.";
  }

  if (form.validade_dias_padrao == null || Number(form.validade_dias_padrao) < 1) {
    return "A validade padrao deve ser de pelo menos 1 dia.";
  }

  return null;
}

function validarMovimentacaoForm(form, tipo) {
  if (form.quantidade == null || Number(form.quantidade) <= 0) {
    return "Informe uma quantidade maior que zero.";
  }

  if (tipo === "entrada" && (form.custo_unitario == null || Number(form.custo_unitario) <= 0)) {
    return "Informe um custo unitario maior que zero para a entrada.";
  }

  return null;
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [produtoForm, setProdutoForm] = useState(initialProdutoForm);
  const [movimentacaoForm, setMovimentacaoForm] = useState(initialMovimentacaoForm);
  const [submittingProduto, setSubmittingProduto] = useState(false);
  const [submittingMovimentacao, setSubmittingMovimentacao] = useState(false);

  async function carregarProdutos(options = {}) {
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const data = await getProdutos();
      setProdutos(data);
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  function abrirMovimentacao(tipo, produto) {
    setProdutoSelecionado(produto);
    setMovimentacaoForm({
      quantidade: null,
      custo_unitario: null,
      subtipo: tipo === "saida" ? "venda" : "",
      observacao: ""
    });

    setModalEntrada(tipo === "entrada");
    setModalSaida(tipo === "saida");
  }

  function fecharModalProduto() {
    setModalProduto(false);
    setProdutoForm(initialProdutoForm);
  }

  function fecharModalMovimentacao() {
    setModalEntrada(false);
    setModalSaida(false);
    setProdutoSelecionado(null);
    setMovimentacaoForm(initialMovimentacaoForm);
  }

  async function handleSubmitProduto(event) {
    event.preventDefault();
    const validationMessage = validarProdutoForm(produtoForm);

    if (validationMessage) {
      setFeedback({ severity: "error", text: validationMessage });
      return;
    }

    setSubmittingProduto(true);
    setFeedback(null);

    try {
      await criarProduto({
        ...produtoForm,
        nome: produtoForm.nome.trim(),
        estoque_minimo: Number(produtoForm.estoque_minimo ?? 0).toFixed(3),
        preco_venda_padrao: Number(produtoForm.preco_venda_padrao ?? 0).toFixed(2),
        validade_dias_padrao: Number(produtoForm.validade_dias_padrao ?? 1)
      });
      fecharModalProduto();
      await carregarProdutos({ silent: true });
      setFeedback({ severity: "success", text: "Produto cadastrado com sucesso." });
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setSubmittingProduto(false);
    }
  }

  async function handleSubmitMovimentacao(event, tipo) {
    event.preventDefault();
    const validationMessage = validarMovimentacaoForm(movimentacaoForm, tipo);

    if (validationMessage || !produtoSelecionado) {
      setFeedback({ severity: "error", text: validationMessage ?? "Selecione um produto." });
      return;
    }

    setSubmittingMovimentacao(true);
    setFeedback(null);

    try {
      const payload = {
        produto_id: produtoSelecionado.id,
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

      fecharModalMovimentacao();
      await carregarProdutos({ silent: true });
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

  const produtosAtivos = useMemo(() => produtos.filter((produto) => produto.ativo), [produtos]);

  function quantidadeBodyTemplate(produto) {
    const estoqueBaixo = isEstoqueBaixo(produto);
    const possuiVencido = Number(produto.quantidade_vencida ?? 0) > 0;

    return (
      <div className={styles.quantityCell}>
        <div className={styles.quantityStack}>
          <strong>Total: {formatQuantidade(produto.quantidade_atual)}</strong>
          <span>Venda: {formatQuantidade(produto.quantidade_disponivel_venda)}</span>
          {possuiVencido ? <span>Vencido: {formatQuantidade(produto.quantidade_vencida)}</span> : null}
        </div>
        {estoqueBaixo ? <Tag severity="danger" value="Abaixo do minimo" /> : null}
        {possuiVencido ? <Tag severity="warning" value="Com vencidos" /> : null}
      </div>
    );
  }

  function acoesBodyTemplate(produto) {
    return (
      <div className={styles.actions}>
        <Button
          label="Entrada"
          icon="pi pi-plus"
          size="small"
          onClick={() => abrirMovimentacao("entrada", produto)}
        />
        <Button
          label="Saida"
          icon="pi pi-minus"
          size="small"
          severity="warning"
          onClick={() => abrirMovimentacao("saida", produto)}
        />
        <Link href={`/produtos/${produto.id}`}>
          <Button label="Ver Detalhe" icon="pi pi-eye" size="small" text />
        </Link>
      </div>
    );
  }

  function rowClassName(produto) {
    return {
      [styles.lowStockRow]: isEstoqueBaixo(produto)
    };
  }

  const dialogFooter = (submitHandler, loadingLabel) => (
    <div className={styles.dialogFooter}>
      <Button label="Cancelar" type="button" text onClick={submitHandler === handleSubmitProduto ? fecharModalProduto : fecharModalMovimentacao} />
      <Button label={loadingLabel} type="submit" loading={submitHandler === handleSubmitProduto ? submittingProduto : submittingMovimentacao} />
    </div>
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Estoque</h1>
          <p>Gerencie produtos, entradas e saidas manuais sem recarregar a pagina.</p>
        </div>

        <Button label="Cadastrar Produto" icon="pi pi-plus" onClick={() => setModalProduto(true)} />
      </header>

      <div className={styles.panel}>
        {feedback ? (
          <div className={styles.feedback}>
            <Message severity={feedback.severity} text={feedback.text} />
          </div>
        ) : null}

        <div className={styles.toolbar}>
          <div className={styles.toolbarTitle}>
            <h2>Produtos</h2>
            <p>Lista principal do estoque com destaque visual para saldo abaixo do minimo.</p>
          </div>

          <span className={`p-input-icon-left ${styles.searchBox}`}>
            <i className="pi pi-search" />
            <InputText
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar por nome"
            />
          </span>
        </div>

        <DataTable
          value={produtosAtivos}
          dataKey="id"
          loading={loading}
          globalFilter={globalFilter}
          globalFilterFields={["nome"]}
          emptyMessage="Nenhum produto encontrado."
          rowClassName={rowClassName}
          responsiveLayout="scroll"
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="categoria" header="Categoria" sortable />
          <Column field="unidade_medida" header="Unidade" sortable />
          <Column
            field="quantidade_atual"
            header="Quantidade em Estoque"
            body={quantidadeBodyTemplate}
            sortable
          />
          <Column
            field="preco_venda_padrao"
            header="Preco Venda"
            body={(produto) => formatMoeda(produto.preco_venda_padrao)}
            sortable
          />
          <Column
            field="estoque_minimo"
            header="Estoque Min."
            body={(produto) => formatQuantidade(produto.estoque_minimo)}
            sortable
          />
          <Column
            field="valor_estoque_custo"
            header="Valor Custo"
            body={(produto) => formatMoeda(produto.valor_estoque_custo)}
            sortable
          />
          <Column
            field="valor_estoque_venda"
            header="Valor Venda"
            body={(produto) => formatMoeda(produto.valor_estoque_venda)}
            sortable
          />
          <Column
            field="proxima_validade"
            header="Proxima Validade"
            body={(produto) => formatData(produto.proxima_validade)}
            sortable
          />
          <Column header="Acoes" body={acoesBodyTemplate} />
        </DataTable>
      </div>

      <Dialog
        visible={modalProduto}
        header="Cadastrar Produto"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalProduto}
      >
        <form className={styles.form} onSubmit={handleSubmitProduto}>
          <div className={styles.field}>
            <label htmlFor="produto-nome">Nome</label>
            <InputText
              id="produto-nome"
              value={produtoForm.nome}
              onChange={(event) => setProdutoForm((current) => ({ ...current, nome: event.target.value }))}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="produto-categoria">Categoria</label>
              <Dropdown
                id="produto-categoria"
                value={produtoForm.categoria}
                options={categoriaOptions}
                onChange={(event) => setProdutoForm((current) => ({ ...current, categoria: event.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="produto-unidade">Unidade</label>
              <Dropdown
                id="produto-unidade"
                value={produtoForm.unidade_medida}
                options={unidadeOptions}
                onChange={(event) => setProdutoForm((current) => ({ ...current, unidade_medida: event.value }))}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="produto-estoque-minimo">Estoque minimo</label>
            <InputNumber
              id="produto-estoque-minimo"
              inputId="produto-estoque-minimo-input"
              min={0}
              minFractionDigits={0}
              maxFractionDigits={3}
              mode="decimal"
              value={produtoForm.estoque_minimo}
              onValueChange={(event) =>
                setProdutoForm((current) => ({ ...current, estoque_minimo: event.value ?? 0 }))
              }
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="produto-preco-venda">Preco de venda padrao</label>
              <InputNumber
                id="produto-preco-venda"
                inputId="produto-preco-venda-input"
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                mode="decimal"
                value={produtoForm.preco_venda_padrao}
                onValueChange={(event) =>
                  setProdutoForm((current) => ({ ...current, preco_venda_padrao: event.value ?? 0 }))
                }
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="produto-validade">Validade padrao (dias)</label>
              <InputNumber
                id="produto-validade"
                inputId="produto-validade-input"
                min={1}
                useGrouping={false}
                value={produtoForm.validade_dias_padrao}
                onValueChange={(event) =>
                  setProdutoForm((current) => ({ ...current, validade_dias_padrao: event.value ?? 1 }))
                }
              />
            </div>
          </div>

          {dialogFooter(handleSubmitProduto, "Salvar Produto")}
        </form>
      </Dialog>

      <Dialog
        visible={modalEntrada || modalSaida}
        header={modalEntrada ? "Registrar Entrada" : "Registrar Saida"}
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalMovimentacao}
      >
        <form
          className={styles.form}
          onSubmit={(event) => handleSubmitMovimentacao(event, modalEntrada ? "entrada" : "saida")}
        >
          <div className={styles.field}>
            <label>Produto</label>
            <InputText
              value={produtoSelecionado ? `${produtoSelecionado.nome} (${produtoSelecionado.unidade_medida})` : ""}
              disabled
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="movimentacao-quantidade">Quantidade</label>
              <InputNumber
                id="movimentacao-quantidade"
                inputId="movimentacao-quantidade-input"
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
                <label htmlFor="movimentacao-custo-unitario">Custo unitario</label>
                <InputNumber
                  id="movimentacao-custo-unitario"
                  inputId="movimentacao-custo-unitario-input"
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
                <label htmlFor="movimentacao-subtipo">Tipo da saida</label>
                <Dropdown
                  id="movimentacao-subtipo"
                  value={movimentacaoForm.subtipo}
                  options={subtipoSaidaOptions}
                  onChange={(event) =>
                    setMovimentacaoForm((current) => ({ ...current, subtipo: event.value }))
                  }
                />
              </div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="movimentacao-observacao">Observacao</label>
            <InputTextarea
              id="movimentacao-observacao"
              rows={4}
              value={movimentacaoForm.observacao}
              onChange={(event) =>
                setMovimentacaoForm((current) => ({ ...current, observacao: event.target.value }))
              }
            />
          </div>

          {dialogFooter(handleSubmitMovimentacao, modalEntrada ? "Salvar Entrada" : "Salvar Saida")}
        </form>
      </Dialog>
    </section>
  );
}
