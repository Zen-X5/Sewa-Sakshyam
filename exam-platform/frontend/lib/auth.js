const AUTH_KEY = "exam_platform_auth";

export const saveAuth = (payload) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
};

export const getAuth = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_KEY);
};
