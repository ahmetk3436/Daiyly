import React, { forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../lib/haptics';

function getMoodLabel(score: number): string {
  if (score <= 20) return 'Feeling Low';
  if (score <= 40) return 'A Bit Down';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Feeling Good';
  return 'Amazing!';
}

/**
 * Adjust color brightness by percentage
 */
const adjustColorBrightness = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

// 2025-2026 Trend: Gradient backgrounds, glassmorphism, shareable cards
interface MoodCardProps {
  moodEmoji: string;
  moodScore: number;
  date: string;
  streakCount: number;
  cardColor: string;
  onShare: () => void;
  userName?: string;
}

export default function MoodCard({
  moodEmoji,
  moodScore,
  date,
  streakCount,
  cardColor,
  onShare,
  userName,
}: MoodCardProps) {
  const label = getMoodLabel(moodScore);

  const formattedDate = (() => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  })();

  // 2025-2026 Trend: Gradient overlay for premium feel
  const moodGradientColors = {
    'Feeling Low': ['#64748b', '#475569'] as const,
    'A Bit Down': ['#60a5fa', '#3b82f6'] as const,
    'Neutral': ['#8b5cf6', '#6366f1'] as const,
    'Feeling Good': ['#34d399', '#10b981'] as const,
    'Amazing!': ['#fbbf24', '#f59e0b'] as const,
  };

  const gradientColors = moodGradientColors[label as keyof typeof moodGradientColors] || (['#8b5cf6', '#ec4899'] as const);

  return (
    <View
      className="rounded-3xl overflow-hidden mx-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      {/* 2025-2026: Gradient background instead of flat color */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-6"
      >
        {/* Top bar with watermark and share button */}
        <View className="flex-row justify-between items-start mb-4">
          {/* Watermark */}
          <View className="flex-row items-center gap-1">
            <Text className="text-white/80 text-sm font-semibold tracking-widest uppercase">
              Daiyly
            </Text>
          </View>

          {/* Share button */}
          <Pressable
            className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 items-center justify-center"
            onPress={() => {
              hapticLight();
              onShare();
            }}
          >
            <Ionicons name="share-outline" size={18} color="#ffffff" />
          </Pressable>
        </View>

        {/* Main content */}
        <View className="items-center py-4">
          {/* Mood Emoji */}
          <View className="mb-3">
            <Text className="text-7xl">{moodEmoji}</Text>
          </View>

          {/* Mood Score Badge */}
          <View className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-2">
            <Text className="text-lg font-bold text-white">
              Mood: {moodScore}/100
            </Text>
          </View>

          {/* Mood Label */}
          <Text className="text-3xl font-bold text-white text-center mb-1">
            {label}
          </Text>

          {/* Date */}
          <Text className="text-sm text-white/80 text-center">
            {formattedDate}
          </Text>
        </View>

        {/* Streak Badge */}
        {streakCount > 0 && (
          <View className="flex-row items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 self-center mb-3">
            <Text className="text-lg">{'\u{1F525}'}</Text>
            <Text className="text-sm font-semibold text-white">
              {streakCount} day streak
            </Text>
          </View>
        )}

        {/* Divider */}
        <View className="h-px bg-white/20 my-3" />

        {/* Footer with username and branding */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="person-outline" size={16} color="#ffffff" />
            </View>
            <Text className="text-sm text-white/90">
              {userName || 'Anonymous'}
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Ionicons name="sparkles" size={14} color="#ffffff" />
            <Text className="text-xs text-white/70">Powered by Daiyly</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export { getMoodLabel };

// Shareable MoodCard with ViewShot support via forwardRef
interface ShareableMoodCardProps {
  entry: {
    id?: string;
    mood_emoji: string;
    mood_score: number;
    content?: string;
    card_color: string;
    entry_date: string;
  };
  showBranding?: boolean;
}

export const ShareableMoodCard = forwardRef<View, ShareableMoodCardProps>(
  ({ entry, showBranding = true }, ref) => {
    const baseColor = entry.card_color || '#6366f1';

    const gradientColors: [string, string, string] = [
      baseColor,
      adjustColorBrightness(baseColor, -20),
      adjustColorBrightness(baseColor, -40),
    ];

    const formattedDate = new Date(entry.entry_date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const label = getMoodLabel(entry.mood_score);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={{ width: 320, height: 400 }}
      >
        <View className="w-80 h-96 rounded-3xl overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
          }}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          >
            {/* Decorative circles */}
            <View
              className="absolute w-32 h-32 rounded-full bg-white/20"
              style={{ top: -20, right: -20 }}
            />
            <View
              className="absolute w-48 h-48 rounded-full bg-white/10"
              style={{ bottom: -40, left: -40 }}
            />

            {/* Content */}
            <View className="flex-1 p-6 justify-between">
              {/* Header */}
              <View>
                <Text className="text-sm text-white/80 font-medium">
                  {formattedDate}
                </Text>
                {showBranding && (
                  <Text className="text-xs text-white/60 mt-1">
                    Daiyly {'\u2022'} Daily Mood Tracker
                  </Text>
                )}
              </View>

              {/* Mood Display */}
              <View className="flex-1 justify-center items-center">
                <Text className="text-7xl">
                  {entry.mood_emoji}
                </Text>
                <Text className="text-2xl font-bold text-white mt-2">
                  {label}
                </Text>
                <Text className="text-lg text-white/80 mt-1">
                  {entry.mood_score}/100
                </Text>
              </View>

              {/* Content */}
              {entry.content ? (
                <View className="bg-white/10 rounded-xl p-3">
                  <Ionicons name="chatbubble-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text
                    className="text-sm text-white/90 mt-2 italic"
                    numberOfLines={3}
                  >
                    &ldquo;{entry.content}&rdquo;
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Footer */}
            {showBranding && (
              <View className="px-6 pb-4 pt-2 border-t border-white/20">
                <Text className="text-xs text-white/60 text-center">
                  Track your mood daily with Daiyly
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
    );
  }
);

ShareableMoodCard.displayName = 'ShareableMoodCard';

// 2025-2026: Bento Box Grid component for multiple moods
export function MoodBentoGrid({ moods, onSelectMood }: {
  moods: Array<{ id: string; emoji: string; label: string }>;
  onSelectMood: (id: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2 px-4">
      {moods.map((mood) => (
        <Pressable
          key={mood.id}
          className="w-16 h-16 rounded-2xl items-center justify-center"
          style={{
            backgroundColor: '#f3f4f6',
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
          onPress={() => {
            hapticLight();
            onSelectMood(mood.id);
          }}
        >
          <Text className="text-2xl mb-0.5">{mood.emoji}</Text>
          <Text className="text-xs text-gray-600">{mood.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
