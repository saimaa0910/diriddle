import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/design-system/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="age-eligibility" />
      <Stack.Screen name="location-setup" />
    </Stack>
  );
}

