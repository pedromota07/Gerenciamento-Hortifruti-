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

import { useAuth } from "@/context/AuthContext";
import { atualizarUsuario, criarUsuario, getUsuarios } from "@/services/usuariosService";

import styles from "./page.module.css";

const perfilOptions = [
  { label: "Gerente", value: "gerente" },
  { label: "Funcionario", value: "funcionario" }
];

const statusOptions = [
  { label: "Ativo", value: true },
  { label: "Inativo", value: false }
];

const initialForm = {
  nome: "",
  email: "",
  senha: "",
  perfil: "funcionario",
  ativo: true
};

function validarNovoUsuario(form) {
  if (!form.nome.trim()) {
    return "Informe o nome do usuario.";
  }

  if (!form.email.trim()) {
    return "Informe o email do usuario.";
  }

  if (!form.senha || form.senha.length < 6) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  return null;
}

export default function UsuariosPage() {
  const router = useRouter();
  const { isReady, usuario } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && usuario?.perfil !== "gerente") {
      router.replace("/dashboard");
    }
  }, [isReady, router, usuario]);

  useEffect(() => {
    if (!isReady || usuario?.perfil !== "gerente") {
      return;
    }

    carregarUsuarios();
  }, [isReady, usuario]);

  async function carregarUsuarios(options = {}) {
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const data = await getUsuarios();
      setUsuarios(data);
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  function fecharModalNovo() {
    setModalNovo(false);
    setForm(initialForm);
  }

  function abrirModalEditar(item) {
    setUsuarioSelecionado(item);
    setForm({
      nome: item.nome,
      email: item.email,
      senha: "",
      perfil: item.perfil,
      ativo: item.ativo
    });
    setModalEditar(true);
  }

  function fecharModalEditar() {
    setModalEditar(false);
    setUsuarioSelecionado(null);
    setForm(initialForm);
  }

  async function handleSubmitNovo(event) {
    event.preventDefault();
    const validationMessage = validarNovoUsuario(form);

    if (validationMessage) {
      setFeedback({ severity: "error", text: validationMessage });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await criarUsuario({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
        perfil: form.perfil,
        ativo: form.ativo
      });
      fecharModalNovo();
      await carregarUsuarios({ silent: true });
      setFeedback({ severity: "success", text: "Usuario criado com sucesso." });
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEditar(event) {
    event.preventDefault();

    if (!usuarioSelecionado) {
      setFeedback({ severity: "error", text: "Selecione um usuario para editar." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await atualizarUsuario(usuarioSelecionado.id, {
        perfil: form.perfil,
        ativo: form.ativo
      });
      fecharModalEditar();
      await carregarUsuarios({ silent: true });
      setFeedback({ severity: "success", text: "Usuario atualizado com sucesso." });
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  function statusBodyTemplate(row) {
    return (
      <Tag severity={row.ativo ? "success" : "danger"} value={row.ativo ? "Ativo" : "Inativo"} />
    );
  }

  function perfilBodyTemplate(row) {
    return row.perfil === "gerente" ? "Gerente" : "Funcionario";
  }

  function acoesBodyTemplate(row) {
    return (
      <Button
        label="Editar"
        icon="pi pi-pencil"
        size="small"
        text
        onClick={() => abrirModalEditar(row)}
      />
    );
  }

  if (!isReady || usuario?.perfil !== "gerente") {
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
        {feedback ? (
          <div className={styles.feedback}>
            <Message severity={feedback.severity} text={feedback.text} />
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
          loading={loading}
          emptyMessage="Nenhum usuario encontrado."
          responsiveLayout="scroll"
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="email" header="Email" sortable />
          <Column field="perfil" header="Perfil" body={perfilBodyTemplate} sortable />
          <Column field="ativo" header="Status" body={statusBodyTemplate} sortable />
          <Column header="Acoes" body={acoesBodyTemplate} />
        </DataTable>
      </div>

      <Dialog
        visible={modalNovo}
        header="Novo Usuario"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalNovo}
      >
        <form className={styles.form} onSubmit={handleSubmitNovo}>
          <div className={styles.field}>
            <label htmlFor="usuario-nome">Nome</label>
            <InputText
              id="usuario-nome"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-email">Email</label>
            <InputText
              id="usuario-email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="usuario-senha">Senha</label>
            <Password
              inputId="usuario-senha"
              value={form.senha}
              onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))}
              feedback={false}
              toggleMask
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="usuario-perfil">Perfil</label>
              <Dropdown
                id="usuario-perfil"
                value={form.perfil}
                options={perfilOptions}
                onChange={(event) => setForm((current) => ({ ...current, perfil: event.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="usuario-status">Status</label>
              <Dropdown
                id="usuario-status"
                value={form.ativo}
                options={statusOptions}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.value }))}
              />
            </div>
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharModalNovo} />
            <Button label="Salvar Usuario" type="submit" loading={submitting} />
          </div>
        </form>
      </Dialog>

      <Dialog
        visible={modalEditar}
        header="Editar Usuario"
        style={{ width: "min(92vw, 640px)" }}
        onHide={fecharModalEditar}
      >
        <form className={styles.form} onSubmit={handleSubmitEditar}>
          <div className={styles.field}>
            <label>Nome</label>
            <InputText value={form.nome} disabled />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <InputText value={form.email} disabled />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="usuario-editar-perfil">Perfil</label>
              <Dropdown
                id="usuario-editar-perfil"
                value={form.perfil}
                options={perfilOptions}
                onChange={(event) => setForm((current) => ({ ...current, perfil: event.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="usuario-editar-status">Status</label>
              <Dropdown
                id="usuario-editar-status"
                value={form.ativo}
                options={statusOptions}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.value }))}
              />
            </div>
          </div>

          <div className={styles.dialogFooter}>
            <Button label="Cancelar" type="button" text onClick={fecharModalEditar} />
            <Button label="Salvar Alteracoes" type="submit" loading={submitting} />
          </div>
        </form>
      </Dialog>
    </section>
  );
}
