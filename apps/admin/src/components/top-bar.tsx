'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff, Lock, Monitor } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-client';
import { useAdmin } from './providers';

export function TopBar() {
  const { isDemoMode, retryApiConnection, session } = useAdmin();
  const [checking, setChecking] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).desktopApi?.isDesktop) {
      setIsDesktop(true);
    }
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      await retryApiConnection();
    } finally {
      setChecking(false);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/80 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Lock className="h-3.5 w-3.5 text-accent" />
        <span>
          PII Protection Active — Ordinary moderators view anonymized IDs only
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isDemoMode ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span>Demo Data Mode (API offline: {API_BASE_URL})</span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={checking}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`}
              />
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span>Connected: {API_BASE_URL}</span>
          </div>
        )}

        {isDesktop && (
          <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
            <Monitor className="h-3.5 w-3.5 text-indigo-400" />
            <span>Desktop</span>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-text-secondary">
          <span>RBAC:</span>
          <span className="font-mono font-semibold text-text-primary">
            {session?.role ?? 'MODERATOR'}
          </span>
        </div>
      </div>
    </header>
  );
}
