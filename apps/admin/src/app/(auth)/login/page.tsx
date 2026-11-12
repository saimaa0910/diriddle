'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAdmin } from '@/components/providers';
import { AdminRole } from '@/lib/types';

const ROLE_OPTIONS: { value: AdminRole; label: string; scope: string }[] = [
  {
    value: 'MODERATOR',
    label: 'Moderator',
    scope: 'Content triage & report actions (anonymized IDs only)',
  },
  {
    value: 'SENIOR_MODERATOR',
    label: 'Senior Moderator',
    scope: 'Appeals, suspensions & community escalations',
  },
  {
    value: 'TRUST_SAFETY_LEAD',
    label: 'Trust & Safety Lead',
    scope: 'City governance, escalations & policy enforcement',
  },
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    scope: 'Full platform governance & immutable audit oversight',
  },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { session, authReady, signIn, isDemoMode } = useAdmin();

  const [email, setEmail] = useState('moderator@diriddle.in');
  const [password, setPassword] = useState('diriddle-local-admin');
  const [role, setRole] = useState<AdminRole>('MODERATOR');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authReady && session) {
      router.replace('/dashboard');
    }
  }, [authReady, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter your admin email and passkey.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password, role });
      router.replace('/dashboard');
    } catch {
      setError('Authentication failed. Verify your RBAC credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-text-primary">
            diriddle Admin Console
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Role-based Trust & Safety portal for India local communities
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-panel border border-border bg-surface p-6 shadow-2xl"
        >
          {isDemoMode && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Backend API is currently offline. Signing in opens the interactive{' '}
                <strong>Demo Mode</strong> console with local audit logging.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-medium text-red-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="moderator@diriddle.in"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Passkey / Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="admin-role"
              className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              RBAC Role Scope
            </label>
            <select
              id="admin-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-text-secondary">
              {ROLE_OPTIONS.find((r) => r.value === role)?.scope}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <span>{submitting ? 'Signing in...' : 'Sign in to Console'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3 text-[11px] text-text-secondary">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>
              All moderation actions and identity access requests are permanently
              recorded in the immutable audit log.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
