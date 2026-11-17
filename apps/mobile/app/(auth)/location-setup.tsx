import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { useLocationStore } from '../../src/store/location-store';
import { detectApproximateCity, INDIA_CITIES, IndiaCity } from '../../src/utils/location';
import { locationApi } from '../../src/api/location.api';

export default function LocationSetupScreen() {
  const router = useRouter();
  const setCity = useLocationStore((s) => s.setCity);
  const currentCity = useLocationStore((s) => s.selectedCity);

  const [selected, setSelected] = useState<IndiaCity>(
    INDIA_CITIES.find((c) => c.name === currentCity) ?? INDIA_CITIES[2]
  );
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const handleDetectLocation = async () => {
    setDetecting(true);
    setDetectMessage(null);
    const res = await detectApproximateCity();
    setDetecting(false);
    if (res.granted && res.city) {
      setSelected(res.city);
      setDetectMessage(`Approximate city detected: ${res.city.name}, ${res.city.state}`);
    } else {
      setDetectMessage('Approximate location unavailable or denied. Pick your city manually below.');
    }
  };

  const handleConfirm = async () => {
    await setCity(selected);
    void locationApi.setPreference({
      selected_city: selected.name,
      selected_state: selected.state,
      lat: selected.lat,
      lng: selected.lng,
      location_permission_granted: false,
    });
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your City</Text>
        <Text style={styles.subtitle}>
          We only use city-level location to show nearby communities—never your exact street or GPS coordinates.
        </Text>

        <TouchableOpacity style={styles.detectBtn} onPress={handleDetectLocation} disabled={detecting}>
          <Ionicons name="navigate-outline" size={18} color={colors.accent} />
          <Text style={styles.detectText}>
            {detecting ? 'Checking approximate location...' : 'Use Approximate Location (Optional)'}
          </Text>
        </TouchableOpacity>

        {detectMessage && <Text style={styles.detectHint}>{detectMessage}</Text>}
      </View>

      <FlatList
        data={INDIA_CITIES}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const active = selected.slug === item.slug;
          return (
            <TouchableOpacity
              style={[styles.cityRow, active && styles.cityRowActive]}
              onPress={() => setSelected(item)}
            >
              <View>
                <Text style={[styles.cityName, active && styles.cityNameActive]}>{item.name}</Text>
                <Text style={styles.cityState}>{item.state}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
          <Text style={styles.primaryText}>Continue in {selected.name}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  detectText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  detectHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  cityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: spacing.xs,
  },
  cityRowActive: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
  },
  cityName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  cityNameActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  cityState: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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

