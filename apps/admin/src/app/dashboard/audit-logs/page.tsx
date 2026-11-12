'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Lock, ScrollText, Search } from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import {
  EmptyState,
  PageHeader,
  formatTimestamp,
} from '@/components/ui-primitives';

export default function AuditLogsPage() {
  const [resourceFilter, setResourceFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: adminApi.listAuditLogs,
  });

  const resourceTypes = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.resourceType)));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (resourceFilter !== 'ALL' && log.resourceType !== resourceFilter) {
        return false;
      }
      if (q) {
        const hay =
          `${log.id} ${log.action} ${log.resourceType} ${log.resourceId} ${log.actorAnonId} ${log.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, resourceFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Audit Logs"
        description="Append-only ledger of every moderation decision, community toggle, and identity access check."
      />

      <div className="flex items-start gap-3 rounded-panel border border-border bg-card/70 p-4 text-xs text-text-secondary">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          Audit records are write-once and chained by sequence number and
          integrity checksum. Edits or deletions are blocked at the database
          policy layer.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor ID, resource ID, or reason..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Resource Types</option>
          {resourceTypes.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading immutable audit trail...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit logs match your filters"
          description="Take a moderation action in Reports, Posts, Users, or Communities to see live entries appended here."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Seq</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="transition-colors hover:bg-card/50">
                        <td className="px-4 py-3.5 font-mono text-xs text-accent">
                          #{log.seq}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-text-secondary whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs text-text-primary">
                            {log.actorAnonId}
                          </p>
                          <p className="font-mono text-[11px] text-text-secondary">
                            {log.actorRole}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-[11px] font-semibold text-text-primary">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">
                          {log.resourceType} / {log.resourceId}
                        </td>
                        <td className="max-w-sm px-4 py-3.5 text-xs text-text-primary">
                          {log.reason}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : log.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            JSON
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-bg/70">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                                  Before State
                                </p>
                                <pre className="mt-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs text-text-secondary">
                                  {JSON.stringify(log.beforeState, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                                  After State
                                </p>
                                <pre className="mt-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs text-emerald-300">
                                  {JSON.stringify(log.afterState, null, 2)}
                                </pre>
                              </div>
                            </div>
                            <p className="mt-3 font-mono text-[11px] text-text-muted">
                              Integrity Checksum: {log.checksum}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
