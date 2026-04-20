// APRÈS
// All API calls use relative URLs through Next.js route handlers
// (architecture migrée — plus de rewrites /school-api/*)

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

import { env } from "./env";

const api: AxiosInstance = axios.create({
  baseURL: "",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (env.NODE_ENV === "development") {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const url = error.config?.url || "";
      // Don't redirect on 401 for login/auth endpoints
      if (status === 401 && typeof window !== "undefined" && !url.includes("/users/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
