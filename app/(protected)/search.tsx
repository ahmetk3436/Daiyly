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
import { JournalEntry } from '../../types/journal';
import { useAuth } from '../../contexts/AuthContext';
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
          <Text className="text-gray-600 text-sm leading-5">{text}</Text>
        );
      }

      const escapedQuery = searchQuery.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);

      return (
        <Text className="text-gray-600 text-sm leading-5" numberOfLines={3}>
          {parts.map((part, index) => {
            const isMatch =
              part.toLowerCase() === searchQuery.toLowerCase();
            if (isMatch) {
              return (
                <Text
                  key={index}
                  className="bg-yellow-200 font-semibold text-gray-900"
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
          q: encodeURIComponent(searchQuery.trim()),
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
      setError(
        'Failed to search entries. Please check your connection and try again.'
      );
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
          className="bg-white rounded-xl p-4 mx-5 mb-2 border border-gray-100 active:scale-[0.98]"
          onPress={() => handleEntryPress(item.id)}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">
                {item.mood_emoji || '\u{1F4DD}'}
              </Text>
              <Text className="text-xs text-gray-500">{formattedDate}</Text>
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
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-gray-400 mt-3">Loading your entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 pt-6 pb-2 bg-white border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">Search</Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            {isGuest
              ? 'Search your local entries'
              : 'Find moments from your journal'}
          </Text>
        </View>

        {/* Search Input */}
        <View className="px-5 py-3 bg-white">
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-2.5 text-sm text-gray-900"
              placeholder={
                isGuest
                  ? 'Search your local entries...'
                  : 'Search your journal...'
              }
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="sentences"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClearSearch} className="p-1">
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Error State */}
        {error && !loading && (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
              <Ionicons
                name="cloud-offline-outline"
                size={32}
                color="#EF4444"
              />
            </View>
            <Text className="text-base font-semibold text-gray-900 mb-2">
              Search Failed
            </Text>
            <Text className="text-sm text-center text-gray-500 mb-4">
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
            <Text className="text-gray-400 text-sm mt-3">Searching...</Text>
          </View>
        )}

        {/* Results Count */}
        {!error &&
          query.length >= 2 &&
          !loading &&
          results.length > 0 && (
            <Text className="text-xs text-gray-500 px-5 py-2">
              {total} {total === 1 ? 'entry' : 'entries'} found
              {isGuest && (
                <Text className="text-purple-500"> (local)</Text>
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
                <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
                  <Ionicons
                    name="search-outline"
                    size={32}
                    color="#9CA3AF"
                  />
                </View>
                <Text className="text-base font-semibold text-gray-800 mb-2">
                  No entries found
                </Text>
                <Text className="text-sm text-center text-gray-500">
                  We couldn't find any entries matching "{query}".
                </Text>
                <Pressable
                  className="mt-4 bg-gray-100 px-5 py-2.5 rounded-full"
                  onPress={handleClearSearch}
                >
                  <Text className="text-gray-600 font-medium text-sm">
                    Clear Search
                  </Text>
                </Pressable>
              </View>
            )
          )
        ) : (
          !error && (
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
                <Ionicons name="book-outline" size={36} color="#2563EB" />
              </View>
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Search Your Journal
              </Text>
              <Text className="text-sm text-center text-gray-500 mb-6">
                Search across all your entries. Find specific moments,
                feelings, or events.
              </Text>

              {isGuest && (
                <Pressable
                  className="bg-purple-50 rounded-xl p-4 w-full max-w-xs mb-4 border border-purple-100"
                  onPress={() => {
                    hapticLight();
                    router.push('/(auth)/register');
                  }}
                >
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color="#8B5CF6"
                    />
                    <Text className="text-xs font-semibold text-purple-700 ml-1.5">
                      Guest Mode
                    </Text>
                  </View>
                  <Text className="text-xs text-purple-600">
                    Create a free account to sync and search across all devices.
                  </Text>
                </Pressable>
              )}

              <View className="bg-gray-50 rounded-xl p-4 w-full max-w-xs">
                <Text className="text-xs font-medium text-gray-600 mb-2">
                  Try searching for:
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {['grateful', 'work', 'family', 'happy', 'weekend'].map(
                    (suggestion) => (
                      <Pressable
                        key={suggestion}
                        className="bg-white px-3 py-1.5 rounded-full border border-gray-200"
                        onPress={() => {
                          hapticSelection();
                          setQuery(suggestion);
                          performSearch(suggestion, 0, true);
                        }}
                      >
                        <Text className="text-xs text-gray-600">
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
