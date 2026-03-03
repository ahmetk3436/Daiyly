import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
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

const EMOTION_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  happy: { bg: '#FEF3C7', text: '#92400E' },
  sad: { bg: '#DBEAFE', text: '#1E40AF' },
  angry: { bg: '#FEE2E2', text: '#991B1B' },
  fear: { bg: '#EDE9FE', text: '#5B21B6' },
  disgust: { bg: '#D1FAE5', text: '#065F46' },
  surprise: { bg: '#FFEDD5', text: '#9A3412' },
  neutral: { bg: '#F1F5F9', text: '#475569' },
};

const EMOTION_EMOJIS_HOME: Record<string, string> = {
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
  created_at: string;
  detected_emotion?: string;
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
  const [streakCelebration, setStreakCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  const userName = user?.email?.split('@')[0] || 'there';

  // Animate celebration in when streakCelebration becomes true
  useEffect(() => {
    if (streakCelebration) {
      celebrationScale.setValue(0);
      celebrationOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [streakCelebration]);

  const fetchHomeData = useCallback(async () => {
    try {
      setIsStale(false);
      if (isAuthenticated) {
        const [entriesRes, streakRes] = await Promise.all([
          api.get('/journals?offset=0&limit=5'),
          api.get('/journals/streak').catch(() => ({ data: null })),
        ]);

        const entries: DisplayEntry[] = (entriesRes.data.entries || []).map(
          (e: JournalEntry) => ({
            id: e.id,
            mood_emoji: e.mood_emoji,
            mood_score: e.mood_score,
            content: e.content,
            card_color: e.card_color,
            photo_url: e.photo_url || undefined,
            created_at: e.created_at,
            detected_emotion: e.detected_emotion,
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

        // Celebration animation for key milestones
        const CELEBRATION_MILESTONES = [3, 7, 30, 100];
        if (cs > 0 && CELEBRATION_MILESTONES.includes(cs)) {
          hapticSuccess();
          setCelebrationStreak(cs);
          setStreakCelebration(true);
          setTimeout(() => setStreakCelebration(false), 3000);
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
      Sentry.captureException(err);
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
                <Text className="text-lg mr-1">
                  {(streak?.grace_period_active || streak?.grace_active) ? '\u{1F9CA}' : '\u{1F525}'}
                </Text>
                <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {currentStreak}
                </Text>
                {(streak?.grace_period_active || streak?.grace_active) && (
                  <View className="ml-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full px-1.5 py-0.5">
                    <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                      Freeze active
                    </Text>
                  </View>
                )}
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

        {/* Grace Period Banner */}
        {(streak?.grace_period_active || streak?.grace_active) && (
          <View className="mx-6 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5 flex-row items-center border border-amber-300 dark:border-amber-700">
            <Text className="text-base mr-2">{'\u26A1'}</Text>
            <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex-1">
              Streak Grace Active — Write today to keep your {currentStreak}-day streak!
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
            className="flex-row items-center bg-surface-elevated border border-border rounded-2xl p-4 active:scale-[0.97]"
          >
            <View className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
              <Ionicons name="add" size={24} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text-primary">
                New Entry
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                How are you feeling today?
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#475569' : '#D1D5DB'} />
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
                  <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                    <Text className="text-xs text-text-muted">
                      {timeAgo(entry.created_at)}
                    </Text>
                    {entry.detected_emotion ? (() => {
                      const key = entry.detected_emotion.toLowerCase();
                      const chip = EMOTION_CHIP_COLORS[key] || EMOTION_CHIP_COLORS.neutral;
                      const emoji = EMOTION_EMOJIS_HOME[key] || '😐';
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
                            {entry.detected_emotion}
                          </Text>
                        </View>
                      );
                    })() : null}
                  </View>
                </View>

                {/* Photo thumbnail */}
                {entry.photo_url ? (
                  <Image
                    source={{ uri: entry.photo_url }}
                    style={{ width: 60, height: 60, borderRadius: 8, marginLeft: 8 }}
                    contentFit="cover"
                    placeholder="LGF5?xYk^6#M@-5c,1J5@[or[Q6."
                    transition={200}
                  />
                ) : null}

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

      {/* Streak Celebration Modal */}
      <Modal
        visible={streakCelebration}
        transparent
        animationType="none"
        onRequestClose={() => setStreakCelebration(false)}
      >
        <Animated.View
          style={{ opacity: celebrationOpacity }}
          className="flex-1 items-center justify-center"
          pointerEvents="box-none"
        >
          <View
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          />
          <Pressable
            className="absolute inset-0"
            onPress={() => setStreakCelebration(false)}
          />
          <Animated.View
            style={{ transform: [{ scale: celebrationScale }] }}
            className="bg-background rounded-3xl items-center px-10 py-10 mx-8"
            pointerEvents="box-none"
          >
            <Text style={{ fontSize: 72, lineHeight: 88 }}>
              {'\u{1F525}'}
            </Text>
            <Text className="text-2xl font-bold text-text-primary mt-3 text-center">
              {celebrationStreak}-Day Streak!
            </Text>
            <Text className="text-sm text-text-secondary mt-2 text-center">
              {celebrationStreak === 3
                ? "You're building a habit. Keep going!"
                : celebrationStreak === 7
                ? "One full week of journaling. Incredible!"
                : celebrationStreak === 30
                ? "30 days strong. You're unstoppable."
                : "100 days! A true journaling master."}
            </Text>
            <Pressable
              onPress={() => setStreakCelebration(false)}
              className="mt-6 bg-amber-500 rounded-2xl px-8 py-3"
            >
              <Text className="text-white font-bold text-base">
                Keep it up!
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
