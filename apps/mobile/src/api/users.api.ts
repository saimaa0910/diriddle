import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_IDENTITIES } from './demo-data';
import { getLocalDemoPosts } from './feed.api';
import { AnonymousIdentityItem, PostItem } from '../types/models';

export const usersApi = {
  async getIdentities(): Promise<AnonymousIdentityItem[]> {
    if (isDemoSession()) return DEMO_IDENTITIES;
    try {
      const res = await apiClient.get<{ data?: AnonymousIdentityItem[] } | AnonymousIdentityItem[]>(
        '/users/me/identities'
      );
      return Array.isArray(res.data) ? res.data : res.data?.data ?? DEMO_IDENTITIES;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return DEMO_IDENTITIES;
      throw error;
    }
  },

  async getMyPosts(): Promise<PostItem[]> {
    const getDemo = () => getLocalDemoPosts().filter((p) => p.author_user_id === 'demo-user');
    if (isDemoSession()) return getDemo();
    try {
      const res = await apiClient.get<{ data?: PostItem[] }>('/users/me/posts');
      return res.data?.data ?? getDemo();
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async getSavedPosts(): Promise<PostItem[]> {
    const getDemo = () => getLocalDemoPosts().filter((p) => p.is_saved);
    if (isDemoSession()) return getDemo();
    try {
      const res = await apiClient.get<{ data?: PostItem[] }>('/users/me/saved');
      return res.data?.data ?? getDemo();
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async deleteAccount(): Promise<{ deleted: boolean }> {
    if (isDemoSession()) return { deleted: true };
    try {
      await apiClient.delete('/users/me');
      return { deleted: true };
    } catch (error) {
      if (shouldUseDemoFallback(error)) return { deleted: true };
      throw error;
    }
  },
};

