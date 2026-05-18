"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import { registrarSaida } from "@/services/servicoMovimentacoes";
import { buscarProdutos } from "@/services/servicoProdutos";
import { formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";

import styles from "./page.module.css";

export default function PaginaPdv() {
  const notificacaoRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState(null);
  const [quantidade, setQuantidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [errosVenda, setErrosVenda] = useState({});
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
    setErrosVenda((errosAtuais) => ({ ...errosAtuais, produto: null, quantidade: null }));
    setUltimaVendaConfirmada(null);
  }

  function limparVenda() {
    setProdutoId(null);
    setQuantidade(null);
    setMensagem(null);
    setErrosVenda({});
    setUltimaVendaConfirmada(null);
  }

  async function confirmarVenda() {
    const novosErros = {};

    if (!produtoSelecionado) {
      novosErros.produto = "Selecione um produto.";
    }

    if (quantidade == null || Number(quantidade) <= 0) {
      novosErros.quantidade = "Informe uma quantidade maior que zero.";
    }

    if (
      produtoSelecionado &&
      Number(quantidade) >
        Number(produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual)
    ) {
      novosErros.quantidade = "A quantidade excede o estoque disponível para venda.";
    }

    if (Object.keys(novosErros).length > 0) {
      setErrosVenda(novosErros);
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
            unidade_medida: produtoAtualizado.unidade_medida,
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
      setErrosVenda({});
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Venda registrada",
        detail: `${produtoAtualizado.nome} vendido com sucesso por ${formatarMoeda(resposta.movimentacao.receita_total)}.`,
        life: 3000
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
      notificacaoRef.current?.show({
        severity: "error",
        summary: "Falha na venda",
        detail: erro.message,
        life: 3200
      });
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
        </div>
      </header>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

      <div className={styles.grid}>
        <div className={`${styles.panel} ${styles.salePanel}`}>
          <div className={styles.panelHeader}>
            <h2>Venda rápida</h2>
          </div>

          <div className={styles.saleFields}>
            <div className={styles.field}>
              <label htmlFor="pdv-produto">Produto</label>
              <Dropdown
                id="pdv-produto"
                className={errosVenda.produto ? "p-invalid" : ""}
                value={produtoId}
                options={produtos.map((produto) => ({ label: produto.nome, value: produto.id }))}
                onChange={(evento) => selecionarProduto(evento.value)}
                placeholder={carregando ? "Carregando produtos..." : "Selecione um produto"}
                filter
                disabled={carregando}
              />
              {errosVenda.produto ? <small className={styles.fieldError}>{errosVenda.produto}</small> : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="pdv-quantidade">Quantidade</label>
              <InputNumber
                id="pdv-quantidade"
                inputId="pdv-quantidade-input"
                inputClassName={errosVenda.quantidade ? "p-invalid" : ""}
                min={0}
                max={Number(produtoSelecionado?.quantidade_disponivel_venda ?? produtoSelecionado?.quantidade_atual ?? 0)}
                minFractionDigits={0}
                maxFractionDigits={3}
                mode="decimal"
                value={quantidade}
                placeholder="0"
                disabled={!produtoSelecionado}
                onValueChange={(evento) => {
                  setQuantidade(evento.value);
                  setErrosVenda((errosAtuais) => ({ ...errosAtuais, quantidade: null }));
                }}
              />
              {errosVenda.quantidade ? <small className={styles.fieldError}>{errosVenda.quantidade}</small> : null}
            </div>
          </div>

          {produtoSelecionado ? (
            <div className={styles.productMeta}>
              <strong>{produtoSelecionado.nome}</strong>
              <span>
                Disponível para venda:{" "}
                {formatarQuantidadeComUnidade(
                  produtoSelecionado.quantidade_disponivel_venda ?? produtoSelecionado.quantidade_atual,
                  produtoSelecionado.unidade_medida
                )}
              </span>
              {estoqueEstaBaixo(produtoSelecionado) ? <Message severity="warn" text="Produto com estoque baixo." /> : null}
            </div>
          ) : null}

          <div className={styles.checkoutSummary}>
            <article className={styles.checkoutMetric}>
              <span>Preço</span>
              <strong>{produtoSelecionado ? formatarMoeda(precoUnitario) : "--"}</strong>
            </article>

            <article className={`${styles.checkoutMetric} ${styles.checkoutTotal}`}>
              <span>Total</span>
              <strong>{formatarMoeda(totalVenda)}</strong>
            </article>

            <article className={styles.checkoutMetric}>
              <span>Saldo após venda</span>
              <strong>
                {saldoResultante != null && produtoSelecionado
                  ? formatarQuantidadeComUnidade(saldoResultante, produtoSelecionado.unidade_medida)
                  : "--"}
              </strong>
            </article>
          </div>

          <div className={styles.actions}>
            <Button label="Limpar" text onClick={limparVenda} />
            <Button
              className={styles.confirmButton}
              label="Confirmar venda"
              icon="pi pi-check"
              onClick={confirmarVenda}
              loading={salvando}
            />
          </div>

          {ultimaVendaConfirmada ? (
            <div className={styles.successBox}>
              <strong>Venda registrada</strong>
              <span>
                {ultimaVendaConfirmada.produto_nome} vendido por {formatarMoeda(ultimaVendaConfirmada.receita_total)}.
              </span>
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Últimas 5 vendas da sessão</h2>
          </div>

          {ultimasVendas.length === 0 ? (
            <EstadoVazio
              icone="pi pi-shopping-cart"
              titulo="Nenhuma venda registrada nesta sessão."
              descricao="As últimas vendas aparecerão aqui durante o atendimento."
            />
          ) : (
            <div className={styles.salesList}>
              {ultimasVendas.map((venda) => (
                <article className={styles.saleItem} key={venda.id}>
                  <strong>{venda.produto_nome}</strong>
                  <span>Quantidade: {formatarQuantidadeComUnidade(venda.quantidade, venda.unidade_medida)}</span>
                  <span>Saldo disponível: {formatarQuantidadeComUnidade(venda.saldo_disponivel, venda.unidade_medida)}</span>
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
