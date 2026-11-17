import { PaginatedResponse } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_NOTIFICATIONS } from './demo-data';
import { NotificationItem } from '../types/models';

let localNotifications: NotificationItem[] = [...DEMO_NOTIFICATIONS];

export const notificationsApi = {
  async list(): Promise<PaginatedResponse<NotificationItem>> {
    const getDemo = () => ({ data: localNotifications, next_cursor: null, has_more: false });
    if (isDemoSession()) return getDemo();

    try {
      const res = await apiClient.get<PaginatedResponse<NotificationItem>>('/notifications');
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async markRead(notificationId: string): Promise<void> {
    const markDemo = () => {
      const nowIso = new Date().toISOString();
      localNotifications = localNotifications.map((n) =>
        n.id === notificationId ? { ...n, read_at: nowIso } : n
      );
    };

    if (isDemoSession()) {
      markDemo();
      return;
    }

    try {
      await apiClient.post(`/notifications/${notificationId}/read`);
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        markDemo();
        return;
      }
      throw error;
    }
  },

  async markAllRead(): Promise<void> {
    const markAllDemo = () => {
      const nowIso = new Date().toISOString();
      localNotifications = localNotifications.map((n) => ({ ...n, read_at: n.read_at ?? nowIso }));
    };

    if (isDemoSession()) {
      markAllDemo();
      return;
    }

    try {
      await apiClient.post('/notifications/read-all');
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        markAllDemo();
        return;
      }
      throw error;
    }
  },
};

