import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use(async (config) => {
  // Token is injected by useApiToken hook or per-call
  // Correlación frontend ↔ backend: el backend devuelve/loguea este mismo id.
  config.headers["X-Request-Id"] = crypto.randomUUID();
  return config;
});

// Normaliza los errores del backend: siempre habrá un mensaje legible en
// error.message (el backend responde { error } — ver backend/src/lib/errors.ts).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error?.response?.data?.error;
    if (typeof serverMessage === "string" && serverMessage) {
      error.message = serverMessage;
    } else if (!error?.response) {
      error.message = "No se pudo contactar al servidor. Verifica tu conexión.";
    }
    return Promise.reject(error);
  }
);

export default api;
