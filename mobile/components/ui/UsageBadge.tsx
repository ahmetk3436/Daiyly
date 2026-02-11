import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 2025-2026 Trend: Usage visibility for freemium conversion
interface UsageBadgeProps {
  used: number;
  limit: number;
  type?: 'daily' | 'monthly' | 'total';
}

export default function UsageBadge({
  used,
  limit,
  type = 'daily',
}: UsageBadgeProps) {
  const remaining = Math.max(0, limit - used);
  const percentage = (used / limit) * 100;
  const isLow = percentage >= 90;
  const isMedium = percentage >= 70;

  const bgColor = isLow ? 'bg-red-100' : isMedium ? 'bg-amber-100' : 'bg-blue-100';
  const textColor = isLow ? 'text-red-600' : isMedium ? 'text-amber-600' : 'text-blue-600';
  const iconName = isLow ? 'warning-outline' : isMedium ? 'time-outline' : 'checkmark-circle-outline';

  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full ${bgColor}`}
    >
      <Ionicons name={iconName} size={14} color={textColor.replace('text-', '')} />
      <Text className={`text-xs font-medium ${textColor}`}>
        {remaining} {type === 'daily' ? 'left today' : type === 'monthly' ? 'left this month' : 'remaining'}
      </Text>
    </View>
  );
}

// 2025-2026: Unlimited badge for premium users
export function UnlimitedBadge({ feature = 'Premium' }: { feature?: string }) {
  return (
    <View className="flex-row items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 rounded-full">
      <Ionicons name="infinite" size={12} color="#ffffff" />
      <Text className="text-xs font-bold text-white">{feature}</Text>
    </View>
  );
}

// Progress bar variant for usage visualization
export function UsageProgressBar({
  used,
  limit,
  color = '#8B5CF6',
}: {
  used: number;
  limit: number;
  color?: string;
}) {
  const percentage = Math.min(100, (used / limit) * 100);

  return (
    <View className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <View
        className="h-full rounded-full"
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
