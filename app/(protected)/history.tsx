import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGuestEntries } from '../../lib/guest';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { cacheSet, cacheGet } from '../../lib/cache';
import { MOOD_OPTIONS } from '../../types/journal';
import type { JournalEntry, GuestEntry } from '../../types/journal';

const PAGE_SIZE = 20;

interface DisplayEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  entry_date: string;
  created_at: string;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getMoodColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

export default function HistoryScreen() {
  const { isGuest } = useAuth();
  const { isDark } = useTheme();

  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DisplayEntry[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  const fetchEntries = async (resetOffset: boolean = false) => {
    try {
      setError(null);
      setIsStale(false);
      if (isGuest) {
        const guestEntries = await getGuestEntries();
        const sortedEntries: DisplayEntry[] = guestEntries
          .map((e: GuestEntry) => ({
            id: e.id,
            mood_emoji: e.mood_emoji,
            mood_score: e.mood_score,
            content: e.content,
            card_color: e.card_color,
            entry_date: e.created_at,
            created_at: e.created_at,
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
        setEntries(sortedEntries);
        setTotal(sortedEntries.length);
        setHasMore(false);
      } else {
        const currentOffset = resetOffset ? 0 : offset;
        const response = await api.get(
          `/journals?offset=${currentOffset}&limit=${PAGE_SIZE}`
        );
        const data = response.data;
        const newEntries: DisplayEntry[] = (data.entries || []).map(
          (e: JournalEntry) => ({
            id: e.id,
            mood_emoji: e.mood_emoji,
            mood_score: e.mood_score,
            content: e.content,
            card_color: e.card_color,
            entry_date: e.entry_date,
            created_at: e.created_at,
          })
        );

        if (resetOffset) {
          setEntries(newEntries);
          setOffset(PAGE_SIZE);
          // Cache first page for offline use
          cacheSet('history_entries', { entries: newEntries, total: data.total || 0 });
        } else {
          setEntries((prev) => [...prev, ...newEntries]);
          setOffset((prev) => prev + PAGE_SIZE);
        }

        setTotal(data.total || 0);
        setHasMore(newEntries.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      // Offline fallback: try cache
      if (!isGuest && resetOffset) {
        const cached = await cacheGet<{ entries: DisplayEntry[]; total: number }>('history_entries');
        if (cached) {
          setEntries(cached.data.entries);
          setTotal(cached.data.total);
          setHasMore(false);
          setIsStale(true);
          return;
        }
      }
      setError(
        'Failed to load your journal entries. Please check your connection and try again.'
      );
    }
  };

  const handleRefresh = async () => {
    hapticLight();
    setRefreshing(true);
    setOffset(0);
    setMoodFilter(null);
    setFilteredEntries(null);
    await fetchEntries(true);
    setRefreshing(false);
  };

  const handleRetry = async () => {
    hapticLight();
    setIsLoading(true);
    setOffset(0);
    await fetchEntries(true);
    setIsLoading(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || isGuest || moodFilter) return;
    setIsLoadingMore(true);
    await fetchEntries(false);
    setIsLoadingMore(false);
  };

  const handleEntryPress = (entryId: string) => {
    hapticLight();
    router.push(`/(protected)/entry/${entryId}`);
  };

  const handleMoodFilter = (emoji: string) => {
    hapticSelection();
    if (moodFilter === emoji) {
      setMoodFilter(null);
      setFilteredEntries(null);
    } else {
      setMoodFilter(emoji);
      setFilteredEntries(
        entries.filter((e) => e.mood_emoji === emoji)
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setIsLoading(true);
        await fetchEntries(true);
        setIsLoading(false);
      };
      loadData();
    }, [isGuest])
  );

  const displayEntries = filteredEntries ?? entries;

  const renderEntryCard = ({ item }: { item: DisplayEntry }) => (
    <Pressable
      className="bg-surface-elevated rounded-xl mx-5 mb-2.5 border border-border active:scale-[0.98]"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.15 : 0.03,
        shadowRadius: 3,
        elevation: 1,
      }}
      onPress={() => handleEntryPress(item.id)}
    >
      <View className="flex-row p-4">
        {/* Left Accent Bar */}
        <View
          className="w-1 rounded-full mr-3 self-stretch"
          style={{ backgroundColor: item.card_color || '#3B82F6' }}
        />

        {/* Content */}
        <View className="flex-1">
          {/* Top Row */}
          <View className="flex-row items-center mb-1.5">
            <Text className="text-xl mr-2">
              {item.mood_emoji || '\u{1F4DD}'}
            </Text>
            <Text className="text-sm text-text-secondary flex-1">
              {formatDate(item.entry_date || item.created_at)}
            </Text>

            {isGuest && (
              <View className="bg-amber-50 dark:bg-amber-900/30 rounded-full px-2 py-0.5 mr-2 border border-amber-200 dark:border-amber-700">
                <Text className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  Local
                </Text>
              </View>
            )}

            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: `${getMoodColor(item.mood_score)}12`,
              }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: getMoodColor(item.mood_score) }}
              >
                {item.mood_score}
              </Text>
            </View>
          </View>

          {/* Content Preview */}
          {item.content ? (
            <Text
              numberOfLines={2}
              className="text-sm text-text-secondary leading-5"
            >
              {item.content}
            </Text>
          ) : null}

          {/* Bottom Row */}
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs text-text-muted">
              {timeAgo(item.created_at)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={isDark ? '#475569' : '#D1D5DB'} />
          </View>
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-10 py-20">
      <Text className="text-5xl mb-4">{'\u{1F4D3}'}</Text>
      <Text className="text-lg font-semibold text-text-primary mb-2">
        {moodFilter ? 'No matching entries' : 'No entries yet'}
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-6">
        {moodFilter
          ? 'No entries match this mood filter. Try another mood or clear the filter.'
          : 'Start journaling to see your entries here'}
      </Text>
      {moodFilter ? (
        <Pressable
          className="bg-surface-muted rounded-xl px-5 py-3"
          onPress={() => {
            setMoodFilter(null);
            setFilteredEntries(null);
          }}
        >
          <Text className="text-sm font-semibold text-text-secondary">
            Clear Filter
          </Text>
        </Pressable>
      ) : (
        <Pressable
          className="bg-blue-600 rounded-xl px-5 py-3"
          onPress={() => {
            hapticLight();
            router.push('/(protected)/new-entry');
          }}
        >
          <Text className="text-sm font-semibold text-white">
            Write your first entry
          </Text>
        </Pressable>
      )}
    </View>
  );

  const renderErrorState = () => (
    <View className="flex-1 justify-center items-center px-10">
      <View className="bg-red-50 dark:bg-red-900/30 rounded-full p-4 mb-4">
        <Ionicons name="cloud-offline" size={40} color="#DC2626" />
      </View>
      <Text className="text-lg font-semibold text-text-primary mb-2">
        Something went wrong
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-6">
        {error}
      </Text>
      <Pressable
        className="bg-blue-600 rounded-xl px-5 py-3 flex-row items-center"
        onPress={handleRetry}
      >
        <Ionicons
          name="refresh"
          size={16}
          color="white"
          style={{ marginRight: 6 }}
        />
        <Text className="text-sm font-semibold text-white">Try Again</Text>
      </Pressable>
    </View>
  );

  const renderLoadingSkeleton = () => (
    <>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          className="bg-surface-muted rounded-xl h-24 mx-5 mb-2.5"
          style={{ opacity: 0.6 }}
        />
      ))}
    </>
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View className="py-4">
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      );
    }

    if (!hasMore && displayEntries.length > 0 && !moodFilter) {
      return (
        <Text className="text-xs text-text-muted text-center py-4">
          You've seen all entries
        </Text>
      );
    }

    return <View className="h-24" />;
  };

  // Unique moods from entries for filter
  const uniqueMoods = Array.from(new Set(entries.map((e) => e.mood_emoji)));

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-6 pb-3 bg-background border-b border-border">
        <View className="flex-row items-center">
          <Text className="text-2xl font-bold text-text-primary">History</Text>
          <View className="bg-blue-50 dark:bg-blue-900/30 rounded-full px-2.5 py-0.5 ml-3 border border-blue-100 dark:border-blue-800">
            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {moodFilter ? displayEntries.length : total}
            </Text>
          </View>
        </View>

        {/* Mood Filter Chips */}
        {uniqueMoods.length > 1 && (
          <View className="flex-row mt-3" style={{ gap: 6 }}>
            {uniqueMoods.slice(0, 8).map((emoji) => {
              const isActive = moodFilter === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleMoodFilter(emoji)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-400'
                      : 'bg-surface-muted'
                  }`}
                >
                  <Text className="text-lg">{emoji}</Text>
                </Pressable>
              );
            })}
            {moodFilter && (
              <Pressable
                onPress={() => {
                  hapticSelection();
                  setMoodFilter(null);
                  setFilteredEntries(null);
                }}
                className="h-9 rounded-full px-3 bg-surface-muted items-center justify-center"
              >
                <Text className="text-xs font-medium text-text-secondary">
                  Clear
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Guest Banner */}
      {isGuest && entries.length > 0 && (
        <View className="bg-amber-50 dark:bg-amber-900/20 px-5 py-2.5 flex-row items-center justify-between border-b border-amber-100 dark:border-amber-800">
          <View className="flex-row items-center flex-1">
            <Ionicons
              name="cloud-offline"
              size={16}
              color={isDark ? '#FBBF24' : '#D97706'}
              style={{ marginRight: 6 }}
            />
            <Text className="text-xs text-amber-700 dark:text-amber-400">
              Sign up to sync entries to cloud
            </Text>
          </View>
          <Pressable
            className="bg-amber-600 rounded-lg px-3 py-1"
            onPress={() => {
              hapticLight();
              router.push('/(auth)/register');
            }}
          >
            <Text className="text-xs font-medium text-white">Sign Up</Text>
          </Pressable>
        </View>
      )}

      {/* Offline indicator */}
      {isStale && (
        <View className="bg-amber-50 dark:bg-amber-900/20 px-5 py-2.5 flex-row items-center border-b border-amber-100 dark:border-amber-800">
          <Ionicons name="cloud-offline-outline" size={14} color="#D97706" />
          <Text className="text-xs text-amber-700 dark:text-amber-400 ml-2">
            Showing cached data — pull to refresh
          </Text>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 pt-4">{renderLoadingSkeleton()}</View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={displayEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntryCard}
          contentContainerStyle={{ paddingVertical: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
