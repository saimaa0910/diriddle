import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communitiesApi } from '../../src/api/communities.api';
import { TRENDING_TOPICS } from '../../src/api/demo-data';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { EmptyState, ErrorBanner } from '../../src/components/StateViews';
import { colors, radii, spacing, typography } from '../../src/design-system/tokens';
import { userMessageForCode } from '../../src/error-codes/user-message-for-code';
import { useLocationStore } from '../../src/store/location-store';
import { CommunityItem } from '../../src/types/models';
import { INDIA_CITIES } from '../../src/utils/location';

export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setCity = useLocationStore((s) => s.setCity);
  const selectedCity = useLocationStore((s) => s.selectedCity);

  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  const { data, error, refetch } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const joinMutation = useMutation({
    mutationFn: async (community: CommunityItem): Promise<void> => {
      if (community.is_joined) {
        await communitiesApi.leave(community.id);
      } else {
        await communitiesApi.join(community.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const communities = useMemo(() => {
    let list = data?.data ?? [];
    if (cityFilter) {
      list = list.filter((c) => c.city?.toLowerCase() === cityFilter.toLowerCase());
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, cityFilter, query]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Explore India</Text>
        <Text style={styles.subtitle}>Browse cities, neighborhoods, campuses, and local buzz.</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cities, neighborhoods, campuses..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={
          <View style={styles.headerSections}>
            {error && <ErrorBanner message={userMessageForCode(error)} onRetry={() => void refetch()} />}

            <Text style={styles.sectionTitle}>Trending Topics</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              <View style={styles.topicRow}>
                {TRENDING_TOPICS.map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    style={styles.topicChip}
                    onPress={() => setQuery(topic.replace('#', ''))}
                  >
                    <Text style={styles.topicText}>{topic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.sectionTitle}>Major Indian Cities</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              <View style={styles.topicRow}>
                <TouchableOpacity
                  style={[styles.cityChip, !cityFilter && styles.cityChipActive]}
                  onPress={() => setCityFilter(null)}
                >
                  <Text style={[styles.cityChipText, !cityFilter && styles.cityChipTextActive]}>
                    All Cities
                  </Text>
                </TouchableOpacity>
                {INDIA_CITIES.map((city) => {
                  const active = cityFilter === city.name;
                  return (
                    <TouchableOpacity
                      key={city.slug}
                      style={[styles.cityChip, active && styles.cityChipActive]}
                      onPress={() => {
                        setCityFilter(active ? null : city.name);
                        if (!active) void setCity(city);
                      }}
                    >
                      <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                        {city.name}
                        {selectedCity === city.name ? ' •' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.sectionTitle}>Communities ({communities.length})</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No communities found"
            message="Try another city or search keyword."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.communityCard}
            onPress={() => router.push(`/community/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.communityTop}>
                <Text style={styles.communityName}>{item.name}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typeText}>{item.type}</Text>
                </View>
              </View>
              <Text style={styles.communityMeta}>
                {item.city ?? 'India'}
                {item.state ? `, ${item.state}` : ''} • {(item.member_count ?? 1200).toLocaleString('en-IN')} members
              </Text>
              {item.description && (
                <Text style={styles.communityDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, item.is_joined && styles.joinedBtn]}
              onPress={() => joinMutation.mutate(item)}
            >
              <Text style={[styles.joinText, item.is_joined && styles.joinedText]}>
                {item.is_joined ? 'Joined' : 'Join'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerSections: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  hScroll: {
    marginBottom: spacing.xs,
  },
  topicRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  topicChip: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topicText: {
    ...typography.caption,
    color: colors.accent,
  },
  cityChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cityChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  cityChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cityChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  communityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  communityName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  typePill: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  communityMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  communityDesc: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
    marginTop: 4,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinedBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  joinedText: {
    color: colors.textSecondary,
  },
});
