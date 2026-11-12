import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../src/api/auth.api';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useAuthStore } from '../../src/store/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const markOnboardingSeen = useAuthStore((s) => s.markOnboardingSeen);

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('+919876543210');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const handleModeChange = (next: 'phone' | 'email') => {
    setMode(next);
    setIdentifier(next === 'phone' ? '+919876543210' : 'tester@diriddle.in');
    setOtpSent(false);
    setOtp('');
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSendOtp = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!identifier.trim()) {
      setErrorMsg('Please enter a valid phone number or email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.sendOtp({ identifier: identifier.trim(), type: mode });
      setOtpSent(true);
      setResendSeconds(30);
      setInfoMsg(res.demoMode ? 'Demo mode active: enter OTP 123456.' : 'OTP sent! Check your inbox or SMS.');
    } catch (err) {
      setErrorMsg(userMessageForCode(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg(null);
    if (otp.trim().length < 4) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const tokens = await authApi.verifyOtp({
        identifier: identifier.trim(),
        otp: otp.trim(),
        type: mode,
      });
      await markOnboardingSeen();
      await setSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        userId: tokens.user_id,
      });
      router.replace('/(auth)/age-eligibility');
    } catch (err) {
      setErrorMsg(userMessageForCode(err));
    } finally {
      setLoading(false);
    }
  };

  const handleWindowsQuickDemo = async () => {
    setLoading(true);
    try {
      await markOnboardingSeen();
      await setSession({
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        userId: 'demo-user',
      });
      router.replace('/(auth)/age-eligibility');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>diriddle</Text>
        <Text style={styles.title}>Private Sign-In</Text>
        <Text style={styles.subtitle}>
          Phone or email is only used to prevent spam. Your public identity is always anonymous.
        </Text>

        {errorMsg && <ErrorBanner message={errorMsg} />}

        {infoMsg && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{infoMsg}</Text>
          </View>
        )}

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'phone' && styles.toggleBtnActive]}
            onPress={() => handleModeChange('phone')}
          >
            <Text style={[styles.toggleText, mode === 'phone' && styles.toggleTextActive]}>
              Phone (India +91)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'email' && styles.toggleBtnActive]}
            onPress={() => handleModeChange('email')}
          >
            <Text style={[styles.toggleText, mode === 'email' && styles.toggleTextActive]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{mode === 'phone' ? 'Mobile Number' : 'Email Address'}</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder={mode === 'phone' ? '+919876543210' : 'you@example.com'}
          placeholderTextColor={colors.textMuted}
          keyboardType={mode === 'phone' ? 'phone-pad' : 'email-address'}
          autoCapitalize="none"
        />

        {!otpSent ? (
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            <Text style={styles.primaryText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.label}>6-Digit OTP</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              <Text style={styles.primaryText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendBtn}
              disabled={resendSeconds > 0 || loading}
              onPress={handleSendOtp}
            >
              <Text style={styles.resendText}>
                {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.testCard}>
          <Text style={styles.testTitle}>
            {Platform.OS === 'web' ? 'Windows / Web Quick Test Mode' : 'Local Testing Helper'}
          </Text>
          <Text style={styles.testBody}>
            Testing locally without Supabase SMS? Use OTP <Text style={styles.code}>123456</Text> or
            launch the instant demo session below.
          </Text>
          <TouchableOpacity style={styles.demoBtn} onPress={handleWindowsQuickDemo} disabled={loading}>
            <Text style={styles.demoBtnText}>Continue with Demo Test Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  brand: {
    ...typography.subtitle,
    color: colors.accent,
    marginBottom: spacing.xs,
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
  infoBox: {
    backgroundColor: colors.infoMuted,
    borderColor: colors.info,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  toggleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
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
  resendBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  resendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  testCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  testTitle: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  testBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  code: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  demoBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingVertical: 11,
    alignItems: 'center',
  },
  demoBtnText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});
