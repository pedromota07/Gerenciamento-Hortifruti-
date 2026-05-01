"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";
import { Tag } from "primereact/tag";

import { usarAutenticacao } from "@/context/AuthContext";
import { atualizarUsuario, buscarUsuarios, criarUsuario } from "@/services/usuariosService";

import styles from "./page.module.css";

const opcoesPerfil = [
  { label: "Gerente", value: "gerente" },
  { label: "Funcionario", value: "funcionario" }
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

function validarNovoUsuario(formulario) {
  if (!formulario.nome.trim()) {
    return "Informe o nome do usuario.";
  }

  if (!formulario.email.trim()) {
    return "Informe o email do usuario.";
  }

  if (!formulario.senha || formulario.senha.length < 6) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  return null;
}

export default function PaginaUsuarios() {
  const roteador = useRouter();
  const { autenticacaoPronta, usuario } = usarAutenticacao();

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [formulario, setFormulario] = useState(formularioInicial);
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
    } finally {
      if (!opcoes.silencioso) {
        setCarregando(false);
      }
    }
  }

  function fecharModalNovo() {
    setModalNovo(false);
    setFormulario(formularioInicial);
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
    const mensagemValidacao = validarNovoUsuario(formulario);

    if (mensagemValidacao) {
      setMensagem({ severity: "error", text: mensagemValidacao });
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
      setMensagem({ severity: "success", text: "Usuario criado com sucesso." });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvando(false);
    }
  }

  async function enviarFormularioEditar(evento) {
    evento.preventDefault();

    if (!usuarioSelecionado) {
      setMensagem({ severity: "error", text: "Selecione um usuario para editar." });
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      await atualizarUsuario(usuarioSelecionado.id, {
        perfil: formulario.perfil,
        ativo: formulario.ativo
      });
      fecharModalEditar();
      await carregarUsuarios({ silencioso: true });
      setMensagem({ severity: "success", text: "Usuario atualizado com sucesso." });
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setSalvando(false);
    }
  }

  function renderizarStatus(usuarioLinha) {
    return (
      <Tag severity={usuarioLinha.ativo ? "success" : "danger"} value={usuarioLinha.ativo ? "Ativo" : "Inativo"} />
    );
  }

  function renderizarPerfil(usuarioLinha) {
    return usuarioLinha.perfil === "gerente" ? "Gerente" : "Funcionario";
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

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Usuarios</h1>
          <p>Gerencie acessos basicos do sistema com perfis de gerente e funcionario.</p>
        </div>

        <Button label="Novo Usuario" icon="pi pi-plus" onClick={() => setModalNovo(true)} />
      </header>

      <div className={styles.panel}>
        {mensagem ? (
          <div className={styles.feedback}>
            <Message severity={mensagem.severity} text={mensagem.text} />
          </div>
        ) : null}

        <div className={styles.panelHeader}>
          <div>
            <h2>Usuarios cadastrados</h2>
            <p>Somente gerente visualiza e administra esta tela.</p>
          </div>
        </div>

        <DataTable
          value={usuarios}
          dataKey="id"
          loading={carregando}
          emptyMessage="Nenhum usuario encontrado."
          responsiveLayout="scroll"
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="email" header="Email" sortable />
          <Column field="perfil" header="Perfil" body={renderizarPerfil} sortable />
          <Column field="ativo" header="Status" body={renderizarStatus} sortable />
          <Column header="Acoes" body={renderizarAcoes} />
        </DataTable>
      </div>

      <Dialog
        visible={modalNovo}
        header="Novo Usuario"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalNovo}
      >
        <form className={styles.form} onSubmit={enviarFormularioNovo}>
          <div className={styles.field}>
            <label htmlFor="usuario-nome">Nome</label>
            <InputText
              id="usuario-nome"
              value={formulario.nome}
              onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, nome: evento.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-email">Email</label>
            <InputText
              id="usuario-email"
              value={formulario.email}
              onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, email: evento.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-senha">Senha</label>
            <Password
              inputId="usuario-senha"
              value={formulario.senha}
              onChange={(evento) => setFormulario((formularioAtual) => ({ ...formularioAtual, senha: evento.target.value }))}
              feedback={false}
              toggleMask
            />
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
            <Button label="Salvar Usuario" type="submit" loading={salvando} />
          </div>
        </form>
      </Dialog>

      <Dialog
        visible={modalEditar}
        header="Editar Usuario"
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
            <Button label="Salvar Alteracoes" type="submit" loading={salvando} />
          </div>
        </form>
      </Dialog>
    </section>
  );
}
