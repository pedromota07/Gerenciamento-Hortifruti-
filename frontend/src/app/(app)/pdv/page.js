"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import ProdutoVisual from "@/components/ProdutoVisual";
import { registrarVendaLote } from "@/services/servicoMovimentacoes";
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

function obterEstoqueDisponivel(produto) {
  return Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0);
}

function montarItemCarrinho(produto, quantidade, precoUnitario) {
  return {
    produto_id: produto.id,
    produto_nome: produto.nome,
    categoria: produto.categoria,
    unidade_medida: produto.unidade_medida,
    estoque_disponivel: obterEstoqueDisponivel(produto),
    preco_unitario_venda: precoUnitario,
    quantidade
  };
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
  const [carrinho, setCarrinho] = useState([]);
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
  const estoqueDisponivel = obterEstoqueDisponivel(produtoSelecionado);
  const quantidadeNoCarrinho = produtoSelecionado
    ? carrinho.find((item) => item.produto_id === produtoSelecionado.id)?.quantidade ?? 0
    : 0;
  const estoqueRestanteParaAdicionar = Math.max(estoqueDisponivel - quantidadeNoCarrinho, 0);
  const subtotalSelecao = produtoSelecionado ? Number(quantidade ?? 0) * precoUnitario : 0;
  const totalCarrinho = carrinho.reduce(
    (total, item) => total + Number(item.quantidade) * Number(item.preco_unitario_venda),
    0
  );
  const itemPronto =
    Boolean(produtoSelecionado) &&
    Number(quantidade) > 0 &&
    Number(quantidade) <= estoqueRestanteParaAdicionar &&
    !salvando;
  const vendaPronta = carrinho.length > 0 && !salvando;

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

  function limparSelecao() {
    setProdutoId(null);
    setBusca("");
    setQuantidade(null);
    setErrosVenda((errosAtuais) => ({ ...errosAtuais, produto: null, quantidade: null }));
    setUltimaVendaConfirmada(null);
    buscaRef.current?.focus();
  }

  function limparVenda() {
    setProdutoId(null);
    setBusca("");
    setQuantidade(null);
    setCarrinho([]);
    setMensagem(null);
    setErrosVenda({});
    setUltimaVendaConfirmada(null);
    buscaRef.current?.focus();
  }

  function adicionarAoCarrinho() {
    const novosErros = {};

    if (!produtoSelecionado) {
      novosErros.produto = "Selecione um produto.";
    }

    if (quantidade == null || Number(quantidade) <= 0) {
      novosErros.quantidade = "Informe uma quantidade maior que zero.";
    }

    if (produtoSelecionado && Number(quantidade) > estoqueRestanteParaAdicionar) {
      novosErros.quantidade = "A quantidade excede o estoque disponível para venda.";
    }

    if (Object.keys(novosErros).length > 0) {
      setErrosVenda(novosErros);
      return;
    }

    const quantidadeInformada = Number(quantidade);
    setCarrinho((itensAtuais) => {
      const itemExistente = itensAtuais.find((item) => item.produto_id === produtoSelecionado.id);

      if (itemExistente) {
        return itensAtuais.map((item) =>
          item.produto_id === produtoSelecionado.id
            ? { ...item, quantidade: Number((item.quantidade + quantidadeInformada).toFixed(3)) }
            : item
        );
      }

      return [...itensAtuais, montarItemCarrinho(produtoSelecionado, quantidadeInformada, precoUnitario)];
    });
    setProdutoId(null);
    setBusca("");
    setQuantidade(null);
    setErrosVenda({});
    setUltimaVendaConfirmada(null);
    buscaRef.current?.focus();
  }

  function atualizarQuantidadeCarrinho(produtoIdAtual, novaQuantidade) {
    const quantidadeNormalizada = Number(novaQuantidade ?? 0);
    const itemAtual = carrinho.find((item) => item.produto_id === produtoIdAtual);

    if (!itemAtual) {
      return;
    }

    if (quantidadeNormalizada <= 0) {
      removerItemCarrinho(produtoIdAtual);
      return;
    }

    if (quantidadeNormalizada > itemAtual.estoque_disponivel) {
      setErrosVenda({ carrinho: `Quantidade acima do estoque disponível para ${itemAtual.produto_nome}.` });
      return;
    }

    setErrosVenda((errosAtuais) => ({ ...errosAtuais, carrinho: null }));
    setCarrinho((itensAtuais) =>
      itensAtuais.map((item) =>
        item.produto_id === produtoIdAtual
          ? { ...item, quantidade: Number(quantidadeNormalizada.toFixed(3)) }
          : item
      )
    );
  }

  function removerItemCarrinho(produtoIdAtual) {
    setCarrinho((itensAtuais) => itensAtuais.filter((item) => item.produto_id !== produtoIdAtual));
    setErrosVenda((errosAtuais) => ({ ...errosAtuais, carrinho: null }));
  }

  async function confirmarVenda() {
    if (carrinho.length === 0) {
      setErrosVenda({ carrinho: "Adicione pelo menos um produto ao carrinho." });
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      const resposta = await registrarVendaLote({
        itens: carrinho.map((item) => ({
          produto_id: item.produto_id,
          quantidade: Number(item.quantidade).toFixed(3),
          preco_unitario_venda: Number(item.preco_unitario_venda).toFixed(2)
        }))
      });

      const produtosAtualizados = resposta.itens.map((item) => item.produto);
      const vendasRegistradas = resposta.itens.map((item) => ({
        id: item.movimentacao.id,
        produto_nome: item.produto.nome,
        categoria: item.produto.categoria,
        quantidade: item.movimentacao.quantidade,
        saldo_disponivel: item.produto.quantidade_disponivel_venda,
        unidade_medida: item.produto.unidade_medida,
        receita_total: item.movimentacao.receita_total,
        lucro_bruto: item.movimentacao.lucro_bruto
      }));

      setProdutos((produtosAtuais) =>
        produtosAtuais.map((produto) => {
          const produtoAtualizado = produtosAtualizados.find((item) => item.id === produto.id);
          return produtoAtualizado ?? produto;
        })
      );
      setUltimasVendas((vendasAtuais) => [...vendasRegistradas, ...vendasAtuais].slice(0, 5));
      setUltimaVendaConfirmada({
        total_itens: resposta.total_itens,
        receita_total: resposta.receita_total
      });
      setProdutoId(null);
      setBusca("");
      setQuantidade(null);
      setCarrinho([]);
      setErrosVenda({});
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Venda registrada",
        detail: `${resposta.total_itens} item(ns) vendidos por ${formatarMoeda(resposta.receita_total)}.`,
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
                <h2>Carrinho da venda</h2>
                <p>Adicione os itens e confirme tudo de uma vez</p>
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
                    {formatarQuantidadeComUnidade(estoqueRestanteParaAdicionar, produtoSelecionado.unidade_medida)} livres para adicionar
                  </small>
                </div>
                <button type="button" onClick={limparSelecao} aria-label="Remover produto da seleção">
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
                  max={estoqueRestanteParaAdicionar}
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
                    if (evento.key === "Enter" && itemPronto) {
                      evento.preventDefault();
                      adicionarAoCarrinho();
                    }
                  }}
                />
                {errosVenda.quantidade ? (
                  <small className={styles.fieldError}>{errosVenda.quantidade}</small>
                ) : (
                  <small>
                    Já no carrinho: {formatarQuantidadeComUnidade(quantidadeNoCarrinho, produtoSelecionado.unidade_medida)}
                  </small>
                )}
              </div>

              <div className={styles.selectionSummary}>
                <span>Subtotal do item</span>
                <strong>{formatarMoeda(subtotalSelecao)}</strong>
              </div>

              <Button
                className={styles.addItemButton}
                label={quantidadeNoCarrinho > 0 ? "Somar ao carrinho" : "Adicionar item"}
                icon="pi pi-plus"
                onClick={adicionarAoCarrinho}
                disabled={!itemPronto}
              />
            </>
          ) : (
            <div className={styles.checkoutEmpty}>
              <span className={styles.checkoutEmptyIcon}>
                <i className="pi pi-arrow-left" aria-hidden="true" />
              </span>
              <strong>Selecione um produto</strong>
              <p>O item selecionado será preparado antes de entrar no carrinho.</p>
            </div>
          )}

          <div className={styles.cartBlock}>
            <div className={styles.cartHeader}>
              <strong>Itens da venda</strong>
              <span>{carrinho.length} produto(s)</span>
            </div>

            {errosVenda.carrinho ? <small className={styles.fieldError}>{errosVenda.carrinho}</small> : null}

            {carrinho.length === 0 ? (
              <div className={styles.cartEmpty}>
                <EstadoVazio
                  icone="pi pi-shopping-cart"
                  titulo="Carrinho vazio."
                  descricao="Adicione banana, maçã ou qualquer outro produto antes de confirmar."
                />
              </div>
            ) : (
              <div className={styles.cartList}>
                {carrinho.map((item) => (
                  <article className={styles.cartItem} key={item.produto_id}>
                    <ProdutoVisual nome={item.produto_nome} categoria={item.categoria} tamanho="compacto" />
                    <div className={styles.cartItemMain}>
                      <strong>{item.produto_nome}</strong>
                      <span>{formatarMoeda(item.preco_unitario_venda)} por {item.unidade_medida}</span>
                    </div>
                    <InputNumber
                      inputClassName={styles.cartQuantityInput}
                      min={0}
                      max={item.estoque_disponivel}
                      minFractionDigits={0}
                      maxFractionDigits={3}
                      mode="decimal"
                      value={item.quantidade}
                      suffix={` ${item.unidade_medida}`}
                      onValueChange={(evento) => atualizarQuantidadeCarrinho(item.produto_id, evento.value)}
                    />
                    <div className={styles.cartSubtotal}>
                      <span>Total</span>
                      <strong>{formatarMoeda(Number(item.quantidade) * Number(item.preco_unitario_venda))}</strong>
                    </div>
                    <button type="button" onClick={() => removerItemCarrinho(item.produto_id)} aria-label={`Remover ${item.produto_nome}`}>
                      <i className="pi pi-trash" aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.totals}>
            <div>
              <span>Produtos no carrinho</span>
              <strong>{carrinho.length}</strong>
            </div>
            <div className={styles.grandTotal}>
              <span>Total geral</span>
              <strong>{formatarMoeda(totalCarrinho)}</strong>
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              label="Limpar"
              text
              onClick={limparVenda}
              disabled={carrinho.length === 0 && !produtoSelecionado && !busca}
            />
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
                  {ultimaVendaConfirmada.total_itens} item(ns) por {formatarMoeda(ultimaVendaConfirmada.receita_total)}
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
