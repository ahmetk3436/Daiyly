import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

// 2025-2026 Trend: Viral shareable cards (Instagram Story optimized)
interface ShareableResultProps {
  result: {
    title: string;
    value: string | number;
    emoji?: string;
    description?: string;
    date?: string;
    userName?: string;
  };
  gradientColors?: readonly [string, string, ...string[]];
  appBranding?: string;
}

export default function ShareableResult({
  result,
  gradientColors = ['#8B5CF6', '#EC4899'] as const,
  appBranding = 'Daiyly',
}: ShareableResultProps) {
  const viewRef = React.useRef<View>(null);

  const handleShare = async () => {
    try {
      hapticLight();
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });

      const fileUri = FileSystem.cacheDirectory + 'share-result.png';
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your result',
      });
      hapticSuccess();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <>
      {/* Shareable Card (1080x1920 for Instagram Stories) */}
      <View
        ref={viewRef}
        className="w-full rounded-3xl overflow-hidden"
        style={{
          aspectRatio: 9 / 16,
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-full h-full p-8 justify-between"
        >
          {/* Top: App branding */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="sparkles" size={20} color="#ffffff" />
              <Text className="text-white/90 text-sm font-bold tracking-widest uppercase">
                {appBranding}
              </Text>
            </View>
            <Text className="text-white/60 text-xs">
              {new Date().toLocaleDateString()}
            </Text>
          </View>

          {/* Center: Main result */}
          <View className="items-center py-12">
            {result.emoji && (
              <Text className="text-8xl mb-4">{result.emoji}</Text>
            )}

            <Text className="text-white/80 text-base font-medium uppercase tracking-widest mb-2">
              {result.title}
            </Text>

            <Text className="text-white text-6xl font-black mb-4 text-center">
              {result.value}
            </Text>

            {result.description && (
              <Text className="text-white/90 text-xl text-center px-4">
                {result.description}
              </Text>
            )}
          </View>

          {/* Bottom: User and CTA */}
          <View>
            {result.userName && (
              <View className="flex-row items-center gap-2 mb-6">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                  <Ionicons name="person-outline" size={20} color="#ffffff" />
                </View>
                <Text className="text-white text-lg font-medium">@{result.userName}</Text>
              </View>
            )}

            <View className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 items-center">
              <Text className="text-white text-sm font-semibold">Try {appBranding}</Text>
              <Text className="text-white/70 text-xs">Download now to track your journey</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Share button */}
      <Pressable
        className="flex-row items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl py-4 mt-4"
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={20} color="#ffffff" />
        <Text className="text-white font-bold text-base">Share Result</Text>
      </Pressable>
    </>
  );
}

// 2025-2026: Minimalist share card variant
export function MinimalShareCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  const viewRef = React.useRef<View>(null);

  const handleShare = async () => {
    try {
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
      });
      const fileUri = FileSystem.cacheDirectory + 'share-card.png';
      await FileSystem.copyAsync({ from: uri, to: fileUri });
      await Sharing.shareAsync(fileUri);
      hapticSuccess();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <Pressable onPress={handleShare}>
      <View ref={viewRef} className="bg-gray-100 rounded-2xl p-8 items-center justify-center">
        <Text className="text-gray-500 text-sm font-medium uppercase tracking-widest mb-2">
          {title}
        </Text>
        <Text className="text-gray-900 text-5xl font-bold mb-2">{value}</Text>
        {subtitle && (
          <Text className="text-gray-600 text-base">{subtitle}</Text>
        )}
        <Text className="text-gray-400 text-xs mt-8">Made with Daiyly</Text>
      </View>
    </Pressable>
  );
}
