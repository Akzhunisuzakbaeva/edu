import axios, { InternalAxiosRequestConfig } from "axios";

const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "/api";

const api = axios.create({
  baseURL, // local: /api (vite proxy), prod: VITE_API_URL
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access");
  if (token) {
    // Axios v1 headers типі "weird", сондықтан қауіпсіз жол:
    config.headers = config.headers ?? ({} as any);
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { api };
