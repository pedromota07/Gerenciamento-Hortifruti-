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
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";

import MovimentacaoDialog from "@/components/MovimentacaoDialog";
import { registrarEntrada, registrarSaida } from "@/services/movimentacoesService";
import { criarProduto, buscarProdutos } from "@/services/produtosService";
import { formatarData, formatarMoeda, formatarQuantidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";
import { validarMovimentacaoForm, validarProdutoForm } from "@/utils/validators";

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

  const renderizarRodapeDialogoProduto = () => (
    <div className={styles.dialogFooter}>
      <Button label="Cancelar" type="button" text onClick={fecharModalProduto} />
      <Button label="Salvar Produto" type="submit" loading={salvandoProduto} />
    </div>
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Estoque</h1>
          <p>Gerencie produtos, entradas, saidas e saldos do estoque.</p>
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

          {renderizarRodapeDialogoProduto()}
        </form>
      </Dialog>

      <MovimentacaoDialog
        visible={modalEntrada || modalSaida}
        tipo={modalEntrada ? "entrada" : "saida"}
        produtoLabel={produtoSelecionado ? `${produtoSelecionado.nome} (${produtoSelecionado.unidade_medida})` : ""}
        formulario={formularioMovimentacao}
        salvando={salvandoMovimentacao}
        styles={styles}
        onChange={setFormularioMovimentacao}
        onHide={fecharModalMovimentacao}
        onSubmit={enviarFormularioMovimentacao}
      />
    </section>
  );
}
