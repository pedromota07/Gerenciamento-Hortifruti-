"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import ProdutoVisual from "@/components/ProdutoVisual";
import { registrarSaida } from "@/services/servicoMovimentacoes";
import { buscarProdutos } from "@/services/servicoProdutos";
import { formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";

import styles from "./page.module.css";

const LIMITE_RESULTADOS = 8;
const CHAVE_VENDAS_SESSAO = "pdv-vendas-sessao";

function carregarVendasDaSessao() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_VENDAS_SESSAO) ?? "[]");
  } catch {
    return [];
  }
}

export default function PaginaPdv() {
  const notificacaoRef = useRef(null);
  const buscaRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [quantidade, setQuantidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [errosVenda, setErrosVenda] = useState({});
  const [ultimasVendas, setUltimasVendas] = useState(carregarVendasDaSessao);
  const [ultimaVendaConfirmada, setUltimaVendaConfirmada] = useState(null);

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    setMensagem(null);

    try {
      const dadosProdutos = await buscarProdutos();
      setProdutos(dadosProdutos.filter((produto) => produto.ativo));
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  useEffect(() => {
    sessionStorage.setItem(CHAVE_VENDAS_SESSAO, JSON.stringify(ultimasVendas));
  }, [ultimasVendas]);

  const produtoSelecionado = useMemo(
    () => produtos.find((produto) => produto.id === produtoId) ?? null,
    [produtoId, produtos]
  );

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return produtos
      .filter((produto) => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo))
      .sort((produtoA, produtoB) => produtoA.nome.localeCompare(produtoB.nome, "pt-BR"))
      .slice(0, LIMITE_RESULTADOS);
  }, [busca, produtos]);

  const precoUnitario = Number(produtoSelecionado?.preco_venda_padrao ?? 0);
  const estoqueDisponivel = Number(
    produtoSelecionado?.quantidade_disponivel_venda ?? produtoSelecionado?.quantidade_atual ?? 0
  );
  const saldoResultante = produtoSelecionado ? estoqueDisponivel - Number(quantidade ?? 0) : null;
  const totalVenda = produtoSelecionado ? Number(quantidade ?? 0) * precoUnitario : 0;
  const vendaPronta =
    Boolean(produtoSelecionado) &&
    Number(quantidade) > 0 &&
    Number(quantidade) <= estoqueDisponivel &&
    !salvando;

  function selecionarProduto(produto) {
    setProdutoId(produto.id);
    setQuantidade(null);
    setBusca(produto.nome);
    setMensagem(null);
    setErrosVenda((errosAtuais) => ({ ...errosAtuais, produto: null, quantidade: null }));
    setUltimaVendaConfirmada(null);
  }

  function limparBusca() {
    setBusca("");
    setProdutoId(null);
    setQuantidade(null);
    setErrosVenda({});
    setUltimaVendaConfirmada(null);
    buscaRef.current?.focus();
  }

  function limparVenda() {
    setProdutoId(null);
    setBusca("");
    setQuantidade(null);
    setMensagem(null);
    setErrosVenda({});
    setUltimaVendaConfirmada(null);
    buscaRef.current?.focus();
  }

  async function confirmarVenda() {
    const novosErros = {};

    if (!produtoSelecionado) {
      novosErros.produto = "Selecione um produto.";
    }

    if (quantidade == null || Number(quantidade) <= 0) {
      novosErros.quantidade = "Informe uma quantidade maior que zero.";
    }

    if (produtoSelecionado && Number(quantidade) > estoqueDisponivel) {
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
            categoria: produtoAtualizado.categoria,
            quantidade: resposta.movimentacao.quantidade,
            saldo_disponivel: produtoAtualizado.quantidade_disponivel_venda,
            unidade_medida: produtoAtualizado.unidade_medida,
            receita_total: resposta.movimentacao.receita_total,
            lucro_bruto: resposta.movimentacao.lucro_bruto
          },
          ...vendasAtuais
        ].slice(0, 5)
      );
      setUltimaVendaConfirmada({
        produto_nome: produtoAtualizado.nome,
        quantidade: resposta.movimentacao.quantidade,
        receita_total: resposta.movimentacao.receita_total
      });
      setProdutoId(null);
      setBusca("");
      setQuantidade(null);
      setErrosVenda({});
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Venda registrada",
        detail: `${produtoAtualizado.nome} vendido com sucesso por ${formatarMoeda(resposta.movimentacao.receita_total)}.`,
        life: 3000
      });
      buscaRef.current?.focus();
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
          <span className={styles.eyebrow}>Operação de caixa</span>
          <h1>Venda rápida</h1>
          <p>Localize o produto, informe a quantidade e conclua a venda sem sair da tela.</p>
        </div>
        <div className={styles.sessionStatus}>
          <span className={styles.statusDot} />
          Caixa pronto
        </div>
      </header>

      {mensagem ? (
        <div className={styles.feedback}>
          <Message severity={mensagem.severity} text={mensagem.text} />
          <Button label="Tentar novamente" icon="pi pi-refresh" text onClick={carregarProdutos} />
        </div>
      ) : null}

      <div className={styles.workspace}>
        <main className={styles.catalogPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.step}>1</span>
              <div>
                <h2>Escolha o produto</h2>
                <p>{produtos.length} produtos ativos disponíveis no catálogo</p>
              </div>
            </div>
          </div>

          <div className={styles.searchBox}>
            <i className="pi pi-search" aria-hidden="true" />
            <input
              ref={buscaRef}
              id="pdv-busca"
              type="search"
              value={busca}
              onChange={(evento) => {
                setBusca(evento.target.value);
                setProdutoId(null);
                setQuantidade(null);
                setErrosVenda((errosAtuais) => ({ ...errosAtuais, produto: null, quantidade: null }));
              }}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") {
                  limparBusca();
                }

                if (evento.key === "Enter" && !produtoSelecionado) {
                  const primeiroProdutoDisponivel = produtosFiltrados.find(
                    (produto) => Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0) > 0
                  );

                  if (primeiroProdutoDisponivel) {
                    evento.preventDefault();
                    selecionarProduto(primeiroProdutoDisponivel);
                  }
                }
              }}
              placeholder="Busque por nome do produto"
              aria-label="Buscar produto"
              autoComplete="off"
              autoFocus
              disabled={carregando}
            />
            {busca ? (
              <button className={styles.clearSearch} type="button" onClick={limparBusca} aria-label="Limpar busca">
                <i className="pi pi-times" aria-hidden="true" />
              </button>
            ) : (
              <kbd>ESC</kbd>
            )}
          </div>

          {errosVenda.produto ? <small className={styles.fieldError}>{errosVenda.produto}</small> : null}

          {carregando ? (
            <div className={styles.productGrid} aria-label="Carregando produtos">
              {Array.from({ length: 6 }, (_, indice) => (
                <div className={styles.productSkeleton} key={indice} />
              ))}
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className={styles.catalogEmpty}>
              <EstadoVazio
                icone="pi pi-search"
                titulo={produtos.length === 0 ? "Nenhum produto ativo para venda." : "Nenhum produto encontrado."}
                descricao={
                  produtos.length === 0
                    ? "Cadastre ou ative produtos para começar a vender."
                    : "Revise o nome digitado ou limpe a busca."
                }
              />
              {busca ? <Button label="Limpar busca" icon="pi pi-times" text onClick={limparBusca} /> : null}
            </div>
          ) : (
            <div className={styles.productGrid}>
              {produtosFiltrados.map((produto) => {
                const saldo = Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0);
                const semEstoque = saldo <= 0;
                const selecionado = produto.id === produtoId;

                return (
                  <button
                    className={`${styles.productCard} ${selecionado ? styles.productCardSelected : ""}`}
                    key={produto.id}
                    type="button"
                    onClick={() => selecionarProduto(produto)}
                    disabled={semEstoque}
                    aria-pressed={selecionado}
                  >
                    <ProdutoVisual nome={produto.nome} categoria={produto.categoria} tamanho="compacto" />
                    <span className={styles.productContent}>
                      <strong>{produto.nome}</strong>
                      <span>{formatarMoeda(produto.preco_venda_padrao)}</span>
                    </span>
                    <span className={`${styles.stockBadge} ${estoqueEstaBaixo(produto) ? styles.stockLow : ""}`}>
                      {semEstoque
                        ? "Sem estoque"
                        : formatarQuantidadeComUnidade(saldo, produto.unidade_medida)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        <aside className={styles.checkoutPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.step}>2</span>
              <div>
                <h2>Resumo da venda</h2>
                <p>Confira os dados antes de confirmar</p>
              </div>
            </div>
          </div>

          {produtoSelecionado ? (
            <>
              <div className={styles.selectedProduct}>
                <ProdutoVisual
                  nome={produtoSelecionado.nome}
                  categoria={produtoSelecionado.categoria}
                  tamanho="compacto"
                />
                <div>
                  <span>Produto selecionado</span>
                  <strong>{produtoSelecionado.nome}</strong>
                  <small>
                    {formatarQuantidadeComUnidade(estoqueDisponivel, produtoSelecionado.unidade_medida)} disponíveis
                  </small>
                </div>
                <button type="button" onClick={limparVenda} aria-label="Remover produto da venda">
                  <i className="pi pi-times" aria-hidden="true" />
                </button>
              </div>

              {estoqueEstaBaixo(produtoSelecionado) ? (
                <div className={styles.stockWarning}>
                  <i className="pi pi-exclamation-triangle" aria-hidden="true" />
                  Produto com estoque abaixo do mínimo.
                </div>
              ) : null}

              <div className={styles.quantityField}>
                <label htmlFor="pdv-quantidade-input">Quantidade</label>
                <InputNumber
                  id="pdv-quantidade"
                  inputId="pdv-quantidade-input"
                  inputClassName={errosVenda.quantidade ? "p-invalid" : ""}
                  min={0}
                  max={estoqueDisponivel}
                  minFractionDigits={0}
                  maxFractionDigits={3}
                  mode="decimal"
                  value={quantidade}
                  placeholder="0"
                  suffix={` ${produtoSelecionado.unidade_medida}`}
                  onValueChange={(evento) => {
                    setQuantidade(evento.value);
                    setErrosVenda((errosAtuais) => ({ ...errosAtuais, quantidade: null }));
                  }}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" && vendaPronta) {
                      evento.preventDefault();
                      confirmarVenda();
                    }
                  }}
                />
                {errosVenda.quantidade ? (
                  <small className={styles.fieldError}>{errosVenda.quantidade}</small>
                ) : (
                  <small>Máximo disponível: {formatarQuantidadeComUnidade(estoqueDisponivel, produtoSelecionado.unidade_medida)}</small>
                )}
              </div>
            </>
          ) : (
            <div className={styles.checkoutEmpty}>
              <span className={styles.checkoutEmptyIcon}>
                <i className="pi pi-arrow-left" aria-hidden="true" />
              </span>
              <strong>Selecione um produto</strong>
              <p>Os valores e a quantidade da venda aparecerão aqui.</p>
            </div>
          )}

          <div className={styles.totals}>
            <div>
              <span>Preço unitário</span>
              <strong>{produtoSelecionado ? formatarMoeda(precoUnitario) : "--"}</strong>
            </div>
            <div>
              <span>Saldo após venda</span>
              <strong>
                {saldoResultante != null && produtoSelecionado
                  ? formatarQuantidadeComUnidade(saldoResultante, produtoSelecionado.unidade_medida)
                  : "--"}
              </strong>
            </div>
            <div className={styles.grandTotal}>
              <span>Total da venda</span>
              <strong>{formatarMoeda(totalVenda)}</strong>
            </div>
          </div>

          <div className={styles.actions}>
            <Button label="Limpar" text onClick={limparVenda} disabled={!produtoSelecionado && !busca} />
            <Button
              className={styles.confirmButton}
              label="Confirmar venda"
              icon="pi pi-check"
              onClick={confirmarVenda}
              loading={salvando}
              disabled={!vendaPronta}
            />
          </div>

          {ultimaVendaConfirmada ? (
            <div className={styles.successBox}>
              <i className="pi pi-check-circle" aria-hidden="true" />
              <div>
                <strong>Venda registrada</strong>
                <span>
                  {ultimaVendaConfirmada.produto_nome} por {formatarMoeda(ultimaVendaConfirmada.receita_total)}
                </span>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <section className={styles.sessionPanel}>
        <div className={styles.sessionHeader}>
          <div>
            <span className={styles.eyebrow}>Atendimento atual</span>
            <h2>Vendas desta sessão</h2>
          </div>
          <span className={styles.sessionCount}>{ultimasVendas.length} de 5</span>
        </div>

        {ultimasVendas.length === 0 ? (
          <EstadoVazio
            icone="pi pi-shopping-cart"
            titulo="Nenhuma venda registrada nesta sessão."
            descricao="As últimas cinco vendas aparecerão aqui para consulta rápida."
          />
        ) : (
          <div className={styles.salesList}>
            {ultimasVendas.map((venda) => (
              <article className={styles.saleItem} key={venda.id}>
                <ProdutoVisual nome={venda.produto_nome} categoria={venda.categoria} tamanho="compacto" />
                <div className={styles.saleProduct}>
                  <strong>{venda.produto_nome}</strong>
                  <span>
                    {formatarQuantidadeComUnidade(venda.quantidade, venda.unidade_medida)} vendidos
                  </span>
                </div>
                <div>
                  <span>Saldo</span>
                  <strong>{formatarQuantidadeComUnidade(venda.saldo_disponivel, venda.unidade_medida)}</strong>
                </div>
                <div>
                  <span>Lucro bruto</span>
                  <strong>{formatarMoeda(venda.lucro_bruto)}</strong>
                </div>
                <div className={styles.saleRevenue}>
                  <span>Total</span>
                  <strong>{formatarMoeda(venda.receita_total)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
