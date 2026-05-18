import { requisitarApi } from "./api";

export function solicitarLogin(email, senha) {
  return requisitarApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha })
  });
}
