import React, { useState, useCallback, useEffect } from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import { Slot, Redirect, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionProvider } from '../../contexts/SubscriptionContext';
import { hapticSelection } from '../../lib/haptics';

const TABS = [
  {
    route: '/(protected)/home',
    label: 'Journal',
    icon: 'book-outline' as const,
    iconActive: 'book' as const,
  },
  {
    route: '/(protected)/insights',
    label: 'Insights',
    icon: 'analytics-outline' as const,
    iconActive: 'analytics' as const,
  },
  {
    route: '/(protected)/history',
    label: 'History',
    icon: 'time-outline' as const,
    iconActive: 'time' as const,
  },
  {
    route: '/(protected)/search',
    label: 'Search',
    icon: 'search-outline' as const,
    iconActive: 'search' as const,
  },
  {
    route: '/(protected)/settings',
    label: 'Settings',
    icon: 'settings-outline' as const,
    iconActive: 'settings' as const,
  },
] as const;

// Screens where the tab bar should be hidden (detail screens, modals)
const HIDDEN_TAB_ROUTES = [
  '/entry/',
  '/new-entry',
  '/paywall',
  '/notification-center',
];

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const [activeTab, setActiveTab] = useState('/(protected)/home');
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Sync active tab with current pathname
  useEffect(() => {
    const matchingTab = TABS.find((tab) => pathname.startsWith(tab.route.replace('/(protected)', '')));
    if (matchingTab) {
      setActiveTab(matchingTab.route);
    }
  }, [pathname]);

  const shouldHideTabs = HIDDEN_TAB_ROUTES.some((route) =>
    pathname.includes(route)
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-base text-gray-400 mt-4">Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SubscriptionProvider>
      <View className="flex-1 bg-white">
        <Slot />

        {/* Custom Tab Bar */}
        {!shouldHideTabs && (
          <View
            className="flex-row bg-white border-t border-gray-100"
            style={{
              paddingBottom: insets.bottom || 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.route;
              return (
                <Pressable
                  key={tab.route}
                  className="flex-1 items-center pt-2.5 pb-1"
                  onPress={() => {
                    hapticSelection();
                    setActiveTab(tab.route);
                    router.replace(tab.route as never);
                  }}
                >
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={22}
                    color={isActive ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text
                    className={`text-[10px] mt-0.5 ${
                      isActive
                        ? 'font-bold text-blue-600'
                        : 'font-normal text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {isActive && (
                    <View
                      className="rounded-full bg-blue-600 mt-0.5"
                      style={{ width: 4, height: 4 }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </SubscriptionProvider>
  );
}
