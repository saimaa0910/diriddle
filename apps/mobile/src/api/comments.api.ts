import { PaginatedResponse } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_COMMENTS } from './demo-data';
import { updateLocalDemoPost } from './feed.api';
import { CommentItem, CommentReply } from '../types/models';

const localComments: Record<string, CommentItem[]> = JSON.parse(JSON.stringify(DEMO_COMMENTS));

export const commentsApi = {
  async list(postId: string): Promise<PaginatedResponse<CommentItem>> {
    const getDemo = (): PaginatedResponse<CommentItem> => ({
      data: localComments[postId] ?? [],
      next_cursor: null,
      has_more: false,
    });

    if (isDemoSession()) return getDemo();

    try {
      const res = await apiClient.get<PaginatedResponse<CommentItem>>(`/posts/${postId}/comments`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemo();
      throw error;
    }
  },

  async create(postId: string, content: string): Promise<CommentItem> {
    const createDemo = (): CommentItem => {
      const item: CommentItem = {
        id: `c-${Date.now()}`,
        anonymous_name: 'Anonymous #0317',
        content: content.trim(),
        created_at: new Date().toISOString(),
        replies: [],
      };
      localComments[postId] = [...(localComments[postId] ?? []), item];
      updateLocalDemoPost(postId, (p) => ({ ...p, comment_count: p.comment_count + 1 }));
      return item;
    };

    if (isDemoSession()) return createDemo();

    try {
      const res = await apiClient.post<CommentItem>(`/posts/${postId}/comments`, { content });
      return { ...res.data, replies: res.data.replies ?? [] };
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemo();
      throw error;
    }
  },

  async reply(postId: string, commentId: string, content: string): Promise<CommentReply> {
    const createDemoReply = (): CommentReply => {
      const reply: CommentReply = {
        id: `r-${Date.now()}`,
        anonymous_name: 'Anonymous #0317',
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      const list = localComments[postId] ?? [];
      localComments[postId] = list.map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
      );
      updateLocalDemoPost(postId, (p) => ({ ...p, comment_count: p.comment_count + 1 }));
      return reply;
    };

    if (isDemoSession()) return createDemoReply();

    try {
      const res = await apiClient.post<CommentReply>(`/comments/${commentId}/replies`, { content });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoReply();
      throw error;
    }
  },
};

