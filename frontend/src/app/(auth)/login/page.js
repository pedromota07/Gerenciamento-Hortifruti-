"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";

import { usarAutenticacao } from "@/context/ContextoAutenticacao";

import styles from "./page.module.css";

export default function PaginaLogin() {
  const roteador = useRouter();
  const { usuarioAutenticado, autenticacaoPronta, entrar } = usarAutenticacao();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    if (autenticacaoPronta && usuarioAutenticado) {
      roteador.replace("/dashboard");
    }
  }, [autenticacaoPronta, roteador, usuarioAutenticado]);

  async function enviarFormulario(evento) {
    evento.preventDefault();

    if (!email.trim() || !senha) {
      setMensagem({ severity: "error", text: "Informe email e senha." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMensagem({ severity: "error", text: "Informe um email válido." });
      return;
    }

    setCarregando(true);
    setMensagem(null);

    try {
      await entrar(email.trim().toLowerCase(), senha);
    } catch (erro) {
      setMensagem({ severity: "error", text: erro.message });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <div className={styles.brand}>
            <span className={styles.brandMark}><i className="pi pi-sparkles" /></span>
            <div>
              <strong>Hortifruti</strong>
              <span>Gestão de hortifruti</span>
            </div>
          </div>

          <div className={styles.brandContent}>
            <span className={styles.eyebrow}>Do estoque ao resultado</span>
            <h2>Seu hortifruti organizado, fresco e rentável.</h2>
            <p>Controle produtos, validade, vendas e equipe com clareza para tomar decisões melhores todos os dias.</p>
          </div>

          <div className={styles.featureList}>
            <span><i className="pi pi-check" /> Estoque e validade sob controle</span>
            <span><i className="pi pi-check" /> Operação rápida no ponto de venda</span>
            <span><i className="pi pi-check" /> Indicadores para decisões seguras</span>
          </div>

          <div className={styles.produceArt} aria-hidden="true">
            <span className={styles.leafOne} />
            <span className={styles.leafTwo} />
            <span className={styles.fruitOne} />
            <span className={styles.fruitTwo} />
            <span className={styles.fruitThree} />
          </div>
        </aside>

        <main className={styles.loginPanel}>
          <form className={styles.form} onSubmit={enviarFormulario}>
            <div className={styles.mobileBrand}>
              <span className={styles.brandMark}><i className="pi pi-sparkles" /></span>
              <strong>Hortifruti</strong>
            </div>

            <div className={styles.header}>
              <span className={styles.eyebrow}>Bem-vindo de volta</span>
              <h1>Acesse sua conta</h1>
              <p>Entre com suas credenciais para continuar a operação.</p>
            </div>

            {mensagem ? <Message severity={mensagem.severity} text={mensagem.text} /> : null}

            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor="login-email">Email</label>
                <span className={styles.inputWrapper}>
                  <i className="pi pi-envelope" />
                  <InputText
                    id="login-email"
                    value={email}
                    onChange={(evento) => setEmail(evento.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    autoFocus
                  />
                </span>
              </div>

              <div className={styles.field}>
                <label htmlFor="login-senha">Senha</label>
                <span className={styles.passwordWrapper}>
                  <i className="pi pi-lock" />
                  <Password
                    inputId="login-senha"
                    value={senha}
                    onChange={(evento) => setSenha(evento.target.value)}
                    placeholder="Digite sua senha"
                    feedback={false}
                    toggleMask
                    autoComplete="current-password"
                  />
                </span>
              </div>
            </div>

            <Button label="Entrar no sistema" icon="pi pi-arrow-right" iconPos="right" type="submit" loading={carregando} />

            <p className={styles.support}>Problemas para acessar? Procure o gerente responsável.</p>
          </form>
        </main>
      </div>
    </section>
  );
}
