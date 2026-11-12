import { useAuthStore } from '../store/auth-store';

describe('useAuthStore', () => {
  beforeEach(async () => {
    await useAuthStore.getState().clearSession();
  });

  it('stores session, onboarding, and age confirmation', async () => {
    await useAuthStore.getState().markOnboardingSeen();
    await useAuthStore.getState().setSession({
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      userId: 'demo-user',
    });
    await useAuthStore.getState().confirmAgeAndTerms();

    const state = useAuthStore.getState();
    expect(state.hasSeenOnboarding).toBe(true);
    expect(state.accessToken).toBe('demo-access-token');
    expect(state.ageVerified).toBe(true);
    expect(state.termsAccepted).toBe(true);
  });

  it('clears tokens on sign out while preserving onboarding flag', async () => {
    await useAuthStore.getState().markOnboardingSeen();
    await useAuthStore.getState().setSession({
      accessToken: 'abc',
      refreshToken: 'def',
      userId: 'u1',
    });
    await useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.hasSeenOnboarding).toBe(true);
  });
});
