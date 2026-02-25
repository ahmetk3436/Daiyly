import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';
import { getGuestEntries } from '../../lib/guest';
import { hapticLight, hapticSelection, hapticSuccess } from '../../lib/haptics';
import { maybeRequestReview } from '../../lib/review';
import { cacheSet, cacheGet } from '../../lib/cache';
import { MOOD_OPTIONS } from '../../types/journal';
import type { JournalEntry, GuestEntry, JournalStreak } from '../../types/journal';

// Time-aware greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '\u{1F31C}';
  if (hour < 12) return '\u{2600}\u{FE0F}';
  if (hour < 17) return '\u{1F324}\u{FE0F}';
  if (hour < 21) return '\u{1F305}';
  return '\u{1F31C}';
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

function getMoodColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

interface DisplayEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  created_at: string;
}

export default function HomeScreen() {
  const { user, isAuthenticated, isGuest } = useAuth();
  const { isDark } = useTheme();

  const [recentEntries, setRecentEntries] = useState<DisplayEntry[]>([]);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [todayMood, setTodayMood] = useState<DisplayEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const userName = user?.email?.split('@')[0] || 'there';

  const fetchHomeData = useCallback(async () => {
    try {
      setIsStale(false);
      if (isAuthenticated) {
        const [entriesRes, streakRes] = await Promise.all([
          api.get('/journals?offset=0&limit=5'),
          api.get('/streak').catch(() => ({ data: null })),
        ]);

        const entries: DisplayEntry[] = (entriesRes.data.entries || []).map(
          (e: JournalEntry) => ({
            id: e.id,
            mood_emoji: e.mood_emoji,
            mood_score: e.mood_score,
            content: e.content,
            card_color: e.card_color,
            created_at: e.created_at,
          })
        );

        setRecentEntries(entries);
        setStreak(streakRes.data);

        // Review prompt on streak milestones
        const STREAK_MILESTONES = [7, 14, 30, 60, 100];
        const cs = streakRes.data?.current_streak || 0;
        if (cs > 0 && STREAK_MILESTONES.includes(cs)) {
          maybeRequestReview('streak_milestone').catch(() => {});
        }

        // Cache for offline use
        cacheSet('home_entries', entries);
        if (streakRes.data) cacheSet('home_streak', streakRes.data);

        // Check if today has an entry
        const today = new Date().toDateString();
        const todayEntry = entries.find(
          (e) => new Date(e.created_at).toDateString() === today
        );
        setTodayMood(todayEntry || null);
      } else {
        // Guest mode
        const guestEntries = await getGuestEntries();
        const entries: DisplayEntry[] = guestEntries
          .map((e: GuestEntry) => ({
            id: e.id,
            mood_emoji: e.mood_emoji,
            mood_score: e.mood_score,
            content: e.content,
            card_color: e.card_color,
            created_at: e.created_at,
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5);

        setRecentEntries(entries);

        const today = new Date().toDateString();
        const todayEntry = entries.find(
          (e) => new Date(e.created_at).toDateString() === today
        );
        setTodayMood(todayEntry || null);
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
      // Offline fallback: try cache
      if (isAuthenticated) {
        const cached = await cacheGet<DisplayEntry[]>('home_entries');
        const cachedStreak = await cacheGet<JournalStreak>('home_streak');
        if (cached) {
          setRecentEntries(cached.data);
          setIsStale(true);
          const today = new Date().toDateString();
          const todayEntry = cached.data.find(
            (e) => new Date(e.created_at).toDateString() === today
          );
          setTodayMood(todayEntry || null);
        }
        if (cachedStreak) setStreak(cachedStreak.data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHomeData();
    }, [fetchHomeData])
  );

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const handleNewEntry = () => {
    hapticLight();
    router.push('/(protected)/new-entry');
  };

  const handleQuickMood = (emoji: string) => {
    hapticSelection();
    router.push({
      pathname: '/(protected)/new-entry',
      params: { quickMood: emoji },
    });
  };

  const handleEntryPress = (entryId: string) => {
    hapticLight();
    router.push(`/(protected)/entry/${entryId}`);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-base text-text-muted mt-4">
            Loading your journal...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStreak = streak?.current_streak || 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {/* Header: Greeting + Streak */}
        <View className="px-6 pt-6 pb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm text-text-muted font-medium">
                {getGreetingEmoji()} {getGreeting()}
              </Text>
              <Text
                className="text-2xl font-bold text-text-primary mt-0.5"
                numberOfLines={1}
              >
                {userName}
              </Text>
            </View>

            {/* Streak Badge */}
            {currentStreak > 0 && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push('/(protected)/insights');
                }}
                className="flex-row items-center bg-amber-50 dark:bg-amber-900/30 rounded-full px-3 py-1.5 border border-amber-200 dark:border-amber-700"
              >
                <Text className="text-lg mr-1">{'\u{1F525}'}</Text>
                <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {currentStreak}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Offline indicator */}
        {isStale && (
          <View className="mx-6 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2 flex-row items-center border border-amber-100 dark:border-amber-800">
            <Ionicons name="cloud-offline-outline" size={14} color="#D97706" />
            <Text className="text-xs text-amber-700 dark:text-amber-400 ml-2">
              Showing cached data — pull to refresh
            </Text>
          </View>
        )}

        {/* Today's Mood Summary */}
        {todayMood && (
          <View className="mx-6 mt-3 mb-1">
            <Pressable
              className="bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-4 flex-row items-center border border-blue-100 dark:border-blue-800 active:scale-[0.98]"
              onPress={() => handleEntryPress(todayMood.id)}
            >
              <Text className="text-3xl mr-3">{todayMood.mood_emoji}</Text>
              <View className="flex-1">
                <Text className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                  Today's Mood
                </Text>
                <Text
                  className="text-sm text-text-secondary mt-0.5"
                  numberOfLines={1}
                >
                  {todayMood.content || 'Tap to view your entry'}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: `${getMoodColor(todayMood.mood_score)}15` }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: getMoodColor(todayMood.mood_score) }}
                >
                  {todayMood.mood_score}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* New Entry CTA */}
        <View className="px-6 mt-4">
          <Pressable
            onPress={handleNewEntry}
            className="active:scale-[0.97]"
          >
            <LinearGradient
              colors={['#2563EB', '#1D4ED8'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-2xl p-5 flex-row items-center"
              style={{
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View className="bg-white/20 w-12 h-12 rounded-xl items-center justify-center mr-4">
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold">
                  New Entry
                </Text>
                <Text className="text-white/80 text-sm mt-0.5">
                  How are you feeling today?
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Quick Mood Selector */}
        <View className="mt-6 px-6">
          <Text className="text-sm font-semibold text-text-secondary mb-3">
            Quick Check-in
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {MOOD_OPTIONS.map((mood) => (
              <Pressable
                key={mood.value}
                onPress={() => handleQuickMood(mood.emoji)}
                className="items-center active:scale-95"
              >
                <View
                  className="w-14 h-14 rounded-full items-center justify-center mb-1"
                  style={{ backgroundColor: `${mood.color}15` }}
                >
                  <Text className="text-2xl">{mood.emoji}</Text>
                </View>
                <Text className="text-xs text-text-secondary">{mood.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Share Your Mood Card */}
        {recentEntries.length > 0 && (
          <View className="px-6 mt-5">
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/sharing');
              }}
              className="active:scale-[0.97]"
            >
              <View
                className="bg-purple-50 dark:bg-purple-900/30 rounded-2xl p-4 flex-row items-center border border-purple-100 dark:border-purple-800"
              >
                <View className="bg-purple-100 dark:bg-purple-800 w-10 h-10 rounded-xl items-center justify-center mr-3">
                  <Ionicons name="share-social-outline" size={20} color={isDark ? '#C084FC' : '#7C3AED'} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                    Share Your Mood
                  </Text>
                  <Text className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                    Create beautiful share cards for stories
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#C084FC' : '#7C3AED'} />
              </View>
            </Pressable>
          </View>
        )}

        {/* Guest Mode Banner */}
        {isGuest && (
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(auth)/register');
            }}
            className="mx-6 mt-5 bg-purple-50 dark:bg-purple-900/30 rounded-2xl p-4 flex-row items-center border border-purple-100 dark:border-purple-800 active:opacity-80"
          >
            <View className="bg-purple-100 dark:bg-purple-800 w-10 h-10 rounded-full items-center justify-center mr-3">
              <Ionicons name="person-add-outline" size={20} color={isDark ? '#C084FC' : '#7C3AED'} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Create a Free Account
              </Text>
              <Text className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                Sync entries, unlock insights & streaks
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#C084FC' : '#7C3AED'} />
          </Pressable>
        )}

        {/* Recent Entries */}
        <View className="mt-6 px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-text-secondary">
              Recent Entries
            </Text>
            {recentEntries.length > 0 && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push('/(protected)/history');
                }}
              >
                <Text className="text-sm font-medium text-blue-600">
                  See All
                </Text>
              </Pressable>
            )}
          </View>

          {recentEntries.length === 0 ? (
            <View className="bg-surface-muted rounded-2xl p-8 items-center">
              <Text className="text-4xl mb-3">{'\u{1F4D3}'}</Text>
              <Text className="text-base font-semibold text-text-primary">
                No entries yet
              </Text>
              <Text className="text-sm text-text-muted text-center mt-1">
                Tap "New Entry" to start your journaling journey
              </Text>
            </View>
          ) : (
            recentEntries.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => handleEntryPress(entry.id)}
                className="bg-surface-elevated rounded-xl p-4 mb-2.5 border border-border flex-row items-center active:scale-[0.98]"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.15 : 0.03,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                {/* Left accent bar */}
                <View
                  className="w-1 rounded-full self-stretch mr-3"
                  style={{
                    backgroundColor: entry.card_color || '#3B82F6',
                  }}
                />

                {/* Mood emoji */}
                <Text className="text-2xl mr-3">
                  {entry.mood_emoji || '\u{1F4DD}'}
                </Text>

                {/* Content */}
                <View className="flex-1">
                  <Text
                    className="text-sm text-text-primary"
                    numberOfLines={2}
                  >
                    {entry.content || 'No content'}
                  </Text>
                  <Text className="text-xs text-text-muted mt-1">
                    {timeAgo(entry.created_at)}
                  </Text>
                </View>

                {/* Score badge */}
                <View
                  className="rounded-full px-2 py-0.5 ml-2"
                  style={{
                    backgroundColor: `${getMoodColor(entry.mood_score)}15`,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: getMoodColor(entry.mood_score) }}
                  >
                    {entry.mood_score}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Bottom spacing for tab bar */}
        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
