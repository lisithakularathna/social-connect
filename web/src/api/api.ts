import axios from "axios";

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    // Sign-in endpoints report bad credentials with 401 — those must surface
    // as form errors, not bounce the user to the login page.
    const isAuthCall = /^\/auth\/(login|register|google|2fa\/verify)(\/|\?|$)/.test(url);

    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem("accessToken");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Pull a human-readable message out of an axios/Nest error. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.trim()) return msg;
  if (!err?.response && err?.message === "Network Error") {
    return "Can't reach the server. Is the backend running?";
  }
  return fallback;
}

export default api;
