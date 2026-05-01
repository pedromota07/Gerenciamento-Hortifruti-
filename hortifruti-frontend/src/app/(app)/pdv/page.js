"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";

import { getProdutos, postSaida } from "@/services/produtosService";

import styles from "./page.module.css";

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

function isEstoqueBaixo(produto) {
  return Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0) < Number(produto?.estoque_minimo ?? 0);
}

export default function PdvPage() {
  const toast = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState(null);
  const [quantidade, setQuantidade] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [ultimasVendas, setUltimasVendas] = useState([]);
  const [ultimaVendaConfirmada, setUltimaVendaConfirmada] = useState(null);

  useEffect(() => {
    async function carregarProdutos() {
      setLoading(true);

      try {
        const data = await getProdutos();
        setProdutos(data.filter((produto) => produto.ativo));
      } catch (error) {
        setFeedback({ severity: "error", text: error.message });
      } finally {
        setLoading(false);
      }
    }

    carregarProdutos();
  }, []);

  const produtoSelecionado = useMemo(
    () => produtos.find((produto) => produto.id === produtoId) ?? null,
    [produtoId, produtos]
  );

  const precoUnitario = Number(produtoSelecionado?.preco_venda_padrao ?? 0);
  const saldoResultante = produtoSelecionado
    ? Number(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual) -
      Number(quantidade ?? 0)
    : null;
  const totalVenda = produtoSelecionado ? Number(quantidade ?? 0) * precoUnitario : 0;

  function handleSelecionarProduto(valor) {
    setProdutoId(valor);
    setQuantidade(null);
    setFeedback(null);
    setUltimaVendaConfirmada(null);
    setStep(valor ? 2 : 1);
  }

  function resetFluxo() {
    setProdutoId(null);
    setQuantidade(null);
    setFeedback(null);
    setUltimaVendaConfirmada(null);
    setStep(1);
  }

  async function handleConfirmarVenda() {
    if (!produtoSelecionado) {
      setFeedback({ severity: "error", text: "Selecione um produto para continuar." });
      return;
    }

    if (quantidade == null || Number(quantidade) <= 0) {
      setFeedback({ severity: "error", text: "Informe uma quantidade maior que zero." });
      return;
    }

    if (Number(quantidade) > Number(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)) {
      setFeedback({
        severity: "error",
        text: "A quantidade informada excede o estoque disponivel para venda."
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await postSaida({
        produto_id: produtoSelecionado.id,
        quantidade: Number(quantidade).toFixed(3),
        subtipo: "venda",
        preco_unitario_venda: precoUnitario.toFixed(2)
      });

      const produtoAtualizado = response.produto;

      setProdutos((current) =>
        current.map((produto) => (produto.id === produtoAtualizado.id ? produtoAtualizado : produto))
      );
      setUltimasVendas((current) =>
        [
          {
            id: response.movimentacao.id,
            produto_nome: produtoAtualizado.nome,
            quantidade: response.movimentacao.quantidade,
            saldo_disponivel: produtoAtualizado.quantidade_disponivel_venda,
            receita_total: response.movimentacao.receita_total,
            custo_total: response.movimentacao.custo_total,
            lucro_bruto: response.movimentacao.lucro_bruto
          },
          ...current
        ].slice(0, 5)
      );
      setUltimaVendaConfirmada({
        produto_nome: produtoAtualizado.nome,
        quantidade: response.movimentacao.quantidade,
        receita_total: response.movimentacao.receita_total,
        custo_total: response.movimentacao.custo_total,
        lucro_bruto: response.movimentacao.lucro_bruto
      });
      setProdutoId(null);
      setQuantidade(null);
      setStep(3);
      toast.current?.show({
        severity: "success",
        summary: "Venda registrada",
        detail: `${produtoAtualizado.nome} vendido com sucesso por ${formatMoeda(response.movimentacao.receita_total)}.`,
        life: 3000
      });
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.page}>
      <Toast ref={toast} />

      <header className={styles.header}>
        <div>
          <h1>PDV</h1>
          <p>Fluxo rapido para registrar uma venda por vez, sem sair da tela.</p>
        </div>
      </header>

      {feedback ? <Message severity={feedback.severity} text={feedback.text} /> : null}

      <div className={styles.steps}>
        <div className={`${styles.stepCard} ${step >= 1 ? styles.stepActive : ""}`}>
          <span>1</span>
          <strong>Selecionar Produto</strong>
        </div>
        <div className={`${styles.stepCard} ${step >= 2 ? styles.stepActive : ""}`}>
          <span>2</span>
          <strong>Informar Quantidade</strong>
        </div>
        <div className={`${styles.stepCard} ${step >= 3 ? styles.stepActive : ""}`}>
          <span>3</span>
          <strong>Confirmar Venda</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Fluxo de venda</h2>
            <p>Selecione o produto, confira o saldo e confirme a venda.</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="pdv-produto">Produto</label>
            <Dropdown
              id="pdv-produto"
              value={produtoId}
              options={produtos.map((produto) => ({ label: produto.nome, value: produto.id }))}
              onChange={(event) => handleSelecionarProduto(event.value)}
              placeholder={loading ? "Carregando produtos..." : "Selecione um produto"}
              filter
              disabled={loading}
            />
          </div>

          {produtoSelecionado ? (
            <div className={styles.summary}>
              <strong>{produtoSelecionado.nome}</strong>
              <span>
                Estoque disponivel para venda:{" "}
                {formatQuantidade(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)}
              </span>
              <span>Estoque total: {formatQuantidade(produtoSelecionado.quantidade_atual)}</span>
              <span>Unidade: {produtoSelecionado.unidade_medida}</span>
              <span>Preco unitario: {formatMoeda(produtoSelecionado.preco_venda_padrao)}</span>
              {isEstoqueBaixo(produtoSelecionado) ? (
                <Message severity="warn" text="Produto com estoque baixo." />
              ) : null}
            </div>
          ) : null}

          {step === 2 && produtoSelecionado ? (
            <>
              <div className={styles.field}>
                <label htmlFor="pdv-quantidade">Quantidade</label>
                <InputNumber
                  id="pdv-quantidade"
                  inputId="pdv-quantidade-input"
                  min={0}
                  max={Number(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)}
                  minFractionDigits={0}
                  maxFractionDigits={3}
                  mode="decimal"
                  value={quantidade}
                  onValueChange={(event) => setQuantidade(event.value)}
                />
              </div>

              <div className={styles.preview}>
                <span>Saldo apos venda</span>
                <strong>{saldoResultante != null ? formatQuantidade(saldoResultante) : "--"}</strong>
              </div>

              <div className={styles.preview}>
                <span>Total da venda</span>
                <strong>{formatMoeda(totalVenda)}</strong>
              </div>

              <div className={styles.actions}>
                <Button label="Cancelar" text onClick={resetFluxo} />
                <Button
                  label="Confirmar Venda"
                  icon="pi pi-check"
                  onClick={handleConfirmarVenda}
                  loading={submitting}
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className={styles.successBox}>
              <strong>Venda registrada</strong>
              {ultimaVendaConfirmada ? (
                <>
                  <p>{`${ultimaVendaConfirmada.produto_nome} foi vendido e o PDV foi resetado para a proxima operacao.`}</p>
                  <p>{`Receita: ${formatMoeda(ultimaVendaConfirmada.receita_total)} | Custo: ${formatMoeda(ultimaVendaConfirmada.custo_total)} | Lucro bruto: ${formatMoeda(ultimaVendaConfirmada.lucro_bruto)}`}</p>
                </>
              ) : (
                <p>O PDV foi resetado para a proxima operacao.</p>
              )}
              <Button label="Nova venda" onClick={resetFluxo} />
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ultimas 5 vendas da sessao</h2>
            <p>Historico local para acompanhamento rapido do uso atual do PDV.</p>
          </div>

          {ultimasVendas.length === 0 ? (
            <p className={styles.empty}>Nenhuma venda registrada nesta sessao.</p>
          ) : (
            <div className={styles.salesList}>
              {ultimasVendas.map((venda) => (
                <article className={styles.saleItem} key={venda.id}>
                  <strong>{venda.produto_nome}</strong>
                  <span>Quantidade: {formatQuantidade(venda.quantidade)}</span>
                  <span>Saldo disponivel: {formatQuantidade(venda.saldo_disponivel)}</span>
                  <span>Receita: {formatMoeda(venda.receita_total)}</span>
                  <span>Lucro bruto: {formatMoeda(venda.lucro_bruto)}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
