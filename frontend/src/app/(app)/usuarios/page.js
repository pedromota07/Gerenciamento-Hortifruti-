"use client";

import { useEffect, useRef, useState } from "react";
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
    return (
      <Tag severity={usuarioLinha.ativo ? "success" : "danger"} value={usuarioLinha.ativo ? "Ativo" : "Inativo"} />
    );
  }

  function renderizarPerfil(usuarioLinha) {
    return usuarioLinha.perfil === "gerente" ? "Gerente" : "Funcionário";
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

  if (!autenticacaoPronta || usuario?.perfil !== "gerente") {
    return null;
  }

  function atualizarCampoNovoUsuario(campo, valor) {
    setFormulario((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
    setErrosNovoUsuario((errosAtuais) => ({ ...errosAtuais, [campo]: null }));
  }

  return (
    <section className={styles.page}>
      <Toast ref={notificacaoRef} />
      <ConfirmDialog />

      <header className={styles.header}>
        <div>
          <h1>Usuários</h1>
        </div>

        <Button label="Novo Usuário" icon="pi pi-plus" onClick={() => setModalNovo(true)} />
      </header>

      <div className={styles.panel}>
        {mensagem ? (
          <div className={styles.feedback}>
            <Message severity={mensagem.severity} text={mensagem.text} />
          </div>
        ) : null}

        <div className={styles.panelHeader}>
          <div>
            <h2>Usuários cadastrados</h2>
          </div>
        </div>

        {usuarios.length === 0 && !carregando ? (
          <EstadoVazio
            icone="pi pi-users"
            titulo="Nenhum usuário cadastrado ainda."
            descricao="Cadastre o primeiro usuário para organizar quem faz cada operação."
          />
        ) : (
          <DataTable value={usuarios} dataKey="id" loading={carregando} responsiveLayout="scroll">
            <Column field="nome" header="Nome" sortable />
            <Column field="email" header="Email" sortable />
            <Column field="perfil" header="Perfil" body={renderizarPerfil} sortable />
            <Column field="ativo" header="Status" body={renderizarStatus} sortable />
            <Column header="Ações" body={renderizarAcoes} />
          </DataTable>
        )}
      </div>

      <Dialog
        visible={modalNovo}
        header="Novo Usuário"
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
            <Button label="Salvar Usuário" type="submit" loading={salvando} />
          </div>
        </form>
      </Dialog>

      <Dialog
        visible={modalEditar}
        header="Editar Usuário"
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
