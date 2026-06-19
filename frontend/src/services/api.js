const URL_API_PADRAO = "http://127.0.0.1:5000/api";

function resolverUrlBaseApi() {
  const urlApi = process.env.NEXT_PUBLIC_API_URL;
  if (urlApi) {
    return urlApi.replace(/\/$/, "");
  }

  const urlBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (urlBase) {
    const urlBaseNormalizada = urlBase.replace(/\/$/, "");
    return urlBaseNormalizada.endsWith("/api") ? urlBaseNormalizada : `${urlBaseNormalizada}/api`;
  }

  return URL_API_PADRAO;
}

function extrairMensagemErro(dados) {
  if (!dados) {
    return "Erro na requisicao.";
  }

  if (typeof dados === "string") {
    return dados;
  }

  if (dados.error) {
    if (typeof dados.error === "string") {
      return dados.error;
    }

    if (typeof dados.error === "object") {
      return Object.entries(dados.error)
        .map(([campo, valor]) => `${campo}: ${Array.isArray(valor) ? valor.join(", ") : valor}`)
        .join(" | ");
    }
  }

  if (dados.message) {
    return dados.message;
  }

  return "Erro na requisicao.";
}

export async function requisitarApi(url, opcoes = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const temCorpo = opcoes.body !== undefined;

  const resposta = await fetch(`${resolverUrlBaseApi()}${url}`, {
    ...opcoes,
    headers: {
      ...(temCorpo ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers ?? {})
    },
    cache: "no-store"
  });

  const respostaJson = resposta.headers.get("content-type")?.includes("application/json");
  const dados = respostaJson ? await resposta.json() : null;

  if (!resposta.ok) {
    throw new Error(extrairMensagemErro(dados));
  }

  return dados;
}
