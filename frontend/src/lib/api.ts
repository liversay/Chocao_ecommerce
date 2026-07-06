import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use(async (config) => {
  // Token is injected by useApiToken hook or per-call
  return config;
});

export default api;
