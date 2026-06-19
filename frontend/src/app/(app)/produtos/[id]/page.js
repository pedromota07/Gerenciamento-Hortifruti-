"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import ModalMovimentacao from "@/components/ModalMovimentacao";
import ProdutoVisual from "@/components/ProdutoVisual";
import {
  buscarMovimentacoesPorProduto,
  registrarEntrada,
  registrarSaida
} from "@/services/servicoMovimentacoes";
import {
  atualizarProduto,
  buscarCamadasPorProduto,
  buscarProdutoPorId
} from "@/services/servicoProdutos";
import { formatarData, formatarMoeda, formatarQuantidadeComUnidade } from "@/utils/formatters";
import {
  estoqueEstaBaixo,
  produtoProximoDoVencimento,
  produtoTemEstoqueVencido
} from "@/utils/produtos";
import { obterErrosProdutoForm, validarMovimentacaoForm } from "@/utils/validators";

import styles from "./page.module.css";

const formularioMovimentacaoInicial = {
  quantidade: null,
  custo_unitario: null,
  subtipo: "venda",
  observacao: ""
};

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

const opcoesStatus = [
  { label: "Ativo", value: true },
  { label: "Inativo", value: false }
];

export default function PaginaDetalheProduto() {
  const { id: produtoId } = useParams();
  const notificacaoRef = useRef(null);

  const [produto, setProduto] = useState(null);
  const [camadas, setCamadas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [formularioMovimentacao, setFormularioMovimentacao] = useState(formularioMovimentacaoInicial);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [modalEdicao, setModalEdicao] = useState(false);
  const [formularioProduto, setFormularioProduto] = useState(null);
  const [errosProduto, setErrosProduto] = useState({});
  const [salvandoProduto, setSalvandoProduto] = useState(false);

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

  function abrirEdicao() {
    setFormularioProduto({
      nome: produto.nome,
      categoria: produto.categoria,
      unidade_medida: produto.unidade_medida,
      estoque_minimo: Number(produto.estoque_minimo),
      preco_venda_padrao: Number(produto.preco_venda_padrao),
      validade_dias_padrao: Number(produto.validade_dias_padrao),
      ativo: produto.ativo
    });
    setErrosProduto({});
    setModalEdicao(true);
  }

  function atualizarCampoProduto(campo, valor) {
    setFormularioProduto((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
    setErrosProduto((errosAtuais) => ({ ...errosAtuais, [campo]: null }));
  }

  async function salvarProduto(evento) {
    evento.preventDefault();
    const novosErros = obterErrosProdutoForm(formularioProduto);

    if (Object.keys(novosErros).length > 0) {
      setErrosProduto(novosErros);
      return;
    }

    setSalvandoProduto(true);

    try {
      await atualizarProduto(produtoId, {
        ...formularioProduto,
        nome: formularioProduto.nome.trim(),
        estoque_minimo: Number(formularioProduto.estoque_minimo).toFixed(3),
        preco_venda_padrao: Number(formularioProduto.preco_venda_padrao).toFixed(2),
        validade_dias_padrao: Number(formularioProduto.validade_dias_padrao)
      });
      setModalEdicao(false);
      await carregarDetalhe();
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Produto atualizado",
        detail: "As informações do produto foram salvas.",
        life: 2800
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
      notificacaoRef.current?.show({
        severity: "error",
        summary: "Falha ao atualizar",
        detail: erro.message,
        life: 3200
      });
    } finally {
      setSalvandoProduto(false);
    }
  }

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
        text: tipo === "entrada" ? "Entrada registrada com sucesso." : "Saída registrada com sucesso."
      });
      notificacaoRef.current?.show({
        severity: "success",
        summary: tipo === "entrada" ? "Entrada registrada" : "Saída registrada",
        detail: "O saldo e o histórico do produto foram atualizados.",
        life: 2800
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvandoMovimentacao(false);
    }
  }

  const estoqueBaixo = estoqueEstaBaixo(produto);
  const estoqueVencido = produtoTemEstoqueVencido(produto);
  const proximoVencimento = produtoProximoDoVencimento(produto);

  function renderizarStatusProduto() {
    if (!produto) {
      return null;
    }

    return (
      <div className={styles.statusList}>
        {!produto.ativo ? <Tag value="Inativo" severity="secondary" /> : null}
        {estoqueVencido ? <Tag value="Estoque vencido" severity="danger" /> : null}
        {proximoVencimento ? <Tag value="Próximo do vencimento" severity="warning" /> : null}
        {estoqueBaixo ? <Tag value="Estoque baixo" severity="danger" /> : null}
        {produto.ativo && !estoqueVencido && !proximoVencimento && !estoqueBaixo ? (
          <Tag value="Regular" severity="success" />
        ) : null}
      </div>
    );
  }

  function renderizarTipoMovimentacao(linha) {
    const entrada = linha.tipo === "entrada";

    return (
      <span className={`${styles.movementType} ${entrada ? styles.entryType : styles.exitType}`}>
        <i className={`pi ${entrada ? "pi-arrow-down-left" : "pi-arrow-up-right"}`} />
        {entrada ? "Entrada" : linha.subtipo === "perda" ? "Perda" : "Saída"}
      </span>
    );
  }

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />

      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/estoque">Estoque</Link>
        <i className="pi pi-angle-right" />
        <span>{produto?.nome ?? "Produto"}</span>
      </nav>

      {mensagem ? (
        <div className={styles.feedback}>
          <Message severity={mensagem.severity} text={mensagem.text} />
          {mensagem.severity === "error" && !produto ? (
            <Button label="Tentar novamente" icon="pi pi-refresh" text onClick={carregarDetalhe} />
          ) : null}
        </div>
      ) : null}

      <header className={styles.productHeader}>
        <div className={styles.titleBlock}>
          <Link className={styles.backButton} href="/estoque" aria-label="Voltar ao estoque">
            <i className="pi pi-arrow-left" />
          </Link>
          <ProdutoVisual
            className={styles.headerProductVisual}
            nome={produto?.nome}
            categoria={produto?.categoria}
            tamanho="destaque"
          />
          <div>
            <p className={styles.eyebrow}>Detalhe do produto</p>
            <h1>{produto?.nome ?? "Carregando produto..."}</h1>
            <div className={styles.meta}>
              <span>{produto?.categoria ?? "-"}</span>
              <span>{produto?.unidade_medida ?? "-"}</span>
              {renderizarStatusProduto()}
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Button
            label="Editar"
            icon="pi pi-pencil"
            outlined
            onClick={abrirEdicao}
            disabled={!produto}
          />
          <Button
            label="Entrada"
            icon="pi pi-plus"
            onClick={() => abrirMovimentacao("entrada")}
          />
          <Button
            label="Saída"
            icon="pi pi-minus"
            severity="warning"
            outlined
            onClick={() => abrirMovimentacao("saida")}
          />
        </div>
      </header>

      <div className={styles.stockOverview}>
        <div className={styles.mainBalance}>
          <span className={styles.metricIcon}><i className="pi pi-box" /></span>
          <div>
            <span>Disponível para venda</span>
            <strong>
              {produto
                ? formatarQuantidadeComUnidade(
                    produto.quantidade_disponivel_venda,
                    produto.unidade_medida
                  )
                : "--"}
            </strong>
            <small>
              {produto
                ? `${formatarQuantidadeComUnidade(
                    produto.quantidade_atual,
                    produto.unidade_medida
                  )} no estoque total`
                : "Carregando saldo"}
            </small>
          </div>
        </div>

        <div className={styles.quickMetrics}>
          <article>
            <span>Estoque vencido</span>
            <strong>
              {produto
                ? formatarQuantidadeComUnidade(produto.quantidade_vencida, produto.unidade_medida)
                : "--"}
            </strong>
          </article>
          <article>
            <span>Próxima validade</span>
            <strong>{produto ? formatarData(produto.proxima_validade) : "--"}</strong>
          </article>
          <article>
            <span>Preço de venda</span>
            <strong>{produto ? formatarMoeda(produto.preco_venda_padrao) : "--"}</strong>
          </article>
        </div>
      </div>

      <div className={styles.contentSurface}>
        <TabView activeIndex={abaAtiva} onTabChange={(evento) => setAbaAtiva(evento.index)}>
          <TabPanel header="Visão geral" leftIcon="pi pi-chart-bar">
            <div className={styles.overviewGrid}>
              <section className={styles.overviewCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span>Financeiro</span>
                    <h2>Valor do estoque</h2>
                  </div>
                  <i className="pi pi-wallet" />
                </div>
                <dl className={styles.detailList}>
                  <div>
                    <dt>Valor em custo</dt>
                    <dd>{produto ? formatarMoeda(produto.valor_estoque_custo) : "--"}</dd>
                  </div>
                  <div>
                    <dt>Potencial de venda</dt>
                    <dd>{produto ? formatarMoeda(produto.valor_estoque_venda) : "--"}</dd>
                  </div>
                  <div>
                    <dt>Preço padrão</dt>
                    <dd>{produto ? formatarMoeda(produto.preco_venda_padrao) : "--"}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.overviewCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span>Configuração</span>
                    <h2>Controle do produto</h2>
                  </div>
                  <i className="pi pi-sliders-h" />
                </div>
                <dl className={styles.detailList}>
                  <div>
                    <dt>Estoque mínimo</dt>
                    <dd>
                      {produto
                        ? formatarQuantidadeComUnidade(
                            produto.estoque_minimo,
                            produto.unidade_medida
                          )
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt>Validade padrão</dt>
                    <dd>{produto ? `${produto.validade_dias_padrao} dia(s)` : "--"}</dd>
                  </div>
                  <div>
                    <dt>Situação</dt>
                    <dd>{produto?.ativo ? "Produto ativo" : "Produto inativo"}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </TabPanel>

          <TabPanel header={`Lotes (${camadas.length})`} leftIcon="pi pi-box">
            <div className={styles.tabHeading}>
              <div>
                <h2>Lotes disponíveis</h2>
                <p>Acompanhamento das entradas abertas por ordem de validade.</p>
              </div>
              <Button label="Registrar entrada" icon="pi pi-plus" size="small" onClick={() => abrirMovimentacao("entrada")} />
            </div>

            {camadas.length === 0 && !carregando ? (
              <EstadoVazio
                icone="pi pi-box"
                titulo="Este produto ainda não tem lotes disponíveis."
                descricao="Registre uma entrada para começar o acompanhamento por validade."
              />
            ) : (
              <>
                <div className={styles.desktopTable}>
                  <DataTable value={camadas} dataKey="id" loading={carregando} responsiveLayout="scroll">
                    <Column field="data_entrada" header="Entrada" body={(linha) => formatarData(linha.data_entrada)} />
                    <Column field="data_validade" header="Validade" body={(linha) => formatarData(linha.data_validade)} />
                    <Column
                      field="quantidade_disponivel"
                      header="Disponível"
                      body={(linha) => formatarQuantidadeComUnidade(linha.quantidade_disponivel, produto?.unidade_medida)}
                    />
                    <Column
                      field="custo_unitario"
                      header="Custo unitário"
                      body={(linha) => formatarMoeda(linha.custo_unitario)}
                    />
                  </DataTable>
                </div>
                <div className={styles.mobileList}>
                  {camadas.map((camada) => (
                    <article className={styles.dataCard} key={camada.id}>
                      <div>
                        <span>Validade</span>
                        <strong>{formatarData(camada.data_validade)}</strong>
                      </div>
                      <dl>
                        <div><dt>Entrada</dt><dd>{formatarData(camada.data_entrada)}</dd></div>
                        <div><dt>Disponível</dt><dd>{formatarQuantidadeComUnidade(camada.quantidade_disponivel, produto?.unidade_medida)}</dd></div>
                        <div><dt>Custo unitário</dt><dd>{formatarMoeda(camada.custo_unitario)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
          </TabPanel>

          <TabPanel header={`Movimentações (${movimentacoes.length})`} leftIcon="pi pi-history">
            <div className={styles.tabHeading}>
              <div>
                <h2>Histórico de movimentações</h2>
                <p>Entradas, vendas e perdas registradas para este produto.</p>
              </div>
            </div>

            {movimentacoes.length === 0 && !carregando ? (
              <EstadoVazio
                icone="pi pi-sync"
                titulo="Nenhuma movimentação registrada neste produto."
                descricao="Entradas, vendas e perdas aparecerão aqui conforme o item for movimentado."
              />
            ) : (
              <>
                <div className={styles.desktopTable}>
                  <DataTable value={movimentacoes} dataKey="id" loading={carregando} responsiveLayout="scroll" paginator rows={10}>
                    <Column field="data" header="Data" body={(linha) => formatarData(linha.data)} />
                    <Column field="tipo" header="Tipo" body={renderizarTipoMovimentacao} />
                    <Column
                      field="quantidade"
                      header="Quantidade"
                      body={(linha) => formatarQuantidadeComUnidade(linha.quantidade, produto?.unidade_medida)}
                    />
                    <Column field="receita_total" header="Receita" body={(linha) => formatarMoeda(linha.receita_total, { exibirVazio: true })} />
                    <Column field="lucro_bruto" header="Lucro bruto" body={(linha) => formatarMoeda(linha.lucro_bruto, { exibirVazio: true })} />
                    <Column field="usuario_nome" header="Responsável" body={(linha) => linha.usuario_nome ?? "-"} />
                    <Column field="observacao" header="Observação" body={(linha) => linha.observacao ?? "-"} />
                  </DataTable>
                </div>
                <div className={styles.mobileList}>
                  {movimentacoes.map((movimentacao) => (
                    <article className={styles.dataCard} key={movimentacao.id}>
                      <div className={styles.movementCardHeader}>
                        {renderizarTipoMovimentacao(movimentacao)}
                        <time>{formatarData(movimentacao.data)}</time>
                      </div>
                      <strong className={styles.movementQuantity}>
                        {formatarQuantidadeComUnidade(movimentacao.quantidade, produto?.unidade_medida)}
                      </strong>
                      <dl>
                        <div><dt>Receita</dt><dd>{formatarMoeda(movimentacao.receita_total, { exibirVazio: true })}</dd></div>
                        <div><dt>Responsável</dt><dd>{movimentacao.usuario_nome ?? "-"}</dd></div>
                      </dl>
                      {movimentacao.observacao ? <p>{movimentacao.observacao}</p> : null}
                    </article>
                  ))}
                </div>
              </>
            )}
          </TabPanel>
        </TabView>
      </div>

      <ModalMovimentacao
        visivel={modalEntrada || modalSaida}
        tipo={modalEntrada ? "entrada" : "saida"}
        formulario={formularioMovimentacao}
        salvando={salvandoMovimentacao}
        estilos={styles}
        prefixoId="detalhe"
        aoAlterar={setFormularioMovimentacao}
        aoFechar={fecharMovimentacao}
        aoEnviar={enviarFormularioMovimentacao}
      />

      <Dialog
        visible={modalEdicao}
        header="Editar produto"
        style={{ width: "min(92vw, 680px)" }}
        onHide={() => setModalEdicao(false)}
      >
        {formularioProduto ? (
          <form className={styles.form} onSubmit={salvarProduto}>
            <div className={styles.field}>
              <label htmlFor="produto-editar-nome">Nome</label>
              <InputText
                id="produto-editar-nome"
                value={formularioProduto.nome}
                className={errosProduto.nome ? "p-invalid" : ""}
                onChange={(evento) => atualizarCampoProduto("nome", evento.target.value)}
              />
              {errosProduto.nome ? <small className={styles.fieldError}>{errosProduto.nome}</small> : null}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="produto-editar-categoria">Categoria</label>
                <Dropdown
                  id="produto-editar-categoria"
                  value={formularioProduto.categoria}
                  options={opcoesCategoria}
                  onChange={(evento) => atualizarCampoProduto("categoria", evento.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="produto-editar-unidade">Unidade</label>
                <Dropdown
                  id="produto-editar-unidade"
                  value={formularioProduto.unidade_medida}
                  options={opcoesUnidade}
                  onChange={(evento) => atualizarCampoProduto("unidade_medida", evento.value)}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="produto-editar-minimo">Estoque mínimo</label>
                <InputNumber
                  inputId="produto-editar-minimo"
                  value={formularioProduto.estoque_minimo}
                  min={0}
                  maxFractionDigits={3}
                  onValueChange={(evento) => atualizarCampoProduto("estoque_minimo", evento.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="produto-editar-preco">Preço de venda</label>
                <InputNumber
                  inputId="produto-editar-preco"
                  value={formularioProduto.preco_venda_padrao}
                  min={0}
                  mode="currency"
                  currency="BRL"
                  locale="pt-BR"
                  onValueChange={(evento) => atualizarCampoProduto("preco_venda_padrao", evento.value)}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="produto-editar-validade">Validade padrão</label>
                <InputNumber
                  inputId="produto-editar-validade"
                  value={formularioProduto.validade_dias_padrao}
                  min={1}
                  suffix=" dias"
                  onValueChange={(evento) => atualizarCampoProduto("validade_dias_padrao", evento.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="produto-editar-status">Status</label>
                <Dropdown
                  id="produto-editar-status"
                  value={formularioProduto.ativo}
                  options={opcoesStatus}
                  onChange={(evento) => atualizarCampoProduto("ativo", evento.value)}
                />
              </div>
            </div>

            <div className={styles.dialogFooter}>
              <Button label="Cancelar" type="button" text onClick={() => setModalEdicao(false)} />
              <Button label="Salvar alterações" type="submit" loading={salvandoProduto} />
            </div>
          </form>
        ) : null}
      </Dialog>
    </section>
  );
}
