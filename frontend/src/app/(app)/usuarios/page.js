"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";

import EstadoVazio from "@/components/EstadoVazio";
import { usarAutenticacao } from "@/context/ContextoAutenticacao";
import { atualizarUsuario, buscarUsuarios, criarUsuario } from "@/services/servicoUsuarios";

import styles from "./page.module.css";

const opcoesPerfil = [
  { label: "Gerente", value: "gerente" },
  { label: "Funcionário", value: "funcionario" }
];

const opcoesStatus = [
  { label: "Ativo", value: true },
  { label: "Inativo", value: false }
];

const formularioInicial = {
  nome: "",
  email: "",
  senha: "",
  perfil: "funcionario",
  ativo: true
};

function obterErrosNovoUsuario(formulario) {
  const erros = {};

  if (!formulario.nome.trim()) {
    erros.nome = "Informe o nome do usuário.";
  }

  if (!formulario.email.trim()) {
    erros.email = "Informe o email do usuário.";
  }

  if (!formulario.senha || formulario.senha.length < 6) {
    erros.senha = "A senha deve ter pelo menos 6 caracteres.";
  }

  return erros;
}

export default function PaginaUsuarios() {
  const notificacaoRef = useRef(null);
  const roteador = useRouter();
  const { autenticacaoPronta, usuario } = usarAutenticacao();

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [errosNovoUsuario, setErrosNovoUsuario] = useState({});
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(null);

  useEffect(() => {
    if (autenticacaoPronta && usuario?.perfil !== "gerente") {
      roteador.replace("/dashboard");
    }
  }, [autenticacaoPronta, roteador, usuario]);

  useEffect(() => {
    if (!autenticacaoPronta || usuario?.perfil !== "gerente") {
      return;
    }

    carregarUsuarios();
  }, [autenticacaoPronta, usuario]);

  async function carregarUsuarios(opcoes = {}) {
    if (!opcoes.silencioso) {
      setCarregando(true);
    }

    try {
      const dados = await buscarUsuarios();
      setUsuarios(dados);
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

  function fecharModalNovo() {
    setModalNovo(false);
    setFormulario(formularioInicial);
    setErrosNovoUsuario({});
  }

  function abrirModalEditar(usuarioEditado) {
    setUsuarioSelecionado(usuarioEditado);
    setFormulario({
      nome: usuarioEditado.nome,
      email: usuarioEditado.email,
      senha: "",
      perfil: usuarioEditado.perfil,
      ativo: usuarioEditado.ativo
    });
    setModalEditar(true);
  }

  function fecharModalEditar() {
    setModalEditar(false);
    setUsuarioSelecionado(null);
    setFormulario(formularioInicial);
  }

  async function enviarFormularioNovo(evento) {
    evento.preventDefault();
    const novosErros = obterErrosNovoUsuario(formulario);

    if (Object.keys(novosErros).length > 0) {
      setErrosNovoUsuario(novosErros);
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      await criarUsuario({
        nome: formulario.nome.trim(),
        email: formulario.email.trim().toLowerCase(),
        senha: formulario.senha,
        perfil: formulario.perfil,
        ativo: formulario.ativo
      });
      fecharModalNovo();
      await carregarUsuarios({ silencioso: true });
      setMensagem({ severity: "success", text: "Usuário criado com sucesso." });
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Usuário criado",
        detail: "O acesso foi cadastrado com sucesso.",
        life: 2600
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
      setSalvando(false);
    }
  }

  async function salvarEdicaoUsuario() {
    setSalvando(true);
    setMensagem(null);

    try {
      await atualizarUsuario(usuarioSelecionado.id, {
        perfil: formulario.perfil,
        ativo: formulario.ativo
      });
      fecharModalEditar();
      await carregarUsuarios({ silencioso: true });
      setMensagem({ severity: "success", text: "Usuário atualizado com sucesso." });
      notificacaoRef.current?.show({
        severity: "success",
        summary: "Usuário atualizado",
        detail: "As permissões foram salvas.",
        life: 2600
      });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvando(false);
    }
  }

  async function enviarFormularioEditar(evento) {
    evento.preventDefault();

    if (!usuarioSelecionado) {
      setMensagem({ severity: "error", text: "Selecione um usuário para editar." });
      return;
    }

    if (usuarioSelecionado.ativo && !formulario.ativo) {
      confirmDialog({
        header: "Confirmar inativação",
        message: "Inativar este usuário impedirá novos acessos. Deseja continuar?",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Inativar",
        rejectLabel: "Cancelar",
        acceptClassName: "p-button-danger",
        accept: salvarEdicaoUsuario
      });
      return;
    }

    await salvarEdicaoUsuario();
  }

  function renderizarStatus(usuarioLinha) {
    return <Tag severity={usuarioLinha.ativo ? "success" : "danger"} value={usuarioLinha.ativo ? "Ativo" : "Inativo"} />;
  }

  function renderizarPerfil(usuarioLinha) {
    return (
      <span className={styles.profileCell}>
        <i className={usuarioLinha.perfil === "gerente" ? "pi pi-shield" : "pi pi-user"} />
        {usuarioLinha.perfil === "gerente" ? "Gerente" : "Funcionário"}
      </span>
    );
  }

  function renderizarNome(usuarioLinha) {
    const usuarioAtual = usuarioLinha.id === usuario?.id;

    return (
      <div className={styles.userCell}>
        <span className={styles.avatar}>{usuarioLinha.nome.trim().charAt(0).toUpperCase()}</span>
        <div>
          <strong>{usuarioLinha.nome}</strong>
          {usuarioAtual ? <small>Seu acesso</small> : null}
        </div>
      </div>
    );
  }

  function renderizarAcoes(usuarioLinha) {
    return (
      <Button
        label="Editar"
        icon="pi pi-pencil"
        size="small"
        text
        onClick={() => abrirModalEditar(usuarioLinha)}
      />
    );
  }

  function atualizarCampoNovoUsuario(campo, valor) {
    setFormulario((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
    setErrosNovoUsuario((errosAtuais) => ({ ...errosAtuais, [campo]: null }));
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return usuarios.filter((usuarioLinha) => {
      const correspondeBusca =
        !termo ||
        usuarioLinha.nome.toLowerCase().includes(termo) ||
        usuarioLinha.email.toLowerCase().includes(termo);
      const correspondePerfil = !filtroPerfil || usuarioLinha.perfil === filtroPerfil;
      const correspondeStatus = filtroStatus === null || usuarioLinha.ativo === filtroStatus;

      return correspondeBusca && correspondePerfil && correspondeStatus;
    });
  }, [busca, filtroPerfil, filtroStatus, usuarios]);

  const resumoUsuarios = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((usuarioLinha) => usuarioLinha.ativo).length,
      gerentes: usuarios.filter((usuarioLinha) => usuarioLinha.perfil === "gerente").length
    }),
    [usuarios]
  );

  function limparFiltros() {
    setBusca("");
    setFiltroPerfil("");
    setFiltroStatus(null);
  }

  const filtrosAtivos = Boolean(busca || filtroPerfil || filtroStatus !== null);

  if (!autenticacaoPronta || usuario?.perfil !== "gerente") {
    return null;
  }

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />
      <ConfirmDialog />

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Controle de acesso</span>
          <h1>Usuários</h1>
          <p>Gerencie quem pode acessar e operar o sistema.</p>
        </div>

        <Button label="Novo usuário" icon="pi pi-plus" onClick={() => setModalNovo(true)} />
      </header>

      <div className={styles.metrics}>
        <article>
          <span className={styles.metricIcon}><i className="pi pi-users" /></span>
          <div>
            <strong>{carregando ? "--" : resumoUsuarios.total}</strong>
            <span>Usuários cadastrados</span>
          </div>
        </article>
        <article>
          <span className={`${styles.metricIcon} ${styles.metricIconActive}`}><i className="pi pi-check-circle" /></span>
          <div>
            <strong>{carregando ? "--" : resumoUsuarios.ativos}</strong>
            <span>Acessos ativos</span>
          </div>
        </article>
        <article>
          <span className={`${styles.metricIcon} ${styles.metricIconManager}`}><i className="pi pi-shield" /></span>
          <div>
            <strong>{carregando ? "--" : resumoUsuarios.gerentes}</strong>
            <span>Gerentes</span>
          </div>
        </article>
      </div>

      <div className={styles.panel}>
        {mensagem ? (
          <div className={styles.feedback}>
            <Message severity={mensagem.severity} text={mensagem.text} />
          </div>
        ) : null}

        <div className={styles.panelHeader}>
          <div>
            <h2>Usuários cadastrados</h2>
            <p>{usuariosFiltrados.length} de {usuarios.length} acessos exibidos</p>
          </div>
        </div>

        <div className={styles.filters}>
          <span className={styles.searchField}>
            <i className="pi pi-search" />
            <InputText
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome ou email"
              aria-label="Buscar usuários por nome ou email"
            />
          </span>
          <Dropdown
            value={filtroPerfil}
            options={[{ label: "Todos os perfis", value: "" }, ...opcoesPerfil]}
            onChange={(evento) => setFiltroPerfil(evento.value)}
            placeholder="Perfil"
            aria-label="Filtrar usuários por perfil"
          />
          <Dropdown
            value={filtroStatus}
            options={[{ label: "Todos os status", value: null }, ...opcoesStatus]}
            onChange={(evento) => setFiltroStatus(evento.value)}
            placeholder="Status"
            aria-label="Filtrar usuários por status"
          />
          {filtrosAtivos ? <Button label="Limpar filtros" text onClick={limparFiltros} /> : null}
        </div>

        {usuariosFiltrados.length === 0 && !carregando ? (
          <EstadoVazio
            icone={filtrosAtivos ? "pi pi-search" : "pi pi-users"}
            titulo={filtrosAtivos ? "Nenhum usuário corresponde aos filtros." : "Nenhum usuário cadastrado ainda."}
            descricao={
              filtrosAtivos
                ? "Limpe ou ajuste os filtros para encontrar outro acesso."
                : "Cadastre o primeiro usuário para organizar quem faz cada operação."
            }
          />
        ) : (
          <>
            <DataTable
              value={usuariosFiltrados}
              dataKey="id"
              loading={carregando}
              responsiveLayout="scroll"
              paginator
              rows={10}
              rowsPerPageOptions={[10, 25, 50]}
              currentPageReportTemplate="{first} a {last} de {totalRecords}"
            >
              <Column field="nome" header="Usuário" body={renderizarNome} sortable />
              <Column field="email" header="Email" sortable />
              <Column field="perfil" header="Perfil" body={renderizarPerfil} sortable />
              <Column field="ativo" header="Status" body={renderizarStatus} sortable />
              <Column header="" body={renderizarAcoes} className={styles.actionColumn} />
            </DataTable>

            <div className={styles.mobileList}>
              {usuariosFiltrados.map((usuarioLinha) => (
                <article
                  className={`${styles.mobileUser} ${usuarioLinha.ativo ? "" : styles.mobileUserInactive}`}
                  key={usuarioLinha.id}
                >
                  <div className={styles.mobileUserHeader}>
                    {renderizarNome(usuarioLinha)}
                    {renderizarStatus(usuarioLinha)}
                  </div>
                  <div className={styles.mobileUserBody}>
                    <span><i className="pi pi-envelope" />{usuarioLinha.email}</span>
                    {renderizarPerfil(usuarioLinha)}
                  </div>
                  <Button
                    label="Editar acesso"
                    icon="pi pi-pencil"
                    outlined
                    onClick={() => abrirModalEditar(usuarioLinha)}
                  />
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog
        visible={modalNovo}
        header="Novo usuário"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalNovo}
      >
        <form className={styles.form} onSubmit={enviarFormularioNovo}>
          <div className={styles.field}>
            <label htmlFor="usuario-nome">Nome do usuário</label>
            <InputText
              id="usuario-nome"
              className={errosNovoUsuario.nome ? "p-invalid" : ""}
              value={formulario.nome}
              placeholder="Ex.: Ana Souza"
              onChange={(evento) => atualizarCampoNovoUsuario("nome", evento.target.value)}
            />
            {errosNovoUsuario.nome ? <small className={styles.fieldError}>{errosNovoUsuario.nome}</small> : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-email">Email</label>
            <InputText
              id="usuario-email"
              className={errosNovoUsuario.email ? "p-invalid" : ""}
              type="email"
              value={formulario.email}
              placeholder="nome@empresa.com"
              onChange={(evento) => atualizarCampoNovoUsuario("email", evento.target.value)}
            />
            {errosNovoUsuario.email ? <small className={styles.fieldError}>{errosNovoUsuario.email}</small> : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-senha">Senha</label>
            <Password
              inputId="usuario-senha"
              inputClassName={errosNovoUsuario.senha ? "p-invalid" : ""}
              value={formulario.senha}
              placeholder="Mínimo de 6 caracteres"
              onChange={(evento) => atualizarCampoNovoUsuario("senha", evento.target.value)}
              feedback={false}
              toggleMask
            />
            {errosNovoUsuario.senha ? <small className={styles.fieldError}>{errosNovoUsuario.senha}</small> : null}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="usuario-perfil">Perfil</label>
              <Dropdown
                id="usuario-perfil"
                value={formulario.perfil}
                options={opcoesPerfil}
                onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, perfil: evento.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="usuario-status">Status</label>
              <Dropdown
                id="usuario-status"
                value={formulario.ativo}
                options={opcoesStatus}
                onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, ativo: evento.value }))}
              />
            </div>
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharModalNovo} />
            <Button label="Salvar usuário" type="submit" loading={salvando} />
          </div>
        </form>
      </Dialog>

      <Dialog
        visible={modalEditar}
        header="Editar usuário"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalEditar}
      >
        <form className={styles.form} onSubmit={enviarFormularioEditar}>
          <div className={styles.field}>
            <label>Nome</label>
            <InputText value={formulario.nome} disabled />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <InputText value={formulario.email} disabled />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="usuario-editar-perfil">Perfil</label>
              <Dropdown
                id="usuario-editar-perfil"
                value={formulario.perfil}
                options={opcoesPerfil}
                onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, perfil: evento.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="usuario-editar-status">Status</label>
              <Dropdown
                id="usuario-editar-status"
                value={formulario.ativo}
                options={opcoesStatus}
                onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, ativo: evento.value }))}
              />
            </div>
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharModalEditar} />
            <Button label="Salvar Alterações" type="submit" loading={salvando} />
          </div>
        </form>
      </Dialog>
    </section>
  );
}
