import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactionType, ReportReason } from '@diriddle/shared-types';
import { commentsApi } from '../../src/api/comments.api';
import { postsApi } from '../../src/api/posts.api';
import { safetyApi } from '../../src/api/safety.api';
import { ReportModal } from '../../src/components/ReportModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner, PostSkeleton } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { REACTION_OPTIONS } from '../../src/types/models';
import { formatRelativeTime } from '../../src/utils/time';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'POST' | 'COMMENT'; id: string } | null>(
    null
  );
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    data: post,
    isLoading: postLoading,
    error: postError,
  } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsApi.getById(id),
    enabled: Boolean(id),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => commentsApi.list(id),
    enabled: Boolean(id),
  });

  const reactMutation = useMutation({
    mutationFn: (reaction: ReactionType) => {
      if (!post) return Promise.resolve(null);
      return postsApi.toggleReaction(post.id, reaction, post.my_reaction);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['post', id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) return;
      if (replyTo) {
        return commentsApi.reply(id, replyTo.id, commentText.trim());
      }
      return commentsApi.create(id, commentText.trim());
    },
    onSuccess: () => {
      setCommentText('');
      setReplyTo(null);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['comments', id] });
      void queryClient.invalidateQueries({ queryKey: ['post', id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err) => {
      setErrorMsg(userMessageForCode(err));
    },
  });

  const handleBlockAuthor = async () => {
    if (!post?.author_user_id) return;
    try {
      await safetyApi.blockUser(post.author_user_id, post.anonymous_name);
      setActionMsg(`Blocked ${post.anonymous_name}. Their posts will be hidden.`);
    } catch (err) {
      setErrorMsg(userMessageForCode(err));
    }
  };

  const handleReportSubmit = async (reason: ReportReason, description: string) => {
    if (!reportTarget) return;
    await safetyApi.createReport({
      target_type: reportTarget.type,
      target_id: reportTarget.id,
      reason,
      description,
    });
    setActionMsg('Report submitted to our safety team.');
  };

  const comments = commentsData?.data ?? [];

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Thread</Text>
        </TouchableOpacity>
        {post && (
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.smallAction}
              onPress={() => setReportTarget({ type: 'POST', id: post.id })}
            >
              <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.smallActionText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={handleBlockAuthor}>
              <Ionicons name="ban-outline" size={16} color={colors.danger} />
              <Text style={[styles.smallActionText, { color: colors.danger }]}>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {actionMsg && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{actionMsg}</Text>
          </View>
        )}

        {errorMsg && <ErrorBanner message={errorMsg} />}
        {postError && <ErrorBanner message={userMessageForCode(postError)} />}

        {postLoading ? (
          <PostSkeleton />
        ) : post ? (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.anonName}>{post.anonymous_name}</Text>
              <Text style={styles.postTime}>
                {post.community_name ?? 'Community'} • {formatRelativeTime(post.created_at)}
              </Text>
            </View>
            <Text style={styles.postContent}>{post.content}</Text>

            <View style={styles.reactionRow}>
              {REACTION_OPTIONS.map((opt) => {
                const selected = post.my_reaction === opt.type;
                const count = post.reaction_counts?.[opt.type] ?? 0;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[styles.reactionPill, selected && styles.reactionPillActive]}
                    onPress={() => reactMutation.mutate(opt.type)}
                  >
                    <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                    {count > 0 && (
                      <Text style={[styles.reactionCount, selected && { color: colors.accent }]}>
                        {count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>

        {comments.length === 0 ? (
          <EmptyState
            icon="chatbubble-outline"
            title="No comments yet"
            message="Start the anonymous discussion below."
          />
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHead}>
                <Text style={styles.commentAuthor}>{comment.anonymous_name}</Text>
                <Text style={styles.commentTime}>{formatRelativeTime(comment.created_at)}</Text>
              </View>
              <Text style={styles.commentBody}>{comment.content}</Text>

              <View style={styles.commentActions}>
                <TouchableOpacity
                  onPress={() => setReplyTo({ id: comment.id, author: comment.anonymous_name })}
                >
                  <Text style={styles.replyLink}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setReportTarget({ type: 'COMMENT', id: comment.id })}
                >
                  <Text style={styles.reportLink}>Report</Text>
                </TouchableOpacity>
              </View>

              {comment.replies.map((reply) => (
                <View key={reply.id} style={styles.replyCard}>
                  <View style={styles.commentHead}>
                    <Text style={styles.commentAuthor}>{reply.anonymous_name}</Text>
                    <Text style={styles.commentTime}>{formatRelativeTime(reply.created_at)}</Text>
                  </View>
                  <Text style={styles.commentBody}>{reply.content}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {post?.comments_enabled !== false && (
        <View style={styles.composerWrap}>
          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to {replyTo.author}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder={replyTo ? 'Write a reply...' : 'Add an anonymous comment...'}
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || commentMutation.isPending) && { opacity: 0.5 }]}
              onPress={() => commentMutation.mutate()}
              disabled={!commentText.trim() || commentMutation.isPending}
            >
              <Ionicons name="send" size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ReportModal
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallAction: {
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
  smallActionText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  infoBanner: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  postHeader: {
    marginBottom: spacing.xs,
  },
  anonName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  postTime: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  postContent: {
    ...typography.body,
    color: colors.textPrimary,
    marginVertical: spacing.sm,
    fontSize: 16,
    lineHeight: 24,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
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
    paddingVertical: 6,
  },
  reactionPillActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  reactionCount: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  commentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  commentTime: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '400',
  },
  commentBody: {
    ...typography.body,
    color: colors.textPrimary,
  },
  commentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  replyLink: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  reportLink: {
    ...typography.micro,
    color: colors.textMuted,
  },
  replyCard: {
    marginTop: spacing.xs,
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accentBorder,
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
  },
  replyBannerText: {
    ...typography.micro,
    color: colors.accent,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

