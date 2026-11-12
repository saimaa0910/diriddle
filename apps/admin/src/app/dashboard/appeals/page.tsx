'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Scale, XCircle } from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { ModerationAppeal } from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  formatRelativeTime,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

export default function AppealsQueuePage() {
  const queryClient = useQueryClient();
  const { notify } = useAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const { data: appeals = [], isLoading } = useQuery({
    queryKey: ['admin-appeals'],
    queryFn: adminApi.listAppeals,
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      appealId: string;
      status: 'APPROVED' | 'REJECTED';
      reviewerNote: string;
    }) => adminApi.resolveAppeal(vars.appealId, vars.status, vars.reviewerNote),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`Appeal ${updated.id} ${updated.status.toLowerCase()}`, 'success');
    },
    onError: () => {
      notify('Failed to resolve appeal', 'error');
    },
  });

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return appeals;
    return appeals.filter((a) => a.status === statusFilter);
  }, [appeals, statusFilter]);

  const handleDecision = (
    appeal: ModerationAppeal,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    const note = (notesById[appeal.id] ?? '').trim();
    const fallbackNote =
      status === 'APPROVED'
        ? 'Appeal granted upon secondary moderator review.'
        : 'Original moderation action upheld.';
    mutation.mutate({
      appealId: appeal.id,
      status,
      reviewerNote: note || fallbackNote,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation Appeals"
        description="Secondary review queue for suspended accounts and removed content."
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
              statusFilter === tab
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading appeals queue...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No appeals in this view"
          description="Appeals submitted by suspended or moderated users appear here for secondary review."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((appeal) => (
            <article
              key={appeal.id}
              className="rounded-panel border border-border bg-surface p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-accent">
                    {appeal.id}
                  </span>
                  <StatusBadge status={appeal.status} />
                  <span className="rounded bg-card px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                    {appeal.originalAction}
                  </span>
                  <span className="text-xs text-text-secondary">
                    by <span className="font-mono">{appeal.userAnonId}</span>
                  </span>
                </div>
                <span className="text-xs text-text-secondary">
                  Submitted {formatRelativeTime(appeal.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-card border border-border bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    Original Decision ({appeal.targetType} {appeal.targetId})
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-300">
                    Reason: {appeal.originalReason}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    &ldquo;{appeal.targetPreview}&rdquo;
                  </p>
                </div>

                <div className="rounded-card border border-border bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    User Appeal Statement
                  </p>
                  <p className="mt-2 text-sm text-text-primary">
                    {appeal.appealStatement}
                  </p>
                </div>
              </div>

              {appeal.status === 'PENDING' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={notesById[appeal.id] ?? ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({
                        ...prev,
                        [appeal.id]: e.target.value,
                      }))
                    }
                    placeholder="Reviewer rationale for audit log..."
                    className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => handleDecision(appeal, 'APPROVED')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve & Restore
                    </button>
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => handleDecision(appeal, 'REJECTED')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                    >
                      <XCircle className="h-4 w-4" />
                      Uphold Decision
                    </button>
                  </div>
                </div>
              ) : (
                appeal.reviewerNote && (
                  <div className="rounded-xl border border-border bg-card/70 px-4 py-2.5 text-xs text-text-secondary">
                    <strong className="text-text-primary">Reviewer note:</strong>{' '}
                    {appeal.reviewerNote}
                  </div>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
