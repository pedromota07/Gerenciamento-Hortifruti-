import { apiFetch } from "./api";

export function loginRequest(email, senha) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha })
  });
}
