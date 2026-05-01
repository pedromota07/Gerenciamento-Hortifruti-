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
  buscarProdutos,
  registrarEntrada,
  registrarSaida
} from "@/services/produtosService";

import styles from "./page.module.css";

const opcoesCategoria = [
  { label: "Fruta", value: "fruta" },
  { label: "Legume", value: "legume" },
  { label: "Verdura", value: "verdura" }
];

const opcoesUnidade = [
  { label: "Kg", value: "kg" },
  { label: "Unidade", value: "un" },
  { label: "Caixa", value: "cx" }
];

const opcoesSubtipoSaida = [
  { label: "Venda", value: "venda" },
  { label: "Perda", value: "perda" }
];

const formularioProdutoInicial = {
  nome: "",
  categoria: "fruta",
  unidade_medida: "kg",
  estoque_minimo: 0,
  preco_venda_padrao: 0,
  validade_dias_padrao: 1
};

const formularioMovimentacaoInicial = {
  quantidade: null,
  custo_unitario: null,
  subtipo: "venda",
  observacao: ""
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

function estoqueEstaBaixo(produto) {
  return Number(produto.quantidade_disponivel_venda ?? produto.quantidade_atual ?? 0) < Number(produto.estoque_minimo ?? 0);
}

function validarProdutoForm(formulario) {
  if (!formulario.nome.trim()) {
    return "Informe o nome do produto.";
  }

  if (formulario.estoque_minimo == null || Number(formulario.estoque_minimo) < 0) {
    return "O estoque minimo deve ser zero ou maior.";
  }

  if (formulario.preco_venda_padrao == null || Number(formulario.preco_venda_padrao) < 0) {
    return "Informe um preco de venda valido.";
  }

  if (formulario.validade_dias_padrao == null || Number(formulario.validade_dias_padrao) < 1) {
    return "A validade padrao deve ser de pelo menos 1 dia.";
  }

  return null;
}

function validarMovimentacaoForm(formulario, tipo) {
  if (formulario.quantidade == null || Number(formulario.quantidade) <= 0) {
    return "Informe uma quantidade maior que zero.";
  }

  if (tipo === "entrada" && (formulario.custo_unitario == null || Number(formulario.custo_unitario) <= 0)) {
    return "Informe um custo unitario maior que zero para a entrada.";
  }

  return null;
}

export default function PaginaEstoque() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroGlobal, setFiltroGlobal] = useState("");
  const [mensagem, setMensagem] = useState(null);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [formularioProduto, setFormularioProduto] = useState(formularioProdutoInicial);
  const [formularioMovimentacao, setFormularioMovimentacao] = useState(formularioMovimentacaoInicial);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);

  async function carregarProdutos(opcoes = {}) {
    if (!opcoes.silencioso) {
      setCarregando(true);
    }

    try {
      const dadosProdutos = await buscarProdutos();
      setProdutos(dadosProdutos);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      if (!opcoes.silencioso) {
        setCarregando(false);
      }
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  function abrirMovimentacao(tipo, produto) {
    setProdutoSelecionado(produto);
    setFormularioMovimentacao({
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
    setFormularioProduto(formularioProdutoInicial);
  }

  function fecharModalMovimentacao() {
    setModalEntrada(false);
    setModalSaida(false);
    setProdutoSelecionado(null);
    setFormularioMovimentacao(formularioMovimentacaoInicial);
  }

  async function enviarFormularioProduto(evento) {
    evento.preventDefault();
    const mensagemValidacao = validarProdutoForm(formularioProduto);

    if (mensagemValidacao) {
      setMensagem({ severity: "error", text: mensagemValidacao });
      return;
    }

    setSalvandoProduto(true);
    setMensagem(null);

    try {
      await criarProduto({
        ...formularioProduto,
        nome: formularioProduto.nome.trim(),
        estoque_minimo: Number(formularioProduto.estoque_minimo ?? 0).toFixed(3),
        preco_venda_padrao: Number(formularioProduto.preco_venda_padrao ?? 0).toFixed(2),
        validade_dias_padrao: Number(formularioProduto.validade_dias_padrao ?? 1)
      });
      fecharModalProduto();
      await carregarProdutos({ silencioso: true });
      setMensagem({ severity: "success", text: "Produto cadastrado com sucesso." });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function enviarFormularioMovimentacao(evento, tipo) {
    evento.preventDefault();
    const mensagemValidacao = validarMovimentacaoForm(formularioMovimentacao, tipo);

    if (mensagemValidacao || !produtoSelecionado) {
      setMensagem({ severity: "error", text: mensagemValidacao ?? "Selecione um produto." });
      return;
    }

    setSalvandoMovimentacao(true);
    setMensagem(null);

    try {
      const dadosMovimentacao = {
        produto_id: produtoSelecionado.id,
        quantidade: Number(formularioMovimentacao.quantidade).toFixed(3),
        observacao: formularioMovimentacao.observacao.trim() || null,
        ...(tipo === "entrada"
          ? { custo_unitario: Number(formularioMovimentacao.custo_unitario).toFixed(2) }
          : {}),
        ...(tipo === "saida" ? { subtipo: formularioMovimentacao.subtipo } : {})
      };

      if (tipo === "entrada") {
        await registrarEntrada(dadosMovimentacao);
      } else {
        await registrarSaida(dadosMovimentacao);
      }

      fecharModalMovimentacao();
      await carregarProdutos({ silencioso: true });
      setMensagem({
        severity: "success",
        text: tipo === "entrada" ? "Entrada registrada com sucesso." : "Saida registrada com sucesso."
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvandoMovimentacao(false);
    }
  }

  const produtosAtivos = useMemo(() => produtos.filter((produto) => produto.ativo), [produtos]);

  function renderizarQuantidade(produto) {
    const estoqueBaixo = estoqueEstaBaixo(produto);
    const possuiVencido = Number(produto.quantidade_vencida ?? 0) > 0;

    return (
      <div className={styles.quantityCell}>
        <div className={styles.quantityStack}>
          <strong>Total: {formatarQuantidade(produto.quantidade_atual)}</strong>
          <span>Venda: {formatarQuantidade(produto.quantidade_disponivel_venda)}</span>
          {possuiVencido ? <span>Vencido: {formatarQuantidade(produto.quantidade_vencida)}</span> : null}
        </div>
        {estoqueBaixo ? <Tag severity="danger" value="Abaixo do minimo" /> : null}
        {possuiVencido ? <Tag severity="warning" value="Com vencidos" /> : null}
      </div>
    );
  }

  function renderizarAcoes(produto) {
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

  function obterClasseLinha(produto) {
    return {
      [styles.lowStockRow]: estoqueEstaBaixo(produto)
    };
  }

  const renderizarRodapeDialogo = (formularioEnviado, rotuloBotao) => (
    <div className={styles.dialogFooter}>
      <Button label="Cancelar" type="button" text onClick={formularioEnviado === enviarFormularioProduto ? fecharModalProduto : fecharModalMovimentacao} />
      <Button label={rotuloBotao} type="submit" loading={formularioEnviado === enviarFormularioProduto ? salvandoProduto : salvandoMovimentacao} />
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
        {mensagem ? (
          <div className={styles.feedback}>
            <Message severity={mensagem.severity} text={mensagem.text} />
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
              value={filtroGlobal}
              onChange={(evento) => setFiltroGlobal(evento.target.value)}
              placeholder="Buscar por nome"
            />
          </span>
        </div>

        <DataTable
          value={produtosAtivos}
          dataKey="id"
          loading={carregando}
          globalFilter={filtroGlobal}
          globalFilterFields={["nome"]}
          emptyMessage="Nenhum produto encontrado."
          rowClassName={obterClasseLinha}
          responsiveLayout="scroll"
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="categoria" header="Categoria" sortable />
          <Column field="unidade_medida" header="Unidade" sortable />
          <Column
            field="quantidade_atual"
            header="Quantidade em Estoque"
            body={renderizarQuantidade}
            sortable
          />
          <Column
            field="preco_venda_padrao"
            header="Preco Venda"
            body={(produto) => formatarMoeda(produto.preco_venda_padrao)}
            sortable
          />
          <Column
            field="estoque_minimo"
            header="Estoque Min."
            body={(produto) => formatarQuantidade(produto.estoque_minimo)}
            sortable
          />
          <Column
            field="valor_estoque_custo"
            header="Valor Custo"
            body={(produto) => formatarMoeda(produto.valor_estoque_custo)}
            sortable
          />
          <Column
            field="valor_estoque_venda"
            header="Valor Venda"
            body={(produto) => formatarMoeda(produto.valor_estoque_venda)}
            sortable
          />
          <Column
            field="proxima_validade"
            header="Proxima Validade"
            body={(produto) => formatarData(produto.proxima_validade)}
            sortable
          />
          <Column header="Acoes" body={renderizarAcoes} />
        </DataTable>
      </div>

      <Dialog
        visible={modalProduto}
        header="Cadastrar Produto"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalProduto}
      >
        <form className={styles.form} onSubmit={enviarFormularioProduto}>
          <div className={styles.field}>
            <label htmlFor="produto-nome">Nome</label>
            <InputText
              id="produto-nome"
              value={formularioProduto.nome}
              onChange={(evento) => setFormularioProduto((formularioAtual) => ({ ...formularioAtual, nome: evento.target.value }))}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="produto-categoria">Categoria</label>
              <Dropdown
                id="produto-categoria"
                value={formularioProduto.categoria}
                options={opcoesCategoria}
                onChange={(evento) => setFormularioProduto((formularioAtual) => ({ ...formularioAtual, categoria: evento.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="produto-unidade">Unidade</label>
              <Dropdown
                id="produto-unidade"
                value={formularioProduto.unidade_medida}
                options={opcoesUnidade}
                onChange={(evento) => setFormularioProduto((formularioAtual) => ({ ...formularioAtual, unidade_medida: evento.value }))}
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
              value={formularioProduto.estoque_minimo}
              onValueChange={(evento) =>
                setFormularioProduto((formularioAtual) => ({ ...formularioAtual, estoque_minimo: evento.value ?? 0 }))
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
                value={formularioProduto.preco_venda_padrao}
                onValueChange={(evento) =>
                  setFormularioProduto((formularioAtual) => ({ ...formularioAtual, preco_venda_padrao: evento.value ?? 0 }))
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
                value={formularioProduto.validade_dias_padrao}
                onValueChange={(evento) =>
                  setFormularioProduto((formularioAtual) => ({ ...formularioAtual, validade_dias_padrao: evento.value ?? 1 }))
                }
              />
            </div>
          </div>

          {renderizarRodapeDialogo(enviarFormularioProduto, "Salvar Produto")}
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
          onSubmit={(evento) => enviarFormularioMovimentacao(evento, modalEntrada ? "entrada" : "saida")}
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
                value={formularioMovimentacao.quantidade}
                onValueChange={(evento) =>
                  setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, quantidade: evento.value }))
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
                  value={formularioMovimentacao.custo_unitario}
                  onValueChange={(evento) =>
                    setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, custo_unitario: evento.value }))
                  }
                />
              </div>
            ) : null}

            {modalSaida ? (
              <div className={styles.field}>
                <label htmlFor="movimentacao-subtipo">Tipo da saida</label>
                <Dropdown
                  id="movimentacao-subtipo"
                  value={formularioMovimentacao.subtipo}
                  options={opcoesSubtipoSaida}
                  onChange={(evento) =>
                    setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, subtipo: evento.value }))
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
              value={formularioMovimentacao.observacao}
              onChange={(evento) =>
                setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, observacao: evento.target.value }))
              }
            />
          </div>

          {renderizarRodapeDialogo(enviarFormularioMovimentacao, modalEntrada ? "Salvar Entrada" : "Salvar Saida")}
        </form>
      </Dialog>
    </section>
  );
}
