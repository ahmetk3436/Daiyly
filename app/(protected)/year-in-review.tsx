import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';
import type { JournalEntry } from '../../types/journal';

interface YearStats {
  totalEntries: number;
  topEmotion: string;
  topEmotionPct: number;
  longestStreak: number;
  mostActiveMonth: string;
  themes: string[];
}

function computeYearStats(entries: JournalEntry[]): YearStats {
  const now = new Date();
  const yearStart = new Date(now.getFullYear() - 1, 0, 1);
  const yearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

  const yearEntries = entries.filter((e) => {
    const d = new Date(e.created_at);
    return d >= yearStart && d <= yearEnd;
  });

  const total = yearEntries.length;

  // Top emotion by mood_emoji frequency
  const emojiFreq = new Map<string, number>();
  for (const e of yearEntries) {
    if (e.mood_emoji) {
      emojiFreq.set(e.mood_emoji, (emojiFreq.get(e.mood_emoji) ?? 0) + 1);
    }
  }
  let topEmoji = '';
  let topCount = 0;
  for (const [emoji, count] of emojiFreq.entries()) {
    if (count > topCount) {
      topCount = count;
      topEmoji = emoji;
    }
  }
  const topEmotionPct = total > 0 ? Math.round((topCount / total) * 100) : 0;

  // Longest streak (consecutive days with entries)
  const dateSet = new Set(
    yearEntries.map((e) => new Date(e.created_at).toDateString())
  );
  const sortedDates = Array.from(dateSet)
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  let longest = 0;
  let current = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      current = 1;
    } else {
      const diff =
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff === 1) {
        current += 1;
      } else {
        current = 1;
      }
    }
    if (current > longest) longest = current;
  }

  // Most active month
  const monthFreq = new Map<number, number>();
  for (const e of yearEntries) {
    const m = new Date(e.created_at).getMonth();
    monthFreq.set(m, (monthFreq.get(m) ?? 0) + 1);
  }
  let topMonth = -1;
  let topMonthCount = 0;
  for (const [m, count] of monthFreq.entries()) {
    if (count > topMonthCount) {
      topMonthCount = count;
      topMonth = m;
    }
  }
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const mostActiveMonth = topMonth >= 0 ? MONTH_NAMES[topMonth] : '—';

  // Top themes from detected_emotion field
  const emotionFreq = new Map<string, number>();
  for (const e of yearEntries) {
    if (e.detected_emotion) {
      const key = e.detected_emotion.toLowerCase();
      emotionFreq.set(key, (emotionFreq.get(key) ?? 0) + 1);
    }
  }
  const themes = Array.from(emotionFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

  return {
    totalEntries: total,
    topEmotion: topEmoji,
    topEmotionPct,
    longestStreak: longest,
    mostActiveMonth,
    themes: themes.length > 0 ? themes : ['Work', 'Growth', 'Reflection'],
  };
}

export default function YearInReviewScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const viewShotRef = useRef<ViewShot>(null);

  const prevYear = new Date().getFullYear() - 1;

  const [stats, setStats] = useState<YearStats | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingNarrative, setLoadingNarrative] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Load all entries and compute stats
  useEffect(() => {
    (async () => {
      if (!isAuthenticated) {
        setLoadingStats(false);
        return;
      }
      try {
        let allEntries: JournalEntry[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;
        while (hasMore) {
          const res = await api.get('/journals', { params: { limit, offset } });
          const batch: JournalEntry[] = res.data?.entries || [];
          allEntries = [...allEntries, ...batch];
          offset += limit;
          hasMore = batch.length === limit;
        }
        setStats(computeYearStats(allEntries));
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [isAuthenticated]);

  // Load AI narrative from therapist-report endpoint
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingNarrative(true);
    api
      .get('/journals/therapist-report')
      .then((res) => {
        const data = res.data;
        const text: string =
          data?.narrative ||
          data?.summary ||
          data?.report ||
          (typeof data === 'string' ? data : '');
        setNarrative(text || null);
      })
      .catch((err) => {
        Sentry.captureException(err);
        setNarrative(null);
      })
      .finally(() => setLoadingNarrative(false));
  }, [isAuthenticated]);

  const handleShare = async () => {
    if (!viewShotRef.current) return;
    hapticLight();
    setSharing(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('common.error'), t('settings.sharingNotAvailable'));
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${prevYear} Year in Review` });
      hapticSuccess();
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
    } finally {
      setSharing(false);
    }
  };

  if (loadingStats) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-sm text-text-muted mt-3">{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable
          onPress={() => { hapticLight(); router.back(); }}
          className="w-9 h-9 rounded-full items-center justify-center bg-surface-muted mr-3"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={isDark ? '#94A3B8' : '#6B7280'} />
        </Pressable>
        <Text className="text-lg font-bold text-text-primary flex-1">
          {t('yearReview.title', { year: prevYear })}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* ViewShot wrapper for sharing */}
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
          <View
            className="mx-5 mt-4 rounded-3xl overflow-hidden"
            style={{
              backgroundColor: isDark ? '#1E3A5F' : '#1E40AF',
              shadowColor: '#1E40AF',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Card top */}
            <View className="px-5 pt-6 pb-4">
              <Text className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">
                {'\u{1F31F}'} Daiyly Year in Review
              </Text>
              <Text className="text-2xl font-bold text-white">
                Your {prevYear}
              </Text>
            </View>

            {/* Divider */}
            <View className="h-px mx-5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

            {/* Stats grid */}
            <View className="flex-row flex-wrap px-5 pt-4 pb-2" style={{ gap: 10 }}>
              <View
                className="flex-1 rounded-2xl px-3 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', minWidth: '44%' }}
              >
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide mb-1">
                  {t('yearReview.entries')}
                </Text>
                <Text className="text-xl font-bold text-white">
                  {'\u{1F4DD}'} {stats?.totalEntries ?? 0}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl px-3 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', minWidth: '44%' }}
              >
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide mb-1">
                  {t('yearReview.topEmotion')}
                </Text>
                <Text className="text-xl font-bold text-white">
                  {stats?.topEmotion || '\u{1F60A}'}{' '}
                  {stats?.topEmotionPct ? `${stats.topEmotionPct}%` : '—'}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl px-3 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', minWidth: '44%' }}
              >
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide mb-1">
                  {t('yearReview.streak')}
                </Text>
                <Text className="text-xl font-bold text-white">
                  {'\u{1F525}'} {stats?.longestStreak ?? 0}d
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl px-3 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', minWidth: '44%' }}
              >
                <Text className="text-[10px] text-blue-200 uppercase tracking-wide mb-1">
                  Best Month
                </Text>
                <Text className="text-base font-bold text-white">
                  {'\u{1F4C5}'} {stats?.mostActiveMonth ?? '—'}
                </Text>
              </View>
            </View>

            {/* AI Narrative */}
            {(loadingNarrative || narrative) && (
              <View className="mx-5 mb-4 mt-2 rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                {loadingNarrative ? (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <ActivityIndicator size="small" color="#BFDBFE" />
                    <Text className="text-blue-200 text-sm">{t('common.loading')}</Text>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                      <Ionicons name="sparkles" size={14} color="#BFDBFE" />
                      <Text className="text-xs text-blue-200 font-semibold uppercase tracking-wide">
                        AI Summary
                      </Text>
                    </View>
                    <Text className="text-sm text-white leading-5" numberOfLines={5}>
                      {narrative}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Themes */}
            {stats && stats.themes.length > 0 && (
              <View className="px-5 pb-6">
                <Text className="text-xs text-blue-200 font-semibold uppercase tracking-wide mb-2">
                  {t('yearReview.themes')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {stats.themes.map((theme) => (
                    <View
                      key={theme}
                      className="rounded-full px-3 py-1"
                      style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                    >
                      <Text className="text-sm text-white font-medium">{theme}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Powered by footer */}
            <View className="px-5 pb-4">
              <Text className="text-[10px] text-blue-300 text-center">
                Powered by Daiyly AI
              </Text>
            </View>
          </View>
        </ViewShot>

        {/* Action buttons */}
        <View className="mx-5 mt-5 flex-row" style={{ gap: 12 }}>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            className="flex-1 flex-row items-center justify-center bg-blue-600 rounded-2xl py-3.5 active:bg-blue-700"
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text className="text-white font-semibold text-sm ml-2">
                  {t('yearReview.share')}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => { hapticLight(); router.back(); }}
            className="flex-1 flex-row items-center justify-center bg-surface-elevated border border-border rounded-2xl py-3.5 active:opacity-80"
          >
            <Text className="text-text-primary font-semibold text-sm">
              {t('common.done')}
            </Text>
          </Pressable>
        </View>

        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
