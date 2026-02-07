import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Slot, Redirect, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { hapticSelection } from '../../lib/haptics';

const TABS = [
  { path: '/(protected)/home', icon: 'book', iconOutline: 'book-outline', label: 'Journal' },
  { path: '/(protected)/settings', icon: 'settings', iconOutline: 'settings-outline', label: 'Settings' },
] as const;

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View className="flex-1 bg-gray-950">
      <Slot />
      <View
        className="flex-row border-t border-gray-800 bg-gray-950"
        style={{ paddingBottom: insets.bottom }}
      >
        {TABS.map((tab) => {
          const isActive = pathname === tab.path || pathname.startsWith(tab.path);
          return (
            <Pressable
              key={tab.path}
              className="flex-1 items-center py-3"
              onPress={() => {
                hapticSelection();
                router.push(tab.path as any);
              }}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.iconOutline}
                size={24}
                color={isActive ? '#f59e0b' : '#6b7280'}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
