"use client";

import { useCallback } from "react";

export function useApi() {
  const getHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("zoraxyhub_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const request = useCallback(
    async <T = unknown>(
      method: string,
      path: string,
      body?: unknown
    ): Promise<T> => {
      const res = await fetch(path, {
        method,
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        localStorage.removeItem("zoraxyhub_token");
        localStorage.removeItem("zoraxyhub_username");
        window.location.href = "/login";
        throw new Error("Session expired");
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      return data.data as T;
    },
    [getHeaders]
  );

  const get = useCallback(
    <T = unknown>(path: string) => request<T>("GET", path),
    [request]
  );

  const post = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      request<T>("POST", path, body),
    [request]
  );

  const put = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      request<T>("PUT", path, body),
    [request]
  );

  const del = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      request<T>("DELETE", path, body),
    [request]
  );

  const patch = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      request<T>("PATCH", path, body),
    [request]
  );

  return { get, post, put, del, patch, request };
}
