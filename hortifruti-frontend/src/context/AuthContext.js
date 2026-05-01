"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { loginRequest } from "@/services/authService";

const AuthContext = createContext(null);

function getStoredJson(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : null;
}

function getStoredValue(key) {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(key);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => getStoredJson("usuario"));
  const [token, setToken] = useState(() => getStoredValue("token"));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUsuario(getStoredJson("usuario"));
    setToken(getStoredValue("token"));
    setIsReady(true);
  }, []);

  async function login(email, senha) {
    const data = await loginRequest(email, senha);

    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));

    setToken(data.token);
    setUsuario(data.usuario);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
  }

  const value = useMemo(
    () => ({
      usuario,
      token,
      isReady,
      isAuthenticated: Boolean(token),
      login,
      logout
    }),
    [isReady, usuario, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
