'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageSquare, Search, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { AdminComment, CommentStatus } from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  formatRelativeTime,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

export default function CommentsModerationPage() {
  const queryClient = useQueryClient();
  const { notify } = useAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['admin-comments'],
    queryFn: adminApi.listComments,
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      commentId: string;
      status: CommentStatus;
      reason: string;
    }) => adminApi.moderateComment(vars.commentId, vars.status, vars.reason),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`Comment ${updated.id} updated to ${updated.status}`, 'success');
    },
    onError: () => {
      notify('Failed to update comment status', 'error');
    },
  });

  const filteredComments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return comments.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${c.id} ${c.content} ${c.postSnippet} ${c.communityName} ${c.anonymousDisplayCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [comments, statusFilter, search]);

  const handleAction = (comment: AdminComment, nextStatus: CommentStatus) => {
    const reason =
      nextStatus === CommentStatus.ACTIVE
        ? 'Comment approved by moderator'
        : 'Comment removed for harassment/policy breach';
    mutation.mutate({ commentId: comment.id, status: nextStatus, reason });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comment Moderation"
        description="Review flagged comments and nested replies with full parent post context."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comment text, parent post, city, Anonymous #ID..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          {Object.values(CommentStatus).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading comments...
        </div>
      ) : filteredComments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments match your filters"
          description="Try selecting All Statuses or adjusting your search query."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Comment & Context</th>
                  <th className="px-4 py-3">Community</th>
                  <th className="px-4 py-3">Reports</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredComments.map((comment) => (
                  <tr
                    key={comment.id}
                    className="transition-colors hover:bg-card/50"
                  >
                    <td className="max-w-xl px-4 py-3.5 align-top">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {comment.anonymousDisplayCode}
                        </span>
                        <span className="font-mono text-[11px]">
                          {comment.authorAnonId}
                        </span>
                        <span>• {formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-text-primary">
                        {comment.content}
                      </p>
                      <p className="mt-1.5 text-xs text-text-secondary">
                        On post:{' '}
                        <span className="italic text-text-muted">
                          &ldquo;{comment.postSnippet}&rdquo;
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-text-secondary">
                      {comment.communityName}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs font-mono text-text-secondary">
                      {comment.reportCount} flags
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusBadge status={comment.status} />
                    </td>
                    <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {comment.status !== CommentStatus.ACTIVE && (
                          <button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() =>
                              handleAction(comment, CommentStatus.ACTIVE)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {comment.status !== CommentStatus.REMOVED && (
                          <button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() =>
                              handleAction(comment, CommentStatus.REMOVED)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/25"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
