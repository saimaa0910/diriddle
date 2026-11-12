import { PaginatedResponse } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_COMMUNITIES } from './demo-data';
import { getLocalDemoPosts } from './feed.api';
import { CommunityItem, PostItem } from '../types/models';

let localCommunities: CommunityItem[] = [...DEMO_COMMUNITIES];

export const communitiesApi = {
  async list(city?: string): Promise<PaginatedResponse<CommunityItem>> {
    const getDemo = (): PaginatedResponse<CommunityItem> => {
      const filtered = city
        ? localCommunities.filter((c) => c.city?.toLowerCase() === city.toLowerCase())
        : localCommunities;
      return { data: filtered, next_cursor: null, has_more: false };
    };

    if (isDemoSession()) return getDemo();

    try {
      const res = await apiClient.get<PaginatedResponse<CommunityItem>>('/communities', {
        params: city ? { city } : undefined,
      });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async getById(communityId: string): Promise<CommunityItem> {
    const getDemo = (): CommunityItem => {
      const found = localCommunities.find((c) => c.id === communityId);
      if (!found) {
        throw { response: { status: 404, data: { error: 'COMMUNITY_NOT_FOUND' } } };
      }
      return found;
    };

    if (isDemoSession()) return getDemo();

    try {
      const res = await apiClient.get<CommunityItem>(`/communities/${communityId}`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async join(communityId: string): Promise<{ status: string }> {
    const toggleDemo = () => {
      localCommunities = localCommunities.map((c) =>
        c.id === communityId
          ? { ...c, is_joined: true, member_count: (c.member_count ?? 0) + (c.is_joined ? 0 : 1) }
          : c
      );
      return { status: 'joined' };
    };

    if (isDemoSession()) return toggleDemo();

    try {
      const res = await apiClient.post(`/communities/${communityId}/join`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return toggleDemo();
      throw error;
    }
  },

  async leave(communityId: string): Promise<void> {
    const toggleDemo = () => {
      localCommunities = localCommunities.map((c) =>
        c.id === communityId
          ? { ...c, is_joined: false, member_count: Math.max(0, (c.member_count ?? 1) - 1) }
          : c
      );
    };

    if (isDemoSession()) {
      toggleDemo();
      return;
    }

    try {
      await apiClient.delete(`/communities/${communityId}/join`);
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        toggleDemo();
        return;
      }
      throw error;
    }
  },

  async getFeed(communityId: string): Promise<PaginatedResponse<PostItem>> {
    const getDemo = (): PaginatedResponse<PostItem> => ({
      data: getLocalDemoPosts().filter((p) => p.community_id === communityId),
      next_cursor: null,
      has_more: false,
    });

    if (isDemoSession()) return getDemo();

    try {
      const res = await apiClient.get<PaginatedResponse<PostItem>>(`/communities/${communityId}/feed`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },
};
