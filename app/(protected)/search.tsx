import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Keyboard,
  InteractionManager,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import api from '../../lib/api';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { cacheGet } from '../../lib/cache';
import { JournalEntry } from '../../types/journal';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGuestEntries } from '../../lib/guest';
import { useProGate } from '../../lib/useProGate';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchMode = 'keyword' | 'ask';

interface AskResult {
  answer: string;
  referenced_dates: string[];
  entries?: JournalEntry[];
  top_themes?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASK_PROMPT_CHIPS = [
  'What stresses me most?',
  'When was I happiest?',
  'What are my recurring worries?',
  'What do I write about most?',
  'When do I feel most energized?',
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function getMoodColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<SearchMode>(params.mode === 'ask' ? 'ask' : 'keyword');

  // ── Keyword search state ──
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
  const [isOfflineResults, setIsOfflineResults] = useState(false);

  // ── Ask AI state ──
  const [askQuery, setAskQuery] = useState('');
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineCacheRef = useRef<{ id: string; content: string; mood_emoji: string; mood_score: number; created_at: string; card_color: string }[]>([]);

  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const { isSubscribed } = useSubscription();
  const { isDark } = useTheme();
  const { requirePro } = useProGate();

  const showSearchUpsell = !isGuest && !isSubscribed;

  // Pre-load offline cache on mount
  useEffect(() => {
    if (isGuest) return;
    InteractionManager.runAfterInteractions(async () => {
      try {
        type CachedEntry = { id: string; content: string; mood_emoji: string; mood_score: number; created_at: string; card_color: string };
        const [homeCached, historyCached] = await Promise.all([
          cacheGet<CachedEntry[]>('home_entries'),
          cacheGet<{ entries: CachedEntry[]; total: number }>('history_entries'),
        ]);
        const seen = new Set<string>();
        const merged: CachedEntry[] = [];
        for (const entry of [...(historyCached?.data?.entries || []), ...(homeCached?.data || [])]) {
          if (entry?.id && !seen.has(entry.id)) {
            seen.add(entry.id);
            merged.push(entry);
          }
        }
        offlineCacheRef.current = merged;
      } catch {
        offlineCacheRef.current = [];
      }
    });
  }, [isGuest]);

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

  // ── Mode switch: clear state ──────────────────────────────────────────────

  const switchMode = useCallback((newMode: SearchMode) => {
    hapticSelection();
    setMode(newMode);
    // Clear keyword state
    setQuery('');
    setResults([]);
    setTotal(0);
    setOffset(0);
    setHasMore(true);
    setError(null);
    setIsOfflineResults(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    // Clear ask state
    setAskQuery('');
    setAskResult(null);
    setAskError(null);
    Keyboard.dismiss();
  }, []);

  // ── Keyword search ────────────────────────────────────────────────────────

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
      const filtered = guestEntries.filter((entry) =>
        entry.content?.toLowerCase().includes(terms)
      );
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
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);
      return (
        <Text className="text-text-secondary text-sm leading-5" numberOfLines={3}>
          {parts.map((part, index) => {
            const isMatch = part.toLowerCase() === searchQuery.toLowerCase();
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
          limit: 10,
          offset: searchOffset,
        },
      });

      const { entries, total: responseTotal, hasMore: responseHasMore } =
        response.data;

      if (isNewSearch) {
        setResults(entries || []);
        setOffset(10);
      } else {
        setResults((prev) => [...prev, ...(entries || [])]);
        setOffset((prev) => prev + 10);
      }

      setTotal(responseTotal || 0);
      setHasMore(responseHasMore ?? false);
      setIsOfflineResults(false);
      hapticLight();
    } catch (err) {
      Sentry.captureException(err);
      const allCached = offlineCacheRef.current;
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
        setIsOfflineResults(true);
        setError(
          localResults.length > 0
            ? null
            : t('search.noCachedResults')
        );
      } else {
        setError(t('search.failedSearch'));
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

  const handleClearKeyword = useCallback(() => {
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
    setIsOfflineResults(false);
    Keyboard.dismiss();
  }, []);

  const handleEntryPress = useCallback((entryId: string) => {
    hapticSelection();
    router.push(`/(protected)/entry/${entryId}` as never);
  }, []);

  // ── Ask AI ────────────────────────────────────────────────────────────────

  const handleAskSubmit = useCallback(async () => {
    const q = askQuery.trim();
    if (!q) return;

    const allowed = requirePro('Ask Your Journal');
    if (!allowed) return;

    hapticLight();
    Keyboard.dismiss();
    setAskLoading(true);
    setAskError(null);
    setAskResult(null);

    try {
      const response = await api.post('/journals/ask', { query: q, days: 90, limit: 5 });
      setAskResult(response.data);
    } catch (err: any) {
      Sentry.captureException(err);
      if (err?.response?.status === 429) {
        setAskError(t('search.rateLimitReached'));
      } else {
        setAskError(t('search.couldNotAnswer'));
      }
    } finally {
      setAskLoading(false);
    }
  }, [askQuery, requirePro]);

  const handleChipPress = useCallback((chip: string) => {
    hapticSelection();
    setAskQuery(chip);
    setAskResult(null);
    setAskError(null);
  }, []);

  const handleClearAsk = useCallback(() => {
    hapticSelection();
    setAskQuery('');
    setAskResult(null);
    setAskError(null);
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────

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
              <Text className="text-xl mr-2">{item.mood_emoji || '\u{1F4DD}'}</Text>
              <Text className="text-xs text-text-secondary">{formattedDate}</Text>
            </View>
            {item.mood_score > 0 && (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${getMoodColor(item.mood_score)}15` }}
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

  const renderKeywordFooter = useCallback(() => {
    if (isFetchingMore) {
      return (
        <View className="py-4">
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      );
    }
    if (isOfflineResults) {
      return (
        <View className="mx-5 my-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 flex-row items-center border border-amber-100 dark:border-amber-800">
          <Ionicons name="cloud-offline-outline" size={16} color="#D97706" />
          <Text className="text-xs text-amber-700 dark:text-amber-400 ml-2 flex-1">
            {t('search.offlineCacheOnly')}
          </Text>
        </View>
      );
    }
    return <View className="h-24" />;
  }, [isFetchingMore, isOfflineResults]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // ── Loading guard for guest ───────────────────────────────────────────────

  if (isGuest && loadingGuestEntries) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-text-muted mt-3">{t('search.loadingEntries')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 pt-6 pb-2 bg-background border-b border-border">
          <Text className="text-2xl font-bold text-text-primary">{t('search.title')}</Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {isGuest ? t('search.headerSubtitleGuest') : t('search.headerSubtitleAuth')}
          </Text>
        </View>

        {/* Mode Toggle Tabs */}
        <View className="flex-row mx-5 mt-3 rounded-xl bg-surface-muted p-1" style={{ gap: 4 }}>
          <Pressable
            className={`flex-1 py-2 rounded-lg items-center justify-center ${
              mode === 'keyword' ? 'bg-background' : ''
            }`}
            style={mode === 'keyword' ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 2,
              elevation: 2,
            } : undefined}
            onPress={() => switchMode('keyword')}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="search"
                size={14}
                color={mode === 'keyword' ? '#2563EB' : (isDark ? '#64748B' : '#9CA3AF')}
              />
              <Text
                className={`text-xs font-semibold ml-1.5 ${
                  mode === 'keyword' ? 'text-blue-600' : 'text-text-muted'
                }`}
              >
                {t('search.tabKeyword')}
              </Text>
            </View>
          </Pressable>

          <Pressable
            className={`flex-1 py-2 rounded-lg items-center justify-center ${
              mode === 'ask' ? 'bg-background' : ''
            }`}
            style={mode === 'ask' ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 2,
              elevation: 2,
            } : undefined}
            onPress={() => switchMode('ask')}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="sparkles"
                size={14}
                color={mode === 'ask' ? '#8B5CF6' : (isDark ? '#64748B' : '#9CA3AF')}
              />
              <Text
                className={`text-xs font-semibold ml-1.5 ${
                  mode === 'ask' ? 'text-violet-600' : 'text-text-muted'
                }`}
              >
                {t('search.tabAskJournal')}
              </Text>
              {!isSubscribed && (
                <View className="ml-1.5 rounded-full px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/50">
                  <Text className="text-[9px] font-bold text-violet-700 dark:text-violet-300">{t('common.pro')}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* ── Keyword Mode ─────────────────────────────────────────────────── */}
        {mode === 'keyword' && (
          <View className="flex-1">
            {/* Search Input */}
            <View className="px-5 py-3 bg-background">
              <View className="flex-row items-center bg-surface-muted rounded-xl px-4 py-2.5">
                <Ionicons name="search" size={18} color={isDark ? '#64748B' : '#9CA3AF'} />
                <TextInput
                  className="flex-1 ml-2.5 text-sm text-text-primary"
                  placeholder={t('search.searchEntries')}
                  placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                  value={query}
                  onChangeText={handleQueryChange}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="sentences"
                />
                {query.length > 0 && (
                  <Pressable onPress={handleClearKeyword} className="p-1">
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
                    {t('search.upgradeFullTextTitle')}
                  </Text>
                  <Text className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                    {t('search.upgradeFullTextSubtitle')}
                  </Text>
                </View>
                <View className="bg-blue-200 dark:bg-blue-700 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-blue-700 dark:text-blue-200">{t('common.pro')}</Text>
                </View>
              </Pressable>
            )}

            {/* Error State */}
            {error && !loading && (
              <View className="flex-1 items-center justify-center px-8">
                <View className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full items-center justify-center mb-4">
                  <Ionicons name="cloud-offline-outline" size={32} color="#EF4444" />
                </View>
                <Text className="text-base font-semibold text-text-primary mb-2">
                  {t('search.searchFailed')}
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
                  <Text className="text-white font-medium text-sm ml-2">{t('common.tryAgain')}</Text>
                </Pressable>
              </View>
            )}

            {/* Loading */}
            {!error && loading && results.length === 0 && query.length >= 2 && (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#2563EB" />
                <Text className="text-text-muted text-sm mt-3">{t('search.searching')}</Text>
              </View>
            )}

            {/* Results Count */}
            {!error && query.length >= 2 && !loading && results.length > 0 && (
              <Text className="text-xs text-text-secondary px-5 py-2">
                {t(total === 1 ? 'search.entriesFound_one' : 'search.entriesFound_other', { count: total })}
                {isGuest && (
                  <Text className="text-purple-500 dark:text-purple-400"> {t('search.localResults')}</Text>
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
                  ListFooterComponent={renderKeywordFooter}
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
                      {t('search.noEntriesFound')}
                    </Text>
                    <Text className="text-sm text-center text-text-secondary">
                      {t('search.noEntriesFoundSubtitle', { query })}
                    </Text>
                    <Pressable
                      className="mt-4 bg-surface-muted px-5 py-2.5 rounded-full"
                      onPress={handleClearKeyword}
                    >
                      <Text className="text-text-secondary font-medium text-sm">{t('search.clearSearch')}</Text>
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
                    {t('search.searchYourJournal')}
                  </Text>
                  <Text className="text-sm text-center text-text-secondary mb-6">
                    {t('search.searchSubtitle')}
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
                          {t('search.guestModeTitle')}
                        </Text>
                      </View>
                      <Text className="text-xs text-purple-600 dark:text-purple-400">
                        {t('search.guestModeBody')}
                      </Text>
                    </Pressable>
                  )}

                  <View className="bg-surface-muted rounded-xl p-4 w-full max-w-xs">
                    <Text className="text-xs font-medium text-text-secondary mb-2">
                      {t('search.trySearchingFor')}
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                      {['grateful', 'work', 'family', 'happy', 'weekend'].map((suggestion) => (
                        <Pressable
                          key={suggestion}
                          className="bg-surface-elevated px-3 py-1.5 rounded-full border border-border-strong"
                          onPress={() => {
                            hapticSelection();
                            setQuery(suggestion);
                            performSearch(suggestion, 0, true);
                          }}
                        >
                          <Text className="text-xs text-text-secondary">{suggestion}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )
            )}
          </View>
        )}

        {/* ── Ask Your Journal Mode ─────────────────────────────────────────── */}
        {mode === 'ask' && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="px-5 py-3 bg-background">
              {/* Ask input */}
              <View className="flex-row items-center bg-surface-muted rounded-xl px-4 py-2.5">
                <Ionicons name="sparkles" size={18} color={isDark ? '#8B5CF6' : '#8B5CF6'} />
                <TextInput
                  className="flex-1 ml-2.5 text-sm text-text-primary"
                  placeholder={t('search.askInput')}
                  placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                  value={askQuery}
                  onChangeText={(text) => {
                    setAskQuery(text);
                    if (askResult) setAskResult(null);
                    if (askError) setAskError(null);
                  }}
                  returnKeyType="send"
                  onSubmitEditing={handleAskSubmit}
                  multiline={false}
                  autoCorrect
                  autoCapitalize="sentences"
                />
                {askQuery.length > 0 && (
                  <Pressable onPress={handleClearAsk} className="p-1 mr-1">
                    <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#9CA3AF'} />
                  </Pressable>
                )}
                <Pressable
                  className={`rounded-lg px-3 py-1.5 ${
                    askQuery.trim().length > 0
                      ? 'bg-violet-600'
                      : 'bg-surface-elevated'
                  }`}
                  onPress={handleAskSubmit}
                  disabled={askQuery.trim().length === 0 || askLoading}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      askQuery.trim().length > 0 ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    {t('search.askButton')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Prompt chips */}
            {!askResult && !askLoading && (
              <View className="px-5 mb-4">
                <Text className="text-xs font-medium text-text-muted mb-2">
                  {t('search.tryAsking')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {ASK_PROMPT_CHIPS.map((chip) => (
                    <Pressable
                      key={chip}
                      className="bg-surface-elevated border border-border rounded-full px-3 py-2 active:opacity-70"
                      onPress={() => handleChipPress(chip)}
                    >
                      <Text className="text-xs text-text-secondary">{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Loading: animated thinking indicator */}
            {askLoading && (
              <View className="mx-5 mt-4 bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-5 border border-violet-100 dark:border-violet-800 items-center">
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text className="text-sm text-violet-700 dark:text-violet-300 font-medium mt-3">
                  {t('search.searchingMemories')}
                </Text>
                <Text className="text-xs text-violet-500 dark:text-violet-400 mt-1">
                  {t('search.analyzingEntries')}
                </Text>
              </View>
            )}

            {/* Ask error */}
            {!askLoading && askError && (
              <View className="mx-5 mt-4 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3 border border-red-100 dark:border-red-800 flex-row items-center">
                <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                <Text className="text-sm text-red-600 dark:text-red-400 ml-2 flex-1">
                  {askError}
                </Text>
              </View>
            )}

            {/* AI Answer card */}
            {!askLoading && askResult && (
              <View className="mx-5 mt-2">
                {/* Answer */}
                <View className="bg-surface-elevated rounded-2xl p-5 border border-border mb-3">
                  <View className="flex-row items-center mb-3">
                    <View className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 items-center justify-center mr-2">
                      <Ionicons name="sparkles" size={14} color="#8B5CF6" />
                    </View>
                    <Text className="text-sm font-bold text-text-primary">
                      {t('search.journalInsight')}
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary leading-relaxed">
                    {askResult.answer}
                  </Text>
                </View>

                {/* Top themes */}
                {askResult.top_themes && askResult.top_themes.length > 0 && (
                  <View className="mb-3">
                    <Text className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider px-1">
                      {t('search.topThemesLabel')}
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {askResult.top_themes.map((theme, i) => (
                        <View
                          key={i}
                          className="bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 rounded-full px-3 py-1.5"
                        >
                          <Text className="text-xs font-medium text-violet-700 dark:text-violet-300">
                            {theme}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Relevant entries */}
                {askResult.entries && askResult.entries.length > 0 && (
                  <View className="mb-3">
                    <Text className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider px-1">
                      {t('search.relatedEntries')}
                    </Text>
                    {askResult.entries.map((entry) => {
                      const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      });
                      const preview = entry.content.length > 100
                        ? entry.content.substring(0, 100) + '...'
                        : entry.content;
                      return (
                        <Pressable
                          key={entry.id}
                          className="bg-surface-elevated rounded-xl p-3.5 mb-2 border border-border flex-row items-start active:opacity-75"
                          onPress={() => {
                            hapticLight();
                            router.push(`/(protected)/entry/${entry.id}` as never);
                          }}
                        >
                          <Text className="text-xl mr-2.5">{entry.mood_emoji || '\u{1F4DD}'}</Text>
                          <View className="flex-1">
                            <Text className="text-xs text-text-muted mb-0.5">{formattedDate}</Text>
                            <Text className="text-sm text-text-secondary">{preview}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748B' : '#9CA3AF'} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Referenced dates (fallback when no entries array) */}
                {(!askResult.entries || askResult.entries.length === 0) && askResult.referenced_dates && askResult.referenced_dates.length > 0 && (
                  <View className="bg-surface-elevated rounded-2xl p-4 border border-border mb-3">
                    <Text className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                      {t('search.referencedEntries')}
                    </Text>
                    {askResult.referenced_dates.map((dateStr, i) => {
                      const d = new Date(dateStr);
                      const isValid = !isNaN(d.getTime());
                      return (
                        <View key={i} className="flex-row items-center py-2 border-b border-border last:border-0">
                          <View className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 items-center justify-center mr-2">
                            <Ionicons name="calendar-outline" size={12} color="#2563EB" />
                          </View>
                          <Text className="text-xs text-text-secondary">
                            {isValid
                              ? d.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : dateStr}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Ask again prompt */}
                <Pressable
                  className="mt-1 items-center py-3"
                  onPress={handleClearAsk}
                >
                  <Text className="text-xs text-text-muted">
                    {t('search.askSomethingElse')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Empty state when no query entered */}
            {!askLoading && !askResult && !askError && askQuery.trim().length === 0 && (
              <View className="flex-1 items-center justify-center px-8 mt-8">
                <View className="w-20 h-20 bg-violet-50 dark:bg-violet-900/30 rounded-full items-center justify-center mb-4">
                  <Ionicons name="sparkles" size={36} color="#8B5CF6" />
                </View>
                <Text className="text-base font-semibold text-text-primary mb-2">
                  {t('search.askEmptyTitle')}
                </Text>
                <Text className="text-sm text-center text-text-secondary">
                  {t('search.askEmptySubtitle')}
                </Text>
              </View>
            )}

            <View className="h-24" />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
