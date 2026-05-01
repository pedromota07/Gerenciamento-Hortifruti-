import { apiFetch } from "./api";

export function getUsuarios() {
  return apiFetch("/usuarios");
}

export function criarUsuario(payload) {
  return apiFetch("/usuarios", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function atualizarUsuario(id, payload) {
  return apiFetch(`/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
