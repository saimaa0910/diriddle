import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { safetyApi } from '../../src/api/safety.api';
import { usersApi } from '../../src/api/users.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useAuthStore } from '../../src/store/auth-store';
import { useLocationStore } from '../../src/store/location-store';
import { formatRelativeTime } from '../../src/utils/time';

export default function SafetyCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  const clearLocation = useLocationStore((s) => s.clearLocation);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealSuccessMsg, setAppealSuccessMsg] = useState<string | null>(null);

  const { data: blockedData } = useQuery({
    queryKey: ['blocked-accounts'],
    queryFn: () => safetyApi.getBlockedAccounts(),
  });

  const { data: reportsData } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => safetyApi.getMyReports(),
  });

  const appealMutation = useMutation({
    mutationFn: () => safetyApi.submitAppeal({ reason: appealReason.trim() }),
    onSuccess: () => {
      setAppealReason('');
      setAppealSuccessMsg('Your appeal was submitted. Our safety team will review it within 24 hours.');
      setTimeout(() => setAppealSuccessMsg(null), 5000);
    },
    onError: (err) => setErrorMsg(userMessageForCode(err)),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => safetyApi.unblockUser(userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['blocked-accounts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: async () => {
      await clearSession();
      await clearLocation();
      router.replace('/(auth)/login');
    },
    onError: (err) => setErrorMsg(userMessageForCode(err)),
  });

  const blocked = blockedData?.data ?? [];
  const reports = reportsData?.data ?? [];

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Safety Center</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {errorMsg && <ErrorBanner message={errorMsg} />}

        <View style={styles.guidelineCard}>
          <Text style={styles.cardTitle}>Community Guidelines</Text>
          <Text style={styles.cardBody}>
            • Zero tolerance for doxxing, real-world threats, hate speech, or non-consensual content.{'\n'}
            • Never post personal phone numbers, Aadhaar, emails, or home addresses.{'\n'}
            • Moderators only see anonymized IDs by default; identity lookup is strictly audit-logged for legal safety.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Blocked Accounts ({blocked.length})</Text>
        {blocked.length === 0 ? (
          <EmptyState
            icon="ban-outline"
            title="No blocked accounts"
            message="When you block an anonymous user on a post, they appear here."
          />
        ) : (
          blocked.map((item) => (
            <View key={item.blocked_id} style={styles.itemRow}>
              <View>
                <Text style={styles.itemTitle}>{item.display_label}</Text>
                <Text style={styles.itemSub}>Blocked {formatRelativeTime(item.created_at)}</Text>
              </View>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => unblockMutation.mutate(item.blocked_id)}
              >
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>My Submitted Reports ({reports.length})</Text>
        {reports.length === 0 ? (
          <View style={styles.mutedBox}>
            <Text style={styles.mutedText}>You have not submitted any reports yet.</Text>
          </View>
        ) : (
          reports.map((rep) => (
            <View key={rep.id} style={styles.itemRow}>
              <View>
                <Text style={styles.itemTitle}>
                  {rep.target_type} • {rep.reason}
                </Text>
                <Text style={styles.itemSub}>{formatRelativeTime(rep.created_at)}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{rep.status}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Moderation Appeals</Text>
        {appealSuccessMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
            <Text style={styles.successText}>{appealSuccessMsg}</Text>
          </View>
        )}
        <View style={styles.appealCard}>
          <Text style={styles.cardTitle}>Submit a Moderation Appeal</Text>
          <Text style={styles.cardBody}>
            If your post was removed or account flagged in error, submit an appeal for human safety review.
          </Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top', marginTop: spacing.xs }]}
            placeholder="Explain why your content or account should be restored..."
            placeholderTextColor={colors.textMuted}
            value={appealReason}
            onChangeText={setAppealReason}
            multiline
          />
          <TouchableOpacity
            style={[styles.appealBtn, (!appealReason.trim() || appealMutation.isPending) && { opacity: 0.5 }]}
            disabled={!appealReason.trim() || appealMutation.isPending}
            onPress={() => appealMutation.mutate()}
          >
            <Text style={styles.appealBtnText}>
              {appealMutation.isPending ? 'Submitting...' : 'Submit Appeal'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Danger Zone</Text>
        {!showDeleteBox ? (
          <TouchableOpacity style={styles.dangerTrigger} onPress={() => setShowDeleteBox(true)}>
            <Text style={styles.dangerTriggerText}>Delete My Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Permanently Delete Account</Text>
            <Text style={styles.deleteDesc}>
              This removes your profile, anonymous identities, and saved posts. Type DELETE to confirm.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textMuted}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowDeleteBox(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteBtn,
                  deleteConfirmText !== 'DELETE' && { opacity: 0.45 },
                ]}
                disabled={deleteConfirmText !== 'DELETE' || deleteMutation.isPending}
                onPress={() => deleteMutation.mutate()}
              >
                <Text style={styles.confirmDeleteText}>
                  {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  guidelineCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  itemSub: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unblockText: {
    ...typography.caption,
    color: colors.accent,
  },
  mutedBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  mutedText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  statusPill: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.micro,
    color: colors.accent,
  },
  dangerTrigger: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerTriggerText: {
    ...typography.bodyMedium,
    color: colors.danger,
    fontWeight: '700',
  },
  deleteCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    gap: spacing.xs,
  },
  deleteTitle: {
    ...typography.subtitle,
    color: colors.danger,
  },
  deleteDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  confirmDeleteText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  appealCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  appealBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  appealBtnText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  successText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
});

