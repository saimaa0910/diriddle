import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PostCategory, Visibility } from '@diriddle/shared-types';
import { communitiesApi } from '../../src/api/communities.api';
import { postsApi } from '../../src/api/posts.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { getActiveCityFallback, useLocationStore } from '../../src/store/location-store';
import { POST_CATEGORIES } from '../../src/types/models';

const MAX_CHARS = 2000;

export default function CreatePostScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedCity = useLocationStore((s) => s.selectedCity);
  const activeCity = getActiveCityFallback(selectedCity);

  const [category, setCategory] = useState<PostCategory>(PostCategory.CONFESSION);
  const [communityId, setCommunityId] = useState<string>(activeCity.communityId);
  const [content, setContent] = useState('');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>(Visibility.COMMUNITY);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: communitiesData } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const communities = communitiesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      postsApi.create({
        community_id: communityId,
        category,
        content: content.trim(),
        visibility,
        comments_enabled: commentsEnabled,
      }),
    onSuccess: () => {
      setContent('');
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['my-posts'] });
      router.replace('/(tabs)');
    },
    onError: (err) => {
      setErrorMsg(userMessageForCode(err));
    },
  });

  const handlePublish = () => {
    setErrorMsg(null);
    if (!content.trim()) {
      setErrorMsg('Write something before posting.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Post Anonymously</Text>
        <Text style={styles.subtitle}>
          Posting as a community-scoped anonymous identity. Your profile remains completely hidden.
        </Text>

        <View style={styles.guidelineBanner}>
          <Ionicons name="shield-outline" size={18} color={colors.accent} />
          <Text style={styles.guidelineText}>
            Never share real names, phone numbers, addresses, or targeted harassment. Automated PII checks apply.
          </Text>
        </View>

        {errorMsg && <ErrorBanner message={errorMsg} />}

        <Text style={styles.label}>Category (9 available)</Text>
        <View style={styles.catGrid}>
          {POST_CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setCategory(cat.key)}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Community</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={styles.commRow}>
            {communities.map((comm) => {
              const active = communityId === comm.id;
              return (
                <TouchableOpacity
                  key={comm.id}
                  style={[styles.commChip, active && styles.commChipActive]}
                  onPress={() => setCommunityId(comm.id)}
                >
                  <Text style={[styles.commText, active && styles.commTextActive]}>
                    {comm.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.editorHeader}>
          <Text style={styles.label}>Your Message</Text>
          <Text style={styles.counter}>
            {content.length}/{MAX_CHARS}
          </Text>
        </View>
        <TextInput
          style={styles.editor}
          placeholder="What is happening in your city or neighborhood?"
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={MAX_CHARS}
        />

        <View style={styles.optionCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Allow Comments</Text>
            <Text style={styles.optionDesc}>Let others reply to your anonymous thread</Text>
          </View>
          <Switch
            value={commentsEnabled}
            onValueChange={setCommentsEnabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={commentsEnabled ? colors.accent : colors.textSecondary}
          />
        </View>

        <View style={styles.optionCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Visibility</Text>
            <Text style={styles.optionDesc}>
              {visibility === Visibility.COMMUNITY
                ? 'Community members only'
                : 'Visible in broader city discovery'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.visToggle}
            onPress={() =>
              setVisibility(
                visibility === Visibility.COMMUNITY ? Visibility.PUBLIC : Visibility.COMMUNITY
              )
            }
          >
            <Text style={styles.visText}>{visibility}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handlePublish}
          disabled={createMutation.isPending}
        >
          <Text style={styles.publishText}>
            {createMutation.isPending ? 'Publishing...' : 'Publish Anonymously'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
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
    marginBottom: spacing.md,
  },
  guidelineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  guidelineText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '400',
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  catChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  catText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  catTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  commRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  commChip: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  commText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  commTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: {
    ...typography.micro,
    color: colors.textMuted,
  },
  editor: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  optionDesc: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  visToggle: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  visText: {
    ...typography.micro,
    color: colors.accent,
  },
  publishBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  publishText: {
    ...typography.subtitle,
    color: colors.background,
    fontWeight: '700',
  },
});
