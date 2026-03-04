/**
 * HealthKitInsight.tsx
 *
 * iOS-only component that reads the last 7 days of sleep data from HealthKit
 * via react-native-health and shows a simple Sleep vs Mood correlation card.
 *
 * Render conditions:
 *  - Only on iOS (Platform.OS === 'ios')
 *  - Only when HealthKit is available and permission is granted
 *  - Hidden silently on any error or when no data is available
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

interface SleepSummary {
  avgHours: number;
  daysWithGoodSleep: number; // days with 7+ hours
  totalDaysTracked: number;
}

export default function HealthKitInsight() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [summary, setSummary] = useState<SleepSummary | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only attempt on iOS
    if (Platform.OS !== 'ios') return;

    fetchSleepData();
  }, []);

  const fetchSleepData = async () => {
    try {
      // Dynamic require so the app does not crash if react-native-health is absent
      // or if HealthKit is unavailable (simulator, iPad without Health, etc.)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AppleHealthKit = require('react-native-health').default;

      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.AppleExerciseTime,
          ],
          write: [] as string[],
        },
      };

      // Wrap initHealthKit in a promise
      const initialized: boolean = await new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (err: any) => {
          resolve(!err);
        });
      });

      if (!initialized) {
        // Permission denied or HealthKit unavailable — stay hidden
        return;
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const sleepOptions = {
        startDate: sevenDaysAgo.toISOString(),
        endDate: new Date().toISOString(),
      };

      // getSleepSamples resolves with array of {startDate, endDate, value}
      const samples: Array<{ startDate: string; endDate: string; value: string }> =
        await new Promise((resolve, reject) => {
          AppleHealthKit.getSleepSamples(sleepOptions, (err: any, results: any) => {
            if (err) reject(err);
            else resolve(results || []);
          });
        });

      if (!samples || samples.length === 0) {
        // No sleep data recorded — stay hidden
        return;
      }

      // Aggregate sleep hours per calendar day (only ASLEEP samples)
      const dailyHours: Map<string, number> = new Map();

      for (const sample of samples) {
        // react-native-health value types: 'ASLEEP', 'INBED', 'AWAKE'
        if (sample.value !== 'ASLEEP') continue;

        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        const hours = (end - start) / (1000 * 60 * 60);

        // Key by the date of the start of the sleep period
        const dayKey = new Date(sample.startDate).toDateString();
        dailyHours.set(dayKey, (dailyHours.get(dayKey) ?? 0) + hours);
      }

      if (dailyHours.size === 0) return;

      const hoursArray = Array.from(dailyHours.values());
      const totalHours = hoursArray.reduce((a, b) => a + b, 0);
      const avgHours = totalHours / hoursArray.length;
      const daysWithGoodSleep = hoursArray.filter((h) => h >= 7).length;

      setSummary({
        avgHours: Math.round(avgHours * 10) / 10,
        daysWithGoodSleep,
        totalDaysTracked: hoursArray.length,
      });
      setVisible(true);
    } catch {
      // Any error (package missing, permission denied, no data) — hide silently
      setVisible(false);
    }
  };

  if (!visible || !summary) return null;

  const goodSleepRatio =
    summary.totalDaysTracked > 0
      ? summary.daysWithGoodSleep / summary.totalDaysTracked
      : 0;

  const correlationNote =
    goodSleepRatio >= 0.6
      ? t('healthKit.correlationGood')
      : goodSleepRatio >= 0.3
      ? t('healthKit.correlationMid')
      : t('healthKit.correlationLow');

  return (
    <View className="bg-surface-elevated rounded-2xl p-5 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View
          className="w-9 h-9 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }}
        >
          <Ionicons name="moon-outline" size={18} color="#0EA5E9" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-text-primary">{t('healthKit.sleepVsMood')}</Text>
          <Text className="text-xs text-text-muted">{t('healthKit.last7Days')}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row mb-3" style={{ gap: 12 }}>
        <View
          className="flex-1 rounded-xl p-3 items-center"
          style={{ backgroundColor: isDark ? '#0C4A6E' : '#F0F9FF' }}
        >
          <Text className="text-2xl font-bold" style={{ color: '#0EA5E9' }}>
            {summary.avgHours}h
          </Text>
          <Text className="text-xs text-text-muted mt-0.5 text-center">{t('healthKit.avgSleep')}</Text>
        </View>

        <View
          className="flex-1 rounded-xl p-3 items-center"
          style={{
            backgroundColor:
              summary.daysWithGoodSleep > 0
                ? isDark
                  ? '#064E3B'
                  : '#ECFDF5'
                : isDark
                ? '#451A03'
                : '#FFF7ED',
          }}
        >
          <Text
            className="text-2xl font-bold"
            style={{
              color: summary.daysWithGoodSleep > 0 ? '#10B981' : '#F59E0B',
            }}
          >
            {summary.daysWithGoodSleep}/{summary.totalDaysTracked}
          </Text>
          <Text className="text-xs text-text-muted mt-0.5 text-center">{t('healthKit.days7Hours')}</Text>
        </View>
      </View>

      {/* Correlation note */}
      <Text className="text-sm text-text-secondary leading-relaxed">
        {`${t('healthKit.averaged', { hours: summary.avgHours })} ${correlationNote}`}
      </Text>
    </View>
  );
}
