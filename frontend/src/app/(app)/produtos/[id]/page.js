"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";

import MovimentacaoDialog from "@/components/MovimentacaoDialog";
import {
  buscarMovimentacoesPorProduto,
  registrarEntrada,
  registrarSaida
} from "@/services/movimentacoesService";
import {
  buscarCamadasPorProduto,
  buscarProdutoPorId
} from "@/services/produtosService";
import { formatarData, formatarMoeda, formatarQuantidade } from "@/utils/formatters";
import { estoqueEstaBaixo } from "@/utils/produtos";
import { validarMovimentacaoForm } from "@/utils/validators";

import styles from "./page.module.css";

const formularioMovimentacaoInicial = {
  quantidade: null,
  custo_unitario: null,
  subtipo: "venda",
  observacao: ""
};

export default function PaginaDetalheProduto({ params }) {
  const produtoId = params?.id;

  const [produto, setProduto] = useState(null);
  const [camadas, setCamadas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [formularioMovimentacao, setFormularioMovimentacao] = useState(formularioMovimentacaoInicial);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);

  async function carregarDetalhe() {
    setCarregando(true);

    try {
      const [dadosProduto, dadosCamadas, dadosMovimentacoes] = await Promise.all([
        buscarProdutoPorId(produtoId),
        buscarCamadasPorProduto(produtoId),
        buscarMovimentacoesPorProduto(produtoId)
      ]);

      setProduto(dadosProduto);
      setCamadas(dadosCamadas);
      setMovimentacoes(dadosMovimentacoes);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (produtoId) {
      carregarDetalhe();
    }
  }, [produtoId]);

  function abrirMovimentacao(tipo) {
    setFormularioMovimentacao({
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
    setFormularioMovimentacao(formularioMovimentacaoInicial);
  }

  async function enviarFormularioMovimentacao(evento, tipo) {
    evento.preventDefault();
    const mensagemValidacao = validarMovimentacaoForm(formularioMovimentacao, tipo);

    if (mensagemValidacao) {
      setMensagem({ severity: "error", text: mensagemValidacao });
      return;
    }

    setSalvandoMovimentacao(true);
    setMensagem(null);

    try {
      const dadosMovimentacao = {
        produto_id: Number(produtoId),
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

      fecharMovimentacao();
      await carregarDetalhe();
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

  const estoqueBaixo = estoqueEstaBaixo(produto);

  return (
    <section className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/estoque">
          &lt;- Voltar ao Estoque
        </Link>
      </div>

      {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

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
          <strong>{produto ? formatarQuantidade(produto.quantidade_atual) : "--"}</strong>
          <small>Venda: {produto ? formatarQuantidade(produto.quantidade_disponivel_venda) : "--"}</small>
          <small>Vencido: {produto ? formatarQuantidade(produto.quantidade_vencida) : "--"}</small>
        </div>
      </div>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <span>Preco de venda</span>
          <strong>{produto ? formatarMoeda(produto.preco_venda_padrao) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Valor em custo</span>
          <strong>{produto ? formatarMoeda(produto.valor_estoque_custo) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Valor em venda</span>
          <strong>{produto ? formatarMoeda(produto.valor_estoque_venda) : "--"}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Proxima validade</span>
          <strong>{produto ? formatarData(produto.proxima_validade) : "--"}</strong>
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
          loading={carregando}
          emptyMessage="Nenhuma camada aberta encontrada para este produto."
          responsiveLayout="scroll"
        >
          <Column field="data_entrada" header="Entrada" body={(linha) => formatarData(linha.data_entrada)} />
          <Column field="data_validade" header="Validade" body={(linha) => formatarData(linha.data_validade)} />
          <Column
            field="quantidade_disponivel"
            header="Disponivel"
            body={(linha) => formatarQuantidade(linha.quantidade_disponivel)}
          />
          <Column
            field="custo_unitario"
            header="Custo Unit."
            body={(linha) => formatarMoeda(linha.custo_unitario)}
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
          loading={carregando}
          emptyMessage="Nenhuma movimentacao encontrada para este produto."
          responsiveLayout="scroll"
        >
          <Column field="data" header="Data" body={(linha) => formatarData(linha.data)} />
          <Column field="tipo" header="Tipo" />
          <Column field="subtipo" header="Subtipo" body={(linha) => linha.subtipo ?? "-"} />
          <Column field="quantidade" header="Quantidade" body={(linha) => formatarQuantidade(linha.quantidade)} />
          <Column field="custo_total" header="Custo" body={(linha) => formatarMoeda(linha.custo_total, { exibirVazio: true })} />
          <Column field="receita_total" header="Receita" body={(linha) => formatarMoeda(linha.receita_total, { exibirVazio: true })} />
          <Column field="lucro_bruto" header="Lucro Bruto" body={(linha) => formatarMoeda(linha.lucro_bruto, { exibirVazio: true })} />
          <Column field="usuario_nome" header="Responsavel" body={(linha) => linha.usuario_nome ?? "-"} />
          <Column field="observacao" header="Observacao" body={(linha) => linha.observacao ?? "-"} />
        </DataTable>
      </div>

      <MovimentacaoDialog
        visible={modalEntrada || modalSaida}
        tipo={modalEntrada ? "entrada" : "saida"}
        formulario={formularioMovimentacao}
        salvando={salvandoMovimentacao}
        styles={styles}
        idPrefix="detalhe"
        onChange={setFormularioMovimentacao}
        onHide={fecharMovimentacao}
        onSubmit={enviarFormularioMovimentacao}
      />
    </section>
  );
}
