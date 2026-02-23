import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../lib/haptics';

// 2025-2026 Trend: Contextual Paywalls (value-gated upgrades)
interface CTABannerProps {
  title: string;
  description?: string;
  buttonText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  gradientColors?: readonly [string, string, ...string[]];
  onPress?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  type?: 'upgrade' | 'feature' | 'achievement';
}

export default function CTABanner({
  title,
  description,
  buttonText = 'Upgrade',
  icon,
  gradientColors = ['#8B5CF6', '#EC4899'] as const,
  onPress,
  dismissible = false,
  onDismiss,
  type = 'upgrade',
}: CTABannerProps) {
  const typeStyles = {
    upgrade: {
      bg: ['#fbbf24', '#f59e0b'] as const,
      text: '#ffffff',
      icon: 'ribbon-outline' as const,
    },
    feature: {
      bg: ['#8B5CF6', '#EC4899'] as const,
      text: '#ffffff',
      icon: 'sparkles-outline' as const,
    },
    achievement: {
      bg: ['#10b981', '#059669'] as const,
      text: '#ffffff',
      icon: 'trophy-outline' as const,
    },
  };

  const style = typeStyles[type];

  return (
    <View className="mx-4 my-3">
      <LinearGradient
        colors={type === 'upgrade' ? style.bg : gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl p-5 relative overflow-hidden"
        style={{
          shadowColor: type === 'upgrade' ? '#f59e0b' : gradientColors[0],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        {/* Decorative pattern */}
        <View className="absolute top-0 right-0 opacity-10">
          <Ionicons name={style.icon} size={120} color="#ffffff" />
        </View>

        {/* Content */}
        <View className="flex-row items-center gap-4 relative z-10">
          {/* Icon */}
          <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
            <Ionicons
              name={icon || style.icon}
              size={28}
              color="#ffffff"
            />
          </View>

          {/* Text and button */}
          <View className="flex-1">
            <Text className="text-white font-bold text-lg mb-1" numberOfLines={1}>
              {title}
            </Text>
            {description && (
              <Text className="text-white/90 text-sm mb-3" numberOfLines={2}>
                {description}
              </Text>
            )}

            {onPress && (
              <Pressable
                className="bg-white rounded-xl py-2.5 px-4 self-start"
                onPress={() => {
                  hapticLight();
                  onPress();
                }}
              >
                <Text
                  className="font-semibold text-sm"
                  style={{ color: type === 'upgrade' ? '#f59e0b' : '#8B5CF6' }}
                >
                  {buttonText}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Dismiss button */}
          {dismissible && onDismiss && (
            <Pressable
              className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"
              onPress={() => {
                hapticLight();
                onDismiss();
              }}
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

// 2025-2026: Minimalist CTA banner variant
export function MinimalCTABanner({
  title,
  subtitle,
  onPress,
  actionText = 'Learn More',
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  actionText?: string;
}) {
  return (
    <Pressable
      className="mx-4 bg-blue-50 rounded-2xl p-4 flex-row items-center justify-between"
      onPress={() => {
        hapticLight();
        onPress?.();
      }}
      style={{
        borderWidth: 1,
        borderColor: '#bfdbfe',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View className="flex-1">
        <Text className="text-blue-900 font-semibold text-base mb-0.5">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-blue-600 text-sm">{subtitle}</Text>
        )}
      </View>

      <View className="flex-row items-center gap-1">
        <Text className="text-blue-600 font-semibold text-sm">{actionText}</Text>
        <Ionicons name="chevron-forward" size={16} color="#2563eb" />
      </View>
    </Pressable>
  );
}
