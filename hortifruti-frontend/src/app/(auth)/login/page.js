"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";

import { useAuth } from "@/context/AuthContext";

import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !senha) {
      setFeedback({ severity: "error", text: "Informe email e senha." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      await login(email.trim().toLowerCase(), senha);
      router.replace("/dashboard");
    } catch (error) {
      setFeedback({ severity: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Hortifruti</span>
          <h1>Login</h1>
          <p>Acesse o sistema com o usuario administrativo sem usar middleware.</p>
        </div>

        {feedback ? <Message severity={feedback.severity} text={feedback.text} /> : null}

        <div className={styles.field}>
          <label htmlFor="login-email">Email</label>
          <InputText
            id="login-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-senha">Senha</label>
          <Password
            inputId="login-senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            feedback={false}
            toggleMask
            autoComplete="current-password"
          />
        </div>

        <Button label="Entrar" type="submit" loading={loading} />
      </form>
    </section>
  );
}
