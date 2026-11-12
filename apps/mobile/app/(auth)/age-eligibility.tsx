import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../src/api/auth.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useAuthStore } from '../../src/store/auth-store';

export default function AgeEligibilityScreen() {
  const router = useRouter();
  const confirmAgeAndTerms = useAuthStore((s) => s.confirmAgeAndTerms);

  const [is18Plus, setIs18Plus] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canContinue = is18Plus && acceptedTerms && !loading;

  const handleConfirm = async () => {
    setErrorMsg(null);
    if (!is18Plus || !acceptedTerms) {
      setErrorMsg('Please confirm both eligibility requirements to proceed.');
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyAge();
      await confirmAgeAndTerms();
      router.replace('/(auth)/location-setup');
    } catch (err) {
      setErrorMsg(userMessageForCode(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>18+ Community Gate</Text>
        </View>
        <Text style={styles.title}>Age & Safety Agreement</Text>
        <Text style={styles.subtitle}>
          diriddle is strictly for adults (18+) in India. Keeping communities safe starts with clear accountability.
        </Text>

        {errorMsg && <ErrorBanner message={errorMsg} />}

        <TouchableOpacity
          style={[styles.checkCard, is18Plus && styles.checkCardActive]}
          onPress={() => setIs18Plus(!is18Plus)}
        >
          <Ionicons
            name={is18Plus ? 'checkbox' : 'square-outline'}
            size={22}
            color={is18Plus ? colors.accent : colors.textSecondary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.checkTitle}>I confirm that I am 18 years of age or older</Text>
            <Text style={styles.checkDesc}>
              Required under Indian digital safety standards for anonymous social spaces.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.checkCard, acceptedTerms && styles.checkCardActive]}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
        >
          <Ionicons
            name={acceptedTerms ? 'checkbox' : 'square-outline'}
            size={22}
            color={acceptedTerms ? colors.accent : colors.textSecondary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.checkTitle}>I accept the Terms, Privacy Policy & Community Rules</Text>
            <Text style={styles.checkDesc}>
              No doxxing, harassment, hate speech, personal phone numbers, or non-consensual content.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !canContinue && { opacity: 0.45 }]}
        onPress={handleConfirm}
        disabled={!canContinue}
      >
        <Text style={styles.primaryText}>{loading ? 'Saving...' : 'Confirm & Continue'}</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.micro,
    color: colors.accent,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  checkTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  checkDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    ...typography.subtitle,
    color: colors.background,
    fontWeight: '700',
  },
});
