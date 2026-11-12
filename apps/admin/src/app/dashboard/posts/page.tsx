'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Search, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { AdminPost, PostCategory, PostStatus } from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  formatRelativeTime,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

export default function PostsModerationPage() {
  const queryClient = useQueryClient();
  const { notify } = useAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: adminApi.listPosts,
  });

  const mutation = useMutation({
    mutationFn: (vars: { postId: string; status: PostStatus; reason: string }) =>
      adminApi.moderatePost(vars.postId, vars.status, vars.reason),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`Post ${updated.id} updated to ${updated.status}`, 'success');
    },
    onError: () => {
      notify('Failed to update post status', 'error');
    },
  });

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (q) {
        const hay =
          `${p.id} ${p.content} ${p.city} ${p.anonymousDisplayCode} ${p.authorAnonId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, statusFilter, categoryFilter, search]);

  const handleAction = (post: AdminPost, nextStatus: PostStatus) => {
    const reason =
      nextStatus === PostStatus.PUBLISHED
        ? 'Moderator approved post after review'
        : 'Removed by moderator for policy violation';
    mutation.mutate({ postId: post.id, status: nextStatus, reason });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Post Moderation"
        description="Inspect posts across India city feeds, review auto-flagged items, and approve or remove content."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search post text, city, Anonymous #ID..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          {Object.values(PostStatus).map((st) => (
            <option key={st} value={st}>
              {st.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          {Object.values(PostCategory).map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading posts...
        </div>
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts found"
          description="Adjust your search query or filters to view other posts."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Post & Author</th>
                  <th className="px-4 py-3">Community</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Signals</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPosts.map((post) => (
                  <tr
                    key={post.id}
                    className="transition-colors hover:bg-card/50"
                  >
                    <td className="max-w-lg px-4 py-3.5 align-top">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {post.anonymousDisplayCode}
                        </span>
                        <span className="font-mono text-[11px]">
                          {post.authorAnonId}
                        </span>
                        <span>• {formatRelativeTime(post.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-text-primary">
                        {post.content}
                      </p>
                      {post.autoFlagReason && (
                        <p className="mt-1.5 inline-block rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                          Auto-Flag: {post.autoFlagReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-text-secondary">
                      {post.communityName}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-text-secondary">
                        {post.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-text-secondary whitespace-nowrap">
                      <div>{post.reportCount} reports</div>
                      <div className="text-[11px] text-text-muted">
                        {post.reactionCount} reactions • {post.commentCount}{' '}
                        comments
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {post.status !== PostStatus.PUBLISHED && (
                          <button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() =>
                              handleAction(post, PostStatus.PUBLISHED)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {post.status !== PostStatus.REMOVED && (
                          <button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() =>
                              handleAction(post, PostStatus.REMOVED)
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
