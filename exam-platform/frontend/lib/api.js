import { getAuth } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export const apiRequest = async (path, { method = "GET", body, token, skipAuth = false } = {}) => {
  const auth = getAuth();
  const bearerToken = token || auth?.token;

  const headers = {
    "Content-Type": "application/json",
  };

  if (!skipAuth && bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};
