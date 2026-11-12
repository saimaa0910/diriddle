import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactionType } from '@diriddle/shared-types';
import { colors, radii, spacing, typography } from '../design-system/tokens';
import { POST_CATEGORIES, PostItem, REACTION_OPTIONS } from '../types/models';
import { formatRelativeTime } from '../utils/time';

interface PostCardProps {
  post: PostItem;
  onPress: () => void;
  onReact: (reaction: ReactionType) => void;
  onSave: () => void;
  onReport: () => void;
}

export function PostCard({ post, onPress, onReact, onSave, onReport }: PostCardProps) {
  const categoryMeta = POST_CATEGORIES.find((c) => c.key === post.category);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Post by ${post.anonymous_name}`}
    >
      <View style={styles.header}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={14} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.anonName}>{post.anonymous_name}</Text>
            <Text style={styles.metaText}>
              {post.community_name ?? post.city ?? 'Local'} • {formatRelativeTime(post.created_at)}
            </Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {categoryMeta ? `${categoryMeta.emoji} ${categoryMeta.label}` : post.category}
          </Text>
        </View>
      </View>

      <Text style={styles.content}>{post.content}</Text>

      <View style={styles.reactionRow}>
        {REACTION_OPTIONS.slice(0, 4).map((opt) => {
          const isSelected = post.my_reaction === opt.type;
          const count = post.reaction_counts?.[opt.type] ?? 0;
          return (
            <TouchableOpacity
              key={opt.type}
              onPress={() => onReact(opt.type)}
              style={[styles.reactionPill, isSelected && styles.reactionPillActive]}
              accessibilityRole="button"
              accessibilityLabel={`React ${opt.label}`}
            >
              <Text style={styles.reactionEmoji}>{opt.emoji}</Text>
              {count > 0 && (
                <Text style={[styles.reactionCount, isSelected && styles.reactionCountActive]}>
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={onPress}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.footerText}>{post.comment_count} comments</Text>
        </TouchableOpacity>

        <View style={styles.footerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onSave}
            accessibilityRole="button"
            accessibilityLabel={post.is_saved ? 'Unsave post' : 'Save post'}
          >
            <Ionicons
              name={post.is_saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={post.is_saved ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel="Report post"
          >
            <Ionicons name="flag-outline" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonName: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  metaText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.micro,
    color: colors.accent,
  },
  content: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reactionPillActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  reactionCountActive: {
    color: colors.accent,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    padding: 4,
  },
});
