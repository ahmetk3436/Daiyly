import React from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import { Slot, Redirect, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { hapticSelection } from '../../lib/haptics';

const TABS = [
  { route: '/(protected)/home', label: 'Journal', icon: '\u{1F4DD}' },
  { route: '/(protected)/history', label: 'History', icon: '\u{1F4D6}' },
  { route: '/(protected)/settings', label: 'Settings', icon: '\u2699\uFE0F' },
] as const;

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-base text-gray-500 mt-4">Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View className="flex-1 bg-white">
      <Slot />
      <View
        className="flex-row border-t border-gray-100 bg-white"
        style={{
          paddingBottom: insets.bottom || 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.route ||
            pathname.includes(tab.route.split('/').pop() || '');
          return (
            <Pressable
              key={tab.route}
              className="flex-1 items-center pt-3 pb-2"
              onPress={() => {
                hapticSelection();
                router.push(tab.route as never);
              }}
            >
              <Text className="text-2xl">{tab.icon}</Text>
              <Text
                className="text-xs mt-1"
                style={{
                  color: isActive ? '#2563eb' : '#9ca3af',
                  fontWeight: isActive ? '600' : '400',
                }}
              >
                {tab.label}
              </Text>
              {isActive && (
                <View
                  className="rounded-full bg-blue-600 mt-1"
                  style={{ width: 4, height: 4 }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
