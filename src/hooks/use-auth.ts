"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { token: null, username: null, isAuthenticated: false, isLoading: true };
    }
    const token = localStorage.getItem("zoraxyhub_token");
    const username = localStorage.getItem("zoraxyhub_username");
    if (token) {
      return { token, username, isAuthenticated: true, isLoading: false };
    }
    return { token: null, username: null, isAuthenticated: false, isLoading: false };
  });

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Login failed");

      localStorage.setItem("zoraxyhub_token", data.data.token);
      localStorage.setItem("zoraxyhub_username", data.data.username);
      setState({
        token: data.data.token,
        username: data.data.username,
        isAuthenticated: true,
        isLoading: false,
      });
      router.push("/");
    },
    [router]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("zoraxyhub_token");
    localStorage.removeItem("zoraxyhub_username");
    setState({
      token: null,
      username: null,
      isAuthenticated: false,
      isLoading: false,
    });
    router.push("/login");
  }, [router]);

  return { ...state, login, logout };
}
