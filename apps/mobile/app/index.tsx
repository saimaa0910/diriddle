import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../src/design-system/tokens';
import { useAuthStore } from '../src/store/auth-store';
import { useLocationStore } from '../src/store/location-store';

export default function IndexGate() {
  const { isHydrated: authReady, accessToken, hasSeenOnboarding, ageVerified } = useAuthStore();
  const { isHydrated: locReady, selectedCity } = useLocationStore();

  if (!authReady || !locReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/splash" />;
  }
  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!ageVerified) {
    return <Redirect href="/(auth)/age-eligibility" />;
  }
  if (!selectedCity) {
    return <Redirect href="/(auth)/location-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
