import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';
import { getGuestEntries } from '../../lib/guest';
import { hapticLight, hapticSelection, hapticSuccess, hapticError } from '../../lib/haptics';
import { maybeRequestReview } from '../../lib/review';
import { cacheSet, cacheGet } from '../../lib/cache';
import { MOOD_OPTIONS } from '../../types/journal';
import type { JournalEntry, GuestEntry, JournalStreak } from '../../types/journal';

// ─── Week In Review helpers ───────────────────────────────────────────────────

interface WeekStats {
  avgMood: number;
  dominantEmoji: string;
  entryCount: number;
  bestDay: string;
  worstDay: string;
  isSunday: boolean;
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ...
  // Treat Monday as start of week
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - daysFromMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function modeOf<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const freq = new Map<string, number>();
  for (const item of arr) {
    const key = String(item);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let bestKey = String(arr[0]);
  let bestCount = 0;
  for (const [k, c] of freq.entries()) {
    if (c > bestCount) { bestCount = c; bestKey = k; }
  }
  return arr.find((x) => String(x) === bestKey) ?? arr[0];
}

function computeWeekStats(entries: DisplayEntry[]): WeekStats | null {
  const { start, end } = getWeekBounds();
  const weekEntries = entries.filter((e) => {
    const d = new Date(e.created_at);
    return d >= start && d <= end;
  });
  if (weekEntries.length < 3) return null;

  const avgMood = Math.round(
    weekEntries.reduce((sum, e) => sum + e.mood_score, 0) / weekEntries.length
  );
  const dominantEmoji = modeOf(weekEntries.map((e) => e.mood_emoji)) ?? '';

  // Best / worst day
  const sorted = [...weekEntries].sort((a, b) => b.mood_score - a.mood_score);
  const bestDay = new Date(sorted[0].created_at).toLocaleDateString('en-US', { weekday: 'short' });
  const worstDay = new Date(sorted[sorted.length - 1].created_at).toLocaleDateString('en-US', { weekday: 'short' });

  const isSunday = new Date().getDay() === 0;

  return { avgMood, dominantEmoji, entryCount: weekEntries.length, bestDay, worstDay, isSunday };
}

function getMoodColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

const FIRST_VISIT_KEY = '@daiyly_first_visit';
const INTENT_ANSWERS_KEY = '@daiyly_onboarding_intent';

type IntentAnswers = {
  why: string;
  frequency: string;
  priority: string;
};

interface OnThisDayEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  created_at: string;
}

// Time-aware greeting key
function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'home.greeting_night';
  if (hour < 12) return 'home.greeting_morning';
  if (hour < 17) return 'home.greeting_afternoon';
  if (hour < 21) return 'home.greeting_evening';
  return 'home.greeting_night';
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '\u{1F31C}';
  if (hour < 12) return '\u{2600}\u{FE0F}';
  if (hour < 17) return '\u{1F324}\u{FE0F}';
  if (hour < 21) return '\u{1F305}';
  return '\u{1F31C}';
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

function getIntentBannerKey(intent: IntentAnswers): string {
  switch (intent.priority) {
    case 'privacy': return 'home.intentBannerPrivacy';
    case 'ai': return 'home.intentBannerAI';
    case 'media': return 'home.intentBannerMedia';
    case 'patterns': return 'home.intentBannerPatterns';
    default: break;
  }
  switch (intent.why) {
    case 'stress': return 'home.intentBannerStress';
    case 'habits': return 'home.intentBannerHabits';
    case 'emotions': return 'home.intentBannerEmotions';
    default: return 'home.intentBannerDefault';
  }
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isGuest } = useAuth();
  const { isDark } = useTheme();

  const [recentEntries, setRecentEntries] = useState<DisplayEntry[]>([]);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [todayMood, setTodayMood] = useState<DisplayEntry | null>(null);
  const [onThisDay, setOnThisDay] = useState<OnThisDayEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [streakCelebration, setStreakCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);
  const [intentBanner, setIntentBanner] = useState<string | null>(null);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ask Your Journal state
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState(false);

  const userName = user?.email?.split('@')[0] || 'there';

  // Compute week-in-review stats from recent entries
  const weekStats = useMemo(() => computeWeekStats(recentEntries), [recentEntries]);

  // Load intent-based welcome banner on first visit
  useEffect(() => {
    (async () => {
      try {
        const alreadySeen = await AsyncStorage.getItem(FIRST_VISIT_KEY);
        if (alreadySeen) return;
        const raw = await AsyncStorage.getItem(INTENT_ANSWERS_KEY);
        if (!raw) return;
        const answers: IntentAnswers = JSON.parse(raw);
        const message = t(getIntentBannerKey(answers));
        setIntentBanner(message);
        await AsyncStorage.setItem(FIRST_VISIT_KEY, 'true');
      } catch {
        // non-critical, ignore
      }
    })();
  }, []);

  // Clean up celebration timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, []);

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
        const [entriesRes, streakRes, onThisDayRes] = await Promise.all([
          api.get('/journals?offset=0&limit=5'),
          api.get('/journals/streak').catch(() => ({ data: null })),
          api.get('/journals/on-this-day').catch(() => ({ data: null })),
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

        // On This Day
        const otd = onThisDayRes.data;
        if (otd && (otd.id || (Array.isArray(otd) && otd.length > 0))) {
          const entry = Array.isArray(otd) ? otd[0] : otd;
          setOnThisDay(entry as OnThisDayEntry);
        } else {
          setOnThisDay(null);
        }

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
          if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
          celebrationTimerRef.current = setTimeout(() => setStreakCelebration(false), 3000);
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

  const handleAskJournal = useCallback(async () => {
    const q = askQuestion.trim();
    if (!q || !isAuthenticated) return;
    hapticLight();
    setAskLoading(true);
    setAskAnswer(null);
    setAskError(false);
    try {
      const { data } = await api.post('/journals/ask', { question: q });
      const answer: string = data.answer || data.text || data.response || '';
      if (answer) {
        hapticSuccess();
        setAskAnswer(answer);
      } else {
        setAskError(true);
        hapticError();
      }
    } catch (err) {
      Sentry.captureException(err);
      setAskError(true);
      hapticError();
    } finally {
      setAskLoading(false);
    }
  }, [askQuestion, isAuthenticated]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-base text-text-muted mt-4">
            {t('home.loadingJournal')}
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
                {getGreetingEmoji()} {t(getGreetingKey())}
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
                  router.push('/(protected)/streak-details' as never);
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
                      {t('home.streakProtected')}
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
              {t('home.showingCachedData')}
            </Text>
          </View>
        )}

        {/* Intent-based welcome banner (first visit only) */}
        {intentBanner !== null && (
          <View className="mx-6 mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 flex-row items-center border border-blue-100 dark:border-blue-800">
            <Ionicons name="sparkles-outline" size={16} color="#2563EB" />
            <Text className="text-xs text-blue-700 dark:text-blue-300 ml-2 flex-1">
              {intentBanner}
            </Text>
            <Pressable
              onPress={() => { hapticLight(); setIntentBanner(null); }}
              className="ml-2 p-1"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={14} color={isDark ? '#93C5FD' : '#2563EB'} />
            </Pressable>
          </View>
        )}

        {/* Grace Period Banner */}
        {(streak?.grace_period_active || streak?.grace_active) && (
          <Pressable
            onPress={() => { hapticLight(); router.push('/(protected)/streak-details' as never); }}
            className="mx-6 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5 flex-row items-center border border-amber-300 dark:border-amber-700 active:opacity-80"
          >
            <Text className="text-base mr-2">{'\u{1F9CA}'}</Text>
            <View className="flex-1">
              <Text className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {t('home.streakProtectedBanner')}
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {t('home.streakProtectedWrite', { count: currentStreak })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D97706" />
          </Pressable>
        )}

        {/* Streak At Risk Banner */}
        {currentStreak > 0 && !todayMood && !(streak?.grace_period_active || streak?.grace_active) && (
          <Pressable
            onPress={() => { hapticLight(); router.push('/(protected)/new-entry'); }}
            className="mx-6 mt-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 flex-row items-center border border-red-200 dark:border-red-800 active:opacity-80"
          >
            <Text className="text-base mr-2">{'\u{2744}\u{FE0F}'}</Text>
            <View className="flex-1">
              <Text className="text-xs font-bold text-red-700 dark:text-red-400">
                {t('home.streakAtRisk')}
              </Text>
              <Text className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                {t('home.streakAtRiskDontLose', { count: currentStreak })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </Pressable>
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
                  {t('home.todaysMood')}
                </Text>
                <Text
                  className="text-sm text-text-secondary mt-0.5"
                  numberOfLines={1}
                >
                  {todayMood.content || t('home.tapToViewEntry')}
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
                {t('home.newEntry')}
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                {t('home.howAreYouToday')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#475569' : '#D1D5DB'} />
          </Pressable>
        </View>

        {/* Quick Mood Selector */}
        <View className="mt-6 px-6">
          <Text className="text-sm font-semibold text-text-secondary mb-3">
            {t('home.quickCheckin')}
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
                    {t('home.shareYourMood')}
                  </Text>
                  <Text className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                    {t('home.shareYourMoodSubtitle')}
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
                {t('home.createFreeAccount')}
              </Text>
              <Text className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                {t('home.syncEntriesSubtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#C084FC' : '#7C3AED'} />
          </Pressable>
        )}

        {/* Week In Review Card */}
        {weekStats !== null && (
          <View className="mx-6 mt-5 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: isDark ? '#1E3A5F' : '#1E40AF',
              shadowColor: '#1E40AF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            {/* Card header */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <View>
                <Text className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                  {weekStats.isSunday
                    ? t('home.weekInReviewTitle')
                    : t('home.weekSoFarTitle')}
                </Text>
                <Text className="text-base font-bold text-white mt-0.5">
                  {weekStats.dominantEmoji} {t('home.weekInReviewSubtitle', { count: weekStats.entryCount })}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: `${getMoodColor(weekStats.avgMood)}30` }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: getMoodColor(weekStats.avgMood) }}
                >
                  {weekStats.avgMood}
                </Text>
              </View>
            </View>

            {/* 2x2 Stats Grid */}
            <View className="flex-row flex-wrap px-4 pb-4 mt-1" style={{ gap: 8 }}>
              <View className="flex-1 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', minWidth: '45%' }}>
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide font-medium">
                  {t('home.weekInReviewAvgMood')}
                </Text>
                <Text className="text-lg font-bold text-white mt-0.5">{weekStats.avgMood}/100</Text>
              </View>
              <View className="flex-1 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', minWidth: '45%' }}>
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide font-medium">
                  {t('home.weekInReviewEntries')}
                </Text>
                <Text className="text-lg font-bold text-white mt-0.5">{weekStats.entryCount}</Text>
              </View>
              <View className="flex-1 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', minWidth: '45%' }}>
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide font-medium">
                  {t('home.weekInReviewBestDay')}
                </Text>
                <Text className="text-lg font-bold text-white mt-0.5">{weekStats.bestDay}</Text>
              </View>
              <View className="flex-1 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', minWidth: '45%' }}>
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide font-medium">
                  {t('home.weekInReviewWorstDay')}
                </Text>
                <Text className="text-lg font-bold text-white mt-0.5">{weekStats.worstDay}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ask Your Journal */}
        {isAuthenticated && (
          <View className="mt-6 px-6">
            <Text className="text-sm font-semibold text-text-secondary mb-3">
              {t('askJournal.title')}
            </Text>
            <View className="flex-row items-center bg-surface-elevated border border-border rounded-2xl overflow-hidden">
              <TextInput
                className="flex-1 px-4 py-3 text-sm text-text-primary"
                placeholder={t('askJournal.placeholder')}
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                value={askQuestion}
                onChangeText={(text) => {
                  setAskQuestion(text);
                  if (askAnswer) setAskAnswer(null);
                  if (askError) setAskError(false);
                }}
                returnKeyType="send"
                onSubmitEditing={handleAskJournal}
                editable={!askLoading}
              />
              <Pressable
                onPress={handleAskJournal}
                disabled={askLoading || !askQuestion.trim()}
                className="px-4 py-3"
              >
                {askLoading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={askQuestion.trim() ? '#2563EB' : (isDark ? '#475569' : '#D1D5DB')}
                  />
                )}
              </Pressable>
            </View>
            {askLoading && (
              <Text className="text-xs text-text-muted mt-2 px-1">
                {t('askJournal.loading')}
              </Text>
            )}
            {askError && (
              <Text className="text-xs text-red-500 mt-2 px-1">
                {t('askJournal.error')}
              </Text>
            )}
            {askAnswer && (
              <View className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 border border-blue-100 dark:border-blue-800">
                <View className="flex-row items-start" style={{ gap: 8 }}>
                  <Ionicons name="sparkles" size={14} color="#2563EB" style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-text-primary leading-5">
                    {askAnswer}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setAskAnswer(null); setAskQuestion(''); }}
                  className="mt-2 self-end"
                >
                  <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Ask something else →
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Recent Entries */}
        <View className="mt-6 px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-text-secondary">
              {t('home.recentEntries')}
            </Text>
            {recentEntries.length > 0 && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push('/(protected)/history');
                }}
              >
                <Text className="text-sm font-medium text-blue-600">
                  {t('home.seeAll')}
                </Text>
              </Pressable>
            )}
          </View>

          {recentEntries.length === 0 ? (
            <View className="bg-surface-muted rounded-2xl p-8 items-center">
              <Text className="text-4xl mb-3">{'\u{1F4D3}'}</Text>
              <Text className="text-base font-semibold text-text-primary">
                {t('home.noEntries')}
              </Text>
              <Text className="text-sm text-text-muted text-center mt-1">
                {t('home.noEntriesStart')}
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
                    {entry.content || t('home.noContent')}
                  </Text>
                  <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                    <Text className="text-xs text-text-muted">
                      {(() => {
                        const r = timeAgoKey(entry.created_at);
                        if (typeof r === 'string') return t(r);
                        return t(r.key, r.options);
                      })()}
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

        {/* On This Day */}
        {onThisDay && (
          <View className="mt-6 px-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Text className="text-sm mr-1.5">{'\u{1F4C5}'}</Text>
                <Text className="text-sm font-semibold text-text-secondary">
                  {t('home.onThisDay')}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleEntryPress(onThisDay.id)}
              className="bg-surface-elevated rounded-2xl p-4 border border-border active:scale-[0.98]"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.15 : 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-2">{onThisDay.mood_emoji || '\u{1F4DD}'}</Text>
                <View className="flex-1">
                  <Text className="text-xs text-text-muted">
                    {new Date(onThisDay.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${getMoodColor(onThisDay.mood_score)}15` }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: getMoodColor(onThisDay.mood_score) }}
                  >
                    {onThisDay.mood_score}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-text-secondary" numberOfLines={2}>
                {onThisDay.content || t('home.noContent')}
              </Text>
              <Text className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                {t('home.seeMemory')}
              </Text>
            </Pressable>
          </View>
        )}

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
              {t('home.streakDays', { count: celebrationStreak })}
            </Text>
            <Text className="text-sm text-text-secondary mt-2 text-center">
              {celebrationStreak === 3
                ? t('home.streakCelebration3')
                : celebrationStreak === 7
                ? t('home.streakCelebration7')
                : celebrationStreak === 30
                ? t('home.streakCelebration30')
                : t('home.streakCelebration100')}
            </Text>
            <Pressable
              onPress={() => setStreakCelebration(false)}
              className="mt-6 bg-amber-500 rounded-2xl px-8 py-3"
            >
              <Text className="text-white font-bold text-base">
                {t('home.keepItUp')}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
