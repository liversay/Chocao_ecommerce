import { useAuth } from "@clerk/react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useApi() {
  const { getToken } = useAuth();

  const authAxios = axios.create({ baseURL: BASE_URL });

  authAxios.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return authAxios;
}
