import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { cacheGet } from '../../lib/cache';
import { JournalEntry } from '../../types/journal';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGuestEntries } from '../../lib/guest';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [guestEntries, setGuestEntries] = useState<any[]>([]);
  const [loadingGuestEntries, setLoadingGuestEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user, isGuest } = useAuth();
  const { isSubscribed } = useSubscription();
  const { isDark } = useTheme();
  const showSearchUpsell = !isGuest && !isSubscribed;

  useEffect(() => {
    if (isGuest) loadGuestEntries();
  }, [isGuest]);

  const loadGuestEntries = async () => {
    setLoadingGuestEntries(true);
    try {
      const entries = await getGuestEntries();
      setGuestEntries(entries || []);
    } catch {
      setGuestEntries([]);
    } finally {
      setLoadingGuestEntries(false);
    }
  };

  const performLocalSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setResults([]);
        setTotal(0);
        return;
      }

      setLoading(true);
      setError(null);

      const terms = searchQuery.toLowerCase().trim();
      const filtered = guestEntries.filter((entry) => {
        return entry.content?.toLowerCase().includes(terms);
      });

      setResults(filtered);
      setTotal(filtered.length);
      setHasMore(false);
      setLoading(false);
      hapticLight();
    },
    [guestEntries]
  );

  const highlightText = useCallback(
    (text: string, searchQuery: string): React.JSX.Element => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return (
          <Text className="text-text-secondary text-sm leading-5">{text}</Text>
        );
      }

      const escapedQuery = searchQuery.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);

      return (
        <Text className="text-text-secondary text-sm leading-5" numberOfLines={3}>
          {parts.map((part, index) => {
            const isMatch =
              part.toLowerCase() === searchQuery.toLowerCase();
            if (isMatch) {
              return (
                <Text
                  key={index}
                  className="bg-yellow-200 dark:bg-yellow-800 font-semibold text-text-primary"
                >
                  {part}
                </Text>
              );
            }
            return <Text key={index}>{part}</Text>;
          })}
        </Text>
      );
    },
    []
  );

  const performSearch = async (
    searchQuery: string,
    searchOffset: number,
    isNewSearch: boolean
  ) => {
    if (!searchQuery || searchQuery.trim().length < 2) return;

    if (isGuest) {
      performLocalSearch(searchQuery);
      return;
    }

    if (isNewSearch) {
      setLoading(true);
      setOffset(0);
      setError(null);
    } else {
      setIsFetchingMore(true);
    }

    try {
      const response = await api.get('/journals/search', {
        params: {
          q: searchQuery.trim(),
          limit: 20,
          offset: searchOffset,
        },
      });

      const { entries, total: responseTotal, hasMore: responseHasMore } =
        response.data;

      if (isNewSearch) {
        setResults(entries || []);
        setOffset(20);
      } else {
        setResults((prev) => [...prev, ...(entries || [])]);
        setOffset((prev) => prev + 20);
      }

      setTotal(responseTotal || 0);
      setHasMore(responseHasMore ?? false);
      hapticLight();
    } catch {
      // Offline fallback: search cached entries locally (home + history)
      type CachedEntry = { id: string; content: string; mood_emoji: string; mood_score: number; created_at: string; card_color: string };
      const homeCached = await cacheGet<CachedEntry[]>('home_entries');
      const historyCached = await cacheGet<{ entries: CachedEntry[]; total: number }>('history_entries');

      // Merge both caches, deduplicate by id
      const seen = new Set<string>();
      const allCached: CachedEntry[] = [];
      for (const entry of [...(historyCached?.data?.entries || []), ...(homeCached?.data || [])]) {
        if (entry?.id && !seen.has(entry.id)) {
          seen.add(entry.id);
          allCached.push(entry);
        }
      }

      if (allCached.length > 0) {
        const terms = searchQuery.toLowerCase().trim();
        const localResults = allCached.filter((e) =>
          e.content?.toLowerCase().includes(terms)
        ) as unknown as JournalEntry[];
        if (isNewSearch) {
          setResults(localResults);
          setOffset(0);
        }
        setTotal(localResults.length);
        setHasMore(false);
        setError(localResults.length > 0
          ? null
          : 'No cached results found. Connect to search all entries.');
      } else {
        setError(
          'Failed to search entries. Please check your connection and try again.'
        );
      }
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (text.length < 2) {
      setResults([]);
      setTotal(0);
      setOffset(0);
      setHasMore(true);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text, 0, true);
    }, 500);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || isFetchingMore || query.length < 2) return;
    performSearch(query, offset, false);
  }, [hasMore, loading, isFetchingMore, query, offset]);

  const handleClearSearch = useCallback(() => {
    hapticSelection();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setQuery('');
    setResults([]);
    setTotal(0);
    setOffset(0);
    setHasMore(true);
    setError(null);
    Keyboard.dismiss();
  }, []);

  const handleEntryPress = useCallback((entryId: string) => {
    hapticSelection();
    router.push(`/(protected)/entry/${entryId}` as never);
  }, []);

  function getMoodColor(score: number): string {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#3B82F6';
    if (score >= 40) return '#F59E0B';
    if (score >= 20) return '#F97316';
    return '#EF4444';
  }

  const renderResultItem = useCallback(
    ({ item }: { item: JournalEntry }) => {
      const formattedDate = new Date(item.created_at).toLocaleDateString(
        'en-US',
        { weekday: 'short', month: 'short', day: 'numeric' }
      );

      const previewContent =
        item.content.length > 150
          ? item.content.substring(0, 150) + '...'
          : item.content;

      return (
        <Pressable
          className="bg-surface-elevated rounded-xl p-4 mx-5 mb-2 border border-border active:scale-[0.98]"
          onPress={() => handleEntryPress(item.id)}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">
                {item.mood_emoji || '\u{1F4DD}'}
              </Text>
              <Text className="text-xs text-text-secondary">{formattedDate}</Text>
            </View>
            {item.mood_score > 0 && (
              <View
                className="rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: `${getMoodColor(item.mood_score)}15`,
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: getMoodColor(item.mood_score) }}
                >
                  {item.mood_score}
                </Text>
              </View>
            )}
          </View>
          {highlightText(previewContent, query)}
        </Pressable>
      );
    },
    [query, highlightText, handleEntryPress]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingMore) return <View className="h-24" />;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  }, [isFetchingMore]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  if (isGuest && loadingGuestEntries) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-text-muted mt-3">Loading your entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 pt-6 pb-2 bg-background border-b border-border">
          <Text className="text-2xl font-bold text-text-primary">Search</Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {isGuest
              ? 'Search your local entries'
              : 'Find moments from your journal'}
          </Text>
        </View>

        {/* Search Input */}
        <View className="px-5 py-3 bg-background">
          <View className="flex-row items-center bg-surface-muted rounded-xl px-4 py-2.5">
            <Ionicons name="search" size={18} color={isDark ? '#64748B' : '#9CA3AF'} />
            <TextInput
              className="flex-1 ml-2.5 text-sm text-text-primary"
              placeholder={
                isGuest
                  ? 'Search your local entries...'
                  : 'Search your journal...'
              }
              placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="sentences"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClearSearch} className="p-1">
                <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#9CA3AF'} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Premium Search Banner */}
        {showSearchUpsell && query.length === 0 && (
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(protected)/paywall?source=search');
            }}
            className="mx-5 mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-100 dark:border-blue-800 flex-row items-center active:opacity-80"
          >
            <View className="bg-blue-100 dark:bg-blue-800 w-9 h-9 rounded-lg items-center justify-center mr-3">
              <Ionicons name="search" size={18} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                Upgrade for Full-Text Search
              </Text>
              <Text className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                Search across all entries instantly with Premium
              </Text>
            </View>
            <View className="bg-blue-200 dark:bg-blue-700 rounded-full px-2 py-0.5">
              <Text className="text-[10px] font-bold text-blue-700 dark:text-blue-200">PRO</Text>
            </View>
          </Pressable>
        )}

        {/* Error State */}
        {error && !loading && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full items-center justify-center mb-4">
              <Ionicons
                name="cloud-offline-outline"
                size={32}
                color="#EF4444"
              />
            </View>
            <Text className="text-base font-semibold text-text-primary mb-2">
              Search Failed
            </Text>
            <Text className="text-sm text-center text-text-secondary mb-4">
              {error}
            </Text>
            <Pressable
              className="bg-blue-600 px-5 py-2.5 rounded-xl flex-row items-center"
              onPress={() => {
                hapticSelection();
                setError(null);
                performSearch(query, 0, true);
              }}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text className="text-white font-medium text-sm ml-2">
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {/* Loading */}
        {!error && loading && results.length === 0 && query.length >= 2 && (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-text-muted text-sm mt-3">Searching...</Text>
          </View>
        )}

        {/* Results Count */}
        {!error &&
          query.length >= 2 &&
          !loading &&
          results.length > 0 && (
            <Text className="text-xs text-text-secondary px-5 py-2">
              {total} {total === 1 ? 'entry' : 'entries'} found
              {isGuest && (
                <Text className="text-purple-500 dark:text-purple-400"> (local)</Text>
              )}
            </Text>
          )}

        {/* Results */}
        {!error && query.length >= 2 ? (
          results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderResultItem}
              contentContainerStyle={{ paddingVertical: 4 }}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={renderFooter}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            !loading && (
              <View className="flex-1 items-center justify-center px-8">
                <View className="w-16 h-16 bg-surface-muted rounded-full items-center justify-center mb-4">
                  <Ionicons
                    name="search-outline"
                    size={32}
                    color={isDark ? '#64748B' : '#9CA3AF'}
                  />
                </View>
                <Text className="text-base font-semibold text-text-primary mb-2">
                  No entries found
                </Text>
                <Text className="text-sm text-center text-text-secondary">
                  We couldn't find any entries matching "{query}".
                </Text>
                <Pressable
                  className="mt-4 bg-surface-muted px-5 py-2.5 rounded-full"
                  onPress={handleClearSearch}
                >
                  <Text className="text-text-secondary font-medium text-sm">
                    Clear Search
                  </Text>
                </Pressable>
              </View>
            )
          )
        ) : (
          !error && (
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mb-4">
                <Ionicons name="book-outline" size={36} color="#2563EB" />
              </View>
              <Text className="text-base font-semibold text-text-primary mb-2">
                Search Your Journal
              </Text>
              <Text className="text-sm text-center text-text-secondary mb-6">
                Search across all your entries. Find specific moments,
                feelings, or events.
              </Text>

              {isGuest && (
                <Pressable
                  className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 w-full max-w-xs mb-4 border border-purple-100 dark:border-purple-800"
                  onPress={() => {
                    hapticLight();
                    router.push('/(auth)/register');
                  }}
                >
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color={isDark ? '#C084FC' : '#8B5CF6'}
                    />
                    <Text className="text-xs font-semibold text-purple-700 dark:text-purple-300 ml-1.5">
                      Guest Mode
                    </Text>
                  </View>
                  <Text className="text-xs text-purple-600 dark:text-purple-400">
                    Create a free account to sync and search across all devices.
                  </Text>
                </Pressable>
              )}

              <View className="bg-surface-muted rounded-xl p-4 w-full max-w-xs">
                <Text className="text-xs font-medium text-text-secondary mb-2">
                  Try searching for:
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {['grateful', 'work', 'family', 'happy', 'weekend'].map(
                    (suggestion) => (
                      <Pressable
                        key={suggestion}
                        className="bg-surface-elevated px-3 py-1.5 rounded-full border border-border-strong"
                        onPress={() => {
                          hapticSelection();
                          setQuery(suggestion);
                          performSearch(suggestion, 0, true);
                        }}
                      >
                        <Text className="text-xs text-text-secondary">
                          {suggestion}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            </View>
          )
        )}
      </View>
    </SafeAreaView>
  );
}
