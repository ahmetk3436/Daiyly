import React from 'react';
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
    'Feeling Low': ['#64748b', '#475569'],
    'A Bit Down': ['#60a5fa', '#3b82f6'],
    'Neutral': ['#8b5cf6', '#6366f1'],
    'Feeling Good': ['#34d399', '#10b981'],
    'Amazing!': ['#fbbf24', '#f59e0b'],
  };

  const gradientColors = moodGradientColors[label as keyof typeof moodGradientColors] || ['#8b5cf6', '#ec4899'];

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
            <Text className="text-lg">{'🔥'}</Text>
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
