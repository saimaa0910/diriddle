import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../src/api/auth.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { useAuthStore } from '../../src/store/auth-store';
import { useLocationStore } from '../../src/store/location-store';

export default function SettingsScreen() {
  const router = useRouter();
  const { pushNotificationsEnabled, setPushNotificationsEnabled, clearSession } = useAuthStore();
  const selectedCity = useLocationStore((s) => s.selectedCity);

  const handleLogout = async () => {
    await authApi.logout();
    await clearSession();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Settings & Privacy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Push & Activity Alerts</Text>
            <Text style={styles.rowSub}>Replies, reactions, and local safety updates</Text>
          </View>
          <Switch
            value={pushNotificationsEnabled}
            onValueChange={(v) => void setPushNotificationsEnabled(v)}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={pushNotificationsEnabled ? colors.accent : colors.textSecondary}
          />
        </View>

        <TouchableOpacity
          style={styles.rowCard}
          onPress={() => router.push('/(auth)/location-setup')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Primary City</Text>
            <Text style={styles.rowSub}>{selectedCity ?? 'Bengaluru'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Trust & Safety</Text>

        <TouchableOpacity style={styles.rowCard} onPress={() => router.push('/settings/safety')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Safety Center, Blocks & Account Deletion</Text>
            <Text style={styles.rowSub}>
              Manage blocked accounts, review your reports, or delete your account
            </Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Legal & Compliance (India)</Text>
        <View style={styles.legalCard}>
          <View style={styles.legalRow}>
            <Ionicons name="document-text-outline" size={16} color={colors.accent} />
            <Text style={styles.legalTitle}>Terms of Service & Privacy Policy</Text>
          </View>
          <Text style={styles.legalBody}>
            Anonymous, location-based social network for adults (18+). Compliant with India IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021 and Digital Personal Data Protection (DPDP) Act 2023.
          </Text>
          <Text style={styles.legalContact}>
            Resident Grievance Officer: grievance@diriddle.com
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Session</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  legalTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  legalBody: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  legalContact: {
    ...typography.micro,
    color: colors.accent,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.danger,
    fontWeight: '700',
  },
});

