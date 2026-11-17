import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/design-system/tokens';
import { useAuthStore } from '../src/store/auth-store';
import { useLocationStore } from '../src/store/location-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
    },
  },
});

export default function RootLayout() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLocation = useLocationStore((s) => s.hydrate);

  useEffect(() => {
    void hydrateAuth();
    void hydrateLocation();
  }, [hydrateAuth, hydrateLocation]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor={colors.background} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="community/[id]" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/safety" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

