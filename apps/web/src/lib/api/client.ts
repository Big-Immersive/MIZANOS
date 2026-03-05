import axios, { type AxiosError, type AxiosInstance } from "axios";
import { ApiError, type ApiErrorResponse } from "./errors";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4006";

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") ?? localStorage.getItem("mizan_auth_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("mizan_auth_token");
  if (typeof document !== "undefined") {
    document.cookie = "access_token=; path=/; max-age=0";
  }
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await axios.post<{ access_token: string; refresh_token: string }>(
    `${API_BASE_URL}/auth/refresh`,
    { refresh_token: refreshToken },
  );

  const { access_token, refresh_token } = response.data;
  setTokens(access_token, refresh_token);
  return access_token;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    if (error.response?.status === 401 && !("_retry" in originalRequest)) {
      Object.assign(originalRequest, { _retry: true });

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const apiError = ApiError.fromAxiosError(error as AxiosError<ApiErrorResponse>);
    return Promise.reject(apiError);
  },
);

export { API_BASE_URL, setTokens };
