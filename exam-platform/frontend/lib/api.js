import { getAuth } from "./auth";

const normalizeApiBase = (value) => String(value || "").replace(/\/$/, "");
const productionApiBase = "https://sewa-sakshyam.onrender.com/api";

export const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    if (process.env.NODE_ENV === "production" && !isLocalHost) {
      return productionApiBase;
    }

    return `${protocol}//${hostname}:5000/api`;
  }

  return process.env.NODE_ENV === "production" ? productionApiBase : "http://localhost:5000/api";
};

export const resolveApiOrigin = () => resolveApiBaseUrl().replace(/\/api\/?$/, "");

export const apiRequest = async (path, { method = "GET", body, token, skipAuth = false } = {}) => {
  const apiBase = resolveApiBaseUrl();
  const auth = getAuth();
  const bearerToken = token || auth?.token;

  const headers = {
    "Content-Type": "application/json",
  };

  if (!skipAuth && bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
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
