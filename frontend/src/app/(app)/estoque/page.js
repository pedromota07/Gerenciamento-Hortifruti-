"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import ModalMovimentacao from "@/components/ModalMovimentacao";
import { registrarEntrada, registrarSaida } from "@/services/servicoMovimentacoes";
import { criarProduto, buscarProdutos } from "@/services/servicoProdutos";
import { formatarData, formatarQuantidadeComUnidade } from "@/utils/formatters";
import {
  estoqueEstaBaixo,
  produtoProximoDoVencimento,
  produtoTemEstoqueVencido
} from "@/utils/produtos";
import { obterErrosProdutoForm, validarMovimentacaoForm } from "@/utils/validators";

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

const opcoesFiltroCategoria = [
  { label: "Todas as categorias", value: null },
  ...opcoesCategoria
];

const opcoesFiltroStatus = [
  { label: "Todos os status", value: null },
  { label: "Regular", value: "regular" },
  { label: "Estoque baixo", value: "estoque_baixo" },
  { label: "Produto vencido", value: "vencido" },
  { label: "Próximo do vencimento", value: "proximo_vencimento" },
  { label: "Inativo", value: "inativo" }
];

const formularioProdutoInicial = {
  nome: "",
  categoria: null,
  unidade_medida: null,
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
  const notificacaoRef = useRef(null);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroGlobal, setFiltroGlobal] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [formularioProduto, setFormularioProduto] = useState(formularioProdutoInicial);
  const [formularioMovimentacao, setFormularioMovimentacao] = useState(formularioMovimentacaoInicial);
  const [errosProduto, setErrosProduto] = useState({});
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
      notificacaoRef.current?.show({
        severity: "error",
        summary: "Falha ao cadastrar",
        detail: erro.message,
        life: 3200
      });
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
    setErrosProduto({});
  }

  function fecharModalMovimentacao() {
    setModalEntrada(false);
    setModalSaida(false);
    setProdutoSelecionado(null);
    setFormularioMovimentacao(formularioMovimentacaoInicial);
  }

  async function enviarFormularioProduto(evento) {
    evento.preventDefault();
    const novosErros = obterErrosProdutoForm(formularioProduto);

    if (Object.keys(novosErros).length > 0) {
      setErrosProduto(novosErros);
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
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Produto cadastrado",
        detail: "O item já está disponível para controle de estoque.",
        life: 2600
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
      notificacaoRef.current?.show({
        severity: "error",
        summary: "Falha na movimentação",
        detail: erro.message,
        life: 3200
      });
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
        text: tipo === "entrada" ? "Entrada registrada com sucesso." : "Saída registrada com sucesso."
      });
      notificacaoRef.current?.show({
        severity: "success",
        summary: tipo === "entrada" ? "Entrada registrada" : "Saída registrada",
        detail: `${produtoSelecionado.nome} atualizado com sucesso.`,
        life: 2600
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvandoMovimentacao(false);
    }
  }

  const produtosComEstoqueBaixo = useMemo(
    () => produtos.filter((produto) => estoqueEstaBaixo(produto)),
    [produtos]
  );
  const produtosVencidos = useMemo(
    () => produtos.filter((produto) => produtoTemEstoqueVencido(produto)),
    [produtos]
  );
  const produtosProximosVencimento = useMemo(
    () => produtos.filter((produto) => produtoProximoDoVencimento(produto)),
    [produtos]
  );
  const produtosInativos = useMemo(
    () => produtos.filter((produto) => !produto.ativo),
    [produtos]
  );

  const produtosFiltrados = useMemo(
    () =>
      produtos.filter((produto) => {
        const categoriaCorresponde = !filtroCategoria || produto.categoria === filtroCategoria;
        const statusCorresponde = !filtroStatus || produtoPossuiStatus(produto, filtroStatus);

        return categoriaCorresponde && statusCorresponde;
      }),
    [filtroCategoria, filtroStatus, produtos]
  );

  function produtoPossuiStatus(produto, status) {
    if (status === "inativo") {
      return !produto.ativo;
    }

    if (status === "vencido") {
      return produtoTemEstoqueVencido(produto);
    }

    if (status === "proximo_vencimento") {
      return produtoProximoDoVencimento(produto);
    }

    if (status === "estoque_baixo") {
      return estoqueEstaBaixo(produto);
    }

    if (status === "regular") {
      return (
        produto.ativo &&
        !produtoTemEstoqueVencido(produto) &&
        !produtoProximoDoVencimento(produto) &&
        !estoqueEstaBaixo(produto)
      );
    }

    return true;
  }

  function renderizarSaldo(produto) {
    const possuiVencido = produtoTemEstoqueVencido(produto);

    return (
      <div className={styles.quantityCell}>
        <div className={styles.quantityStack}>
          <strong>Total: {formatarQuantidadeComUnidade(produto.quantidade_atual, produto.unidade_medida)}</strong>
          <span>Venda: {formatarQuantidadeComUnidade(produto.quantidade_disponivel_venda, produto.unidade_medida)}</span>
          {possuiVencido ? (
            <span>Vencido: {formatarQuantidadeComUnidade(produto.quantidade_vencida, produto.unidade_medida)}</span>
          ) : null}
        </div>
      </div>
    );
  }

  function renderizarStatus(produto) {
    const status = [];

    if (!produto.ativo) {
      status.push(<Tag key="inativo" severity="secondary" value="Inativo" />);
    }

    if (produtoTemEstoqueVencido(produto)) {
      status.push(<Tag key="vencido" severity="danger" value="Produto vencido" />);
    }

    if (produtoProximoDoVencimento(produto)) {
      status.push(<Tag key="proximo" severity="warning" value="Próximo do vencimento" />);
    }

    if (estoqueEstaBaixo(produto)) {
      status.push(<Tag key="baixo" severity="danger" value="Estoque baixo" />);
    }

    if (status.length === 0) {
      status.push(<Tag key="regular" severity="success" value="Regular" />);
    }

    return <div className={styles.statusTags}>{status}</div>;
  }

  function renderizarAcoes(produto) {
    return (
      <div className={styles.actions}>
        <Button
          label="Entrada"
          icon="pi pi-plus"
          size="small"
          disabled={!produto.ativo}
          onClick={() => abrirMovimentacao("entrada", produto)}
        />
        <Button
          label="Saída"
          icon="pi pi-minus"
          size="small"
          severity="warning"
          disabled={!produto.ativo}
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
      [styles.lowStockRow]: estoqueEstaBaixo(produto),
      [styles.expiredRow]: produtoTemEstoqueVencido(produto),
      [styles.expiringRow]: produtoProximoDoVencimento(produto),
      [styles.inactiveRow]: !produto.ativo
    };
  }

  function limparFiltrosTabela() {
    setFiltroGlobal("");
    setFiltroCategoria(null);
    setFiltroStatus(null);
  }

  function atualizarCampoProduto(campo, valor) {
    setFormularioProduto((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
    setErrosProduto((errosAtuais) => ({ ...errosAtuais, [campo]: null }));
  }

  const renderizarRodapeDialogoProduto = () => (
    <div className={styles.dialogFooter}>
      <Button label="Cancelar" type="button" text onClick={fecharModalProduto} />
      <Button label="Salvar Produto" type="submit" loading={salvandoProduto} />
    </div>
  );

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />

      <header className={styles.header}>
        <div>
          <h1>Estoque</h1>
        </div>

        <Button label="Cadastrar Produto" icon="pi pi-plus" onClick={() => setModalProduto(true)} />
      </header>

      <div className={styles.panel}>
        {mensagem ? (
          <div className={styles.feedback}>
            <Message severity={mensagem.severity} text={mensagem.text} />
          </div>
        ) : null}

        <div className={styles.summaryGrid}>
          <article className={`${styles.summaryItem} ${styles.summaryDanger}`}>
            <span>Estoque baixo</span>
            <strong>{produtosComEstoqueBaixo.length}</strong>
          </article>

          <article className={`${styles.summaryItem} ${styles.summaryDanger}`}>
            <span>Produto vencido</span>
            <strong>{produtosVencidos.length}</strong>
          </article>

          <article className={`${styles.summaryItem} ${styles.summaryWarning}`}>
            <span>Próximo do vencimento</span>
            <strong>{produtosProximosVencimento.length}</strong>
          </article>

          <article className={styles.summaryItem}>
            <span>Produto inativo</span>
            <strong>{produtosInativos.length}</strong>
          </article>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarTitle}>
            <h2>Produtos</h2>
          </div>

          <div className={styles.filters}>
            <span className={`p-input-icon-left ${styles.searchBox}`}>
              <i className="pi pi-search" />
              <InputText
                value={filtroGlobal}
                onChange={(evento) => setFiltroGlobal(evento.target.value)}
                placeholder="Buscar produto"
              />
            </span>

            <Dropdown
              className={styles.filterSelect}
              value={filtroCategoria}
              options={opcoesFiltroCategoria}
              onChange={(evento) => setFiltroCategoria(evento.value)}
              placeholder="Todas as categorias"
            />

            <Dropdown
              className={styles.filterSelect}
              value={filtroStatus}
              options={opcoesFiltroStatus}
              onChange={(evento) => setFiltroStatus(evento.value)}
              placeholder="Todos os status"
            />

            <Button label="Limpar filtros" text onClick={limparFiltrosTabela} />
          </div>
        </div>

        {produtos.length === 0 && !carregando ? (
          <EstadoVazio
            icone="pi pi-box"
            titulo="Nenhum produto cadastrado ainda."
            descricao="Cadastre o primeiro produto para iniciar o controle de estoque."
            acao={<Button label="Cadastrar Produto" icon="pi pi-plus" onClick={() => setModalProduto(true)} />}
          />
        ) : (
          <DataTable
            value={produtosFiltrados}
            dataKey="id"
            loading={carregando}
            globalFilter={filtroGlobal}
            globalFilterFields={["nome"]}
            emptyMessage="Nenhum produto corresponde aos filtros aplicados."
            rowClassName={obterClasseLinha}
            responsiveLayout="scroll"
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} a {last} de {totalRecords}"
            sortField="nome"
            sortOrder={1}
          >
            <Column field="nome" header="Produto" sortable />
            <Column field="categoria" header="Categoria" sortable />
            <Column
              field="quantidade_atual"
              header="Saldo"
              body={renderizarSaldo}
              sortable
            />
            <Column
              field="proxima_validade"
              header="Validade"
              body={(produto) => formatarData(produto.proxima_validade)}
              sortable
            />
            <Column header="Status" body={renderizarStatus} />
            <Column header="Ações" body={renderizarAcoes} />
          </DataTable>
        )}
      </div>

      <Dialog
        visible={modalProduto}
        header="Cadastrar Produto"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalProduto}
      >
        <form className={styles.form} onSubmit={enviarFormularioProduto}>
          <div className={styles.field}>
            <label htmlFor="produto-nome">Nome do produto</label>
            <InputText
              id="produto-nome"
              className={errosProduto.nome ? "p-invalid" : ""}
              value={formularioProduto.nome}
              placeholder="Ex.: Tomate italiano"
              onChange={(evento) => atualizarCampoProduto("nome", evento.target.value)}
            />
            {errosProduto.nome ? <small className={styles.fieldError}>{errosProduto.nome}</small> : null}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="produto-categoria">Categoria</label>
              <Dropdown
                id="produto-categoria"
                className={errosProduto.categoria ? "p-invalid" : ""}
                value={formularioProduto.categoria}
                options={opcoesCategoria}
                placeholder="Selecione a categoria"
                onChange={(evento) => atualizarCampoProduto("categoria", evento.value)}
              />
              {errosProduto.categoria ? <small className={styles.fieldError}>{errosProduto.categoria}</small> : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="produto-unidade">Unidade de medida</label>
              <Dropdown
                id="produto-unidade"
                className={errosProduto.unidade_medida ? "p-invalid" : ""}
                value={formularioProduto.unidade_medida}
                options={opcoesUnidade}
                placeholder="Selecione a unidade"
                onChange={(evento) => atualizarCampoProduto("unidade_medida", evento.value)}
              />
              {errosProduto.unidade_medida ? (
                <small className={styles.fieldError}>{errosProduto.unidade_medida}</small>
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="produto-estoque-minimo">Estoque mínimo</label>
            <InputNumber
              id="produto-estoque-minimo"
              inputId="produto-estoque-minimo-input"
              inputClassName={errosProduto.estoque_minimo ? "p-invalid" : ""}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={3}
              mode="decimal"
              value={formularioProduto.estoque_minimo}
              placeholder="0"
              onValueChange={(evento) =>
                atualizarCampoProduto("estoque_minimo", evento.value ?? 0)
              }
            />
            {errosProduto.estoque_minimo ? (
              <small className={styles.fieldError}>{errosProduto.estoque_minimo}</small>
            ) : null}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="produto-preco-venda">Preço de venda</label>
              <InputNumber
                id="produto-preco-venda"
                inputId="produto-preco-venda-input"
                inputClassName={errosProduto.preco_venda_padrao ? "p-invalid" : ""}
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                mode="decimal"
                locale="pt-BR"
                useGrouping={false}
                value={formularioProduto.preco_venda_padrao}
                placeholder="0,00"
                onFocus={(evento) => evento.target.select()}
                onValueChange={(evento) =>
                  atualizarCampoProduto("preco_venda_padrao", evento.value ?? 0)
                }
              />
              {errosProduto.preco_venda_padrao ? (
                <small className={styles.fieldError}>{errosProduto.preco_venda_padrao}</small>
              ) : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="produto-validade">Validade padrão em dias</label>
              <InputNumber
                id="produto-validade"
                inputId="produto-validade-input"
                inputClassName={errosProduto.validade_dias_padrao ? "p-invalid" : ""}
                min={1}
                useGrouping={false}
                value={formularioProduto.validade_dias_padrao}
                placeholder="Ex.: 5"
                onValueChange={(evento) =>
                  atualizarCampoProduto("validade_dias_padrao", evento.value ?? 1)
                }
              />
              {errosProduto.validade_dias_padrao ? (
                <small className={styles.fieldError}>{errosProduto.validade_dias_padrao}</small>
              ) : null}
            </div>
          </div>

          {renderizarRodapeDialogoProduto()}
        </form>
      </Dialog>

      <ModalMovimentacao
        visivel={modalEntrada || modalSaida}
        tipo={modalEntrada ? "entrada" : "saida"}
        rotuloProduto={produtoSelecionado ? `${produtoSelecionado.nome} (${produtoSelecionado.unidade_medida})` : ""}
        formulario={formularioMovimentacao}
        salvando={salvandoMovimentacao}
        estilos={styles}
        aoAlterar={setFormularioMovimentacao}
        aoFechar={fecharModalMovimentacao}
        aoEnviar={enviarFormularioMovimentacao}
      />
    </section>
  );
}
