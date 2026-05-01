"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";

import {
  buscarCamadasPorProduto,
  buscarMovimentacoesPorProduto,
  buscarProdutoPorId,
  registrarEntrada,
  registrarSaida
} from "@/services/produtosService";

import styles from "./page.module.css";

const opcoesSubtipoSaida = [
  { label: "Venda", value: "venda" },
  { label: "Perda", value: "perda" }
];

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
  if (valor == null) {
    return "-";
  }

  return Number(valor).toLocaleString("pt-BR", {
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
  return Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0) < Number(produto?.estoque_minimo ?? 0);
}

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

    if (formularioMovimentacao.quantidade == null || Number(formularioMovimentacao.quantidade) <= 0) {
      setMensagem({ severity: "error", text: "Informe uma quantidade maior que zero." });
      return;
    }

    if (
      tipo === "entrada" &&
      (formularioMovimentacao.custo_unitario == null || Number(formularioMovimentacao.custo_unitario) <= 0)
    ) {
      setMensagem({ severity: "error", text: "Informe um custo unitario maior que zero para a entrada." });
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
          <Column field="custo_total" header="Custo" body={(linha) => formatarMoeda(linha.custo_total)} />
          <Column field="receita_total" header="Receita" body={(linha) => formatarMoeda(linha.receita_total)} />
          <Column field="lucro_bruto" header="Lucro Bruto" body={(linha) => formatarMoeda(linha.lucro_bruto)} />
          <Column field="usuario_nome" header="Responsavel" body={(linha) => linha.usuario_nome ?? "-"} />
          <Column field="observacao" header="Observacao" body={(linha) => linha.observacao ?? "-"} />
        </DataTable>
      </div>

      <Dialog
        visible={modalEntrada || modalSaida}
        header={modalEntrada ? "Registrar Entrada" : "Registrar Saida"}
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharMovimentacao}
      >
        <form
          className={styles.form}
          onSubmit={(evento) => enviarFormularioMovimentacao(evento, modalEntrada ? "entrada" : "saida")}
        >
          <div className={styles.field}>
            <label htmlFor="detalhe-quantidade">Quantidade</label>
            <InputNumber
              id="detalhe-quantidade"
              inputId="detalhe-quantidade-input"
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
              <label htmlFor="detalhe-custo-unitario">Custo unitario</label>
              <InputNumber
                id="detalhe-custo-unitario"
                inputId="detalhe-custo-unitario-input"
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
              <label htmlFor="detalhe-subtipo">Tipo da saida</label>
              <Dropdown
                id="detalhe-subtipo"
                value={formularioMovimentacao.subtipo}
                options={opcoesSubtipoSaida}
                onChange={(evento) => setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, subtipo: evento.value }))}
              />
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="detalhe-observacao">Observacao</label>
            <InputTextarea
              id="detalhe-observacao"
              rows={4}
              value={formularioMovimentacao.observacao}
              onChange={(evento) =>
                setFormularioMovimentacao((formularioAtual) => ({ ...formularioAtual, observacao: evento.target.value }))
              }
            />
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharMovimentacao} />
            <Button
              label={modalEntrada ? "Salvar Entrada" : "Salvar Saida"}
              type="submit"
              loading={salvandoMovimentacao}
            />
          </div>
        </form>
      </Dialog>
    </section>
  );
}
