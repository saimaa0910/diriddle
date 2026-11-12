import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PostCategory } from '@diriddle/shared-types';
import { colors, radii, spacing, typography } from '../design-system/tokens';
import { POST_CATEGORIES } from '../types/models';

interface CategoryChipsProps {
  selected: PostCategory | 'ALL';
  onSelect: (category: PostCategory | 'ALL') => void;
  includeAll?: boolean;
}

export function CategoryChips({ selected, onSelect, includeAll = true }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {includeAll && (
        <TouchableOpacity
          onPress={() => onSelect('ALL')}
          style={[styles.chip, selected === 'ALL' && styles.chipActive]}
          accessibilityRole="button"
          accessibilityLabel="All categories"
        >
          <Text style={[styles.chipText, selected === 'ALL' && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
      )}
      {POST_CATEGORIES.map((cat) => {
        const active = selected === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {cat.emoji} {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});
