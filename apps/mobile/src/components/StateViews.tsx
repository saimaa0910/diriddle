import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../design-system/tokens';

export function PostSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonCircle} />
        <View style={styles.skeletonLineShort} />
      </View>
      <View style={styles.skeletonLineFull} />
      <View style={styles.skeletonLineMed} />
    </View>
  );
}

export function EmptyState({
  icon = 'chatbubbles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={36} color={colors.accent} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  skeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  skeletonLineShort: {
    width: 120,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonLineFull: {
    width: '100%',
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonLineMed: {
    width: '72%',
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.background,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  retryText: {
    ...typography.caption,
    color: colors.accent,
  },
});
