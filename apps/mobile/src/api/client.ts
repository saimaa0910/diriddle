import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth-store';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/v1';

export const SOCKET_BASE_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const DEMO_FALLBACK_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_DEMO_FALLBACK !== 'false';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 7000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/verify-otp') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken || isDemoSession()) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const newAccessToken = refreshResponse.data?.access_token;
        const newRefreshToken = refreshResponse.data?.refresh_token ?? refreshToken;
        const userId = useAuthStore.getState().userId ?? 'current-user';

        if (newAccessToken) {
          await useAuthStore.getState().setSession({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            userId,
          });

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await useAuthStore.getState().clearSession();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function isDemoSession(): boolean {
  const token = useAuthStore.getState().accessToken;
  return Boolean(token && token.startsWith('demo-'));
}

export function shouldUseDemoFallback(error: unknown): boolean {
  if (!DEMO_FALLBACK_ENABLED) return false;
  if (isDemoSession()) return true;
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError;
    if (!axiosErr.response) return true; // Network error / API offline on Windows
    if (axiosErr.response.status >= 500) return true;
  }
  return false;
}

