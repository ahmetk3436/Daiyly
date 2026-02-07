import React from 'react';
import { View, Text, Pressable } from 'react-native';

function getMoodLabel(score: number): string {
  if (score <= 20) return 'Feeling Low';
  if (score <= 40) return 'A Bit Down';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Feeling Good';
  return 'Amazing!';
}

interface MoodCardProps {
  moodEmoji: string;
  moodScore: number;
  date: string;
  streakCount: number;
  cardColor: string;
  onShare: () => void;
}

export default function MoodCard({
  moodEmoji,
  moodScore,
  date,
  streakCount,
  cardColor,
  onShare,
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

  return (
    <View
      className="rounded-3xl overflow-hidden mx-4"
      style={{
        backgroundColor: cardColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <View className="p-6">
        <Pressable
          className="absolute top-4 right-4 bg-white/80 rounded-full w-10 h-10 items-center justify-center z-10"
          onPress={onShare}
        >
          <Text className="text-lg">{'↗'}</Text>
        </Pressable>

        <Text className="text-6xl text-center">{moodEmoji}</Text>
        <Text className="text-lg font-bold text-gray-800 text-center mt-3">
          Mood: {moodScore}/100
        </Text>
        <Text className="text-2xl font-bold text-center mt-2 text-gray-900">
          {label}
        </Text>
        <Text className="text-sm text-gray-600 text-center mt-4">
          {formattedDate}
        </Text>

        {streakCount > 0 && (
          <View className="bg-white/50 rounded-full px-4 py-2 self-center mt-3 flex-row items-center">
            <Text className="text-sm font-medium text-gray-700">
              {'🔥'} {streakCount} day streak
            </Text>
          </View>
        )}

        <View className="h-px bg-gray-300/50 my-4" />

        <Text className="text-xs text-gray-500 text-center tracking-widest uppercase">
          Daiyly
        </Text>
      </View>
    </View>
  );
}

export { getMoodLabel };
