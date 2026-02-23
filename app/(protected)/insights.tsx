import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getGuestEntries } from '../../lib/guest';
import CTABanner from '../../components/ui/CTABanner';
import type { JournalStreak } from '../../types/journal';

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

  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [showFeatureBanner, setShowFeatureBanner] = useState(true);

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
          bg: '#ECFDF5',
        };
      case 'stable':
        return {
          name: 'remove' as const,
          color: COLORS.primaryLight,
          label: 'Stable',
          bg: '#EFF6FF',
        };
      case 'declining':
        return {
          name: 'trending-down' as const,
          color: COLORS.warning,
          label: 'Needs Attention',
          bg: '#FFFBEB',
        };
      default:
        return {
          name: 'remove' as const,
          color: '#9CA3AF',
          label: 'Unknown',
          bg: '#F3F4F6',
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

  const fetchInsights = useCallback(async () => {
    try {
      setError(null);
      if (isAuthenticated) {
        const [response, streakRes] = await Promise.all([
          api.get('/journals/insights'),
          api.get('/streak'),
        ]);
        setInsights(response.data.data);
        setStreak(streakRes.data);
      } else {
        const guestEntries = await getGuestEntries();
        const guestInsights = computeGuestInsights(guestEntries);
        setInsights(guestInsights);
        setStreak(null);
      }
      hapticSuccess();
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        'Failed to load insights. Please try again.';
      setError(errorMessage);
      hapticError();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

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
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="text-base text-gray-400 mt-4">
            Analyzing your journal...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error State
  if (error && !insights) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
            <Ionicons
              name="cloud-offline-outline"
              size={32}
              color={COLORS.error}
            />
          </View>
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Insights
          </Text>
          <Text className="text-base text-gray-500 text-center mb-6">
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
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">{'\u{1F4CA}'}</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            No Data Yet
          </Text>
          <Text className="text-base text-gray-500 text-center mb-6">
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
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
          <Text className="text-2xl font-bold text-gray-900">
            Your Insights
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
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
            className="mx-5 mt-3 bg-purple-50 rounded-2xl p-4 border border-purple-100 active:opacity-80"
          >
            <View className="flex-row items-center">
              <Ionicons
                name="person-add-outline"
                size={22}
                color={COLORS.purple}
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-purple-900">
                  Create Account to Sync
                </Text>
                <Text className="text-xs text-purple-600">
                  Unlock premium analytics & sync across devices
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.purple}
              />
            </View>
          </Pressable>
        )}

        <View className="px-5 mt-4">
          {/* Mood Trend + Average Score Card */}
          <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
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
                  <Text className="text-xs text-gray-400 uppercase tracking-wider">
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
              <Text className="text-xs text-gray-400">
                {insights.period_start} - {insights.period_end}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-gray-400 mb-1">Average Score</Text>
                <View className="flex-row items-baseline">
                  <Text
                    className="text-5xl font-bold"
                    style={{ color: moodColor }}
                  >
                    {Math.round(insights.average_mood_score)}
                  </Text>
                  <Text className="text-xl text-gray-300 ml-1">/100</Text>
                </View>
              </View>
              <View className="items-center">
                <Text className="text-5xl">
                  {insights.top_mood_emoji}
                </Text>
                <Text className="text-xs text-gray-400 mt-1">Top Mood</Text>
              </View>
            </View>
          </View>

          {/* Mood Distribution */}
          <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
            <Text className="text-base font-bold text-gray-900 mb-4">
              Mood Breakdown
            </Text>

            {insights.mood_distribution.map((item, index) => (
              <View key={index} className="flex-row items-center mb-3">
                <Text className="text-xl w-8">{item.emoji}</Text>
                <View className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden mx-2">
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
                <Text className="text-sm text-gray-500 w-10 text-right font-medium">
                  {item.percentage}%
                </Text>
              </View>
            ))}
          </View>

          {/* 7-Day Mood Chart (auth only) */}
          {isAuthenticated &&
            insights.daily_scores &&
            insights.daily_scores.length > 0 && (
              <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
                <Text className="text-base font-bold text-gray-900 mb-4">
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
                        <Text className="text-[10px] text-gray-400 mt-2 font-medium">
                          {day.day_name.substring(0, 3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

          {/* Streak Card */}
          <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-3xl">{'\u{1F525}'}</Text>
                <View className="ml-2">
                  <Text className="text-2xl font-bold text-gray-900">
                    Day {currentStreak}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    Current streak
                  </Text>
                </View>
              </View>

              <View className="bg-amber-50 rounded-full px-3 py-1 border border-amber-200">
                <Text className="text-xs font-bold text-amber-700">
                  {'\u{1F3C6}'} Best: {longestStreak}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="mt-4">
              <View className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <View
                  className="bg-amber-500 rounded-full h-2.5"
                  style={{
                    width: `${Math.min(progress * 100, 100)}%`,
                  }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-1.5">
                <Text className="text-xs text-gray-400">
                  {currentStreak}/{nextMilestone} to next milestone
                </Text>
                {isAtMilestone && (
                  <View className="bg-purple-50 rounded-full px-2 py-0.5">
                    <Text className="text-xs font-semibold text-purple-600">
                      {'\u2728'} Milestone!
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100">
              <Ionicons
                name="document-text-outline"
                size={14}
                color="#9CA3AF"
              />
              <Text className="text-xs text-gray-400 ml-1">
                {totalEntries} total entries
              </Text>
            </View>
          </View>

          {/* Writing Stats */}
          <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
            <Text className="text-base font-bold text-gray-900 mb-4">
              Writing Stats
            </Text>

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: '#EFF6FF' }}
                >
                  <Ionicons
                    name="document-text"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  {insights.total_entries}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Entries
                </Text>
              </View>

              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: '#F0FDF4' }}
                >
                  <Ionicons name="text" size={20} color={COLORS.success} />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  {insights.avg_word_count}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Avg Words
                </Text>
              </View>

              <View className="items-center flex-1">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: '#FEF3C7' }}
                >
                  <Ionicons name="library" size={20} color={COLORS.accent} />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  {insights.total_words}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Total Words
                </Text>
              </View>
            </View>
          </View>

          {/* Weekly Writing Frequency */}
          {isAuthenticated &&
            insights.daily_scores &&
            insights.daily_scores.length > 0 && (
              <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100">
                <Text className="text-base font-bold text-gray-900 mb-3">
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
                              hasEntry ? 'bg-blue-100' : 'bg-gray-100'
                            }`}
                          >
                            <Ionicons
                              name={
                                hasEntry
                                  ? 'checkmark-circle'
                                  : 'ellipse-outline'
                              }
                              size={hasEntry ? 18 : 14}
                              color={hasEntry ? '#2563EB' : '#D1D5DB'}
                            />
                          </View>
                          <Text className="text-[10px] text-gray-400 mt-1 font-medium">
                            {day}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            )}

          {/* Premium Insights Preview */}
          {showPremiumUpsell && insights.total_entries >= 7 && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/paywall?source=insights');
              }}
              className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 relative overflow-hidden active:scale-[0.98]"
            >
              <View className="opacity-40">
                <Text className="text-base font-bold text-gray-900 mb-3">
                  Word Cloud Analysis
                </Text>
                <View className="h-28 bg-gray-100 rounded-xl" />
              </View>
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
              >
                <View className="bg-purple-100 w-14 h-14 rounded-full items-center justify-center mb-2">
                  <Ionicons name="lock-closed" size={24} color="#8B5CF6" />
                </View>
                <Text className="text-purple-700 font-bold text-sm">
                  Premium Feature
                </Text>
                <Text className="text-purple-500 text-xs mt-1">
                  Tap to unlock
                </Text>
              </View>
            </Pressable>
          )}

          {/* Feature Banner */}
          {showPremiumUpsell &&
            insights.total_entries >= 7 &&
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
        </View>

        {/* Bottom Spacing */}
        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
