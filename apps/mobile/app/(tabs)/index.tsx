import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PostCategory, ReactionType, ReportReason } from '@diriddle/shared-types';
import { feedApi, FeedTab } from '../../src/api/feed.api';
import { postsApi } from '../../src/api/posts.api';
import { safetyApi } from '../../src/api/safety.api';
import { CategoryChips } from '../../src/components/CategoryChips';
import { PostCard } from '../../src/components/PostCard';
import { ReportModal } from '../../src/components/ReportModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner, PostSkeleton } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useAuthStore } from '../../src/store/auth-store';
import { getActiveCityFallback, useLocationStore } from '../../src/store/location-store';
import { PostItem } from '../../src/types/models';
import { connectCommunitySocket } from '../../src/utils/realtime';

const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'trending', label: 'Trending' },
  { key: 'nearby', label: 'Nearby' },
];

export default function HomeFeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { selectedCity, selectedCommunityId } = useLocationStore();
  const activeCity = getActiveCityFallback(selectedCity);

  const [tab, setTab] = useState<FeedTab>('latest');
  const [category, setCategory] = useState<PostCategory | 'ALL'>('ALL');
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const feedQueryKey = ['feed', tab, activeCity.name, category];

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: feedQueryKey,
    queryFn: () =>
      feedApi.getFeed({
        tab,
        city: activeCity.name,
        category,
      }),
  });

  useEffect(() => {
    const communityId = selectedCommunityId ?? activeCity.communityId;
    const socket = connectCommunitySocket(accessToken, communityId);
    if (!socket) return;
    const onNewPost = () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    };
    socket.on('post:created', onNewPost);
    return () => {
      socket.off('post:created', onNewPost);
    };
  }, [accessToken, selectedCommunityId, activeCity.communityId, queryClient]);

  const reactMutation = useMutation({
    mutationFn: ({ post, reaction }: { post: PostItem; reaction: ReactionType }) =>
      postsApi.toggleReaction(post.id, reaction, post.my_reaction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (post: PostItem) => postsApi.toggleSave(post.id, Boolean(post.is_saved)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    },
  });

  const handleReportSubmit = async (reason: ReportReason, description: string) => {
    if (!reportTargetId) return;
    await safetyApi.createReport({
      target_type: 'POST',
      target_id: reportTargetId,
      reason,
      description,
    });
    setFeedbackBanner('Report received. Thank you for helping keep your community safe.');
    setTimeout(() => setFeedbackBanner(null), 3500);
  };

  const posts = data?.data ?? [];

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>diriddle</Text>
          <TouchableOpacity
            style={styles.cityPicker}
            onPress={() => router.push('/(auth)/location-setup')}
          >
            <Ionicons name="location" size={15} color={colors.accent} />
            <Text style={styles.cityText}>{activeCity.name}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          accessibilityLabel="Open settings"
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {FEED_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>

      {feedbackBanner && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{feedbackBanner}</Text>
        </View>
      )}

      {error && (
        <View style={styles.listPad}>
          <ErrorBanner message={userMessageForCode(error)} onRetry={() => void refetch()} />
        </View>
      )}

      {isLoading ? (
        <View style={styles.listPad}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={`Quiet in ${activeCity.name}`}
              message="No anonymous posts match this filter yet. Start the conversation!"
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
              onReport={() => setReportTargetId(item.id)}
            />
          )}
        />
      )}

      <ReportModal
        visible={Boolean(reportTargetId)}
        onClose={() => setReportTargetId(null)}
        onSubmit={handleReportSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  brand: {
    ...typography.micro,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  cityText: {
    ...typography.title,
    color: colors.textPrimary,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.card,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  feedbackBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  feedbackText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
