'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ShieldAlert,
  FileText,
  MessageSquare,
  Users,
  MapPin,
  Scale,
  BarChart3,
  ScrollText,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { ReportStatus } from '@/lib/types';
import { useAdmin } from './providers';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/reports', label: 'Reports', icon: ShieldAlert },
  { href: '/dashboard/posts', label: 'Posts', icon: FileText },
  { href: '/dashboard/comments', label: 'Comments', icon: MessageSquare },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/communities', label: 'Communities', icon: MapPin },
  { href: '/dashboard/appeals', label: 'Appeals', icon: Scale },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAdmin();

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: adminApi.listReports,
  });

  const { data: appeals = [] } = useQuery({
    queryKey: ['admin-appeals'],
    queryFn: adminApi.listAppeals,
  });

  const openReportsCount = reports.filter(
    (r) => r.status === ReportStatus.RECEIVED || r.status === ReportStatus.UNDER_REVIEW
  ).length;

  const pendingAppealsCount = appeals.filter(
    (a) => a.status === 'PENDING'
  ).length;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-text-primary">
              diriddle
            </span>
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Admin
            </span>
          </div>
          <p className="text-[11px] text-text-secondary">Trust & Safety Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badge =
            item.href === '/dashboard/reports' && openReportsCount > 0
              ? openReportsCount
              : item.href === '/dashboard/appeals' && pendingAppealsCount > 0
              ? pendingAppealsCount
              : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:bg-card hover:text-text-primary border border-transparent'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
              {badge !== null && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-bg">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Session footer */}
      <div className="border-t border-border p-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">
                {session?.displayName ?? 'Moderator'}
              </p>
              <p className="truncate text-[11px] font-mono text-accent">
                {session?.role ?? 'MODERATOR'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.replace('/login');
              }}
              className="rounded-lg border border-border bg-surface p-1.5 text-text-secondary hover:border-red-500/40 hover:text-red-300"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
