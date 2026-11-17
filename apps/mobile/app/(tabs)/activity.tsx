import React, { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationType } from '@diriddle/shared-types';
import { notificationsApi } from '../../src/api/notifications.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useAuthStore } from '../../src/store/auth-store';
import { NotificationItem } from '../../src/types/models';
import { connectCommunitySocket } from '../../src/utils/realtime';
import { formatRelativeTime } from '../../src/utils/time';

function iconForType(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case NotificationType.COMMENT_REPLY:
      return 'chatbubble-ellipses-outline';
    case NotificationType.REACTION:
      return 'heart-outline';
    case NotificationType.COMMUNITY_POST:
      return 'people-outline';
    default:
      return 'shield-checkmark-outline';
  }
}

export default function ActivityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isRefetching, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectCommunitySocket(accessToken, 'global-notifications');
    if (!socket) return;

    const onNotificationNew = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:new', onNotificationNew);
    return () => {
      socket.off('notification:new', onNotificationNew);
    };
  }, [accessToken, queryClient]);

  const handleOpen = (item: NotificationItem) => {
    if (!item.read_at) {
      markReadMutation.mutate(item.id);
    }
    if (item.reference_id) {
      router.push(`/post/${item.reference_id}`);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllMutation.mutate()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner message={userMessageForCode(error)} onRetry={() => void refetch()} />
        </View>
      )}

      <FlatList
        data={notifications}
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
            icon="notifications-off-outline"
            title="No notifications yet"
            message="Replies, reactions, and community updates will appear here."
          />
        }
        renderItem={({ item }) => {
          const unread = !item.read_at;
          return (
            <TouchableOpacity
              style={[styles.card, unread && styles.cardUnread]}
              onPress={() => handleOpen(item)}
            >
              <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
                <Ionicons
                  name={iconForType(item.type)}
                  size={18}
                  color={unread ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardBody}>{item.body}</Text>
                <Text style={styles.cardTime}>{formatRelativeTime(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  markAllBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    ...typography.caption,
    color: colors.accent,
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  cardUnread: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.cardElevated,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.accentMuted,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  cardBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 3,
  },
  cardTime: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '400',
    marginTop: 6,
  },
});

