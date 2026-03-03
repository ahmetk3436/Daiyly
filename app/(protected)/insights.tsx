import React, { useState, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ExpoSharing from 'expo-sharing';
import api from '../../lib/api';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';
import { cacheSet, cacheGet } from '../../lib/cache';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useProGate } from '../../lib/useProGate';
import { getGuestEntries } from '../../lib/guest';
import CTABanner from '../../components/ui/CTABanner';
import HealthKitInsight from '../../components/HealthKitInsight';
import type { JournalStreak, WeeklyReport } from '../../types/journal';

// Type Definitions
interface MoodDistributionItem {
  emoji: string;
  count: number;
  percentage: number;
}

interface DailyScore {
  date: string;
  day_name: string;
  score: number;
}

interface WeeklyInsights {
  mood_trend: 'improving' | 'stable' | 'declining';
  average_mood_score: number;
  top_mood_emoji: string;
  mood_distribution: MoodDistributionItem[];
  daily_scores: DailyScore[];
  total_entries: number;
  avg_word_count: number;
  total_words: number;
  current_streak: number;
  longest_streak: number;
  period_start: string;
  period_end: string;
}

interface SearchResult {
  id: string;
  mood_emoji: string;
  created_at: string;
  content: string;
}

interface TherapistExportResponse {
  ai_narrative: string;
  suggestions: string[];
}

// Health correlation data shape (computed locally, HealthKit optional)
interface HealthCorrelation {
  highSleepMoodAvg: number;
  lowSleepMoodAvg: number;
  available: boolean;
}

// Constants
const MAX_BAR_HEIGHT = 120;

const COLORS = {
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  purple: '#8B5CF6',
  secondary: '#EC4899',
  accent: '#F59E0B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

// Helper function to compute basic insights from guest entries
const computeGuestInsights = (entries: any[]): WeeklyInsights | null => {
  if (!entries || entries.length === 0) return null;

  const moodEmojiMap: { [key: string]: number } = {};
  let totalMoodScore = 0;
  let totalWords = 0;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentEntries = entries.filter((entry: any) => {
    const entryDate = new Date(entry.created_at || entry.date);
    return entryDate >= weekAgo;
  });

  if (recentEntries.length === 0) return null;

  recentEntries.forEach((entry: any) => {
    const emoji = entry.mood_emoji || entry.emoji || '\u{1F610}';
    moodEmojiMap[emoji] = (moodEmojiMap[emoji] || 0) + 1;
    totalMoodScore += entry.mood_score || entry.score || 50;
    totalWords += (entry.content || '')
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;
  });

  const avgMoodScore = totalMoodScore / recentEntries.length;
  const avgWordCount = Math.round(totalWords / recentEntries.length);

  const topEmoji =
    Object.entries(moodEmojiMap).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    '\u{1F610}';

  const moodDistribution: MoodDistributionItem[] = Object.entries(moodEmojiMap)
    .map(([emoji, count]) => ({
      emoji,
      count,
      percentage: Math.round((count / recentEntries.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate streak
  const sortedDates = entries
    .map((e: any) => new Date(e.created_at || e.date).toDateString())
    .filter(
      (date: string, index: number, self: string[]) =>
        self.indexOf(date) === index
    )
    .sort(
      (a: string, b: string) =>
        new Date(b).getTime() - new Date(a).getTime()
    );

  let currentStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    if (sortedDates.includes(checkDate.toDateString())) {
      currentStreak++;
    } else {
      break;
    }
  }

  const moodTrend: 'improving' | 'stable' | 'declining' =
    avgMoodScore >= 65
      ? 'improving'
      : avgMoodScore >= 45
      ? 'stable'
      : 'declining';

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    mood_trend: moodTrend,
    average_mood_score: Math.round(avgMoodScore),
    top_mood_emoji: topEmoji,
    mood_distribution: moodDistribution,
    daily_scores: [],
    total_entries: entries.length,
    avg_word_count: avgWordCount,
    total_words: totalWords,
    current_streak: currentStreak,
    longest_streak: currentStreak,
    period_start: formatDate(weekAgo),
    period_end: formatDate(now),
  };
};

export default function InsightsScreen() {
  const { isAuthenticated } = useAuth();
  const { isSubscribed } = useSubscription();
  const { isDark } = useTheme();
  const { requirePro } = useProGate();

  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [showFeatureBanner, setShowFeatureBanner] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);

  // Task E2: Ask Your Journal search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Task E1: Health correlation state
  const [healthCorrelation, setHealthCorrelation] = useState<HealthCorrelation | null>(null);

  // Task E3: Therapist export state
  const [therapistLoading, setTherapistLoading] = useState(false);

  const getMilestoneData = (currentStreak: number) => {
    const milestones = [3, 7, 14, 21, 30, 50, 100];
    const nextMilestone =
      milestones.find((m) => m > currentStreak) || currentStreak + 10;
    const progress = currentStreak / nextMilestone;
    const isAtMilestone = milestones.includes(currentStreak);
    return { nextMilestone, progress, isAtMilestone };
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return {
          name: 'trending-up' as const,
          color: COLORS.success,
          label: 'Improving',
          bg: isDark ? '#064E3B' : '#ECFDF5',
        };
      case 'stable':
        return {
          name: 'remove' as const,
          color: COLORS.primaryLight,
          label: 'Stable',
          bg: isDark ? '#1E3A5F' : '#EFF6FF',
        };
      case 'declining':
        return {
          name: 'trending-down' as const,
          color: COLORS.warning,
          label: 'Needs Attention',
          bg: isDark ? '#78350F' : '#FFFBEB',
        };
      default:
        return {
          name: 'remove' as const,
          color: '#9CA3AF',
          label: 'Unknown',
          bg: isDark ? '#374151' : '#F3F4F6',
        };
    }
  };

  const getMoodColor = (score: number): string => {
    if (score >= 80) return COLORS.success;
    if (score >= 60) return COLORS.primaryLight;
    if (score >= 40) return COLORS.accent;
    if (score >= 20) return '#F97316';
    return COLORS.error;
  };

  // Task E2: Journal search handler
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    const allowed = requirePro('Ask Your Journal');
    if (!allowed) return;

    hapticLight();
    setSearchLoading(true);
    setSearchError(null);
    setSearchSubmitted(true);

    try {
      const res = await api.get<{ entries: SearchResult[] }>(
        `/journals/search?q=${encodeURIComponent(q)}&semantic=true`
      );
      const entries = res.data?.entries ?? (res.data as any) ?? [];
      setSearchResults(Array.isArray(entries) ? entries.slice(0, 3) : []);
    } catch (err: any) {
      Sentry.captureException(err);
      setSearchResults([]);
      setSearchError('Search failed. Try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, requirePro]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSubmitted(false);
    setSearchError(null);
    hapticLight();
  }, []);

  // Task E1: Attempt HealthKit data fetch — graceful degradation if unavailable
  const fetchHealthCorrelation = useCallback(async () => {
    // expo-health is not in package.json. We attempt a dynamic require so the
    // app does not crash if the package is absent.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Health = require('expo-health');
      const { status } = await Health.requestPermissionsAsync([
        {
          kind: Health.HealthDataTypes.SleepAnalysis,
          access: Health.HealthAccessTypes.Read,
        },
        {
          kind: Health.HealthDataTypes.StepCount,
          access: Health.HealthAccessTypes.Read,
        },
      ]);

      if (status !== 'granted') {
        setHealthCorrelation(null);
        return;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const sleepRecords = await Health.getHealthRecordsAsync({
        startDate: sevenDaysAgo,
        endDate: new Date(),
        type: Health.HealthDataTypes.SleepAnalysis,
      });

      if (!sleepRecords || sleepRecords.length === 0) {
        setHealthCorrelation(null);
        return;
      }

      // Map sleep records to daily sleep hours
      const dailySleepMap: Record<string, number> = {};
      for (const record of sleepRecords) {
        const dateKey = new Date(record.startDate).toDateString();
        const hours =
          (new Date(record.endDate).getTime() -
            new Date(record.startDate).getTime()) /
          (1000 * 60 * 60);
        dailySleepMap[dateKey] = (dailySleepMap[dateKey] ?? 0) + hours;
      }

      // Cross-reference with journal daily scores if available
      const dailyScores = insights?.daily_scores ?? [];
      if (dailyScores.length === 0) {
        setHealthCorrelation(null);
        return;
      }

      const highSleepScores: number[] = [];
      const lowSleepScores: number[] = [];

      for (const dayScore of dailyScores) {
        const key = new Date(dayScore.date).toDateString();
        const sleepHrs = dailySleepMap[key] ?? 0;
        if (sleepHrs >= 7) {
          highSleepScores.push(dayScore.score);
        } else if (sleepHrs > 0) {
          lowSleepScores.push(dayScore.score);
        }
      }

      if (highSleepScores.length === 0 && lowSleepScores.length === 0) {
        setHealthCorrelation(null);
        return;
      }

      const avg = (arr: number[]) =>
        arr.length > 0
          ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
          : 0;

      setHealthCorrelation({
        highSleepMoodAvg: avg(highSleepScores),
        lowSleepMoodAvg: avg(lowSleepScores),
        available: true,
      });
    } catch {
      // expo-health not installed, permission denied, or unsupported platform
      setHealthCorrelation(null);
    }
  }, [insights?.daily_scores]);

  // Task E3: Therapist report export
  const handleTherapistExport = useCallback(async () => {
    const allowed = requirePro('Therapist Report');
    if (!allowed) return;

    hapticLight();
    setTherapistLoading(true);

    try {
      const res = await api.get<TherapistExportResponse>(
        '/journals/therapist-export'
      );
      const { ai_narrative, suggestions } = res.data;

      const suggestionText =
        suggestions && suggestions.length > 0
          ? '\n\nSuggestions:\n' + suggestions.map((s) => `- ${s}`).join('\n')
          : '';

      const shareText = `My Daiyly Journal Report\n\n${ai_narrative}${suggestionText}`;

      hapticSuccess();

      const sharingAvailable = await ExpoSharing.isAvailableAsync();
      if (sharingAvailable) {
        // Write to a temp file for expo-sharing to pick up as an attachment
        const { FileSystem } = await import('expo-file-system');
        const fileUri =
          FileSystem.cacheDirectory + 'daiyly-therapist-report.txt';
        await FileSystem.writeAsStringAsync(fileUri, shareText);
        await ExpoSharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Therapist Report',
        });
      } else {
        await Share.share({
          message: shareText,
          title: 'My Daiyly Journal Report',
        });
      }
    } catch (err: any) {
      Sentry.captureException(err);
      hapticError();
    } finally {
      setTherapistLoading(false);
    }
  }, [requirePro]);

  const fetchInsights = useCallback(async () => {
    try {
      setError(null);
      setIsStale(false);
      if (isAuthenticated) {
        const [response, streakRes] = await Promise.all([
          api.get('/journals/insights'),
          api.get('/journals/streak'),
        ]);
        setInsights(response.data);
        setStreak(streakRes.data);

        // Cache for offline
        cacheSet('insights_data', response.data);
        cacheSet('insights_streak', streakRes.data);

        // Task E1: Attempt HealthKit correlation (fire-and-forget, no await)
        if (Platform.OS === 'ios') {
          fetchHealthCorrelation();
        }

        // Fetch AI weekly report
        setReportLoading(true);
        api.get('/journals/weekly-report')
          .then(res => setWeeklyReport(res.data))
          .catch(err => { Sentry.captureException(err); setWeeklyReport(null); })
          .finally(() => setReportLoading(false));
      } else {
        const guestEntries = await getGuestEntries();
        const guestInsights = computeGuestInsights(guestEntries);
        setInsights(guestInsights);
        setStreak(null);
      }
      hapticSuccess();
    } catch (err: any) {
      // Offline fallback: try cache
      if (isAuthenticated) {
        const cachedInsights = await cacheGet<WeeklyInsights>('insights_data');
        const cachedStreak = await cacheGet<JournalStreak>('insights_streak');
        if (cachedInsights) {
          setInsights(cachedInsights.data);
          setIsStale(true);
          if (cachedStreak) setStreak(cachedStreak.data);
          return;
        }
      }
      Sentry.captureException(err);
      const errorMessage =
        err?.response?.data?.message ||
        'Failed to load insights. Please try again.';
      setError(errorMessage);
      hapticError();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, fetchHealthCorrelation]);

  useFocusEffect(
    useCallback(() => {
      fetchInsights();
    }, [fetchInsights])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    hapticLight();
    fetchInsights();
  }, [fetchInsights]);

  // Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="text-base text-text-muted mt-4">
            Analyzing your journal...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error State
  if (error && !insights) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
            <Ionicons
              name="cloud-offline-outline"
              size={32}
              color={COLORS.error}
            />
          </View>
          <Text className="text-lg font-semibold text-text-primary mb-2">
            Unable to Load Insights
          </Text>
          <Text className="text-base text-text-secondary text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={() => {
              hapticLight();
              setLoading(true);
              fetchInsights();
            }}
            className="bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Empty State
  if (!insights) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">{'\u{1F4CA}'}</Text>
          <Text className="text-xl font-bold text-text-primary mb-2">
            No Data Yet
          </Text>
          <Text className="text-base text-text-secondary text-center mb-6">
            Start journaling to see your personalized mood insights and
            analytics.
          </Text>
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(protected)/home');
            }}
            className="bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">
              Start Journaling
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const trendInfo = getTrendIcon(insights.mood_trend);
  const moodColor = getMoodColor(insights.average_mood_score);
  const maxDistributionCount = Math.max(
    ...insights.mood_distribution.map((d) => d.count),
    1
  );
  const showPremiumUpsell = !isAuthenticated || !isSubscribed;

  const currentStreak =
    streak?.current_streak || insights.current_streak || 0;
  const longestStreak =
    streak?.longest_streak || insights.longest_streak || 0;
  const totalEntries = streak?.total_entries || insights.total_entries || 0;
  const { nextMilestone, progress, isAtMilestone } =
    getMilestoneData(currentStreak);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-2">
          <Text className="text-2xl font-bold text-text-primary">
            Your Insights
          </Text>
          <Text className="text-sm text-text-secondary mt-1">
            {isAuthenticated
              ? 'Weekly mood analytics'
              : 'Basic insights from your entries'}
          </Text>
        </View>

        {/* Guest Mode Banner */}
        {!isAuthenticated && (
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(auth)/register');
            }}
            className="mx-5 mt-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl p-4 border border-purple-100 dark:border-purple-800 active:opacity-80"
          >
            <View className="flex-row items-center">
              <Ionicons
                name="person-add-outline"
                size={22}
                color={isDark ? '#C084FC' : COLORS.purple}
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                  Create Account to Sync
                </Text>
                <Text className="text-xs text-purple-600 dark:text-purple-400">
                  Unlock premium analytics & sync across devices
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDark ? '#C084FC' : COLORS.purple}
              />
            </View>
          </Pressable>
        )}

        {/* Offline indicator */}
        {isStale && (
          <View className="mx-5 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2 flex-row items-center border border-amber-100 dark:border-amber-800">
            <Ionicons name="cloud-offline-outline" size={14} color="#D97706" />
            <Text className="text-xs text-amber-700 dark:text-amber-400 ml-2">
              Showing cached data — pull to refresh
            </Text>
          </View>
        )}

        {/* Task E2: Ask Your Journal — always-visible semantic search */}
        {isAuthenticated && (
          <View className="mx-5 mt-4">
            {/* Search bar */}
            <View
              className="flex-row items-center rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              }}
            >
              <Ionicons
                name="search"
                size={18}
                color={isDark ? '#64748B' : '#94A3B8'}
              />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                placeholder="Ask anything... e.g. 'What made me happy this month?'"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                className="flex-1 ml-2 text-sm text-text-primary"
                style={{ paddingVertical: 0 }}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={clearSearch} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={isDark ? '#64748B' : '#94A3B8'}
                  />
                </Pressable>
              ) : (
                <Ionicons
                  name="mic-outline"
                  size={18}
                  color={isDark ? '#64748B' : '#94A3B8'}
                />
              )}
            </View>

            {/* Label below search bar */}
            <View className="flex-row items-center mt-1.5 px-1">
              <Ionicons name="sparkles" size={12} color="#8B5CF6" />
              <Text className="text-xs text-text-muted ml-1">
                Ask Your Journal
              </Text>
              {!isSubscribed && (
                <View
                  className="rounded-full px-2 py-0.5 ml-2"
                  style={{ backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }}
                >
                  <Text className="text-[10px] font-bold" style={{ color: '#8B5CF6' }}>
                    PRO
                  </Text>
                </View>
              )}
            </View>

            {/* Search loading */}
            {searchLoading && (
              <View className="mt-3 items-center py-4">
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text className="text-xs text-text-muted mt-2">
                  Searching your entries...
                </Text>
              </View>
            )}

            {/* Search error */}
            {!searchLoading && searchError && (
              <View className="mt-2 px-1">
                <Text className="text-xs text-red-500">{searchError}</Text>
              </View>
            )}

            {/* No results message */}
            {!searchLoading &&
              searchSubmitted &&
              !searchError &&
              searchResults.length === 0 && (
                <View className="mt-3 px-1">
                  <Text className="text-xs text-text-muted">
                    No entries matching this. Try 'anxious' or 'grateful'
                  </Text>
                </View>
              )}

            {/* Search results */}
            {!searchLoading && searchResults.length > 0 && (
              <View className="mt-3" style={{ gap: 8 }}>
                {searchResults.map((result) => (
                  <Pressable
                    key={result.id}
                    onPress={() => {
                      hapticLight();
                      router.push(
                        `/(protected)/entry/${result.id}` as any
                      );
                    }}
                    className="flex-row items-start rounded-xl border px-4 py-3 active:opacity-75"
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <Text className="text-xl mr-3">{result.mood_emoji || '\u{1F4DD}'}</Text>
                    <View className="flex-1">
                      <Text className="text-xs text-text-muted mb-0.5">
                        {new Date(result.created_at).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </Text>
                      <Text
                        className="text-sm text-text-primary"
                        numberOfLines={2}
                      >
                        {result.content?.slice(0, 100) ?? ''}
                        {(result.content?.length ?? 0) > 100 ? '…' : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={isDark ? '#64748B' : '#9CA3AF'}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View className="px-5 mt-4">
          {/* AI Weekly Summary */}
          {isAuthenticated && (
            <Pressable
              onPress={() => {
                if (!isSubscribed) {
                  router.push('/(protected)/paywall');
                  return;
                }
                hapticLight();
                setReportExpanded(!reportExpanded);
              }}
              className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="sparkles" size={18} color="#8B5CF6" />
                  <Text className="text-base font-bold text-text-primary ml-2">
                    Your Weekly Summary
                  </Text>
                </View>
                {!isSubscribed ? (
                  <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }}>
                    <Text className="text-xs font-bold" style={{ color: '#8B5CF6' }}>PRO</Text>
                  </View>
                ) : (
                  <Ionicons
                    name={reportExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={isDark ? '#64748B' : '#9CA3AF'}
                  />
                )}
              </View>

              {!isSubscribed && (
                <Text className="text-xs text-text-muted mt-2">
                  Get AI-powered insights about your journaling patterns
                </Text>
              )}

              {reportExpanded && isSubscribed && weeklyReport && (
                <View className="mt-4">
                  <Text className="text-sm text-text-primary leading-relaxed">
                    {weeklyReport.narrative}
                  </Text>

                  {weeklyReport.key_themes.length > 0 && (
                    <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
                      {weeklyReport.key_themes.map((theme, i) => (
                        <View key={i} className="rounded-full px-3 py-1 bg-surface-elevated">
                          <Text className="text-xs text-text-secondary">{theme}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {weeklyReport.mood_explanation ? (
                    <View className="mt-3 p-3 rounded-xl" style={{ backgroundColor: isDark ? '#1E293B' : '#F0F9FF' }}>
                      <Text className="text-xs font-semibold text-text-muted mb-1">Mood Pattern</Text>
                      <Text className="text-sm text-text-secondary">{weeklyReport.mood_explanation}</Text>
                    </View>
                  ) : null}

                  {weeklyReport.suggestion ? (
                    <View className="mt-3 p-3 rounded-xl" style={{ backgroundColor: isDark ? '#1A2E1A' : '#F0FDF4' }}>
                      <View className="flex-row items-center mb-1">
                        <Ionicons name="bulb-outline" size={14} color="#22C55E" />
                        <Text className="text-xs font-semibold ml-1" style={{ color: '#22C55E' }}>Suggestion</Text>
                      </View>
                      <Text className="text-sm text-text-secondary">{weeklyReport.suggestion}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {reportExpanded && isSubscribed && !weeklyReport && reportLoading && (
                <View className="mt-4 items-center py-4">
                  <ActivityIndicator size="small" color="#8B5CF6" />
                  <Text className="text-xs text-text-muted mt-2">Generating your summary...</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Ask About Your History — Quick Action */}
          {isAuthenticated && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/search?mode=ask' as never);
              }}
              className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-4 mb-3 border border-violet-100 dark:border-violet-800 flex-row items-center active:opacity-80"
            >
              <View className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-800 items-center justify-center mr-3">
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-violet-900 dark:text-violet-200">
                  Ask about your history
                </Text>
                <Text className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  "What made me happy last month?"
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#8B5CF6' : '#7C3AED'} />
            </Pressable>
          )}

          {/* Mood Trend + Average Score Card */}
          <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: trendInfo.bg }}
                >
                  <Ionicons
                    name={trendInfo.name}
                    size={22}
                    color={trendInfo.color}
                  />
                </View>
                <View>
                  <Text className="text-xs text-text-muted uppercase tracking-wider">
                    Mood Trend
                  </Text>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: trendInfo.color }}
                  >
                    {trendInfo.label}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-text-muted">
                {insights.period_start} - {insights.period_end}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-text-muted mb-1">Average Score</Text>
                <View className="flex-row items-baseline">
                  <Text
                    className="text-5xl font-bold"
                    style={{ color: moodColor }}
                  >
                    {Math.round(insights.average_mood_score)}
                  </Text>
                  <Text className="text-xl text-text-muted ml-1">/100</Text>
                </View>
              </View>
              <View className="items-center">
                <Text className="text-5xl">
                  {insights.top_mood_emoji}
                </Text>
                <Text className="text-xs text-text-muted mt-1">Top Mood</Text>
              </View>
            </View>
          </View>

          {/* Mood Distribution */}
          <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
            <Text className="text-base font-bold text-text-primary mb-4">
              Mood Breakdown
            </Text>

            {insights.mood_distribution.map((item, index) => (
              <View key={index} className="flex-row items-center mb-3">
                <Text className="text-xl w-8">{item.emoji}</Text>
                <View className="flex-1 h-7 bg-surface-muted rounded-full overflow-hidden mx-2">
                  <View
                    className="h-full rounded-full flex-row items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(
                        (item.count / maxDistributionCount) * 100,
                        8
                      )}%`,
                      backgroundColor: COLORS.primary,
                    }}
                  >
                    {item.count > 0 && (
                      <Text className="text-white text-xs font-bold">
                        {item.count}
                      </Text>
                    )}
                  </View>
                </View>
                <Text className="text-sm text-text-secondary w-10 text-right font-medium">
                  {item.percentage}%
                </Text>
              </View>
            ))}
          </View>

          {/* HealthKit Sleep vs Mood card — iOS only, hides itself when unavailable */}
          {isAuthenticated && <HealthKitInsight />}

          {/* Task E1: Sleep & Mood Correlation (HealthKit) — shown only when data available */}
          {isAuthenticated && healthCorrelation?.available && (
            <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
              <View className="flex-row items-center mb-4">
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }}
                >
                  <Ionicons name="moon-outline" size={18} color="#0EA5E9" />
                </View>
                <View>
                  <Text className="text-base font-bold text-text-primary">
                    Sleep & Mood Correlation
                  </Text>
                  <Text className="text-xs text-text-muted">
                    Last 7 days — from Apple Health
                  </Text>
                </View>
              </View>

              <Text className="text-sm text-text-secondary mb-4 leading-relaxed">
                {`On days you slept 7+ hours, your mood averaged ${healthCorrelation.highSleepMoodAvg} vs ${healthCorrelation.lowSleepMoodAvg} on low-sleep days.`}
              </Text>

              {/* Simple side-by-side bar comparison */}
              <View className="flex-row items-end justify-around" style={{ gap: 16 }}>
                {/* High sleep bar */}
                <View className="items-center flex-1">
                  <Text
                    className="text-xs font-bold mb-1"
                    style={{ color: COLORS.success }}
                  >
                    {healthCorrelation.highSleepMoodAvg}
                  </Text>
                  <View
                    className="w-full rounded-t-lg"
                    style={{
                      height: Math.max(
                        (healthCorrelation.highSleepMoodAvg / 100) * 80,
                        4
                      ),
                      backgroundColor: COLORS.success,
                    }}
                  />
                  <Text className="text-[10px] text-text-muted mt-2 text-center font-medium">
                    {'\u{1F634}'} 7+ hrs
                  </Text>
                </View>

                {/* Low sleep bar */}
                <View className="items-center flex-1">
                  <Text
                    className="text-xs font-bold mb-1"
                    style={{ color: COLORS.warning }}
                  >
                    {healthCorrelation.lowSleepMoodAvg}
                  </Text>
                  <View
                    className="w-full rounded-t-lg"
                    style={{
                      height: Math.max(
                        (healthCorrelation.lowSleepMoodAvg / 100) * 80,
                        4
                      ),
                      backgroundColor: COLORS.warning,
                    }}
                  />
                  <Text className="text-[10px] text-text-muted mt-2 text-center font-medium">
                    {'\u{1F62A}'} {'<'}7 hrs
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 7-Day Mood Chart */}
          {isAuthenticated &&
            insights.daily_scores &&
            insights.daily_scores.length > 0 &&
            isSubscribed && (
              <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
                <Text className="text-base font-bold text-text-primary mb-4">
                  7-Day Mood Scores
                </Text>

                <View className="flex-row items-end justify-between h-36 px-1">
                  {insights.daily_scores.map((day, index) => {
                    const barHeight = (day.score / 100) * MAX_BAR_HEIGHT;
                    const barColor = getMoodColor(day.score);

                    return (
                      <View key={index} className="items-center flex-1">
                        <Text
                          className="text-xs font-bold mb-1"
                          style={{ color: barColor }}
                        >
                          {day.score}
                        </Text>
                        <View
                          className="w-7 rounded-t-lg"
                          style={{
                            height: Math.max(barHeight, 4),
                            backgroundColor: barColor,
                          }}
                        />
                        <Text className="text-[10px] text-text-muted mt-2 font-medium">
                          {day.day_name.substring(0, 3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

          {/* 7-Day Mood Chart -- Locked Preview for non-subscribers */}
          {showPremiumUpsell && isAuthenticated && insights.daily_scores && insights.daily_scores.length > 0 && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/paywall?source=insights-chart');
              }}
              className="bg-surface-elevated rounded-2xl mb-3 border border-border relative overflow-hidden active:scale-[0.98]"
            >
              <View className="p-5 opacity-30">
                <Text className="text-base font-bold text-text-primary mb-4">
                  7-Day Mood Scores
                </Text>
                <View className="flex-row items-end justify-between h-36 px-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                    const fakeHeight = [65, 72, 58, 80, 45, 75, 68][index];
                    return (
                      <View key={index} className="items-center flex-1">
                        <View
                          className="w-7 rounded-t-lg bg-blue-400"
                          style={{ height: (fakeHeight / 100) * MAX_BAR_HEIGHT }}
                        />
                        <Text className="text-[10px] text-text-muted mt-2 font-medium">
                          {day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.80)' }}
              >
                <View className="bg-blue-100 dark:bg-blue-900/40 w-14 h-14 rounded-full items-center justify-center mb-2">
                  <Ionicons name="bar-chart" size={24} color="#2563EB" />
                </View>
                <Text className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                  AI-Powered Mood Chart
                </Text>
                <Text className="text-blue-500 dark:text-blue-400 text-xs mt-1">
                  Unlock with Premium
                </Text>
              </View>
            </Pressable>
          )}

          {/* Streak Card */}
          <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-3xl">
                  {(streak?.grace_period_active || streak?.grace_active) ? '\u{1F9CA}' : '\u{1F525}'}
                </Text>
                <View className="ml-2">
                  <View className="flex-row items-center">
                    <Text className="text-2xl font-bold text-text-primary">
                      Day {currentStreak}
                    </Text>
                    {(streak?.grace_period_active || streak?.grace_active) && (
                      <View className="ml-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                          Freeze active
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-text-muted">
                    Current streak
                  </Text>
                </View>
              </View>

              <View className="bg-amber-50 dark:bg-amber-900/30 rounded-full px-3 py-1 border border-amber-200 dark:border-amber-700">
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {'\u{1F3C6}'} Best: {longestStreak}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="mt-4">
              <View className="bg-surface-muted rounded-full h-2.5 overflow-hidden">
                <View
                  className="bg-amber-500 rounded-full h-2.5"
                  style={{
                    width: `${Math.min(progress * 100, 100)}%`,
                  }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-1.5">
                <Text className="text-xs text-text-muted">
                  {currentStreak}/{nextMilestone} to next milestone
                </Text>
                {isAtMilestone && (
                  <View className="bg-purple-50 dark:bg-purple-900/30 rounded-full px-2 py-0.5">
                    <Text className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {'\u2728'} Milestone!
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-center mt-3 pt-3 border-t border-border">
              <Ionicons
                name="document-text-outline"
                size={14}
                color={isDark ? '#64748B' : '#9CA3AF'}
              />
              <Text className="text-xs text-text-muted ml-1">
                {totalEntries} total entries
              </Text>
            </View>

            {(streak?.grace_period_active || streak?.grace_active) && (
              <View className="mt-3 flex-row items-start bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2.5 border border-indigo-100 dark:border-indigo-800">
                <Text className="text-sm mr-1.5">{'\u2744\uFE0F'}</Text>
                <Text className="text-xs text-indigo-700 dark:text-indigo-300 flex-1 leading-relaxed">
                  You haven't journaled today but your streak is protected for 1 more day.
                </Text>
              </View>
            )}
          </View>

          {/* Share Insights CTA */}
          <Pressable
            onPress={() => {
              hapticLight();
              if (showPremiumUpsell) {
                router.push('/(protected)/paywall?source=insights-share');
              } else {
                router.push({
                  pathname: '/(protected)/sharing',
                  params: { cardType: 'weekly' },
                } as any);
              }
            }}
            className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 mb-3 flex-row items-center border border-purple-100 dark:border-purple-800 active:scale-[0.98]"
          >
            <View className="bg-purple-100 dark:bg-purple-800 w-10 h-10 rounded-xl items-center justify-center mr-3">
              <Ionicons name="share-social-outline" size={20} color={isDark ? '#C084FC' : '#7C3AED'} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Share Your Insights
              </Text>
              <Text className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                {showPremiumUpsell
                  ? 'Premium: Create beautiful shareable mood cards'
                  : 'Create a beautiful card to share your mood stats'}
              </Text>
            </View>
            {showPremiumUpsell ? (
              <View className="bg-purple-200 dark:bg-purple-800 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-bold text-purple-700 dark:text-purple-300">PRO</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#C084FC' : '#7C3AED'} />
            )}
          </Pressable>

          {/* Writing Stats */}
          <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
            <Text className="text-base font-bold text-text-primary mb-4">
              Writing Stats
            </Text>

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }}
                >
                  <Ionicons
                    name="document-text"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text className="text-xl font-bold text-text-primary">
                  {insights.total_entries}
                </Text>
                <Text className="text-xs text-text-muted mt-0.5">
                  Entries
                </Text>
              </View>

              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: isDark ? '#064E3B' : '#F0FDF4' }}
                >
                  <Ionicons name="text" size={20} color={COLORS.success} />
                </View>
                <Text className="text-xl font-bold text-text-primary">
                  {insights.avg_word_count}
                </Text>
                <Text className="text-xs text-text-muted mt-0.5">
                  Avg Words
                </Text>
              </View>

              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: isDark ? '#78350F' : '#FEF3C7' }}
                >
                  <Ionicons name="library" size={20} color={COLORS.accent} />
                </View>
                <Text className="text-xl font-bold text-text-primary">
                  {insights.total_words}
                </Text>
                <Text className="text-xs text-text-muted mt-0.5">
                  Total Words
                </Text>
              </View>
            </View>
          </View>

          {/* Weekly Writing Frequency */}
          {isAuthenticated &&
            insights.daily_scores &&
            insights.daily_scores.length > 0 && (
              <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
                <Text className="text-base font-bold text-text-primary mb-3">
                  Weekly Frequency
                </Text>
                <View className="flex-row justify-between">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                    (day) => {
                      const hasEntry = insights.daily_scores.some(
                        (d) => d.day_name.startsWith(day)
                      );
                      return (
                        <View key={day} className="items-center">
                          <View
                            className={`w-8 h-8 rounded-full items-center justify-center ${
                              hasEntry ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-surface-muted'
                            }`}
                          >
                            <Ionicons
                              name={
                                hasEntry
                                  ? 'checkmark-circle'
                                  : 'ellipse-outline'
                              }
                              size={hasEntry ? 18 : 14}
                              color={hasEntry ? '#2563EB' : (isDark ? '#475569' : '#D1D5DB')}
                            />
                          </View>
                          <Text className="text-[10px] text-text-muted mt-1 font-medium">
                            {day}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            )}

          {/* Premium Insights Preview -- Word Cloud */}
          {showPremiumUpsell && insights.total_entries >= 3 && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/paywall?source=insights-wordcloud');
              }}
              className="bg-surface-elevated rounded-2xl mb-3 border border-border relative overflow-hidden active:scale-[0.98]"
            >
              <View className="p-5 opacity-25">
                <Text className="text-base font-bold text-text-primary mb-3">
                  Word Cloud Analysis
                </Text>
                <View className="h-32 bg-surface-muted rounded-xl items-center justify-center">
                  <View className="flex-row flex-wrap justify-center px-4" style={{ gap: 6 }}>
                    <Text className="text-2xl font-bold text-blue-500">grateful</Text>
                    <Text className="text-lg font-semibold text-purple-500">happy</Text>
                    <Text className="text-base text-pink-500">family</Text>
                    <Text className="text-xl font-bold text-green-500">growth</Text>
                    <Text className="text-sm text-amber-500">mindful</Text>
                    <Text className="text-lg font-semibold text-blue-400">peace</Text>
                    <Text className="text-base text-purple-400">love</Text>
                  </View>
                </View>
              </View>
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.80)' }}
              >
                <View className="bg-purple-100 dark:bg-purple-900/40 w-14 h-14 rounded-full items-center justify-center mb-2">
                  <Ionicons name="cloud-outline" size={24} color="#8B5CF6" />
                </View>
                <Text className="text-purple-700 dark:text-purple-300 font-bold text-sm">
                  See Your Most-Used Words
                </Text>
                <Text className="text-purple-500 dark:text-purple-400 text-xs mt-1">
                  Unlock with Premium
                </Text>
              </View>
            </Pressable>
          )}

          {/* Premium Insights Preview -- AI Sentiment Trends */}
          {showPremiumUpsell && insights.total_entries >= 3 && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/paywall?source=insights-sentiment');
              }}
              className="bg-surface-elevated rounded-2xl mb-3 border border-border relative overflow-hidden active:scale-[0.98]"
            >
              <View className="p-5 opacity-25">
                <Text className="text-base font-bold text-text-primary mb-3">
                  AI Sentiment Analysis
                </Text>
                <View className="h-24 bg-surface-muted rounded-xl items-center justify-center">
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View className="items-center">
                      <Text className="text-2xl">72%</Text>
                      <Text className="text-xs text-text-muted">Positive</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-2xl">18%</Text>
                      <Text className="text-xs text-text-muted">Neutral</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-2xl">10%</Text>
                      <Text className="text-xs text-text-muted">Reflective</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.80)' }}
              >
                <View className="bg-green-100 dark:bg-green-900/40 w-14 h-14 rounded-full items-center justify-center mb-2">
                  <Ionicons name="analytics" size={24} color="#10B981" />
                </View>
                <Text className="text-green-700 dark:text-green-300 font-bold text-sm">
                  AI-Powered Sentiment Trends
                </Text>
                <Text className="text-green-500 dark:text-green-400 text-xs mt-1">
                  Unlock with Premium
                </Text>
              </View>
            </Pressable>
          )}

          {/* Feature Banner */}
          {showPremiumUpsell &&
            insights.total_entries >= 3 &&
            showFeatureBanner && (
              <View className="mb-3">
                <CTABanner
                  type="feature"
                  title="Unlock Detailed Analytics"
                  description="Get word clouds, sentiment trends, and more with Premium"
                  buttonText="Unlock"
                  onPress={() => {
                    hapticLight();
                    router.push('/(protected)/paywall?source=insights');
                  }}
                  dismissible
                  onDismiss={() => {
                    hapticLight();
                    setShowFeatureBanner(false);
                  }}
                />
              </View>
            )}

          {/* Task E3: Therapist Report — premium export card */}
          {isAuthenticated && (
            <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={COLORS.success}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-bold text-text-primary">
                      Therapist Report
                    </Text>
                    {!isSubscribed && (
                      <View
                        className="rounded-full px-2 py-0.5 ml-2"
                        style={{
                          backgroundColor: isDark ? '#2E1065' : '#F3E8FF',
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{ color: '#8B5CF6' }}
                        >
                          PRO
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-text-muted mt-0.5">
                    Share a 30-day AI summary with your therapist
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleTherapistExport}
                disabled={therapistLoading}
                className="rounded-xl py-3 items-center justify-center active:opacity-75"
                style={{ backgroundColor: COLORS.success }}
              >
                {therapistLoading ? (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-white font-semibold text-sm">
                      Generating...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold text-sm">
                      Generate Report
                    </Text>
                  </View>
                )}
              </Pressable>

              {therapistLoading && (
                <Text className="text-xs text-text-muted text-center mt-2">
                  AI is reviewing your entries — this can take up to 30 seconds
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
