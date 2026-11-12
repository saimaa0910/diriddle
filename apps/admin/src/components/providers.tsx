'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  adminApi,
  demoStore,
  getStoredAdminSession,
  setStoredAdminSession,
} from '@/lib/api-client';
import { AdminRole, AdminSession } from '@/lib/types';

interface ToastMessage {
  id: string;
  title: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

interface AdminContextValue {
  session: AdminSession | null;
  authReady: boolean;
  isDemoMode: boolean;
  signIn: (params: {
    email: string;
    password: string;
    role: AdminRole;
  }) => Promise<AdminSession>;
  signOut: () => void;
  retryApiConnection: () => Promise<void>;
  notify: (title: string, tone?: ToastMessage['tone']) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [session, setSession] = useState<AdminSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(demoStore.isDemoMode);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setSession(getStoredAdminSession());
    setAuthReady(true);
    const unsubscribe = demoStore.subscribe((mode) => setIsDemoMode(mode));
    void adminApi.checkHealth();
    return unsubscribe;
  }, []);

  const notify = useCallback(
    (title: string, tone: ToastMessage['tone'] = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3800);
    },
    []
  );

  const signIn = useCallback(
    async (params: { email: string; password: string; role: AdminRole }) => {
      const nextSession = await adminApi.signIn(params);
      setSession(nextSession);
      return nextSession;
    },
    []
  );

  const signOut = useCallback(() => {
    setStoredAdminSession(null);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const retryApiConnection = useCallback(async () => {
    const result = await adminApi.checkHealth();
    if (result.online) {
      notify('Connected to live diriddle API', 'success');
      void queryClient.invalidateQueries();
    } else {
      notify('Backend API unreachable — running in Demo Mode', 'warning');
    }
  }, [notify, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AdminContext.Provider
        value={{
          session,
          authReady,
          isDemoMode,
          signIn,
          signOut,
          retryApiConnection,
          notify,
        }}
      >
        {children}
        {toasts.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-sm ${
                  toast.tone === 'success'
                    ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
                    : toast.tone === 'warning'
                    ? 'border-amber-500/40 bg-amber-950/90 text-amber-200'
                    : toast.tone === 'error'
                    ? 'border-red-500/40 bg-red-950/90 text-red-200'
                    : 'border-border bg-card/95 text-text-primary'
                }`}
              >
                {toast.title}
              </div>
            ))}
          </div>
        )}
      </AdminContext.Provider>
    </QueryClientProvider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within Providers');
  }
  return ctx;
}
