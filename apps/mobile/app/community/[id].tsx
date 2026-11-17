import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactionType, ReportReason } from '@diriddle/shared-types';
import { communitiesApi } from '../../src/api/communities.api';
import { postsApi } from '../../src/api/posts.api';
import { safetyApi } from '../../src/api/safety.api';
import { PostCard } from '../../src/components/PostCard';
import { ReportModal } from '../../src/components/ReportModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner, PostSkeleton } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { PostItem } from '../../src/types/models';

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const { data: community, error: commError } = useQuery({
    queryKey: ['community', id],
    queryFn: () => communitiesApi.getById(id),
    enabled: Boolean(id),
  });

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['community-feed', id],
    queryFn: () => communitiesApi.getFeed(id),
    enabled: Boolean(id),
  });

  const joinMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (community?.is_joined) {
        await communitiesApi.leave(id);
      } else {
        await communitiesApi.join(id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', id] });
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ post, reaction }: { post: PostItem; reaction: ReactionType }) =>
      postsApi.toggleReaction(post.id, reaction, post.my_reaction),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community-feed', id] }),
  });

  const saveMutation = useMutation({
    mutationFn: (post: PostItem) => postsApi.toggleSave(post.id, Boolean(post.is_saved)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community-feed', id] }),
  });

  const voteMutation = useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) =>
      postsApi.votePoll(postId, optionId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community-feed', id] }),
  });

  const handleReportSubmit = async (reason: ReportReason, description: string) => {
    if (!reportPostId) return;
    await safetyApi.createReport({
      target_type: 'POST',
      target_id: reportPostId,
      reason,
      description,
    });
  };

  const posts = feedData?.data ?? [];

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Community</Text>
        </TouchableOpacity>
      </View>

      {commError && (
        <View style={{ padding: spacing.md }}>
          <ErrorBanner message={userMessageForCode(commError)} />
        </View>
      )}

      {community && (
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.commTitle}>{community.name}</Text>
            <Text style={styles.commMeta}>
              {community.type} • {community.city ?? 'India'} •{' '}
              {(community.member_count ?? 1000).toLocaleString('en-IN')} members
            </Text>
            {community.description && (
              <Text style={styles.commDesc}>{community.description}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, community.is_joined && styles.joinedBtn]}
            onPress={() => joinMutation.mutate()}
          >
            <Text style={[styles.joinText, community.is_joined && styles.joinedText]}>
              {community.is_joined ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: spacing.md }}>
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            <EmptyState
              title="No posts here yet"
              message="Be the first to share something anonymously in this community."
              actionLabel="Create Post"
              onAction={() => router.push('/(tabs)/create')}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => router.push(`/post/${item.id}`)}
              onReact={(reaction) => reactMutation.mutate({ post: item, reaction })}
              onSave={() => saveMutation.mutate(item)}
              onReport={() => setReportPostId(item.id)}
              onVotePoll={(postId, optionId) => voteMutation.mutate({ postId, optionId })}
            />
          )}
        />
      )}

      <ReportModal
        visible={Boolean(reportPostId)}
        onClose={() => setReportPostId(null)}
        onSubmit={handleReportSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
  },
  commTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  commMeta: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  commDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 6,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinedBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  joinedText: {
    color: colors.textSecondary,
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
});
