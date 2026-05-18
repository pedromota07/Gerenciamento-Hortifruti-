export function obterUsuarioIdAutenticado() {
  if (typeof window === "undefined") {
    return null;
  }

  const usuarioSalvo = localStorage.getItem("usuario");
  if (!usuarioSalvo) {
    return null;
  }

  try {
    return JSON.parse(usuarioSalvo)?.id ?? null;
  } catch {
    return null;
  }
}
