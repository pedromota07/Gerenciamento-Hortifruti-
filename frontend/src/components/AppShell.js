"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import BarraLateral from "@/components/BarraLateral";
import { usarAutenticacao } from "@/context/ContextoAutenticacao";

const titulosPorRota = {
  "/dashboard": ["Visão geral", "Acompanhe a operação e os pontos que precisam de atenção."],
  "/estoque": ["Estoque", "Produtos, saldos, lotes e movimentações."],
  "/pdv": ["Ponto de venda", "Registre vendas com rapidez e segurança."],
  "/relatorios": ["Relatórios", "Resultado financeiro, validade e movimentações."],
  "/usuarios": ["Usuários", "Acessos e permissões da equipe."]
};

function obterContextoRota(caminho) {
  if (caminho.startsWith("/produtos/")) {
    return ["Detalhe do produto", "Saldo, lotes e histórico do item."];
  }

  return titulosPorRota[caminho] ?? ["Hortifruti", "Gestão simples para uma operação saudável."];
}

export default function AppShell({ children }) {
  const caminho = usePathname();
  const { usuario } = usarAutenticacao();
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuCompacto, setMenuCompacto] = useState(false);
  const [titulo, descricao] = obterContextoRota(caminho);

  useEffect(() => {
    setMenuCompacto(localStorage.getItem("menu-compacto") === "true");
  }, []);

  function alternarMenuCompacto() {
    setMenuCompacto((valorAtual) => {
      const proximoValor = !valorAtual;
      localStorage.setItem("menu-compacto", String(proximoValor));
      return proximoValor;
    });
  }

  return (
    <div className={`app-shell${menuCompacto ? " is-compact" : ""}`}>
      <BarraLateral
        aberto={menuAberto}
        compacto={menuCompacto}
        aoFechar={() => setMenuAberto(false)}
        aoAlternarCompacto={alternarMenuCompacto}
      />

      {menuAberto ? (
        <button
          className="app-sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="app-header">
          <button
            className="app-menu-trigger"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
          >
            <i className="pi pi-bars" />
          </button>

          <div className="app-header-copy">
            <strong>{titulo}</strong>
            <span>{descricao}</span>
          </div>

          <div className="app-user">
            <span className="app-user-avatar">{usuario?.nome?.charAt(0).toUpperCase() ?? "H"}</span>
            <span className="app-user-copy">
              <strong>{usuario?.nome ?? "Usuário"}</strong>
              <small>{usuario?.perfil ?? "Sistema"}</small>
            </span>
          </div>
        </header>

        <main className="app-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}
