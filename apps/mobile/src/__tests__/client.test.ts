import axios from 'axios';
import { isDemoSession, shouldUseDemoFallback } from '../api/client';
import { useAuthStore } from '../store/auth-store';

describe('apiClient utilities', () => {
  beforeEach(async () => {
    await useAuthStore.getState().clearSession();
  });

  it('detects demo session when accessToken starts with demo-', async () => {
    expect(isDemoSession()).toBe(false);

    await useAuthStore.getState().setSession({
      accessToken: 'demo-token-xyz',
      refreshToken: 'refresh-xyz',
      userId: 'demo-user',
    });
    expect(isDemoSession()).toBe(true);

    await useAuthStore.getState().setSession({
      accessToken: 'jwt.header.payload',
      refreshToken: 'jwt.refresh.payload',
      userId: 'real-user',
    });
    expect(isDemoSession()).toBe(false);
  });

  it('triggers demo fallback on network errors when enabled', () => {
    const networkError = new axios.AxiosError('Network Error');
    networkError.response = undefined;

    expect(shouldUseDemoFallback(networkError)).toBe(true);
  });

  it('triggers demo fallback on server 500 errors', () => {
    const serverError = new axios.AxiosError('Internal Server Error', '500');
    serverError.response = {
      status: 500,
      data: {},
      statusText: 'Error',
      headers: {},
      config: {} as any,
    };

    expect(shouldUseDemoFallback(serverError)).toBe(true);
  });
});
