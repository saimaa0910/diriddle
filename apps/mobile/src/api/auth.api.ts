import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';

export interface SendOtpPayload {
  identifier: string;
  type: 'phone' | 'email';
}

export interface VerifyOtpPayload {
  identifier: string;
  otp: string;
  type: 'phone' | 'email';
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  age_verified?: boolean;
}

export const authApi = {
  async sendOtp(payload: SendOtpPayload): Promise<{ message: string; demoMode?: boolean }> {
    try {
      const res = await apiClient.post('/auth/send-otp', payload);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          message: 'Verification code prepared (demo mode). Use 123456 to sign in.',
          demoMode: true,
        };
      }
      throw error;
    }
  },

  async verifyOtp(payload: VerifyOtpPayload): Promise<AuthTokensResponse> {
    if (payload.otp === '123456' && isDemoSession()) {
      return {
        access_token: 'demo-access-token',
        refresh_token: 'demo-refresh-token',
        user_id: 'demo-user',
        age_verified: false,
      };
    }

    try {
      const res = await apiClient.post<AuthTokensResponse>('/auth/verify-otp', payload);
      if (!res.data?.access_token || res.data.access_token === 'TODO') {
        return {
          access_token: 'demo-access-token',
          refresh_token: 'demo-refresh-token',
          user_id: 'demo-user',
          age_verified: false,
        };
      }
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error) && payload.otp === '123456') {
        return {
          access_token: 'demo-access-token',
          refresh_token: 'demo-refresh-token',
          user_id: 'demo-user',
          age_verified: false,
        };
      }
      throw error;
    }
  },

  async verifyAge(): Promise<{ age_verified: boolean }> {
    if (isDemoSession()) return { age_verified: true };
    try {
      const res = await apiClient.post('/auth/age-verify', { confirmed: true });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return { age_verified: true };
      throw error;
    }
  },

  async logout(): Promise<void> {
    if (isDemoSession()) return;
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Safe local logout regardless of remote state
    }
  },
};

