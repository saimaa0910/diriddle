'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  CheckCircle2,
  Eye,
  Filter,
  Search,
  ShieldAlert,
  Trash2,
  UserX,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import {
  AdminReport,
  ModerationActionType,
  ReportPriority,
  ReportReason,
  ReportStatus,
} from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  PriorityBadge,
  SlideOverDrawer,
  StatusBadge,
  formatRelativeTime,
  formatTimestamp,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

const MODERATION_ACTIONS: {
  type: ModerationActionType;
  label: string;
  description: string;
  tone: 'safe' | 'warn' | 'danger';
  icon: typeof CheckCircle2;
}[] = [
  {
    type: ModerationActionType.APPROVE,
    label: 'Approve (Dismiss Report)',
    description: 'Content obeys community guidelines; mark report dismissed.',
    tone: 'safe',
    icon: CheckCircle2,
  },
  {
    type: ModerationActionType.REMOVE,
    label: 'Remove Content',
    description: 'Delete reported post or comment from public feeds immediately.',
    tone: 'danger',
    icon: Trash2,
  },
  {
    type: ModerationActionType.WARN,
    label: 'Warn Author',
    description: 'Send official policy warning to anonymized user account.',
    tone: 'warn',
    icon: AlertTriangle,
  },
  {
    type: ModerationActionType.TEMPORARY_SUSPENSION,
    label: 'Temporary Suspension (7d)',
    description: 'Remove content & suspend posting privileges for 7 days.',
    tone: 'danger',
    icon: UserX,
  },
  {
    type: ModerationActionType.PERMANENT_SUSPENSION,
    label: 'Permanent Suspension',
    description: 'Permanently suspend user for severe doxxing/hate/abuse.',
    tone: 'danger',
    icon: AlertOctagon,
  },
  {
    type: ModerationActionType.ESCALATE,
    label: 'Escalate to Trust & Safety Lead',
    description: 'Move report to senior review queue without resolving yet.',
    tone: 'warn',
    icon: ArrowUpRight,
  },
];

export default function ReportsQueuePage() {
  const queryClient = useQueryClient();
  const { notify } = useAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [selectedAction, setSelectedAction] = useState<ModerationActionType>(
    ModerationActionType.REMOVE
  );
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: adminApi.listReports,
  });

  // Support deep link ?focus=<reportId> safely on client
  useEffect(() => {
    if (reports.length === 0 || selectedReport) return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focus');
    if (focusId) {
      const target = reports.find((r) => r.id === focusId);
      if (target) {
        setSelectedReport(target);
        setActionReason(`Policy enforcement: ${target.reason}`);
      }
    }
  }, [reports, selectedReport]);

  const mutation = useMutation({
    mutationFn: (vars: {
      reportId: string;
      actionType: ModerationActionType;
      reason: string;
      notes?: string;
    }) =>
      adminApi.resolveReport(vars.reportId, {
        actionType: vars.actionType,
        reason: vars.reason,
        notes: vars.notes,
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`Report ${updated.id} updated (${updated.status})`, 'success');
      setSelectedReport(null);
      setActionReason('');
      setActionNotes('');
    },
    onError: () => {
      notify('Failed to apply moderation decision', 'error');
    },
  });

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter === 'OPEN') {
        if (
          r.status !== ReportStatus.RECEIVED &&
          r.status !== ReportStatus.UNDER_REVIEW
        ) {
          return false;
        }
      } else if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) {
        return false;
      }
      if (reasonFilter !== 'ALL' && r.reason !== reasonFilter) {
        return false;
      }
      if (q) {
        const hay =
          `${r.id} ${r.targetPreview} ${r.city} ${r.targetAuthorDisplayCode} ${r.targetAuthorAnonId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, statusFilter, priorityFilter, reasonFilter, search]);

  const openReportDrawer = (report: AdminReport) => {
    setSelectedReport(report);
    setSelectedAction(ModerationActionType.REMOVE);
    setActionReason(`Moderation review for ${report.reason}`);
    setActionNotes('');
  };

  const handleSubmitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!actionReason.trim()) {
      notify('A moderation reason is required for the audit log.', 'warning');
      return;
    }
    mutation.mutate({
      reportId: selectedReport.id,
      actionType: selectedAction,
      reason: actionReason.trim(),
      notes: actionNotes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports Queue"
        description="Triage user and automated safety flags. Every decision records an immutable audit log entry."
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search report ID, content, city, anon ID..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-secondary" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="OPEN">Open (Received / Reviewing)</option>
            <option value="ALL">All Statuses</option>
            {Object.values(ReportStatus).map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            {(['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] as ReportPriority[]).map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              )
            )}
          </select>

          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="ALL">All Reasons</option>
            {Object.values(ReportReason).map((reason) => (
              <option key={reason} value={reason}>
                {reason.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports Table */}
      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading reports queue...
        </div>
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No reports match your filters"
          description="Try clearing your search or switching status filters to view resolved reports."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Target & Content</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="transition-colors hover:bg-card/50"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <PriorityBadge priority={report.priority} />
                      <p className="mt-1 text-[11px] font-mono text-text-secondary">
                        {report.reportCount}x flags
                      </p>
                    </td>
                    <td className="max-w-md px-4 py-3.5 align-top">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-accent">
                          {report.targetType}
                        </span>
                        <span>{report.targetAuthorDisplayCode}</span>
                        <span className="font-mono text-[11px] text-text-muted">
                          ({report.targetAuthorAnonId})
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-text-primary">
                        {report.targetPreview}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusBadge status={report.reason} />
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-text-secondary">
                      {report.city}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-text-secondary whitespace-nowrap">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 align-top text-right">
                      <button
                        type="button"
                        onClick={() => openReportDrawer(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-bg"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Moderation Action Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title={`Review Report ${selectedReport?.id ?? ''}`}
        subtitle={
          selectedReport
            ? `${selectedReport.targetType} • ${selectedReport.city} • Filed ${formatTimestamp(
                selectedReport.createdAt
              )}`
            : undefined
        }
      >
        {selectedReport && (
          <form onSubmit={handleSubmitDecision} className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={selectedReport.priority} />
              <StatusBadge status={selectedReport.reason} />
              <StatusBadge status={selectedReport.status} />
            </div>

            <div className="rounded-card border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>
                  Author: <strong>{selectedReport.targetAuthorDisplayCode}</strong>
                </span>
                <span className="font-mono">
                  {selectedReport.targetAuthorAnonId}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-text-primary">
                {selectedReport.targetPreview}
              </p>
              {selectedReport.description && (
                <div className="border-t border-border pt-2 text-xs text-text-secondary">
                  <strong className="text-text-primary">Reporter note:</strong>{' '}
                  {selectedReport.description}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Select Moderation Action
              </p>
              <div className="space-y-2">
                {MODERATION_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const active = selectedAction === action.type;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => setSelectedAction(action.type)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-accent bg-accent/15'
                          : 'border-border bg-card hover:bg-card-hover'
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          action.tone === 'danger'
                            ? 'text-red-400'
                            : action.tone === 'warn'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-text-primary">
                          {action.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-secondary">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="mod-reason"
                className="block text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Audit Reason (Required)
              </label>
              <input
                id="mod-reason"
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g., Confirmed doxxing / PII solicitation"
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                required
              />
            </div>

            <div>
              <label
                htmlFor="mod-notes"
                className="block text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Internal Moderator Notes (Optional)
              </label>
              <textarea
                id="mod-notes"
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Context for appeal reviewers or Trust & Safety escalation..."
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {mutation.isPending ? 'Recording...' : 'Confirm & Log Action'}
              </button>
            </div>
          </form>
        )}
      </SlideOverDrawer>
    </div>
  );
}
