"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";

import { usarAutenticacao } from "@/context/AuthContext";

import styles from "./page.module.css";

export default function PaginaLogin() {
  const roteador = useRouter();
  const { usuarioAutenticado, entrar } = usarAutenticacao();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    if (usuarioAutenticado) {
      roteador.replace("/dashboard");
    }
  }, [roteador, usuarioAutenticado]);

  async function enviarFormulario(evento) {
    evento.preventDefault();

    if (!email.trim() || !senha) {
      setMensagem({ severity: "error", text: "Informe email e senha." });
      return;
    }

    setCarregando(true);
    setMensagem(null);

    try {
      await entrar(email.trim().toLowerCase(), senha);
      roteador.replace("/dashboard");
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className={styles.page}>
      <form className={styles.form} onSubmit={enviarFormulario}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Hortifruti</span>
          <h1>Login</h1>
          <p>Acesse o sistema com o usuario administrativo sem usar middleware.</p>
        </div>

        {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

        <div className={styles.field}>
          <label htmlFor="login-email">Email</label>
          <InputText
            id="login-email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="username"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-senha">Senha</label>
          <Password
            inputId="login-senha"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            feedback={false}
            toggleMask
            autoComplete="current-password"
          />
        </div>

        <Button label="Entrar" type="submit" loading={carregando} />
      </form>
    </section>
  );
}
