import { PaginatedResponse, PostCategory } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_POSTS } from './demo-data';
import { PostItem } from '../types/models';

export type FeedTab = 'latest' | 'trending' | 'nearby';

export interface FeedParams {
  tab?: FeedTab;
  communityId?: string;
  city?: string;
  category?: PostCategory | 'ALL';
  cursor?: string;
  limit?: number;
}

let localDemoPosts: PostItem[] = [...DEMO_POSTS];

export function getLocalDemoPosts(): PostItem[] {
  return localDemoPosts;
}

export function prependLocalDemoPost(post: PostItem): void {
  localDemoPosts = [post, ...localDemoPosts];
}

export function updateLocalDemoPost(postId: string, updater: (post: PostItem) => PostItem): void {
  localDemoPosts = localDemoPosts.map((p) => (p.id === postId ? updater(p) : p));
}

export function removeLocalDemoPost(postId: string): void {
  localDemoPosts = localDemoPosts.filter((p) => p.id !== postId);
}

function filterDemoFeed(params: FeedParams): PaginatedResponse<PostItem> {
  let items = [...localDemoPosts];
  if (params.communityId) {
    items = items.filter((p) => p.community_id === params.communityId);
  } else if (params.city) {
    const cityMatches = items.filter(
      (p) => p.city?.toLowerCase() === params.city?.toLowerCase()
    );
    if (cityMatches.length > 0) items = cityMatches;
  }

  if (params.category && params.category !== 'ALL') {
    items = items.filter((p) => p.category === params.category);
  }

  if (params.tab === 'trending') {
    items.sort((a, b) => b.reaction_count + b.comment_count - (a.reaction_count + a.comment_count));
  } else {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return {
    data: items.slice(0, params.limit ?? 20),
    next_cursor: null,
    has_more: false,
  };
}

export const feedApi = {
  async getFeed(params: FeedParams): Promise<PaginatedResponse<PostItem>> {
    if (isDemoSession()) {
      return filterDemoFeed(params);
    }

    const endpoint =
      params.tab === 'trending'
        ? '/feed/trending'
        : params.tab === 'nearby'
        ? '/feed/nearby'
        : '/feed/latest';

    try {
      const res = await apiClient.get<PaginatedResponse<PostItem>>(endpoint, {
        params: {
          community_id: params.communityId,
          category: params.category && params.category !== 'ALL' ? params.category : undefined,
          cursor: params.cursor,
          limit: params.limit ?? 20,
        },
      });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return filterDemoFeed(params);
      }
      throw error;
    }
  },
};

