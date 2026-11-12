'use client';

import React from 'react';
import clsx from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import { LucideIcon, X } from 'lucide-react';
import { ReportPriority } from '@/lib/types';

export function formatRelativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function formatTimestamp(iso: string): string {
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

const PRIORITY_STYLES: Record<ReportPriority, string> = {
  CRITICAL: 'border-red-500/40 bg-red-500/15 text-red-300',
  HIGH: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  NORMAL: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  LOW: 'border-slate-500/40 bg-slate-500/15 text-slate-300',
};

export function PriorityBadge({ priority }: { priority: ReportPriority }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        PRIORITY_STYLES[priority]
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          priority === 'CRITICAL'
            ? 'bg-red-400 animate-pulse'
            : priority === 'HIGH'
            ? 'bg-amber-400'
            : priority === 'NORMAL'
            ? 'bg-sky-400'
            : 'bg-slate-400'
        )}
      />
      {priority}
    </span>
  );
}

const STATUS_STYLE_MAP: Record<string, string> = {
  ACTIVE: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  PUBLISHED: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  APPROVED: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  RESOLVED: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  OPERATIONAL: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  RECEIVED: 'border-accent/40 bg-accent/15 text-accent',
  PENDING: 'border-accent/40 bg-accent/15 text-accent',
  UNDER_REVIEW: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  FLAGGED: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  DEGRADED: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  DISMISSED: 'border-slate-500/35 bg-slate-500/15 text-slate-300',
  INACTIVE: 'border-slate-500/35 bg-slate-500/15 text-slate-300',
  DRAFT: 'border-slate-500/35 bg-slate-500/15 text-slate-300',
  REMOVED: 'border-red-500/40 bg-red-500/15 text-red-300',
  SUSPENDED: 'border-red-500/40 bg-red-500/15 text-red-300',
  REJECTED: 'border-red-500/40 bg-red-500/15 text-red-300',
  DELETED: 'border-red-500/40 bg-red-500/15 text-red-300',
  OFFLINE: 'border-red-500/40 bg-red-500/15 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLE_MAP[status] ??
          'border-border bg-surface text-text-secondary'
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-card border bg-card p-5 transition-colors',
        highlight ? 'border-accent/40' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-text-secondary">{subtext}</p>
          )}
        </div>
        <div
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            highlight
              ? 'border-accent/30 bg-accent/15 text-accent'
              : 'border-border bg-surface text-text-secondary'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-text-secondary">{description}</p>
    </div>
  );
}

export function SlideOverDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div
        className="flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card p-1.5 text-text-secondary hover:text-text-primary"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
