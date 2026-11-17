import { PostCategory, ReactionType, Visibility } from '@diriddle/shared-types';
import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { DEMO_COMMUNITIES } from './demo-data';
import {
  getLocalDemoPosts,
  prependLocalDemoPost,
  removeLocalDemoPost,
  updateLocalDemoPost,
} from './feed.api';
import { PostItem } from '../types/models';

export interface CreatePostInput {
  community_id: string;
  category: PostCategory;
  content: string;
  visibility: Visibility;
  comments_enabled: boolean;
  poll?: {
    question: string;
    options: string[];
    closes_in_hours?: number;
  };
  attachment_ids?: string[];
  attachment_url?: string;
}

export const postsApi = {
  async create(input: CreatePostInput): Promise<PostItem> {
    const createDemo = (): PostItem => {
      const community = DEMO_COMMUNITIES.find((c) => c.id === input.community_id);
      const newPost: PostItem = {
        id: `post-${Date.now()}`,
        anonymous_name: 'Anonymous #0317',
        author_user_id: 'demo-user',
        category: input.category,
        content: input.content.trim(),
        status: 'PUBLISHED',
        community_id: input.community_id,
        community_name: community?.name ?? 'Bengaluru',
        city: community?.city ?? 'Bengaluru',
        comment_count: 0,
        reaction_count: 0,
        reaction_counts: {},
        my_reaction: null,
        is_saved: false,
        comments_enabled: input.comments_enabled,
        visibility: input.visibility,
        attachments: input.attachment_url || (input.attachment_ids && input.attachment_ids.length > 0)
          ? [
              {
                id: input.attachment_ids?.[0] ?? `att-${Date.now()}`,
                url: input.attachment_url || 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=800&q=80',
                mime_type: 'image/jpeg',
              },
            ]
          : undefined,
        poll: input.poll
          ? {
              id: `poll-${Date.now()}`,
              question: input.poll.question,
              options: input.poll.options.map((optText, i) => ({
                id: `opt-${i}`,
                option_text: optText,
                votes: 0,
              })),
              total_votes: 0,
            }
          : null,
        created_at: new Date().toISOString(),
      };
      prependLocalDemoPost(newPost);
      return newPost;
    };

    if (isDemoSession()) return createDemo();

    try {
      const res = await apiClient.post<PostItem>('/posts', input);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return createDemo();
      }
      throw error;
    }
  },

  async getById(postId: string): Promise<PostItem> {
    const findDemo = (): PostItem => {
      const post = getLocalDemoPosts().find((p) => p.id === postId);
      if (!post) {
        throw { response: { status: 404, data: { error: 'POST_NOT_FOUND' } } };
      }
      return post;
    };

    if (isDemoSession()) return findDemo();

    try {
      const res = await apiClient.get<PostItem>(`/posts/${postId}`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return findDemo();
      throw error;
    }
  },

  async remove(postId: string): Promise<void> {
    if (isDemoSession()) {
      removeLocalDemoPost(postId);
      return;
    }
    try {
      await apiClient.delete(`/posts/${postId}`);
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        removeLocalDemoPost(postId);
        return;
      }
      throw error;
    }
  },

  async toggleReaction(
    postId: string,
    reactionType: ReactionType,
    currentlySelected: ReactionType | null | undefined
  ): Promise<{ my_reaction: ReactionType | null; reaction_counts: Partial<Record<ReactionType, number>> }> {
    const applyDemo = () => {
      let updatedCounts: Partial<Record<ReactionType, number>> = {};
      let nextReaction: ReactionType | null = reactionType;

      updateLocalDemoPost(postId, (p) => {
        const counts = { ...(p.reaction_counts ?? {}) };
        if (p.my_reaction) {
          counts[p.my_reaction] = Math.max(0, (counts[p.my_reaction] ?? 1) - 1);
        }
        if (p.my_reaction === reactionType) {
          nextReaction = null;
        } else {
          counts[reactionType] = (counts[reactionType] ?? 0) + 1;
        }
        const total = Object.values(counts).reduce((sum, v) => sum + (v ?? 0), 0);
        updatedCounts = counts;
        return {
          ...p,
          my_reaction: nextReaction,
          reaction_counts: counts,
          reaction_count: total,
        };
      });

      return { my_reaction: nextReaction, reaction_counts: updatedCounts };
    };

    if (isDemoSession()) return applyDemo();

    try {
      if (currentlySelected === reactionType) {
        const res = await apiClient.delete(`/posts/${postId}/reactions`);
        return { my_reaction: null, reaction_counts: res.data?.reaction_counts ?? {} };
      }
      const res = await apiClient.post(`/posts/${postId}/reactions`, {
        reaction_type: reactionType,
      });
      return { my_reaction: reactionType, reaction_counts: res.data?.reaction_counts ?? {} };
    } catch (error) {
      if (shouldUseDemoFallback(error)) return applyDemo();
      throw error;
    }
  },

  async toggleSave(postId: string, currentlySaved: boolean): Promise<{ saved: boolean }> {
    const applyDemo = () => {
      const next = !currentlySaved;
      updateLocalDemoPost(postId, (p) => ({ ...p, is_saved: next }));
      return { saved: next };
    };

    if (isDemoSession()) return applyDemo();

    try {
      if (currentlySaved) {
        await apiClient.delete(`/posts/${postId}/save`);
        return { saved: false };
      }
      await apiClient.post(`/posts/${postId}/save`);
      return { saved: true };
    } catch (error) {
      if (shouldUseDemoFallback(error)) return applyDemo();
      throw error;
    }
  },

  async votePoll(postId: string, optionId: string): Promise<any> {
    const applyDemo = () => {
      let updatedPoll: any = null;
      updateLocalDemoPost(postId, (p) => {
        if (!p.poll) return p;
        const options = p.poll.options.map((opt) => {
          const isSelected = opt.id === optionId;
          const prevVotes = opt.votes ?? opt.voteCount ?? 0;
          return {
            ...opt,
            votes: isSelected ? prevVotes + 1 : prevVotes,
            voteCount: isSelected ? prevVotes + 1 : prevVotes,
          };
        });
        const total = options.reduce((sum, o) => sum + (o.votes ?? o.voteCount ?? 0), 0);
        updatedPoll = {
          ...p.poll,
          options,
          total_votes: total,
          user_voted_option_id: optionId,
        };
        return { ...p, poll: updatedPoll };
      });
      return updatedPoll ?? { poll_id: postId, user_option_id: optionId };
    };

    if (isDemoSession()) return applyDemo();

    try {
      const res = await apiClient.post(`/posts/${postId}/poll/vote`, {
        option_id: optionId,
      });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return applyDemo();
      throw error;
    }
  },
};

