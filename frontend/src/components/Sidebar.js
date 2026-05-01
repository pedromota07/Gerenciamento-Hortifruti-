"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";

import { usarAutenticacao } from "@/context/AuthContext";

const itensNavegacao = [
  { label: "Dashboard", href: "/dashboard", icon: "pi pi-home" },
  { label: "Estoque", href: "/estoque", icon: "pi pi-box" },
  { label: "PDV", href: "/pdv", icon: "pi pi-shopping-cart" },
  { label: "Relatorios", href: "/relatorios", icon: "pi pi-chart-bar" },
  { label: "Usuarios", href: "/usuarios", icon: "pi pi-users" }
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
    : itensNavegacao.filter((itemNavegacao) => itemNavegacao.href !== "/usuarios");

  const modeloMenu = itensVisiveis.map((itemNavegacao) => ({
    label: itemNavegacao.label,
    template: () => (
      <Link
        className={`sidebar-link${itemEstaAtivo(caminhoAtual, itemNavegacao.href) ? " is-active" : ""}`}
        href={itemNavegacao.href}
      >
        <i className={itemNavegacao.icon} />
        <span>{itemNavegacao.label}</span>
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
