import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setOnboardingSeen } from '../lib/onboarding';
import { hapticLight, hapticSuccess, hapticSelection } from '../lib/haptics';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { enterGuestMode } = useAuth();
  const [activePage, setActivePage] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    startFadeAnimation();
  }, []);

  const startFadeAnimation = (): void => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const handleSkip = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleTryFree = async (): Promise<void> => {
    hapticSuccess();
    await setOnboardingSeen();
    enterGuestMode();
    router.replace('/(protected)/home');
  };

  const handleSignIn = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const onMomentumScrollEnd = (event: any): void => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(contentOffset / SCREEN_WIDTH);
    if (newPage !== activePage) {
      setActivePage(newPage);
      hapticSelection();
    }
  };

  const renderPageDot = (index: number) => {
    const isActive = activePage === index;
    return (
      <View
        key={index}
        className={`h-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
        style={{ width: isActive ? 32 : 8 }}
      />
    );
  };

  const renderWelcomePage = () => (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ width: SCREEN_WIDTH }}
    >
      <Animated.View
        className="items-center"
        style={{ opacity: fadeAnim }}
      >
        <Text className="text-7xl mb-6">📓</Text>
        <Text className="text-3xl font-bold text-gray-900 text-center">
          Welcome to Daiyly
        </Text>
        <Text className="text-lg text-gray-500 mt-2 text-center">
          Your private mood journal
        </Text>
      </Animated.View>
    </View>
  );

  const renderFeatureCard = (
    iconName: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    bgColor: string,
    iconBgColor: string,
    title: string,
    subtitle: string,
    isLast: boolean = false
  ) => (
    <View
      className={`${bgColor} rounded-2xl p-5 ${isLast ? '' : 'mb-4'} flex-row items-center`}
    >
      <View className={`w-14 h-14 rounded-xl ${iconBgColor} items-center justify-center`}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-base font-semibold text-gray-900">{title}</Text>
        <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>
      </View>
    </View>
  );

  const renderFeaturesPage = () => (
    <View
      className="flex-1 justify-center px-6"
      style={{ width: SCREEN_WIDTH }}
    >
      {renderFeatureCard(
        'happy-outline',
        '#2563eb',
        'bg-blue-50',
        'bg-blue-100',
        'Track Your Mood',
        'Log how you feel with emojis and scores'
      )}
      {renderFeatureCard(
        'analytics-outline',
        '#9333ea',
        'bg-purple-50',
        'bg-purple-100',
        'See Your Patterns',
        'Discover mood trends with weekly insights'
      )}
      {renderFeatureCard(
        'flame-outline',
        '#d97706',
        'bg-amber-50',
        'bg-amber-100',
        'Build Streaks',
        'Stay consistent with daily journaling streaks',
        true
      )}
    </View>
  );

  const renderCTAPage = () => (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ width: SCREEN_WIDTH }}
    >
      <Text className="text-6xl mb-4">✨</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center">
        Ready to start?
      </Text>
      <Text className="text-base text-gray-500 mt-2 text-center">
        3 free entries, no account needed
      </Text>

      <Pressable
        className="bg-blue-600 rounded-2xl py-4 px-8 w-full items-center mt-6 shadow-md active:opacity-80"
        onPress={handleTryFree}
      >
        <Text className="text-white text-lg font-semibold">Try Free</Text>
      </Pressable>

      <Pressable
        className="py-3 mt-3 active:opacity-70"
        onPress={handleSignIn}
      >
        <Text className="text-blue-600 text-base font-medium">
          I have an account — Sign In
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Skip Button - Only visible on pages 0 and 1 */}
      {activePage < 2 && (
        <View className="flex-row justify-end px-6 pt-2">
          <Pressable
            className="py-2 px-3"
            onPress={handleSkip}
          >
            <Text className="text-sm text-gray-500 font-medium">Skip</Text>
          </Pressable>
        </View>
      )}

      {/* Horizontal Scrollable Pages */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        className="flex-1"
      >
        {renderWelcomePage()}
        {renderFeaturesPage()}
        {renderCTAPage()}
      </ScrollView>

      {/* Page Dots Indicator */}
      <View className="flex-row justify-center items-center py-6 gap-2">
        {[0, 1, 2].map(renderPageDot)}
      </View>
    </SafeAreaView>
  );
}
