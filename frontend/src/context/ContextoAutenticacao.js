"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { solicitarLogin } from "@/services/servicoAutenticacao";

const ContextoAutenticacao = createContext(null);

function buscarJsonArmazenado(chave) {
  if (typeof window === "undefined") {
    return null;
  }

  const valor = localStorage.getItem(chave);
  if (!valor) {
    return null;
  }

  try {
    return JSON.parse(valor);
  } catch {
    localStorage.removeItem(chave);
    return null;
  }
}

function buscarValorArmazenado(chave) {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(chave);
}

export function ProvedorAutenticacao({ children }) {
  const [usuario, setUsuario] = useState(() => buscarJsonArmazenado("usuario"));
  const [token, setToken] = useState(() => buscarValorArmazenado("token"));
  const [autenticacaoPronta, setAutenticacaoPronta] = useState(false);

  useEffect(() => {
    setUsuario(buscarJsonArmazenado("usuario"));
    setToken(buscarValorArmazenado("token"));
    setAutenticacaoPronta(true);
  }, []);

  async function entrar(email, senha) {
    const dados = await solicitarLogin(email, senha);

    localStorage.setItem("token", dados.token);
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));

    setToken(dados.token);
    setUsuario(dados.usuario);

    return dados;
  }

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
  }

  const valorContexto = useMemo(
    () => ({
      usuario,
      token,
      autenticacaoPronta,
      usuarioAutenticado: Boolean(token),
      entrar,
      sair
    }),
    [autenticacaoPronta, usuario, token]
  );

  return <ContextoAutenticacao.Provider value={valorContexto}>{children}</ContextoAutenticacao.Provider>;
}

export function usarAutenticacao() {
  const contexto = useContext(ContextoAutenticacao);

  if (!contexto) {
    throw new Error("usarAutenticacao deve ser usado dentro de ProvedorAutenticacao");
  }

  return contexto;
}
