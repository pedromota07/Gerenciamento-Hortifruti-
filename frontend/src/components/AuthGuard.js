"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { usarAutenticacao } from "@/context/AuthContext";

export function ProtecaoAutenticacao({ children }) {
  const { usuarioAutenticado, autenticacaoPronta } = usarAutenticacao();
  const roteador = useRouter();

  useEffect(() => {
    if (autenticacaoPronta && !usuarioAutenticado) {
      roteador.replace("/login");
    }
  }, [autenticacaoPronta, usuarioAutenticado, roteador]);

  if (!autenticacaoPronta || !usuarioAutenticado) {
    return null;
  }

  return <>{children}</>;
}
