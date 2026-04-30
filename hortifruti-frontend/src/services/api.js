const DEFAULT_API_URL = "http://127.0.0.1:5000/api";

function resolveApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl) {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    return normalizedBaseUrl.endsWith("/api") ? normalizedBaseUrl : `${normalizedBaseUrl}/api`;
  }

  return DEFAULT_API_URL;
}

function extractErrorMessage(data) {
  if (!data) {
    return "Erro na requisicao.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.error) {
    if (typeof data.error === "string") {
      return data.error;
    }

    if (typeof data.error === "object") {
      return Object.entries(data.error)
        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`)
        .join(" | ");
    }
  }

  if (data.message) {
    return data.message;
  }

  return "Erro na requisicao.";
}

export async function apiFetch(url, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const hasBody = options.body !== undefined;

  const response = await fetch(`${resolveApiBaseUrl()}${url}`, {
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    },
    cache: "no-store"
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data;
}
