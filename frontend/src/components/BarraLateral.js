"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";

import { usarAutenticacao } from "@/context/ContextoAutenticacao";

const itensNavegacao = [
  { rotulo: "Painel", destino: "/dashboard", icone: "pi pi-home" },
  { rotulo: "Estoque", destino: "/estoque", icone: "pi pi-box" },
  { rotulo: "PDV", destino: "/pdv", icone: "pi pi-shopping-cart" },
  { rotulo: "Relatórios", destino: "/relatorios", icone: "pi pi-chart-bar" },
  { rotulo: "Usuários", destino: "/usuarios", icone: "pi pi-users" }
];

function itemEstaAtivo(caminhoAtual, destino) {
  if (destino === "/estoque" && caminhoAtual.startsWith("/produtos")) {
    return true;
  }

  return caminhoAtual === destino || caminhoAtual.startsWith(`${destino}/`);
}

export default function BarraLateral() {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const { sair, usuario } = usarAutenticacao();
  const itensVisiveis = usuario?.perfil === "gerente"
    ? itensNavegacao
    : itensNavegacao.filter((itemNavegacao) => itemNavegacao.destino !== "/usuarios");

  const modeloMenu = itensVisiveis.map((itemNavegacao) => ({
    label: itemNavegacao.rotulo,
    template: () => (
      <Link
        className={`sidebar-link${itemEstaAtivo(caminhoAtual, itemNavegacao.destino) ? " is-active" : ""}`}
        href={itemNavegacao.destino}
      >
        <i className={itemNavegacao.icone} />
        <span>{itemNavegacao.rotulo}</span>
      </Link>
    )
  }));

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark">HF</span>
        <div>
          <strong>Hortifruti</strong>
          <p>{usuario ? `${usuario.nome} - ${usuario.perfil}` : "Sistema"}</p>
        </div>
      </div>

      <Menu className="sidebar-menu" model={modeloMenu} />

      <Button
        className="sidebar-logout"
        label="Sair"
        icon="pi pi-sign-out"
        text
        onClick={() => {
          sair();
          roteador.replace("/login");
        }}
      />
    </aside>
  );
}
