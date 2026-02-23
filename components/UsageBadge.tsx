import React from 'react';
import { View, Text } from 'react-native';

interface UsageBadgeProps {
  variant: 'guest' | 'premium';
  usesRemaining?: number;
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({ variant, usesRemaining }) => {
  if (variant === 'premium') {
    return (
      <View className="bg-purple-100 px-4 py-2 rounded-full flex-row items-center self-start">
        <Text className="text-purple-700 text-sm font-medium">⭐ Premium</Text>
      </View>
    );
  }

  return (
    <View className="bg-blue-50 px-4 py-2 rounded-full flex-row items-center self-start border border-blue-100">
      <Text className="text-blue-700 text-sm font-medium">
        🎁 {usesRemaining} free {usesRemaining === 1 ? 'entry' : 'entries'} remaining
      </Text>
    </View>
  );
};
