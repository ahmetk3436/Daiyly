import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { hapticLight } from '../../lib/haptics';
import type { JournalEntry } from '../../types/journal';

interface Props {
  entry: JournalEntry;
  yearsAgo: number;
}

export default function OnThisDayCard({ entry, yearsAgo }: Props) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const dateLabel = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const yearsAgoLabel =
    yearsAgo === 1
      ? t('onThisDay.yearsAgo', { count: 1 })
      : t('onThisDay.yearsAgo', { count: yearsAgo });

  const handlePress = () => {
    hapticLight();
    router.push(`/(protected)/entry/${entry.id}`);
  };

  return (
    <View className="mx-6 mt-5">
      {/* Section header */}
      <View className="flex-row items-center mb-2.5">
        <Text className="text-base mr-1.5">{'\u{1F4C5}'}</Text>
        <Text className="text-sm font-semibold text-text-secondary flex-1">
          {t('onThisDay.title')} — {yearsAgoLabel}
        </Text>
      </View>

      {/* Card */}
      <Pressable
        onPress={handlePress}
        className="bg-surface-elevated rounded-2xl p-4 border border-border active:scale-[0.98]"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.15 : 0.04,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {/* Divider line */}
        <View
          className="h-px mb-3"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
        />

        {/* Mood + date row */}
        <View className="flex-row items-center mb-2">
          <Text className="text-2xl mr-2">{entry.mood_emoji || '\u{1F4DD}'}</Text>
          <View className="flex-1">
            <Text className="text-xs font-medium text-text-muted">{dateLabel}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isDark ? '#4B5563' : '#D1D5DB'}
          />
        </View>

        {/* Entry preview */}
        <Text className="text-sm text-text-secondary leading-5" numberOfLines={2}>
          {entry.content || t('home.noContent')}
        </Text>

        {/* Read link */}
        <Text className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium text-right">
          {t('onThisDay.read')}
        </Text>
      </Pressable>
    </View>
  );
}
