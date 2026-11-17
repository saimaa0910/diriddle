import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useAuthStore } from '../../src/store/auth-store';

const SLIDES = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Zero Real Names. Ever.',
    body: 'Get a fresh anonymous handle (like Anonymous #0421) per community. Nobody sees your phone or email.',
  },
  {
    icon: 'location-outline' as const,
    title: 'Hyperlocal Across India',
    body: 'Connect with your city, neighborhood, or campus—from Bengaluru traffic alerts to Delhi campus confessions.',
  },
  {
    icon: 'heart-outline' as const,
    title: 'Safe & Moderated 18+',
    body: 'Built-in PII protection, instant blocking, and active moderation keep local conversations respectful.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const markOnboardingSeen = useAuthStore((s) => s.markOnboardingSeen);
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];

  const handleNext = async () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
      return;
    }
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleSkip = async () => {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>diriddle</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={slide.icon} size={36} color={colors.accent} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === step && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
        <Text style={styles.primaryText}>
          {step === SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    ...typography.title,
    color: colors.textPrimary,
  },
  skip: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
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

