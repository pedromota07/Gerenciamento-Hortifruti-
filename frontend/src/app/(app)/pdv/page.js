"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";

import { registrarSaida } from "@/services/movimentacoesService";
import { buscarProdutos } from "@/services/produtosService";
import { formatarMoeda, formatarQuantidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";

import styles from "./page.module.css";

export default function PaginaPdv() {
  const notificacaoRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState(null);
  const [quantidade, setQuantidade] = useState(null);
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [ultimasVendas, setUltimasVendas] = useState([]);
  const [ultimaVendaConfirmada, setUltimaVendaConfirmada] = useState(null);

  useEffect(() => {
    async function carregarProdutos() {
      setCarregando(true);

      try {
        const dadosProdutos = await buscarProdutos();
        setProdutos(dadosProdutos.filter((produto) => produto.ativo));
      } catch (erro) {
        setMensagem({ severity: "error", text: erro.message });
      } finally {
        setCarregando(false);
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

  function selecionarProduto(valor) {
    setProdutoId(valor);
    setQuantidade(null);
    setMensagem(null);
    setUltimaVendaConfirmada(null);
    setEtapa(valor ? 2 : 1);
  }

  function reiniciarFluxo() {
    setProdutoId(null);
    setQuantidade(null);
    setMensagem(null);
    setUltimaVendaConfirmada(null);
    setEtapa(1);
  }

  async function confirmarVenda() {
    if (!produtoSelecionado) {
      setMensagem({ severity: "error", text: "Selecione um produto para continuar." });
      return;
    }

    if (quantidade == null || Number(quantidade) <= 0) {
      setMensagem({ severity: "error", text: "Informe uma quantidade maior que zero." });
      return;
    }

    if (Number(quantidade) > Number(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)) {
      setMensagem({
        severity: "error",
        text: "A quantidade informada excede o estoque disponivel para venda."
      });
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      const resposta = await registrarSaida({
        produto_id: produtoSelecionado.id,
        quantidade: Number(quantidade).toFixed(3),
        subtipo: "venda",
        preco_unitario_venda: precoUnitario.toFixed(2)
      });

      const produtoAtualizado = resposta.produto;

      setProdutos((produtosAtuais) =>
        produtosAtuais.map((produto) => (produto.id === produtoAtualizado.id ? produtoAtualizado : produto))
      );
      setUltimasVendas((vendasAtuais) =>
        [
          {
            id: resposta.movimentacao.id,
            produto_nome: produtoAtualizado.nome,
            quantidade: resposta.movimentacao.quantidade,
            saldo_disponivel: produtoAtualizado.quantidade_disponivel_venda,
            receita_total: resposta.movimentacao.receita_total,
            custo_total: resposta.movimentacao.custo_total,
            lucro_bruto: resposta.movimentacao.lucro_bruto
          },
          ...vendasAtuais
        ].slice(0, 5)
      );
      setUltimaVendaConfirmada({
        produto_nome: produtoAtualizado.nome,
        quantidade: resposta.movimentacao.quantidade,
        receita_total: resposta.movimentacao.receita_total,
        custo_total: resposta.movimentacao.custo_total,
        lucro_bruto: resposta.movimentacao.lucro_bruto
      });
      setProdutoId(null);
      setQuantidade(null);
      setEtapa(3);
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Venda registrada",
        detail: `${produtoAtualizado.nome} vendido com sucesso por ${formatarMoeda(resposta.movimentacao.receita_total)}.`,
        life: 3000
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />

      <header className={styles.header}>
        <div>
          <h1>PDV</h1>
          <p>Fluxo rapido para registrar uma venda por vez, sem sair da tela.</p>
        </div>
      </header>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={styles.steps}>
        <div className={`${styles.stepCard} ${etapa >= 1 ? styles.stepActive : ""}`}>
          <span>1</span>
          <strong>Selecionar Produto</strong>
        </div>
        <div className={`${styles.stepCard} ${etapa >= 2 ? styles.stepActive : ""}`}>
          <span>2</span>
          <strong>Informar Quantidade</strong>
        </div>
        <div className={`${styles.stepCard} ${etapa >= 3 ? styles.stepActive : ""}`}>
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
              onChange={(evento) => selecionarProduto(evento.value)}
              placeholder={carregando ? "Carregando produtos..." : "Selecione um produto"}
              filter
              disabled={carregando}
            />
          </div>

          {produtoSelecionado ? (
            <div className={styles.summary}>
              <strong>{produtoSelecionado.nome}</strong>
              <span>
                Estoque disponivel para venda:{" "}
                {formatarQuantidade(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)}
              </span>
              <span>Estoque total: {formatarQuantidade(produtoSelecionado.quantidade_atual)}</span>
              <span>Unidade: {produtoSelecionado.unidade_medida}</span>
              <span>Preco unitario: {formatarMoeda(produtoSelecionado.preco_venda_padrao)}</span>
              {estoqueEstaBaixo(produtoSelecionado) ? (
                <Message severity="warn" text="Produto com estoque baixo." />
              ) : null}
            </div>
          ) : null}

          {etapa === 2 && produtoSelecionado ? (
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
                  onValueChange={(evento) => setQuantidade(evento.value)}
                />
              </div>

              <div className={styles.preview}>
                <span>Saldo apos venda</span>
                <strong>{saldoResultante != null ? formatarQuantidade(saldoResultante) : "--"}</strong>
              </div>

              <div className={styles.preview}>
                <span>Total da venda</span>
                <strong>{formatarMoeda(totalVenda)}</strong>
              </div>

              <div className={styles.actions}>
                <Button label="Cancelar" text onClick={reiniciarFluxo} />
                <Button
                  label="Confirmar Venda"
                  icon="pi pi-check"
                  onClick={confirmarVenda}
                  loading={salvando}
                />
              </div>
            </>
          ) : null}

          {etapa === 3 ? (
            <div className={styles.successBox}>
              <strong>Venda registrada</strong>
              {ultimaVendaConfirmada ? (
                <>
                  <p>{`${ultimaVendaConfirmada.produto_nome} foi vendido e o PDV foi resetado para a proxima operacao.`}</p>
                  <p>{`Receita: ${formatarMoeda(ultimaVendaConfirmada.receita_total)} | Custo: ${formatarMoeda(ultimaVendaConfirmada.custo_total)} | Lucro bruto: ${formatarMoeda(ultimaVendaConfirmada.lucro_bruto)}`}</p>
                </>
              ) : (
                <p>O PDV foi resetado para a proxima operacao.</p>
              )}
              <Button label="Nova venda" onClick={reiniciarFluxo} />
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ultimas 5 vendas da sessao</h2>
            <p>Acompanhe as vendas registradas durante o atendimento atual.</p>
          </div>

          {ultimasVendas.length === 0 ? (
            <p className={styles.empty}>Nenhuma venda registrada nesta sessao.</p>
          ) : (
            <div className={styles.salesList}>
              {ultimasVendas.map((venda) => (
                <article className={styles.saleItem} key={venda.id}>
                  <strong>{venda.produto_nome}</strong>
                  <span>Quantidade: {formatarQuantidade(venda.quantidade)}</span>
                  <span>Saldo disponivel: {formatarQuantidade(venda.saldo_disponivel)}</span>
                  <span>Receita: {formatarMoeda(venda.receita_total)}</span>
                  <span>Lucro bruto: {formatarMoeda(venda.lucro_bruto)}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
