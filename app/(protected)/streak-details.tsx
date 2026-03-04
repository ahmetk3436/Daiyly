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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { hapticLight } from '../../lib/haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import type { JournalStreak } from '../../types/journal';

interface CalendarDay {
  date: string; // ISO YYYY-MM-DD
  hasEntry: boolean;
  isToday: boolean;
  isFuture: boolean;
}

function buildCalendarDays(entryDates: Set<string>): CalendarDay[] {
  const today = new Date();
  const days: CalendarDay[] = [];
  // Show last 35 days (5 weeks)
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const todayIso = today.toISOString().split('T')[0];
    days.push({
      date: iso,
      hasEntry: entryDates.has(iso),
      isToday: iso === todayIso,
      isFuture: false,
    });
  }
  return days;
}

function getMotivationalKey(streak: number): string {
  if (streak === 0) return 'streak.motivational0';
  if (streak < 3) return 'streak.motivational1';
  if (streak < 7) return 'streak.motivational3';
  if (streak < 14) return 'streak.motivational7';
  if (streak < 30) return 'streak.motivational14';
  if (streak < 60) return 'streak.motivational30';
  if (streak < 100) return 'streak.motivational60';
  return 'streak.motivational100';
}

export default function StreakDetailsScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();

  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const [streakRes, entriesRes] = await Promise.all([
        api.get('/journals/streak').catch(() => ({ data: null })),
        api.get('/journals', { params: { limit: 100, offset: 0 } }).catch(() => ({ data: { entries: [] } })),
      ]);

      setStreak(streakRes.data);

      const dates = new Set<string>();
      const entries = entriesRes.data?.entries || [];
      for (const e of entries) {
        const iso = (e.entry_date || e.created_at || '').split('T')[0];
        if (iso) dates.add(iso);
      }
      setEntryDates(dates);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    hapticLight();
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalEntries = streak?.total_entries || 0;
  const graceActive = streak?.grace_period_active || streak?.grace_active || false;
  const calendarDays = buildCalendarDays(entryDates);
  const motivationalMsg = t(getMotivationalKey(currentStreak));

  // Group calendar into rows of 7
  const calendarRows: CalendarDay[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    calendarRows.push(calendarDays.slice(i, i + 7));
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-border">
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          className="flex-row items-center mr-3"
        >
          <Ionicons name="chevron-back" size={24} color={isDark ? '#94A3B8' : '#374151'} />
        </Pressable>
        <Text className="text-lg font-bold text-text-primary">{t('streak.title')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
      >
        <View className="px-5 pt-5">
          {/* Current Streak Hero */}
          <View className="bg-surface-elevated rounded-3xl p-6 border border-border items-center mb-4">
            <Text style={{ fontSize: 56, lineHeight: 68 }}>
              {graceActive ? '\u{1F9CA}' : currentStreak > 0 ? '\u{1F525}' : '\u{1F4D3}'}
            </Text>
            <Text className="text-5xl font-black text-text-primary mt-2">
              {currentStreak}
            </Text>
            <Text className="text-base font-semibold text-text-secondary mt-1">
              {t('streak.dayStreak_other')}
            </Text>

            {graceActive && (
              <View className="mt-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl px-4 py-2 flex-row items-center border border-indigo-100 dark:border-indigo-800">
                <Text className="text-sm mr-1">{'\u{1F6E1}\u{FE0F}'}</Text>
                <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {t('streak.streakProtectedGrace')}
                </Text>
              </View>
            )}

            {!graceActive && currentStreak >= 7 && (
              <View className="mt-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl px-4 py-2 flex-row items-center border border-amber-100 dark:border-amber-800">
                <Ionicons name="shield-checkmark" size={14} color="#D97706" />
                <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300 ml-1.5">
                  {t('streak.graceEarned')}
                </Text>
              </View>
            )}
          </View>

          {/* Stats Row */}
          <View className="flex-row mb-4" style={{ gap: 12 }}>
            <View className="flex-1 bg-surface-elevated rounded-2xl p-4 border border-border items-center">
              <Ionicons name="trophy-outline" size={22} color="#F59E0B" />
              <Text className="text-2xl font-black text-text-primary mt-1">{longestStreak}</Text>
              <Text className="text-xs text-text-muted mt-0.5">{t('streak.longestLabel')}</Text>
            </View>
            <View className="flex-1 bg-surface-elevated rounded-2xl p-4 border border-border items-center">
              <Ionicons name="journal-outline" size={22} color="#2563EB" />
              <Text className="text-2xl font-black text-text-primary mt-1">{totalEntries}</Text>
              <Text className="text-xs text-text-muted mt-0.5">{t('streak.totalEntriesLabel')}</Text>
            </View>
          </View>

          {/* Motivational Message */}
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-4 border border-blue-100 dark:border-blue-800">
            <View className="flex-row items-center mb-1.5">
              <Ionicons name="sparkles" size={14} color="#2563EB" />
              <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300 ml-1.5">
                {t('streak.yourJourney')}
              </Text>
            </View>
            <Text className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {motivationalMsg}
            </Text>
          </View>

          {/* Grace Period Explanation */}
          <View className="bg-surface-elevated rounded-2xl p-4 mb-4 border border-border">
            <View className="flex-row items-center mb-2">
              <Text className="text-base mr-2">{'\u{1F9CA}'}</Text>
              <Text className="text-sm font-bold text-text-primary">{t('streak.gracePeriod')}</Text>
            </View>
            <Text className="text-sm text-text-secondary leading-relaxed">
              {t('streak.gracePeriodBody')}
            </Text>
            <View className="mt-3 flex-row items-center">
              <View
                className="rounded-full px-2.5 py-1 mr-2"
                style={{ backgroundColor: graceActive ? '#EEF2FF' : '#F1F5F9' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: graceActive ? '#4F46E5' : '#64748B' }}
                >
                  {graceActive ? t('streak.graceActive') : currentStreak >= 7 ? t('streak.graceAvailable') : t('streak.graceUnlocksAt')}
                </Text>
              </View>
            </View>
          </View>

          {/* Calendar */}
          <View className="bg-surface-elevated rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-sm font-bold text-text-primary mb-3">
              {t('streak.last5Weeks')}
            </Text>
            {calendarRows.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row justify-between mb-2">
                {row.map((day) => {
                  const dayNum = parseInt(day.date.split('-')[2], 10);
                  return (
                    <View
                      key={day.date}
                      className="items-center"
                      style={{ width: 38 }}
                    >
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: day.isToday
                            ? '#2563EB'
                            : day.hasEntry
                            ? '#22C55E'
                            : isDark
                            ? '#1E293B'
                            : '#F1F5F9',
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: day.isToday || day.hasEntry ? '#FFFFFF' : isDark ? '#64748B' : '#9CA3AF',
                          }}
                        >
                          {dayNum}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
            {/* Legend */}
            <View className="flex-row items-center mt-3" style={{ gap: 16 }}>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-1.5" />
                <Text className="text-xs text-text-muted">{t('streak.legendEntryLogged')}</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-blue-600 mr-1.5" />
                <Text className="text-xs text-text-muted">{t('streak.legendToday')}</Text>
              </View>
            </View>
          </View>

          {/* Write Today CTA */}
          {!entryDates.has(new Date().toISOString().split('T')[0]) && (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/(protected)/new-entry');
              }}
              className="bg-blue-600 rounded-2xl py-4 items-center mb-4 active:opacity-90"
            >
              <Text className="text-white font-bold text-base">
                {'\u{270D}\u{FE0F}'} {t('streak.writeTodayEntry')}
              </Text>
            </Pressable>
          )}
        </View>

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
