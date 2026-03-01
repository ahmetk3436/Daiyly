import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setOnboardingSeen } from '../lib/onboarding';
import { hapticLight, hapticSuccess, hapticSelection } from '../lib/haptics';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const INTENT_PLAN_KEY = '@daiyly_intent_plan';

const TOTAL_PAGES = 4;

export default function OnboardingScreen() {
  const { enterGuestMode } = useAuth();
  const [activePage, setActivePage] = useState<number>(0);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const isLastSlide = activePage === TOTAL_PAGES - 1;

  const handleSkip = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleStartTrial = async (): Promise<void> => {
    hapticSuccess();
    await setOnboardingSeen();
    await AsyncStorage.setItem(INTENT_PLAN_KEY, selectedPlan);
    router.replace('/(auth)/register');
  };

  const handleExploreFirst = async (): Promise<void> => {
    hapticLight();
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
        className={`h-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-surface-muted'}`}
        style={{ width: isActive ? 32 : 8 }}
      />
    );
  };

  const renderWelcomePage = () => (
    <View className="flex-1 items-center justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      <Animated.View className="items-center" style={{ opacity: fadeAnim }}>
        <Text className="text-7xl mb-6">📓</Text>
        <Text className="text-3xl font-bold text-text-primary text-center">
          Welcome to Daiyly
        </Text>
        <Text className="text-lg text-text-secondary mt-2 text-center">
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
    <View className={`${bgColor} rounded-2xl p-5 ${isLast ? '' : 'mb-4'} flex-row items-center`}>
      <View className={`w-14 h-14 rounded-xl ${iconBgColor} items-center justify-center`}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-base font-semibold text-text-primary">{title}</Text>
        <Text className="text-sm text-text-secondary mt-1">{subtitle}</Text>
      </View>
    </View>
  );

  const renderFeaturesPage = () => (
    <View className="flex-1 justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      {renderFeatureCard(
        'happy-outline', '#2563eb',
        'bg-blue-50 dark:bg-blue-900/20', 'bg-blue-100 dark:bg-blue-900/40',
        'Track Your Mood', 'Log how you feel with emojis and scores'
      )}
      {renderFeatureCard(
        'analytics-outline', '#9333ea',
        'bg-purple-50 dark:bg-purple-900/20', 'bg-purple-100 dark:bg-purple-900/40',
        'See Your Patterns', 'Discover mood trends with weekly insights'
      )}
      {renderFeatureCard(
        'flame-outline', '#d97706',
        'bg-amber-50 dark:bg-amber-900/20', 'bg-amber-100 dark:bg-amber-900/40',
        'Build Streaks', 'Stay consistent with daily journaling streaks',
        true
      )}
    </View>
  );

  const renderInsightsPage = () => (
    <View className="flex-1 items-center justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      <Text className="text-6xl mb-4">🧠</Text>
      <Text className="text-2xl font-bold text-text-primary text-center mb-2">
        AI That Understands You
      </Text>
      <Text className="text-base text-text-secondary text-center mb-8">
        Weekly reports reveal your emotional patterns before you even notice them
      </Text>

      {[
        { icon: 'analytics-outline' as const, text: 'AI-powered weekly insights' },
        { icon: 'search-outline' as const, text: 'Full-text search across all entries' },
        { icon: 'share-social-outline' as const, text: 'Shareable mood cards' },
      ].map((item, i) => (
        <View key={i} className="flex-row items-center mb-3 w-full px-4">
          <View className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 items-center justify-center mr-3">
            <Ionicons name={item.icon} size={16} color="#2563EB" />
          </View>
          <Text className="text-sm text-text-primary">{item.text}</Text>
          <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginLeft: 'auto' }} />
        </View>
      ))}
    </View>
  );

  const renderPricingPage = () => (
    <View className="flex-1 justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      <Text className="text-2xl font-bold text-text-primary text-center mb-1">
        Start Your Journey
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-5">
        Most journalers see a difference in 2 weeks
      </Text>

      {/* Social proof */}
      <View className="flex-row items-center justify-center mb-4 gap-1.5">
        <Ionicons name="people" size={14} color="#10B981" />
        <Text className="text-xs font-semibold" style={{ color: '#10B981' }}>
          50,000+ people journaling daily
        </Text>
      </View>

      {/* Annual Plan */}
      <Pressable
        onPress={() => { hapticLight(); setSelectedPlan('annual'); }}
        className={`rounded-2xl p-4 mb-3 border-2 ${
          selectedPlan === 'annual'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-border bg-surface'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-text-primary">Annual Plan</Text>
              <View className="rounded-full bg-green-500 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-white">BEST VALUE</Text>
              </View>
            </View>
            <Text className="text-sm text-text-secondary mt-0.5">
              $29.99/year · $2.50/mo
            </Text>
          </View>
          <View className={`h-6 w-6 rounded-full border-2 items-center justify-center ${
            selectedPlan === 'annual' ? 'border-blue-500 bg-blue-500' : 'border-border'
          }`}>
            {selectedPlan === 'annual' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </View>
      </Pressable>

      {/* Monthly Plan */}
      <Pressable
        onPress={() => { hapticLight(); setSelectedPlan('monthly'); }}
        className={`rounded-2xl p-4 border-2 ${
          selectedPlan === 'monthly'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-border bg-surface'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-base font-semibold text-text-primary">Monthly Plan</Text>
            <Text className="text-sm text-text-secondary mt-0.5">$4.99/month</Text>
          </View>
          <View className={`h-6 w-6 rounded-full border-2 items-center justify-center ${
            selectedPlan === 'monthly' ? 'border-blue-500 bg-blue-500' : 'border-border'
          }`}>
            {selectedPlan === 'monthly' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </View>
      </Pressable>

      {/* Trial badge */}
      <View className="mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#F59E0B15' }}>
        <Ionicons name="gift-outline" size={16} color="#D97706" />
        <Text className="text-xs" style={{ color: '#D97706' }}>
          7-day free trial included — no payment due now
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Skip Button */}
      {!isLastSlide && (
        <View className="flex-row justify-end px-6 pt-2">
          <Pressable className="py-2 px-3" onPress={handleSkip}>
            <Text className="text-sm text-text-secondary font-medium">Skip</Text>
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
        {renderInsightsPage()}
        {renderPricingPage()}
      </ScrollView>

      {/* Page Dots */}
      <View className="flex-row justify-center items-center py-4 gap-2">
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => renderPageDot(i))}
      </View>

      {/* Bottom CTAs */}
      <View className="px-6 pb-6 gap-3">
        {isLastSlide ? (
          <>
            <Pressable
              className="bg-blue-600 rounded-2xl py-4 items-center active:opacity-80"
              onPress={handleStartTrial}
            >
              <Text className="text-white text-base font-bold">Start 7-Day Free Trial</Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={handleExploreFirst}>
              <Text className="text-blue-600 text-sm font-medium">Explore first →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              className="bg-blue-600 rounded-2xl py-4 items-center active:opacity-80"
              onPress={() => {
                hapticLight();
                if (activePage < TOTAL_PAGES - 1) {
                  scrollViewRef.current?.scrollTo({
                    x: (activePage + 1) * SCREEN_WIDTH,
                    animated: true,
                  });
                  setActivePage(activePage + 1);
                }
              }}
            >
              <Text className="text-white text-base font-semibold">
                {activePage === 0 ? 'Get Started' : 'Continue'}
              </Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={handleSignIn}>
              <Text className="text-blue-600 text-sm font-medium">I have an account — Sign In</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
