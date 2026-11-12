'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Clock,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { PageHeader, StatCard } from '@/components/ui-primitives';

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverview,
  });

  const daily = overview?.dailyMetrics ?? [];
  const maxDau = Math.max(...daily.map((d) => d.dau), 1);
  const maxPosts = Math.max(...daily.map((d) => d.posts), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        description="DAU/MAU engagement, posts per day across India, and Trust & Safety SLA response times."
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="DAU / MAU"
          value={
            overview
              ? `${overview.dau.toLocaleString('en-IN')} / ${(
                  overview.mau / 1000
                ).toFixed(1)}k`
              : '—'
          }
          subtext={
            overview
              ? `Stickiness ratio: ${(overview.dauMauRatio * 100).toFixed(0)}%`
              : 'Loading...'
          }
          icon={Users}
        />
        <StatCard
          label="Posts / Day"
          value={overview ? overview.postsLast24h.toLocaleString('en-IN') : '—'}
          subtext={
            overview
              ? `${overview.commentsLast24h.toLocaleString('en-IN')} comments in 24h`
              : 'Loading...'
          }
          icon={FileText}
        />
        <StatCard
          label="Median Response SLA"
          value={overview ? `${overview.medianResponseMinutes} min` : '—'}
          subtext="Target: < 15 min for priority queues"
          icon={Clock}
          highlight
        />
        <StatCard
          label="P95 Moderation SLA"
          value={overview ? `${overview.p95ResponseMinutes} min` : '—'}
          subtext="95th percentile time-to-resolution"
          icon={TrendingUp}
        />
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading telemetry...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* DAU 7-day trend */}
          <section className="rounded-panel border border-border bg-surface p-5">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                <h2 className="text-base font-semibold text-text-primary">
                  Daily Active Users (7d)
                </h2>
              </div>
              <span className="text-xs text-text-secondary">India total</span>
            </div>

            <div className="mt-6 flex h-52 items-end gap-3">
              {daily.map((pt) => {
                const heightPct = Math.max(
                  12,
                  Math.round((pt.dau / maxDau) * 100)
                );
                return (
                  <div
                    key={pt.date}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[11px] font-mono text-text-secondary">
                      {(pt.dau / 1000).toFixed(1)}k
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-lg bg-accent/80 transition-all hover:bg-accent"
                        style={{ height: `${heightPct}%` }}
                        title={`${pt.date}: ${pt.dau.toLocaleString('en-IN')} DAU`}
                      />
                    </div>
                    <span className="text-[11px] text-text-secondary">
                      {pt.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Posts/day & SLA trend */}
          <section className="rounded-panel border border-border bg-surface p-5">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <h2 className="text-base font-semibold text-text-primary">
                  Posts / Day &amp; Response SLA (7d)
                </h2>
              </div>
              <span className="text-xs text-text-secondary">
                Avg response (min)
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {daily.map((pt) => {
                const widthPct = Math.max(
                  10,
                  Math.round((pt.posts / maxPosts) * 100)
                );
                return (
                  <div key={pt.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-text-primary">
                        {pt.date}
                      </span>
                      <span className="font-mono text-text-secondary">
                        {pt.posts.toLocaleString('en-IN')} posts •{' '}
                        {pt.reportsResolved} resolved •{' '}
                        <span className="text-accent">{pt.avgResponseMin}m</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-card">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Category distribution */}
          <section className="rounded-panel border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-text-primary pb-4 border-b border-border">
              Posts by Category (24h)
            </h2>
            <div className="mt-4 space-y-3">
              {(overview?.categoryBreakdown ?? []).map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-primary">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-text-secondary">
                      {item.count.toLocaleString('en-IN')} ({item.sharePercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-card">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{ width: `${item.sharePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* City throughput */}
          <section className="rounded-panel border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-text-primary pb-4 border-b border-border">
              Top Cities Throughput
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-text-secondary uppercase">
                  <tr>
                    <th className="py-2 pr-3">City</th>
                    <th className="py-2 pr-3">DAU</th>
                    <th className="py-2 pr-3">Posts/24h</th>
                    <th className="py-2 text-right">Open Reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(overview?.cityBreakdown ?? []).map((city) => (
                    <tr key={city.city}>
                      <td className="py-2.5 pr-3 font-medium text-text-primary">
                        {city.city}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-text-secondary">
                        {city.dau.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-text-secondary">
                        {city.posts24h.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-accent">
                        {city.openReports}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
