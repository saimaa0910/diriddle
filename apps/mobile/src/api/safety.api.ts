import { PaginatedResponse, ReportReason } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_BLOCKED, DEMO_REPORTS } from './demo-data';
import { BlockedAccountItem, MyReportItem } from '../types/models';

let localBlocked: BlockedAccountItem[] = [...DEMO_BLOCKED];
let localReports: MyReportItem[] = [...DEMO_REPORTS];

export const safetyApi = {
  async createReport(input: {
    target_type: 'POST' | 'COMMENT';
    target_id: string;
    reason: ReportReason;
    description?: string;
  }): Promise<{ id: string; status: string }> {
    const createDemo = () => {
      const item: MyReportItem = {
        id: `rep-${Date.now()}`,
        target_type: input.target_type,
        reason: input.reason,
        status: 'RECEIVED',
        created_at: new Date().toISOString(),
      };
      localReports = [item, ...localReports];
      return { id: item.id, status: item.status };
    };

    if (isDemoSession()) return createDemo();

    try {
      const res = await apiClient.post('/reports', input);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemo();
      throw error;
    }
  },

  async getMyReports(): Promise<PaginatedResponse<MyReportItem>> {
    const getDemo = () => ({ data: localReports, next_cursor: null, has_more: false });
    if (isDemoSession()) return getDemo();
    try {
      const res = await apiClient.get('/reports/me');
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async blockUser(userId: string, displayLabel = 'Anonymous user'): Promise<{ blocked: boolean }> {
    const addDemo = () => {
      if (!localBlocked.some((b) => b.blocked_id === userId)) {
        localBlocked = [
          { blocked_id: userId, display_label: displayLabel, created_at: new Date().toISOString() },
          ...localBlocked,
        ];
      }
      return { blocked: true };
    };

    if (isDemoSession()) return addDemo();

    try {
      const res = await apiClient.post('/blocks', { user_id: userId });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return addDemo();
      throw error;
    }
  },

  async unblockUser(userId: string): Promise<{ blocked: boolean }> {
    const removeDemo = () => {
      localBlocked = localBlocked.filter((b) => b.blocked_id !== userId);
      return { blocked: false };
    };

    if (isDemoSession()) return removeDemo();

    try {
      const res = await apiClient.delete(`/blocks/${userId}`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return removeDemo();
      throw error;
    }
  },

  async getBlockedAccounts(): Promise<PaginatedResponse<BlockedAccountItem>> {
    const getDemo = () => ({ data: localBlocked, next_cursor: null, has_more: false });
    if (isDemoSession()) return getDemo();
    try {
      const res = await apiClient.get('/safety/blocked');
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },
};

