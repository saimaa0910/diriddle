import { create } from 'zustand';
import { safeStorage } from '../utils/storage';

const AUTH_STORAGE_KEY = 'diriddle_auth_state_v1';

interface PersistedAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  hasSeenOnboarding: boolean;
  ageVerified: boolean;
  termsAccepted: boolean;
  pushNotificationsEnabled: boolean;
}

interface AuthStore extends PersistedAuthState {
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (payload: { accessToken: string; refreshToken: string; userId: string }) => Promise<void>;
  markOnboardingSeen: () => Promise<void>;
  confirmAgeAndTerms: () => Promise<void>;
  setPushNotificationsEnabled: (enabled: boolean) => Promise<void>;
  clearSession: () => Promise<void>;
}

const DEFAULT_PERSISTED: PersistedAuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  hasSeenOnboarding: false,
  ageVerified: false,
  termsAccepted: false,
  pushNotificationsEnabled: true,
};

async function persistAuth(state: PersistedAuthState) {
  await safeStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function extractPersisted(s: AuthStore): PersistedAuthState {
  return {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    userId: s.userId,
    hasSeenOnboarding: s.hasSeenOnboarding,
    ageVerified: s.ageVerified,
    termsAccepted: s.termsAccepted,
    pushNotificationsEnabled: s.pushNotificationsEnabled,
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...DEFAULT_PERSISTED,
  isHydrated: false,

  async hydrate() {
    if (get().isHydrated) return;
    try {
      const raw = await safeStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedAuthState>;
        set({
          ...DEFAULT_PERSISTED,
          ...parsed,
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignore corrupt storage and fall back to defaults
    }
    set({ isHydrated: true });
  },

  async setSession({ accessToken, refreshToken, userId }) {
    const next: PersistedAuthState = {
      ...extractPersisted(get()),
      accessToken,
      refreshToken,
      userId,
    };
    set(next);
    await persistAuth(next);
  },

  async markOnboardingSeen() {
    const next: PersistedAuthState = {
      ...extractPersisted(get()),
      hasSeenOnboarding: true,
    };
    set(next);
    await persistAuth(next);
  },

  async confirmAgeAndTerms() {
    const next: PersistedAuthState = {
      ...extractPersisted(get()),
      ageVerified: true,
      termsAccepted: true,
    };
    set(next);
    await persistAuth(next);
  },

  async setPushNotificationsEnabled(enabled: boolean) {
    const next: PersistedAuthState = {
      ...extractPersisted(get()),
      pushNotificationsEnabled: enabled,
    };
    set(next);
    await persistAuth(next);
  },

  async clearSession() {
    const next: PersistedAuthState = {
      ...DEFAULT_PERSISTED,
      hasSeenOnboarding: get().hasSeenOnboarding,
    };
    set(next);
    await persistAuth(next);
  },
}));

