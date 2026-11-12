import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../src/api/users.api';
import { PostCard } from '../../src/components/PostCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { useLocationStore } from '../../src/store/location-store';

export default function ProfileScreen() {
  const router = useRouter();
  const selectedCity = useLocationStore((s) => s.selectedCity);
  const [tab, setTab] = useState<'identities' | 'posts' | 'saved'>('identities');

  const { data: identities = [] } = useQuery({
    queryKey: ['my-identities'],
    queryFn: () => usersApi.getIdentities(),
  });

  const { data: myPosts = [] } = useQuery({
    queryKey: ['my-posts'],
    queryFn: () => usersApi.getMyPosts(),
  });

  const { data: savedPosts = [] } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: () => usersApi.getSavedPosts(),
  });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Your Anonymous Space</Text>
            <Text style={styles.subtitle}>Active City: {selectedCity ?? 'Bengaluru'}</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings/safety')}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
          <Text style={styles.privacyText}>
            Each community assigns you an isolated anonymous handle. Posts in one community cannot be linked to another.
          </Text>
        </View>

        <View style={styles.tabBar}>
          {[
            { key: 'identities' as const, label: `Identities (${identities.length})` },
            { key: 'posts' as const, label: `My Posts (${myPosts.length})` },
            { key: 'saved' as const, label: `Saved (${savedPosts.length})` },
          ].map((item) => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setTab(item.key)}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'identities' && (
          <View>
            {identities.map((idItem) => (
              <View key={idItem.id} style={styles.identityRow}>
                <View style={styles.identityAvatar}>
                  <Ionicons name="person-outline" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.identityCode}>{idItem.display_code}</Text>
                  <Text style={styles.identityComm}>Community: {idItem.community_name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/community/${idItem.community_id}`)}
                  style={styles.visitBtn}
                >
                  <Text style={styles.visitText}>View</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === 'posts' && (
          <View>
            {myPosts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                message="Your anonymous posts will appear here."
                actionLabel="Create Post"
                onAction={() => router.push('/(tabs)/create')}
              />
            ) : (
              myPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => router.push(`/post/${post.id}`)}
                  onReact={() => undefined}
                  onSave={() => undefined}
                  onReport={() => undefined}
                />
              ))
            )}
          </View>
        )}

        {tab === 'saved' && (
          <View>
            {savedPosts.length === 0 ? (
              <EmptyState
                icon="bookmark-outline"
                title="No saved posts"
                message="Tap the bookmark icon on any post to revisit it later."
              />
            ) : (
              savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => router.push(`/post/${post.id}`)}
                  onReact={() => undefined}
                  onSave={() => undefined}
                  onReport={() => undefined}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
    marginBottom: spacing.md,
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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  identityAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCode: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  identityComm: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  visitBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  visitText: {
    ...typography.caption,
    color: colors.accent,
  },
});
