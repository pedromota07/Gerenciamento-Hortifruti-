import { requisitarApi } from "./api";

export function buscarUsuarios() {
  return requisitarApi("/usuarios");
}

export function criarUsuario(dadosUsuario) {
  return requisitarApi("/usuarios", {
    method: "POST",
    body: JSON.stringify(dadosUsuario)
  });
}

export function atualizarUsuario(id, dadosUsuario) {
  return requisitarApi(`/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(dadosUsuario)
  });
}
