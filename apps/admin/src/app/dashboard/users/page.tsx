'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Lock,
  Search,
  ShieldOff,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import { AdminUser, UserStatus } from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  formatRelativeTime,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const { notify, session } = useAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [actionTarget, setActionTarget] = useState<{
    user: AdminUser;
    nextStatus: UserStatus;
  } | null>(null);
  const [reason, setReason] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; status: UserStatus; reason: string }) =>
      adminApi.updateUserStatus(vars.userId, vars.status, vars.reason),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`User ${updated.id} status set to ${updated.status}`, 'success');
      setActionTarget(null);
      setReason('');
    },
    onError: () => {
      notify('Failed to update user status', 'error');
    },
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${u.id} ${u.anonymizedHandle} ${u.primaryCity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, statusFilter, search]);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;
    if (!reason.trim()) {
      notify('Reason is required for audit compliance.', 'warning');
      return;
    }
    mutation.mutate({
      userId: actionTarget.user.id,
      status: actionTarget.nextStatus,
      reason: reason.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Status Management"
        description="Manage account standing using anonymized internal identifiers. Zero PII is exposed in moderation views."
      />

      {/* Anonymity & PII Guardrail Banner */}
      <div className="flex flex-col gap-2 rounded-panel border border-accent/35 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="text-xs leading-relaxed text-text-primary">
            <strong>Identity Separation Enforced:</strong> Phone numbers, email
            addresses, and device tokens are scrubbed from all moderation views.
            Current role{' '}
            <span className="font-mono text-accent">{session?.role}</span>{' '}
            operates strictly on anonymized account tokens (
            <span className="font-mono">usr_anon_*</span>).
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search anonymized ID, hashed handle, or city..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Account Statuses</option>
          {Object.values(UserStatus).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Inline Confirm Box when taking action */}
      {actionTarget && (
        <form
          onSubmit={handleConfirm}
          className="rounded-panel border border-accent/40 bg-card p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Confirm Account Action:{' '}
              <span className="font-mono text-accent">
                {actionTarget.user.id}
              </span>{' '}
              &rarr; {actionTarget.nextStatus}
            </h3>
            <button
              type="button"
              onClick={() => setActionTarget(null)}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter mandatory audit reason..."
              className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-accent-hover disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving...' : 'Apply Status Change'}
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading anonymized user directory...
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No anonymized users match your query"
          description="Try clearing filters or searching another anonymized ID."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Anonymized ID</th>
                  <th className="px-4 py-3">Primary City</th>
                  <th className="px-4 py-3">18+ Gate</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Safety Strikes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-card/50"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs font-semibold text-text-primary">
                        {user.id}
                      </p>
                      <p className="font-mono text-[11px] text-text-secondary">
                        {user.anonymizedHandle}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      {user.primaryCity}
                    </td>
                    <td className="px-4 py-3.5">
                      {user.ageVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Unverified</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      <div>
                        {user.postsCount} posts • {user.activeCommunitiesCount}{' '}
                        communities
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Active {formatRelativeTime(user.lastActiveAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <span
                        className={`font-mono font-semibold ${
                          user.strikesCount >= 2
                            ? 'text-red-300'
                            : user.strikesCount === 1
                            ? 'text-amber-300'
                            : 'text-text-secondary'
                        }`}
                      >
                        {user.strikesCount} strikes
                      </span>
                      <p className="text-[11px] text-text-muted">
                        {user.reportsAgainstCount} reports received
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {user.status === UserStatus.ACTIVE ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActionTarget({
                              user,
                              nextStatus: UserStatus.SUSPENDED,
                            });
                            setReason('Repeated safety policy violations');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/25"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Suspend
                        </button>
                      ) : user.status === UserStatus.SUSPENDED ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActionTarget({
                              user,
                              nextStatus: UserStatus.ACTIVE,
                            });
                            setReason('Suspension expired / reinstated after review');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Reactivate
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">Deleted</span>
                      )}
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
