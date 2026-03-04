import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { useTheme } from '../../contexts/ThemeContext';

const SKIP_KEY = '@daiyly_prompt_skip_date';

type PromptCategory = 'gratitude' | 'reflection' | 'challenge' | 'growth';

const PROMPTS: Record<PromptCategory, string[]> = {
  gratitude: [
    "What's one small thing that made today better?",
    'Name three people you\'re grateful for today.',
    'What did your body do well today?',
  ],
  reflection: [
    "What's been on your mind this week?",
    'What would you tell your morning self right now?',
    'What did you learn about yourself today?',
  ],
  challenge: [
    "What's one thing that felt hard today, and why?",
    "What's a worry you can put on paper and let go of?",
    "What's one thing you wish went differently?",
  ],
  growth: [
    "What's one thing you're looking forward to?",
    'What would make tomorrow better than today?',
    "What's one thing you're proud of this week?",
  ],
};

const CATEGORY_ORDER: PromptCategory[] = ['gratitude', 'reflection', 'challenge', 'growth'];

// Select category based on mood register
function selectCategoryForMood(mood: string | null): PromptCategory {
  if (!mood) {
    // Date-seeded random so it stays stable per calendar day
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return CATEGORY_ORDER[dayOfYear % CATEGORY_ORDER.length];
  }
  // Sad/angry/anxious moods → reflection or challenge
  const lowMoodEmojis = ['\uD83D\uDE22', '\uD83D\uDE14', '\uD83D\uDE20', '\uD83D\uDE2B', '\uD83D\uDE41', '\uD83D\uDE1F'];
  const highMoodEmojis = ['\uD83D\uDE04', '\uD83D\uDE0A', '\uD83E\uDD29', '\uD83D\uDE01', '\uD83E\uDD73', '\uD83D\uDE03'];

  if (lowMoodEmojis.some(e => mood.includes(e))) {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return dayOfYear % 2 === 0 ? 'reflection' : 'challenge';
  }
  if (highMoodEmojis.some(e => mood.includes(e))) {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return dayOfYear % 2 === 0 ? 'gratitude' : 'growth';
  }
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return CATEGORY_ORDER[dayOfYear % CATEGORY_ORDER.length];
}

// Pick initial prompt index seeded by current date (stable per day)
function getDayIndex(listLength: number): number {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return dayOfYear % listLength;
}

interface WritingPromptCardProps {
  mood: string | null;
  onSelectPrompt: (text: string) => void;
}

export default function WritingPromptCard({ mood, onSelectPrompt }: WritingPromptCardProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [visible, setVisible] = useState(false);
  const [category, setCategory] = useState<PromptCategory>('gratitude');
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const init = async () => {
      // Check skip flag — resets daily
      try {
        const skipDate = await AsyncStorage.getItem(SKIP_KEY);
        const today = new Date().toDateString();
        if (skipDate === today) {
          setVisible(false);
          return;
        }
      } catch {
        // ignore
      }
      const cat = selectCategoryForMood(mood);
      setCategory(cat);
      setPromptIndex(getDayIndex(PROMPTS[cat].length));
      setVisible(true);
    };
    init();
    // Only run on mount — mood changes after mount don't reset the card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = useCallback(async () => {
    hapticLight();
    try {
      await AsyncStorage.setItem(SKIP_KEY, new Date().toDateString());
    } catch {
      // ignore
    }
    setVisible(false);
  }, []);

  const handleUsePrompt = useCallback(() => {
    hapticSelection();
    const prompts = PROMPTS[category];
    onSelectPrompt(prompts[promptIndex]);
    setVisible(false);
  }, [category, promptIndex, onSelectPrompt]);

  const handleDifferentPrompt = useCallback(() => {
    hapticLight();
    const prompts = PROMPTS[category];
    setPromptIndex((prev) => (prev + 1) % prompts.length);
  }, [category]);

  if (!visible) return null;

  const prompts = PROMPTS[category];
  const currentPrompt = prompts[promptIndex];

  const categoryLabel = t(`writingPrompt.categories.${category}`);

  const categoryColors: Record<PromptCategory, { bg: string; bgDark: string; text: string }> = {
    gratitude: { bg: '#FEF9C3', bgDark: '#422006', text: '#92400E' },
    reflection: { bg: '#EFF6FF', bgDark: '#1E3A5F', text: '#1D4ED8' },
    challenge: { bg: '#FFF7ED', bgDark: '#431407', text: '#C2410C' },
    growth: { bg: '#F0FDF4', bgDark: '#052E16', text: '#15803D' },
  };
  const colors = categoryColors[category];

  return (
    <View
      className="rounded-2xl px-4 py-4 mt-4 mb-1"
      style={{
        backgroundColor: isDark ? colors.bgDark : colors.bg,
        // Subtle shadow on light mode
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      {/* Category chip + dismiss */}
      <View className="flex-row items-center justify-between mb-3">
        <View
          className="rounded-full px-2.5 py-0.5"
          style={{
            backgroundColor: isDark
              ? `${colors.text}25`
              : `${colors.text}15`,
          }}
        >
          <Text
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: colors.text }}
          >
            {categoryLabel}
          </Text>
        </View>
        <Pressable
          onPress={handleSkip}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          className="active:opacity-50"
        >
          <Ionicons
            name="close"
            size={16}
            color={isDark ? '#94A3B8' : '#9CA3AF'}
          />
        </Pressable>
      </View>

      {/* Prompt text */}
      <Text
        className="text-base leading-6 mb-4"
        style={{
          color: isDark ? '#E2E8F0' : '#1E293B',
          fontStyle: 'italic',
        }}
      >
        {currentPrompt}
      </Text>

      {/* Action row */}
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {/* Use this */}
        <Pressable
          onPress={handleUsePrompt}
          className="flex-row items-center rounded-xl px-4 py-2.5 active:opacity-75"
          style={{ backgroundColor: colors.text }}
        >
          <Text className="text-white text-sm font-semibold mr-1">
            {t('writingPrompt.useThis')}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </Pressable>

        {/* Different prompt */}
        <Pressable
          onPress={handleDifferentPrompt}
          className="flex-row items-center rounded-xl px-3 py-2.5 border active:opacity-75"
          style={{
            borderColor: isDark ? '#334155' : '#E2E8F0',
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          }}
        >
          <Ionicons name="refresh-outline" size={14} color={isDark ? '#94A3B8' : '#6B7280'} />
          <Text
            className="text-sm font-medium ml-1"
            style={{ color: isDark ? '#94A3B8' : '#6B7280' }}
          >
            {t('writingPrompt.different')}
          </Text>
        </Pressable>

        {/* Skip (text link) */}
        <Pressable
          onPress={handleSkip}
          className="ml-auto active:opacity-50"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text
            className="text-xs"
            style={{ color: isDark ? '#64748B' : '#9CA3AF' }}
          >
            {t('writingPrompt.skip')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
