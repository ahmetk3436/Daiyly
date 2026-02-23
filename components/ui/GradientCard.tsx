import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../lib/haptics';

// 2025-2026 Trend: AI Gradient Haze (purple→pink gradients)
interface GradientCardProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  gradientColors?: readonly [string, string, ...string[]];
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function GradientCard({
  title,
  description,
  icon,
  gradientColors = ['#8B5CF6', '#EC4899'] as const,
  onPress,
  size = 'md',
}: GradientCardProps) {
  const sizeStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const textSizeStyles = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const cardContent = (
    <View
      className={`rounded-3xl overflow-hidden ${sizeStyles[size]}`}
      style={{
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full h-full"
      >
        <View className="flex-row items-center gap-3">
          {icon && (
            <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
              <Ionicons name={icon} size={24} color="#ffffff" />
            </View>
          )}
          <View className="flex-1">
            <Text
              className={`font-bold text-white ${textSizeStyles[size]}`}
              numberOfLines={1}
            >
              {title}
            </Text>
            {description && (
              <Text className="text-white/80 text-sm mt-0.5" numberOfLines={2}>
                {description}
              </Text>
            )}
          </View>
          {onPress && (
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
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

// 2025-2026: Glassmorphism card variant
export function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-3xl border border-white/10 overflow-hidden ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      {children}
    </View>
  );
}

// 2025-2026: Dark mode optimized card
export function DarkCard({
  children,
  className = '',
  padding = 'p-6',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <View
      className={`rounded-3xl ${padding} ${className}`}
      style={{
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: '#2a2a4e',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      {children}
    </View>
  );
}
