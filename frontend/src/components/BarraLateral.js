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

export default function BarraLateral({ aberto, compacto, aoFechar, aoAlternarCompacto }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const { sair, usuario } = usarAutenticacao();
  const itensVisiveis = usuario?.perfil === "gerente"
    ? itensNavegacao
    : itensNavegacao.filter((itemNavegacao) => itemNavegacao.destino !== "/usuarios");

  const modeloMenu = itensVisiveis.map((itemNavegacao) => {
    const ativo = itemEstaAtivo(caminhoAtual, itemNavegacao.destino);

    return {
      label: itemNavegacao.rotulo,
      template: () => (
      <Link
        className={`sidebar-link${ativo ? " is-active" : ""}`}
        href={itemNavegacao.destino}
        title={compacto ? itemNavegacao.rotulo : undefined}
        aria-current={ativo ? "page" : undefined}
        onClick={aoFechar}
      >
        <i className={itemNavegacao.icone} />
        <span>{itemNavegacao.rotulo}</span>
      </Link>
      )
    };
  });

  return (
    <aside className={`app-sidebar${aberto ? " is-open" : ""}`}>
      <div className="app-brand">
        <span className="app-brand-mark">
          <i className="pi pi-sparkles" />
        </span>
        <div className="app-brand-copy">
          <strong>HortiGestão</strong>
          <p>Estoque & vendas</p>
        </div>
      </div>

      <span className="sidebar-section-label">Operação</span>
      <Menu className="sidebar-menu" model={modeloMenu} />

      <div className="sidebar-footer">
        <button
          className="sidebar-collapse"
          type="button"
          title={compacto ? "Expandir menu" : "Recolher menu"}
          onClick={aoAlternarCompacto}
        >
          <i className={`pi ${compacto ? "pi-angle-right" : "pi-angle-left"}`} />
          <span>Recolher menu</span>
        </button>

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
      </div>
    </aside>
  );
}
