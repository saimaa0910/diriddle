import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { ScreenContainer } from '../../src/components/ScreenContainer';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/onboarding');
    }, 1100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>d</Text>
      </View>
      <Text style={styles.title}>diriddle</Text>
      <Text style={styles.tagline}>Your city, unfiltered & anonymous.</Text>
      <TouchableOpacity
        style={styles.continueBtn}
        onPress={() => router.replace('/(auth)/onboarding')}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.accentMuted,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoGlyph: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.accent,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  continueBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
