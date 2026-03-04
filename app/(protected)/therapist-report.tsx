import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProGate } from '../../lib/useProGate';

const CACHE_KEY = '@daiyly_therapist_report_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  data: TherapistReportData;
  fetchedAt: number;
}

interface TherapistReportData {
  period_days: number;
  total_entries: number;
  avg_mood: number;
  top_themes: string[];
  mood_trend: 'improving' | 'stable' | 'declining';
  emotional_highlights: string[];
  ai_summary: string;
  recommendations: string[];
  generated_at: string;
}

function formatGeneratedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TherapistReportScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { requirePro } = useProGate();

  const [data, setData] = useState<TherapistReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notEnoughData, setNotEnoughData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const reportViewRef = useRef<ViewShot>(null);

  const fetchReport = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setNotEnoughData(false);

    // Check cache unless forced refresh
    if (!forceRefresh) {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: CacheEntry = JSON.parse(raw);
          if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            setData(cached.data);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // ignore cache read errors
      }
    }

    try {
      const response = await api.get('/journals/therapist-report');
      const reportData: TherapistReportData = response.data;
      setData(reportData);

      // Persist to cache
      try {
        const entry: CacheEntry = { data: reportData, fetchedAt: Date.now() };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
      } catch {
        // non-fatal
      }
    } catch (err: any) {
      if (err?.response?.status === 422) {
        setNotEnoughData(true);
      } else {
        Sentry.captureException(err);
        setError(t('therapistReport.couldNotGenerate'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const allowed = requirePro('Therapist Report');
    if (!allowed) {
      router.back();
      return;
    }
    fetchReport();
  }, [isAuthenticated, fetchReport, requirePro]);

  const handleShare = async () => {
    if (!data) return;
    hapticLight();
    setIsSharing(true);
    try {
      const uri = await captureRef(reportViewRef, {
        format: 'png',
        quality: 1,
      });
      const available = await ExpoSharing.isAvailableAsync();
      if (available) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: t('therapistReport.title'),
        });
        hapticSuccess();
      } else {
        hapticError();
      }
    } catch (err: any) {
      Sentry.captureException(err);
      hapticError();
    } finally {
      setIsSharing(false);
    }
  };

  const getTrendLabel = (trend: TherapistReportData['mood_trend']): string => {
    switch (trend) {
      case 'improving': return t('therapistReport.trendImproving');
      case 'stable': return t('therapistReport.trendStable');
      case 'declining': return t('therapistReport.trendDeclining');
    }
  };

  const getTrendIcon = (trend: TherapistReportData['mood_trend']) => {
    switch (trend) {
      case 'improving': return { name: 'trending-up' as const, color: '#10B981' };
      case 'stable': return { name: 'remove' as const, color: '#3B82F6' };
      case 'declining': return { name: 'trending-down' as const, color: '#F59E0B' };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable
          className="w-9 h-9 items-center justify-center rounded-full active:bg-surface-muted mr-2"
          onPress={() => {
            hapticLight();
            router.back();
          }}
        >
          <Ionicons name="chevron-back" size={22} color={isDark ? '#CBD5E1' : '#374151'} />
        </Pressable>
        <Text className="text-lg font-bold text-text-primary flex-1">
          {t('therapistReport.title')}
        </Text>
        {data && (
          <Pressable
            className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <>
                  <Ionicons name="share-outline" size={16} color="#2563EB" />
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400 ml-1">
                    {t('therapistReport.shareReport')}
                  </Text>
                </>
            }
          </Pressable>
        )}
      </View>

      {/* Loading */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-sm text-text-secondary mt-4">
            {t('therapistReport.generating')}
          </Text>
        </View>
      )}

      {/* Not enough data (422) */}
      {!isLoading && notEnoughData && (
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }}
          >
            <Ionicons name="document-outline" size={32} color="#2563EB" />
          </View>
          <Text className="text-base font-semibold text-text-primary text-center mb-2">
            {t('therapistReport.notEnoughData')}
          </Text>
          <Pressable
            className="mt-4 bg-blue-600 rounded-xl px-6 py-3 active:bg-blue-700"
            onPress={() => router.back()}
          >
            <Text className="text-white font-semibold text-sm">{t('common.goBack')}</Text>
          </Pressable>
        </View>
      )}

      {/* Error */}
      {!isLoading && error && (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 items-center justify-center mb-4">
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <Text className="text-base font-semibold text-text-primary text-center mb-2">
            {error}
          </Text>
          <Pressable
            className="mt-4 bg-blue-600 rounded-xl px-6 py-3 active:bg-blue-700"
            onPress={() => {
              hapticLight();
              fetchReport(true);
            }}
          >
            <Text className="text-white font-semibold text-sm">{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      )}

      {/* Report content */}
      {!isLoading && !error && !notEnoughData && data && (
        <>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Capture view wraps the shareable content */}
            <ViewShot ref={reportViewRef} options={{ format: 'png', quality: 1 }}>
              <View className="bg-background">
                {/* Subtitle row */}
                <View className="mx-4 mt-4 flex-row items-center justify-between">
                  <Text className="text-xs text-text-muted">
                    {t('therapistReport.subtitle')}
                  </Text>
                  <Text className="text-xs text-text-muted">
                    {t('therapistReport.generated', {
                      date: formatGeneratedDate(data.generated_at),
                    })}
                  </Text>
                </View>

                {/* Overview card */}
                <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
                  <View className="flex-row items-center mb-3">
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }}
                    >
                      <Ionicons name="bar-chart-outline" size={18} color="#2563EB" />
                    </View>
                    <Text className="text-base font-bold text-text-primary">
                      {t('therapistReport.overview')}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                    {/* Entries */}
                    <View
                      className="rounded-xl px-3 py-2 flex-row items-center"
                      style={{ backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }}
                    >
                      <Ionicons name="journal-outline" size={14} color="#2563EB" />
                      <Text className="text-xs font-semibold text-text-primary ml-1.5">
                        {t('therapistReport.entries', { count: data.total_entries })}
                      </Text>
                    </View>
                    {/* Avg mood */}
                    <View
                      className="rounded-xl px-3 py-2 flex-row items-center"
                      style={{ backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }}
                    >
                      <Ionicons name="happy-outline" size={14} color="#8B5CF6" />
                      <Text className="text-xs font-semibold text-text-primary ml-1.5">
                        {t('therapistReport.avgMood', { score: data.avg_mood.toFixed(1) })}
                      </Text>
                    </View>
                    {/* Trend */}
                    {(() => {
                      const { name, color } = getTrendIcon(data.mood_trend);
                      return (
                        <View
                          className="rounded-xl px-3 py-2 flex-row items-center"
                          style={{ backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }}
                        >
                          <Ionicons name={name} size={14} color={color} />
                          <Text className="text-xs font-semibold ml-1.5" style={{ color }}>
                            {getTrendLabel(data.mood_trend)}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>

                {/* Top Themes */}
                {data.top_themes && data.top_themes.length > 0 && (
                  <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }}
                      >
                        <Ionicons name="bulb-outline" size={18} color="#8B5CF6" />
                      </View>
                      <Text className="text-base font-bold text-text-primary">
                        {t('therapistReport.topThemes')}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {data.top_themes.map((theme, i) => (
                        <View
                          key={i}
                          className="rounded-full px-3 py-1.5"
                          style={{ backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }}
                        >
                          <Text className="text-xs font-medium" style={{ color: '#8B5CF6' }}>
                            {theme}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* AI Summary */}
                {data.ai_summary ? (
                  <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }}
                      >
                        <Ionicons name="sparkles-outline" size={18} color="#10B981" />
                      </View>
                      <Text className="text-base font-bold text-text-primary">
                        {t('therapistReport.aiSummary')}
                      </Text>
                    </View>
                    <Text className="text-sm text-text-secondary leading-6">
                      {data.ai_summary}
                    </Text>
                  </View>
                ) : null}

                {/* Highlights */}
                {data.emotional_highlights && data.emotional_highlights.length > 0 && (
                  <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: isDark ? '#78350F' : '#FFFBEB' }}
                      >
                        <Ionicons name="star-outline" size={18} color="#F59E0B" />
                      </View>
                      <Text className="text-base font-bold text-text-primary">
                        {t('therapistReport.highlights')}
                      </Text>
                    </View>
                    {data.emotional_highlights.map((h, i) => (
                      <View key={i} className="flex-row mt-1.5">
                        <Text className="text-text-muted text-sm mr-2 mt-0.5">{'\u2022'}</Text>
                        <Text className="text-sm text-text-secondary flex-1 leading-5">{h}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recommendations */}
                {data.recommendations && data.recommendations.length > 0 && (
                  <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }}
                      >
                        <Ionicons name="clipboard-outline" size={18} color="#2563EB" />
                      </View>
                      <Text className="text-base font-bold text-text-primary">
                        {t('therapistReport.recommendations')}
                      </Text>
                    </View>
                    {data.recommendations.map((rec, i) => (
                      <View key={i} className="flex-row mt-1.5">
                        <Text className="text-text-muted text-sm mr-2 mt-0.5">{'\u2022'}</Text>
                        <Text className="text-sm text-text-secondary flex-1 leading-5">{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Confidentiality notice */}
                <View className="mx-4 mt-3 flex-row items-center px-3 py-2 bg-amber-50 dark:bg-amber-900/15 rounded-xl border border-amber-100 dark:border-amber-800/40">
                  <Ionicons name="lock-closed-outline" size={13} color="#D97706" />
                  <Text className="text-xs text-amber-700 dark:text-amber-400 ml-1.5 flex-1">
                    {t('therapistReport.confidentialNote')}
                  </Text>
                </View>
              </View>
            </ViewShot>
          </ScrollView>

          {/* Share button */}
          <View className="px-4 pb-6 pt-3 bg-background border-t border-border">
            <Pressable
              className="bg-blue-600 rounded-2xl py-4 items-center active:bg-blue-700 flex-row justify-center"
              onPress={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text className="text-white font-semibold text-base ml-2">
                    {t('therapistReport.shareReport')}
                  </Text>
                </>
              )}
            </Pressable>
            <Text className="text-center text-xs text-text-muted mt-2">
              {t('therapistReport.generatedBy')}
            </Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
