import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../../lib/haptics';

// 2025-2026 Trend: Bento Box Grids (modular layouts)
interface FeatureCardProps {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  locked?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'premium' | 'new';
}

export default function FeatureCard({
  title,
  description,
  icon,
  color = '#8B5CF6',
  locked = false,
  onPress,
  variant = 'default',
}: FeatureCardProps) {
  const gradientColors = {
    default: ['#f3f4f6', '#e5e7eb'] as const,
    premium: ['#8B5CF6', '#EC4899'] as const,
    new: ['#10b981', '#059669'] as const,
  };

  const textColor = {
    default: '#1f2937',
    premium: '#ffffff',
    new: '#ffffff',
  };

  const cardGradient = gradientColors[variant];

  const cardContent = (
    <View
      className="rounded-3xl p-5 overflow-hidden"
      style={{
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full h-full"
      >
        <View className="flex-row items-start gap-4">
          {/* Icon container */}
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: locked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)' }}
          >
            {locked ? (
              <Ionicons name="lock-closed" size={24} color={variant === 'default' ? '#6b7280' : '#ffffff'} />
            ) : (
              <Ionicons name={icon} size={24} color={color} />
            )}
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text
                className={`font-bold text-base flex-1`}
                style={{ color: textColor[variant] }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {variant === 'new' && (
                <View className="bg-green-400 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-bold">NEW</Text>
                </View>
              )}
              {variant === 'premium' && (
                <Ionicons name="diamond" size={16} color="#ffffff" />
              )}
            </View>

            {description && (
              <Text
                className={`text-sm ${variant === 'default' ? 'text-gray-600' : 'text-white/80'}`}
                numberOfLines={2}
              >
                {description}
              </Text>
            )}
          </View>

          {/* Chevron */}
          {onPress && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={variant === 'default' ? '#9ca3af' : '#ffffff'}
            />
          )}
        </View>
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

// 2025-2026: Bento grid item (smaller square variant)
export function BentoItem({
  emoji,
  label,
  color = '#f3f4f6',
  onPress,
}: {
  emoji: string;
  label: string;
  color?: string;
  onPress?: () => void;
}) {
  const content = (
    <View
      className="rounded-2xl p-4 items-center justify-center gap-2"
      style={{
        backgroundColor: color,
        aspectRatio: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text className="text-4xl">{emoji}</Text>
      <Text className="text-sm font-medium text-gray-700 text-center">
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// 2025-2026: Streak milestone card
export function StreakMilestoneCard({
  days,
  reward,
  unlocked,
  icon,
}: {
  days: number;
  reward: string;
  unlocked: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      className={`rounded-3xl p-5 ${unlocked ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400' : 'bg-gray-100 border-2 border-transparent'}`}
      style={{
        shadowColor: unlocked ? '#f59e0b' : '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: unlocked ? 0.2 : 0.05,
        shadowRadius: unlocked ? 12 : 6,
        elevation: unlocked ? 6 : 2,
      }}
    >
      <View className="flex-row items-center gap-4">
        <View
          className={`w-14 h-14 rounded-2xl items-center justify-center ${unlocked ? 'bg-amber-400' : 'bg-gray-300'}`}
        >
          {icon ? (
            <Ionicons name={icon} size={28} color={unlocked ? '#ffffff' : '#9ca3af'} />
          ) : (
            <Text className="text-2xl">{unlocked ? '🔥' : '🔒'}</Text>
          )}
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text
              className={`font-bold text-lg ${unlocked ? 'text-amber-900' : 'text-gray-500'}`}
            >
              {days} Day Streak
            </Text>
            {unlocked && (
              <View className="bg-amber-500 px-2 py-0.5 rounded-full">
                <Text className="text-white text-xs font-bold">UNLOCKED</Text>
              </View>
            )}
          </View>
          <Text className={`text-sm ${unlocked ? 'text-amber-700' : 'text-gray-400'}`}>
            {reward}
          </Text>
        </View>

        {unlocked && (
          <Ionicons name="checkmark-circle" size={24} color="#f59e0b" />
        )}
      </View>
    </View>
  );
}
