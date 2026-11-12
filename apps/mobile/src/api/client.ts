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
