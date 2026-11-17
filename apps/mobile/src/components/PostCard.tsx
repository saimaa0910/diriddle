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
  onVotePoll?: (postId: string, optionId: string) => void;
}

export function PostCard({ post, onPress, onReact, onSave, onReport, onVotePoll }: PostCardProps) {
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

      {post.attachments && post.attachments.length > 0 && (
        <View style={styles.attachmentContainer}>
          {post.attachments.map((att) => (
            <View key={att.id} style={styles.attachmentPlaceholder}>
              <Ionicons name="image-outline" size={20} color={colors.accent} />
              <Text style={styles.attachmentText}>Attachment ({att.mime_type ?? 'Image'})</Text>
            </View>
          ))}
        </View>
      )}

      {post.poll && (
        <View style={styles.pollContainer}>
          <View style={styles.pollHeader}>
            <Ionicons name="bar-chart-outline" size={15} color={colors.accent} />
            <Text style={styles.pollQuestion}>{post.poll.question}</Text>
          </View>
          {post.poll.options?.map((option) => {
            const totalVotes =
              post.poll?.total_votes ??
              post.poll?.options?.reduce((sum, o) => sum + (o.votes ?? o.voteCount ?? 0), 0) ??
              0;
            const optVotes = option.votes ?? option.voteCount ?? 0;
            const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const isVoted = post.poll?.user_voted_option_id === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.pollOptionBtn, isVoted && styles.pollOptionBtnVoted]}
                disabled={Boolean(post.poll?.user_voted_option_id)}
                onPress={() => onVotePoll?.(post.id, option.id)}
                accessibilityRole="button"
                accessibilityLabel={`Vote for ${option.option_text ?? option.text}`}
              >
                {totalVotes > 0 && (
                  <View style={[styles.pollBarFill, { width: `${percentage}%` }]} />
                )}
                <View style={styles.pollOptionContent}>
                  <Text style={[styles.pollOptionText, isVoted && styles.pollOptionTextVoted]}>
                    {option.option_text ?? option.text}
                  </Text>
                  {totalVotes > 0 && (
                    <Text style={styles.pollPercentageText}>{percentage}% ({optVotes})</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollFooterText}>
            {post.poll.total_votes ?? 0} total votes
            {post.poll.user_voted_option_id ? ' • You voted' : ' • Tap to vote'}
          </Text>
        </View>
      )}

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
  pollContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pollQuestion: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  pollOptionBtn: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 38,
    justifyContent: 'center',
  },
  pollOptionBtnVoted: {
    borderColor: colors.accent,
  },
  pollBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.accentMuted,
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 1,
  },
  pollOptionText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  pollOptionTextVoted: {
    color: colors.accent,
    fontWeight: '700',
  },
  pollPercentageText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 8,
  },
  pollFooterText: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 2,
  },
  attachmentContainer: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  attachmentPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  attachmentText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

