"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";

import { useAuth } from "@/context/AuthContext";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: "pi pi-home" },
  { label: "Estoque", href: "/estoque", icon: "pi pi-box" },
  { label: "PDV", href: "/pdv", icon: "pi pi-shopping-cart" },
  { label: "Relatorios", href: "/relatorios", icon: "pi pi-chart-bar" },
  { label: "Usuarios", href: "/usuarios", icon: "pi pi-users" }
];

function isItemActive(pathname, href) {
  if (href === "/estoque" && pathname.startsWith("/produtos")) {
    return true;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, usuario } = useAuth();
  const visibleItems = usuario?.perfil === "gerente"
    ? navigationItems
    : navigationItems.filter((item) => item.href !== "/usuarios");

  const model = visibleItems.map((item) => ({
    label: item.label,
    template: () => (
      <Link
        className={`sidebar-link${isItemActive(pathname, item.href) ? " is-active" : ""}`}
        href={item.href}
      >
        <i className={item.icon} />
        <span>{item.label}</span>
      </Link>
    )
  }));

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark">HF</span>
        <div>
          <strong>Hortifruti</strong>
          <p>{usuario ? `${usuario.nome} · ${usuario.perfil}` : "Sistema"}</p>
        </div>
      </div>

      <Menu className="sidebar-menu" model={model} />

      <Button
        className="sidebar-logout"
        label="Sair"
        icon="pi pi-sign-out"
        text
        onClick={() => {
          logout();
          router.replace("/login");
        }}
      />
    </aside>
  );
}
