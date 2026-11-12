'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Clock,
  FileText,
  MapPin,
  Server,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { ReportStatus } from '@/lib/types';
import {
  PageHeader,
  PriorityBadge,
  StatCard,
  StatusBadge,
  formatRelativeTime,
} from '@/components/ui-primitives';

export default function DashboardOverviewPage() {
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverview,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: adminApi.listReports,
  });

  const priorityQueue = reports
    .filter(
      (r) =>
        r.status === ReportStatus.RECEIVED ||
        r.status === ReportStatus.UNDER_REVIEW
    )
    .sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      return rank[a.priority] - rank[b.priority];
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Real-time safety operations, active India city feeds, and infrastructure health."
        actions={
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <ShieldAlert className="h-4 w-4" />
            Open Reports Queue ({priorityQueue.length})
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Daily Active Users"
          value={overview ? overview.dau.toLocaleString('en-IN') : '—'}
          subtext={
            overview
              ? `${Math.round(overview.dauMauRatio * 100)}% DAU/MAU stickiness`
              : 'Loading...'
          }
          icon={Users}
        />
        <StatCard
          label="Posts (Last 24h)"
          value={overview ? overview.postsLast24h.toLocaleString('en-IN') : '—'}
          subtext={
            overview
              ? `${overview.commentsLast24h.toLocaleString('en-IN')} comments across India`
              : 'Loading...'
          }
          icon={FileText}
        />
        <StatCard
          label="Open Safety Reports"
          value={overview ? overview.openReportsCount : priorityQueue.length}
          subtext={
            overview
              ? `${overview.criticalReportsCount} critical priority awaiting triage`
              : 'Loading...'
          }
          icon={ShieldAlert}
          highlight={(overview?.criticalReportsCount ?? 0) > 0}
        />
        <StatCard
          label="Median Moderation SLA"
          value={overview ? `${overview.medianResponseMinutes}m` : '—'}
          subtext={
            overview
              ? `P95 response: ${overview.p95ResponseMinutes}m`
              : 'Loading...'
          }
          icon={Clock}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Priority Report Queue Summary */}
        <section className="xl:col-span-2 rounded-panel border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Priority Report Queue
              </h2>
              <p className="text-xs text-text-secondary">
                Doxxing, harassment, and hate-speech reports are escalated automatically.
              </p>
            </div>
            <Link
              href="/dashboard/reports"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {priorityQueue.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                All reports triaged. Queue is clear.
              </p>
            ) : (
              priorityQueue.slice(0, 5).map((report) => (
                <Link
                  key={report.id}
                  href={`/dashboard/reports?focus=${report.id}`}
                  className="block rounded-card border border-border bg-card p-4 transition-colors hover:border-accent/40 hover:bg-card-hover"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={report.priority} />
                      <StatusBadge status={report.reason} />
                      <span className="text-xs font-mono text-text-secondary">
                        {report.targetType} • {report.city}
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary">
                      {report.reportCount} reports •{' '}
                      {formatRelativeTime(report.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-text-primary">
                    {report.targetPreview}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                    <span>
                      Author: {report.targetAuthorDisplayCode} (
                      <span className="font-mono">{report.targetAuthorAnonId}</span>)
                    </span>
                    <StatusBadge status={report.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* System Health */}
        <section className="rounded-panel border border-border bg-surface p-5">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Server className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                System Status
              </h2>
              <p className="text-xs text-text-secondary">
                Core platform & safety pipeline services
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(overview?.systemHealth ?? []).map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-card px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {svc.name}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {svc.detail}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={svc.status} />
                  <p className="mt-1 text-[11px] font-mono text-text-secondary">
                    {svc.latencyMs}ms
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Active India Cities */}
      <section className="rounded-panel border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Active India Cities
              </h2>
              <p className="text-xs text-text-secondary">
                Top city communities by daily engagement and moderation load
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/communities"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
          >
            Manage communities <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(overview?.cityBreakdown ?? []).map((city) => (
            <div
              key={city.city}
              className="rounded-card border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {city.city}
                  </h3>
                  <p className="text-xs text-text-secondary">{city.state}</p>
                </div>
                <StatusBadge status={city.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                <div>
                  <p className="text-text-secondary">DAU</p>
                  <p className="mt-0.5 font-semibold text-text-primary">
                    {city.dau.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary">Posts/24h</p>
                  <p className="mt-0.5 font-semibold text-text-primary">
                    {city.posts24h.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary">Reports</p>
                  <p className="mt-0.5 font-semibold text-accent">
                    {city.openReports}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
          <Activity className="h-3.5 w-3.5 text-accent" />
          <span>
            Location privacy threshold enforced: geo-cells require minimum active
            users before neighborhood feeds unlock.
          </span>
        </div>
      </section>
    </div>
  );
}
