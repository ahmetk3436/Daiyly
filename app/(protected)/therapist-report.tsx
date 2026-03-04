import React, { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface DateRange {
  from: string;
  to: string;
}

interface TherapistReportData {
  report: string;
  generated_at: string;
  entry_count: number;
  date_range: DateRange;
}

function formatDateRange(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const fromStr = `${monthNames[fromDate.getUTCMonth()]} ${fromDate.getUTCDate()}`;
  const toStr = `${monthNames[toDate.getUTCMonth()]} ${toDate.getUTCDate()}, ${toDate.getUTCFullYear()}`;
  return `${fromStr} \u2013 ${toStr}`;
}

export default function TherapistReportScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<TherapistReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/journals/therapist-report');
      setData(response.data);
    } catch (err: any) {
      Sentry.captureException(err);
      setError(t('therapistReport.couldNotGenerate'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchReport();
  }, [fetchReport, isAuthenticated]);

  const handleShare = async () => {
    if (!data) return;
    hapticLight();
    setIsSharing(true);
    try {
      const dateRange = formatDateRange(data.date_range.from, data.date_range.to);
      const shareText = [
        `${t('therapistReport.title')} — ${dateRange}`,
        t('therapistReport.basedOn_other', { count: data.entry_count }),
        '',
        data.report,
        '',
        t('therapistReport.generatedBy'),
      ].join('\n');

      await Share.share({
        message: shareText,
        title: t('therapistReport.title'),
      });
      hapticSuccess();
    } catch (err: any) {
      // User cancelled share — not an error worth capturing
      if (err?.message !== 'Share was dismissed') {
        Sentry.captureException(err);
        hapticError();
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Navigation header */}
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
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-sm text-text-secondary mt-4">
            {t('therapistReport.generating')}
          </Text>
        </View>
      )}

      {/* Error state */}
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
              fetchReport();
            }}
          >
            <Text className="text-white font-semibold text-sm">{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      )}

      {/* Report content */}
      {!isLoading && !error && data && (
        <>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Report header card */}
            <View className="mx-4 mt-4 bg-surface-elevated rounded-2xl border border-border p-4">
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}
                >
                  <Ionicons name="document-text-outline" size={20} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-text-primary">
                    {t('therapistReport.summary30Day')}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-0.5">
                    {formatDateRange(data.date_range.from, data.date_range.to)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2">
                <Ionicons name="journal-outline" size={14} color="#2563EB" />
                <Text className="text-xs text-blue-700 dark:text-blue-300 ml-1.5 font-medium">
                  {data.entry_count === 1
                    ? t('therapistReport.basedOn_one', { count: data.entry_count })
                    : t('therapistReport.basedOn_other', { count: data.entry_count })}
                </Text>
              </View>
            </View>

            {/* Report body */}
            <View className="mx-4 mt-3 bg-surface-elevated rounded-2xl border border-border p-4">
              <Text className="text-sm font-semibold text-text-primary mb-3">
                {t('therapistReport.reportContent')}
              </Text>
              {data.report.split('\n').map((line, index) => {
                const trimmed = line.trim();

                // H2 heading: ## text
                if (trimmed.startsWith('## ')) {
                  return (
                    <Text
                      key={index}
                      className="text-base font-bold text-text-primary mt-4 mb-1"
                    >
                      {trimmed.slice(3)}
                    </Text>
                  );
                }

                // H3 heading: ### text
                if (trimmed.startsWith('### ')) {
                  return (
                    <Text
                      key={index}
                      className="text-sm font-semibold text-text-primary mt-3 mb-1"
                    >
                      {trimmed.slice(4)}
                    </Text>
                  );
                }

                // Bullet point: - text or * text
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  return (
                    <View key={index} className="flex-row mt-1">
                      <Text className="text-text-secondary text-sm mr-2 mt-0.5">{'\u2022'}</Text>
                      <Text className="text-sm text-text-secondary flex-1 leading-5">
                        {trimmed.slice(2)}
                      </Text>
                    </View>
                  );
                }

                // Empty line — add spacing
                if (trimmed === '') {
                  return <View key={index} className="h-2" />;
                }

                // Regular paragraph
                return (
                  <Text
                    key={index}
                    className="text-sm text-text-secondary leading-5 mt-0.5"
                  >
                    {trimmed}
                  </Text>
                );
              })}
            </View>

            {/* Confidentiality notice */}
            <View className="mx-4 mt-3 flex-row items-center px-3 py-2 bg-amber-50 dark:bg-amber-900/15 rounded-xl border border-amber-100 dark:border-amber-800/40">
              <Ionicons name="lock-closed-outline" size={13} color="#D97706" />
              <Text className="text-xs text-amber-700 dark:text-amber-400 ml-1.5 flex-1">
                {t('therapistReport.confidentialNote')}
              </Text>
            </View>
          </ScrollView>

          {/* Share button */}
          <View
            className="px-4 pb-6 pt-3 bg-background border-t border-border"
          >
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
                    {t('therapistReport.shareWithTherapist')}
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
