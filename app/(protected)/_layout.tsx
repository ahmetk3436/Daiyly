import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import { Slot, Redirect, router, usePathname } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionProvider } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hapticSelection } from '../../lib/haptics';
import { authenticateWithBiometrics } from '../../lib/biometrics';

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
  '/sharing',
];

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('/(protected)/home');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pendingDeepLink = useRef<string | null>(null);

  // Capture initial deep link URL on cold start
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = Linking.parse(url);
        if (parsed.path && parsed.path !== 'home' && parsed.path !== '') {
          pendingDeepLink.current = `/(protected)/${parsed.path}`;
        }
      }
    }).catch(() => {});
  }, []);

  // Navigate to pending deep link after auth + biometric resolve
  useEffect(() => {
    if (!isLoading && biometricChecked && isUnlocked && (isAuthenticated || isGuest)) {
      if (pendingDeepLink.current) {
        const target = pendingDeepLink.current;
        pendingDeepLink.current = null;
        // Defer to next tick so Slot is mounted
        setTimeout(() => router.replace(target as never), 0);
      }
    }
  }, [isLoading, biometricChecked, isUnlocked, isAuthenticated, isGuest]);

  // Check biometric lock on mount
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const stored = await AsyncStorage.getItem('@daiyly_settings');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.biometricEnabled) {
            const success = await authenticateWithBiometrics('Unlock Daiyly');
            setIsUnlocked(success);
            setBiometricChecked(true);
            return;
          }
        }
        // No biometric required
        setIsUnlocked(true);
        setBiometricChecked(true);
      } catch {
        // Corrupted settings — safe default: assume biometric was enabled, attempt auth
        try {
          const success = await authenticateWithBiometrics('Unlock Daiyly');
          setIsUnlocked(success);
        } catch {
          setIsUnlocked(false);
        }
        setBiometricChecked(true);
      }
    };
    checkBiometric();
  }, []);

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

  if (isLoading || !biometricChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-base text-text-muted mt-4">Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  // Biometric lock screen
  if (!isUnlocked) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <View className="items-center px-8">
          <View className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 items-center justify-center mb-6">
            <Ionicons name="lock-closed" size={36} color="#2563EB" />
          </View>
          <Text className="text-xl font-bold text-text-primary mb-2">
            Daiyly is Locked
          </Text>
          <Text className="text-sm text-text-secondary text-center mb-8">
            Authenticate to access your journal
          </Text>
          <Pressable
            className="bg-blue-600 rounded-2xl py-4 px-8 items-center active:bg-blue-700"
            onPress={async () => {
              const success = await authenticateWithBiometrics('Unlock Daiyly');
              if (success) setIsUnlocked(true);
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="finger-print" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold text-base ml-2">
                Unlock
              </Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SubscriptionProvider>
      <View className="flex-1 bg-background">
        <Slot />

        {/* Custom Tab Bar */}
        {!shouldHideTabs && (
          <View
            className="flex-row bg-background border-t border-border"
            style={{
              paddingBottom: insets.bottom || 16,
              shadowColor: isDark ? '#000' : '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: isDark ? 0.2 : 0.04,
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
                    color={isActive ? '#2563EB' : isDark ? '#64748B' : '#9CA3AF'}
                  />
                  <Text
                    className={`text-[10px] mt-0.5 ${
                      isActive
                        ? 'font-bold text-blue-600'
                        : 'font-normal text-text-muted'
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
