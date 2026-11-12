'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Power, Search } from 'lucide-react';
import { adminApi } from '@/lib/api-client';
import {
  AdminCommunity,
  CommunityStatusValue,
  CommunityType,
} from '@/lib/types';
import {
  EmptyState,
  PageHeader,
  SlideOverDrawer,
  StatusBadge,
} from '@/components/ui-primitives';
import { useAdmin } from '@/components/providers';

export default function CommunitiesManagementPage() {
  const queryClient = useQueryClient();
  const { notify } = useAdmin();

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newType, setNewType] = useState<CommunityType>(CommunityType.CITY);

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ['admin-communities'],
    queryFn: adminApi.listCommunities,
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: {
      communityId: string;
      status: CommunityStatusValue;
      reason: string;
    }) =>
      adminApi.updateCommunityStatus(vars.communityId, vars.status, vars.reason),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`${updated.name} is now ${updated.status}`, 'success');
    },
    onError: () => {
      notify('Failed to update community status', 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createCommunity,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      notify(`Created community: ${created.name}`, 'success');
      setCreateOpen(false);
      setNewName('');
      setNewCity('');
      setNewState('');
    },
    onError: () => {
      notify('Failed to create community', 'error');
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communities.filter((c) => {
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.city} ${c.state} ${c.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [communities, typeFilter, statusFilter, search]);

  const handleToggle = (community: AdminCommunity) => {
    const nextStatus: CommunityStatusValue =
      community.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const reason =
      nextStatus === 'ACTIVE'
        ? `Activated ${community.city} community feed`
        : `Deactivated ${community.city} community feed`;
    toggleMutation.mutate({
      communityId: community.id,
      status: nextStatus,
      reason,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCity.trim() || !newState.trim()) {
      notify('All fields are required to launch a community.', 'warning');
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      city: newCity.trim(),
      state: newState.trim(),
      type: newType,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="India Cities & Communities"
        description="Activate or deactivate city, neighborhood, and campus communities across India."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Add Community
          </button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search city, neighborhood, or state..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Types</option>
          {Object.values(CommunityType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="PENDING">PENDING</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-panel border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Loading communities...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No communities found"
          description="Try clearing filters or add a new India city or neighborhood community."
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card/70 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Community</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">City / State</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">24h Posts</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((community) => (
                  <tr
                    key={community.id}
                    className="transition-colors hover:bg-card/50"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-text-primary">
                        {community.name}
                      </p>
                      <p className="font-mono text-[11px] text-text-muted">
                        /{community.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-text-secondary">
                        {community.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      {community.city}, {community.state}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-text-primary">
                      {community.memberCount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      {community.postCount24h.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={community.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={toggleMutation.isPending}
                        onClick={() => handleToggle(community)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          community.status === 'ACTIVE'
                            ? 'border-red-500/35 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                            : 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {community.status === 'ACTIVE'
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Community Drawer */}
      <SlideOverDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Launch New Community"
        subtitle="Add an Indian city, neighborhood, or campus feed."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Community Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Chandigarh or Indiranagar"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Community Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as CommunityType)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              {Object.values(CommunityType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              City
            </label>
            <input
              type="text"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="e.g., Chandigarh"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              State / Union Territory
            </label>
            <input
              type="text"
              value={newState}
              onChange={(e) => setNewState(e.target.value)}
              placeholder="e.g., Punjab / Chandigarh"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-accent-hover disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating...' : 'Activate Community'}
            </button>
          </div>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
