import React, { useState, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGuestEntries } from '../../lib/guest';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { cacheSet, cacheGet } from '../../lib/cache';
import { MOOD_OPTIONS } from '../../types/journal';
import type { JournalEntry, GuestEntry } from '../../types/journal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_ITEM_SIZE = (SCREEN_WIDTH - 40 - 8) / 2; // 2 columns, 20px side padding, 8px gap

type HistoryViewMode = 'all' | 'photos';

const PAGE_SIZE = 20;

const EMOTION_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  happy: { bg: '#FEF3C7', text: '#92400E' },
  sad: { bg: '#DBEAFE', text: '#1E40AF' },
  angry: { bg: '#FEE2E2', text: '#991B1B' },
  fear: { bg: '#EDE9FE', text: '#5B21B6' },
  disgust: { bg: '#D1FAE5', text: '#065F46' },
  surprise: { bg: '#FFEDD5', text: '#9A3412' },
  neutral: { bg: '#F1F5F9', text: '#475569' },
};

const EMOTION_EMOJIS_HISTORY: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fear: '😰',
  disgust: '🤢',
  surprise: '😲',
  neutral: '😐',
};

interface DisplayEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  photo_url?: string;
  entry_date: string;
  created_at: string;
  detected_emotion?: string;
}

function timeAgoKey(dateString: string): { key: string; options?: Record<string, unknown> } | string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'home.justNow';
  if (diffMins < 60) return { key: 'home.minutesAgo', options: { count: diffMins } };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { key: 'home.hoursAgo', options: { count: diffHours } };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'home.yesterday';
  if (diffDays < 7) return { key: 'home.daysAgo', options: { count: diffDays } };
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
  const { t } = useTranslation();
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
  const [viewMode, setViewMode] = useState<HistoryViewMode>('all');
  const [photoViewerEntry, setPhotoViewerEntry] = useState<DisplayEntry | null>(null);

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
            photo_url: e.photo_url || undefined,
            entry_date: e.entry_date,
            created_at: e.created_at,
            detected_emotion: e.detected_emotion,
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
      Sentry.captureException(err);
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
      setError(t('history.failedLoad'));
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

  // Entries with photos for the gallery tab
  const photoEntries = useMemo(
    () => entries.filter((e) => e.photo_url),
    [entries]
  );

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
                  {t('common.local')}
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
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Text className="text-xs text-text-muted">
                {(() => {
                  const r = timeAgoKey(item.created_at);
                  if (typeof r === 'string') return t(r);
                  return t(r.key, r.options);
                })()}
              </Text>
              {item.detected_emotion ? (() => {
                const key = item.detected_emotion.toLowerCase();
                const chip = EMOTION_CHIP_COLORS[key] || EMOTION_CHIP_COLORS.neutral;
                const emoji = EMOTION_EMOJIS_HISTORY[key] || '😐';
                return (
                  <View
                    className="flex-row items-center rounded-full px-1.5 py-0.5"
                    style={{ backgroundColor: chip.bg }}
                  >
                    <Text style={{ fontSize: 9 }}>{emoji}</Text>
                    <Text
                      className="font-medium capitalize ml-0.5"
                      style={{ fontSize: 9, color: chip.text }}
                    >
                      {item.detected_emotion}
                    </Text>
                  </View>
                );
              })() : null}
            </View>
            <Ionicons name="chevron-forward" size={14} color={isDark ? '#475569' : '#D1D5DB'} />
          </View>
        </View>

        {/* Photo Thumbnail */}
        {item.photo_url ? (
          <Image
            source={{ uri: item.photo_url }}
            style={{ width: 60, height: 60, borderRadius: 8, marginLeft: 8, alignSelf: 'center' }}
            contentFit="cover"
            placeholder="LGF5?xYk^6#M@-5c,1J5@[or[Q6."
            transition={200}
          />
        ) : null}
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-10 py-20">
      <Text className="text-5xl mb-4">{'\u{1F4D3}'}</Text>
      <Text className="text-lg font-semibold text-text-primary mb-2">
        {moodFilter ? t('history.noMatchingEntries') : t('history.noHistory')}
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-6">
        {moodFilter
          ? t('history.noMatchingSubtitle')
          : t('history.startJournalingHere')}
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
            {t('history.clearFilter')}
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
            {t('history.writeFirstEntry')}
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
        {t('history.somethingWentWrong')}
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
        <Text className="text-sm font-semibold text-white">{t('common.tryAgain')}</Text>
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
          {t('history.seenAllEntries')}
        </Text>
      );
    }

    return <View className="h-24" />;
  };

  // Unique moods from entries for filter
  const uniqueMoods = Array.from(new Set(entries.map((e) => e.mood_emoji)));

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Photo Viewer Modal */}
      <Modal
        visible={photoViewerEntry !== null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setPhotoViewerEntry(null)}
      >
        <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
          {/* Close button */}
          <Pressable
            className="absolute top-14 right-5 z-10 w-10 h-10 rounded-full bg-black/60 items-center justify-center"
            onPress={() => setPhotoViewerEntry(null)}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          {photoViewerEntry && (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Full-screen photo */}
              <Image
                source={{ uri: photoViewerEntry.photo_url! }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                contentFit="cover"
                transition={300}
              />

              {/* Entry content below photo */}
              <View className="p-5">
                <View className="flex-row items-center mb-3">
                  <Text className="text-2xl mr-2">{photoViewerEntry.mood_emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-sm text-slate-400">
                      {formatDate(photoViewerEntry.entry_date || photoViewerEntry.created_at)}
                    </Text>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${getMoodColor(photoViewerEntry.mood_score)}20` }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ color: getMoodColor(photoViewerEntry.mood_score) }}
                    >
                      {photoViewerEntry.mood_score}
                    </Text>
                  </View>
                </View>
                {photoViewerEntry.content ? (
                  <Text className="text-base text-slate-200 leading-relaxed">
                    {photoViewerEntry.content}
                  </Text>
                ) : null}
                <Pressable
                  className="mt-4 bg-blue-600 rounded-xl py-3 items-center"
                  onPress={() => {
                    setPhotoViewerEntry(null);
                    hapticLight();
                    router.push(`/(protected)/entry/${photoViewerEntry.id}`);
                  }}
                >
                  <Text className="text-white font-semibold text-sm">
                    {t('history.openEntry')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Header */}
      <View className="px-5 pt-6 pb-3 bg-background border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-text-primary">{t('history.title')}</Text>
            <View className="bg-blue-50 dark:bg-blue-900/30 rounded-full px-2.5 py-0.5 ml-3 border border-blue-100 dark:border-blue-800">
              <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {moodFilter ? displayEntries.length : total}
              </Text>
            </View>
          </View>

          {/* View mode toggle: All | Photos */}
          <View className="flex-row bg-surface-muted rounded-lg p-0.5" style={{ gap: 2 }}>
            <Pressable
              onPress={() => { hapticSelection(); setViewMode('all'); }}
              className={`px-3 py-1 rounded-md ${viewMode === 'all' ? 'bg-background' : ''}`}
            >
              <Text className={`text-xs font-semibold ${viewMode === 'all' ? 'text-text-primary' : 'text-text-muted'}`}>
                {t('history.tabAll')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { hapticSelection(); setViewMode('photos'); }}
              className={`flex-row items-center px-3 py-1 rounded-md ${viewMode === 'photos' ? 'bg-background' : ''}`}
            >
              <Ionicons
                name="images-outline"
                size={11}
                color={viewMode === 'photos' ? (isDark ? '#E2E8F0' : '#374151') : (isDark ? '#64748B' : '#9CA3AF')}
              />
              <Text className={`text-xs font-semibold ml-1 ${viewMode === 'photos' ? 'text-text-primary' : 'text-text-muted'}`}>
                {t('history.tabPhotos')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Mood Filter Chips — only in "All" mode */}
        {viewMode === 'all' && uniqueMoods.length > 1 && (
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
                  {t('common.clear')}
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
              {t('history.signUpToSync')}
            </Text>
          </View>
          <Pressable
            className="bg-amber-600 rounded-lg px-3 py-1"
            onPress={() => {
              hapticLight();
              router.push('/(auth)/register');
            }}
          >
            <Text className="text-xs font-medium text-white">{t('common.signUp')}</Text>
          </Pressable>
        </View>
      )}

      {/* Offline indicator */}
      {isStale && (
        <View className="bg-amber-50 dark:bg-amber-900/20 px-5 py-2.5 flex-row items-center border-b border-amber-100 dark:border-amber-800">
          <Ionicons name="cloud-offline-outline" size={14} color="#D97706" />
          <Text className="text-xs text-amber-700 dark:text-amber-400 ml-2">
            {t('history.showingCachedData')}
          </Text>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 pt-4">{renderLoadingSkeleton()}</View>
      ) : error ? (
        renderErrorState()
      ) : viewMode === 'photos' ? (
        // ── Photo Gallery Grid ───────────────────────────────────────────────
        photoEntries.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10 py-20">
            <Ionicons name="images-outline" size={48} color={isDark ? '#475569' : '#D1D5DB'} />
            <Text className="text-lg font-semibold text-text-primary mt-4 mb-2">
              {t('history.noPhotos')}
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              {t('history.noPhotosSubtitle')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={photoEntries}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 20, gap: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                className="rounded-xl overflow-hidden active:opacity-80"
                style={{ width: PHOTO_GRID_ITEM_SIZE, height: PHOTO_GRID_ITEM_SIZE }}
                onPress={() => {
                  hapticLight();
                  setPhotoViewerEntry(item);
                }}
              >
                <Image
                  source={{ uri: item.photo_url! }}
                  style={{ width: PHOTO_GRID_ITEM_SIZE, height: PHOTO_GRID_ITEM_SIZE }}
                  contentFit="cover"
                  transition={200}
                />
                {/* Overlay with mood emoji + date */}
                <View
                  className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ fontSize: 16 }}>{item.mood_emoji}</Text>
                    <Text className="text-xs text-white font-medium">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#2563EB"
                colors={['#2563EB']}
              />
            }
          />
        )
      ) : (
        // ── All Entries List ─────────────────────────────────────────────────
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
