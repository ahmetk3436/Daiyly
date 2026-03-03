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
import { useTranslation } from 'react-i18next';
import { setOnboardingSeen } from '../lib/onboarding';
import { hapticLight, hapticSuccess, hapticSelection } from '../lib/haptics';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const INTENT_PLAN_KEY = '@daiyly_intent_plan';
export const INTENT_ANSWERS_KEY = '@daiyly_onboarding_intent';

// Slide indices:
// 0: Welcome
// 1: Features
// 2: AI Insights
// 3: Why (intent Q1)
// 4: Frequency (intent Q2)
// 5: Priority (intent Q3)
// 6: Pricing
const TOTAL_PAGES = 7;
const PRICING_PAGE = 6;

type IntentAnswers = {
  why: string;
  frequency: string;
  priority: string;
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { enterGuestMode } = useAuth();
  const [activePage, setActivePage] = useState<number>(0);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [intentAnswers, setIntentAnswers] = useState<IntentAnswers>({
    why: '',
    frequency: '',
    priority: '',
  });
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

  // Intent slides are pages 3, 4, 5
  const isIntentSlide = activePage >= 3 && activePage <= 5;

  // Current intent answer for the active intent slide
  const currentIntentAnswer = (): string => {
    if (activePage === 3) return intentAnswers.why;
    if (activePage === 4) return intentAnswers.frequency;
    if (activePage === 5) return intentAnswers.priority;
    return 'set';
  };

  const canProceed = (): boolean => {
    if (!isIntentSlide) return true;
    return currentIntentAnswer() !== '';
  };

  const handleSkip = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleStartTrial = async (): Promise<void> => {
    hapticSuccess();
    await setOnboardingSeen();
    await AsyncStorage.setItem(INTENT_PLAN_KEY, selectedPlan);
    await AsyncStorage.setItem(INTENT_ANSWERS_KEY, JSON.stringify(intentAnswers));
    router.replace('/(auth)/register');
  };

  const handleExploreFirst = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    await AsyncStorage.setItem(INTENT_ANSWERS_KEY, JSON.stringify(intentAnswers));
    enterGuestMode();
    router.replace('/(protected)/home');
  };

  const handleSignIn = async (): Promise<void> => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const scrollToPage = (page: number): void => {
    scrollViewRef.current?.scrollTo({
      x: page * SCREEN_WIDTH,
      animated: true,
    });
    setActivePage(page);
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
          {t('onboarding.step1Title')}
        </Text>
        <Text className="text-lg text-text-secondary mt-2 text-center">
          {t('onboarding.step1Subtitle')}
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
        t('onboarding.feature1Title'), t('onboarding.feature1Subtitle')
      )}
      {renderFeatureCard(
        'analytics-outline', '#9333ea',
        'bg-purple-50 dark:bg-purple-900/20', 'bg-purple-100 dark:bg-purple-900/40',
        t('onboarding.feature2Title'), t('onboarding.feature2Subtitle')
      )}
      {renderFeatureCard(
        'flame-outline', '#d97706',
        'bg-amber-50 dark:bg-amber-900/20', 'bg-amber-100 dark:bg-amber-900/40',
        t('onboarding.feature3Title'), t('onboarding.feature3Subtitle'),
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

  // Generic intent question slide
  const renderIntentPage = (
    emoji: string,
    title: string,
    options: { emoji: string; label: string; value: string }[],
    selectedValue: string,
    onSelect: (value: string) => void
  ) => (
    <View className="flex-1 items-center justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      <Text className="text-6xl mb-4">{emoji}</Text>
      <Text className="text-xl font-bold text-text-primary text-center mb-6">
        {title}
      </Text>
      <View className="w-full flex-row flex-wrap" style={{ gap: 12 }}>
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                hapticSelection();
                onSelect(opt.value);
              }}
              style={{ width: (SCREEN_WIDTH - 48 - 12) / 2 }}
              className={`rounded-2xl p-4 border-2 items-center active:opacity-80 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border bg-surface'
              }`}
            >
              <View className="relative w-full">
                {isSelected && (
                  <View className="absolute top-0 right-0 w-5 h-5 rounded-full bg-blue-500 items-center justify-center">
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
                <Text className="text-3xl text-center mb-2">{opt.emoji}</Text>
                <Text
                  className={`text-xs font-medium text-center ${
                    isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-text-primary'
                  }`}
                >
                  {opt.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderWhyPage = () => renderIntentPage(
    '📔',
    t('onboarding.whyTitle'),
    [
      { emoji: '📔', label: t('onboarding.whyPersonalGrowth'), value: 'growth' },
      { emoji: '😌', label: t('onboarding.whyStressRelief'), value: 'stress' },
      { emoji: '🎯', label: t('onboarding.whyHabits'), value: 'habits' },
      { emoji: '💭', label: t('onboarding.whyEmotions'), value: 'emotions' },
    ],
    intentAnswers.why,
    (value) => setIntentAnswers((prev) => ({ ...prev, why: value }))
  );

  const renderFrequencyPage = () => renderIntentPage(
    '📅',
    t('onboarding.frequencyTitle'),
    [
      { emoji: '📅', label: t('onboarding.frequencyDaily'), value: 'daily' },
      { emoji: '🗓️', label: t('onboarding.frequencyWeekly'), value: 'weekly' },
      { emoji: '🌙', label: t('onboarding.frequencyWhenFeel'), value: 'when_feel' },
      { emoji: '⚡', label: t('onboarding.frequencyQuick'), value: 'quick' },
    ],
    intentAnswers.frequency,
    (value) => setIntentAnswers((prev) => ({ ...prev, frequency: value }))
  );

  const renderPriorityPage = () => renderIntentPage(
    '✨',
    t('onboarding.priorityTitle'),
    [
      { emoji: '🔒', label: t('onboarding.priorityPrivacy'), value: 'privacy' },
      { emoji: '🤖', label: t('onboarding.priorityAI'), value: 'ai' },
      { emoji: '🎙️', label: t('onboarding.priorityMedia'), value: 'media' },
      { emoji: '📊', label: t('onboarding.priorityPatterns'), value: 'patterns' },
    ],
    intentAnswers.priority,
    (value) => setIntentAnswers((prev) => ({ ...prev, priority: value }))
  );

  const getPricingHeadline = (): string => {
    switch (intentAnswers.priority) {
      case 'ai':
        return 'Unlock AI-Powered Journal Analysis';
      case 'privacy':
        return 'Your Journal, Fully Private & Encrypted';
      case 'media':
        return 'Capture Life with Voice & Photos';
      case 'patterns':
        return 'See Your Patterns. Understand Yourself.';
      default:
        return t('onboarding.step4Title');
    }
  };

  const renderPricingPage = () => (
    <View className="flex-1 justify-center px-6" style={{ width: SCREEN_WIDTH }}>
      <Text className="text-2xl font-bold text-text-primary text-center mb-1">
        {getPricingHeadline()}
      </Text>
      <Text className="text-sm text-text-secondary text-center mb-5">
        {t('onboarding.step4Subtitle')}
      </Text>

      {/* Social proof */}
      <View className="flex-row items-center justify-center mb-4 gap-1.5">
        <Ionicons name="people" size={14} color="#10B981" />
        <Text className="text-xs font-semibold" style={{ color: '#10B981' }}>
          {t('onboarding.socialProof')}
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
              <Text className="text-base font-semibold text-text-primary">
                {t('onboarding.planAnnual')}
              </Text>
              <View className="rounded-full bg-green-500 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {t('onboarding.planAnnualSave')}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-text-secondary mt-0.5">
              {t('onboarding.planAnnualPrice')} · {t('onboarding.planAnnualPerMonth')}
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
            <Text className="text-base font-semibold text-text-primary">
              {t('onboarding.planMonthly')}
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              {t('onboarding.planMonthlyPrice')}
            </Text>
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
          {t('onboarding.trialBadge')} — no payment due now
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
            <Text className="text-sm text-text-secondary font-medium">
              {t('common.skip')}
            </Text>
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
        scrollEnabled={true}
      >
        {renderWelcomePage()}
        {renderFeaturesPage()}
        {renderInsightsPage()}
        {renderWhyPage()}
        {renderFrequencyPage()}
        {renderPriorityPage()}
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
              <Text className="text-white text-base font-bold">
                {t('onboarding.startFreeTrial')}
              </Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={handleExploreFirst}>
              <Text className="text-blue-600 text-sm font-medium">
                {t('onboarding.exploreFirst')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              className={`rounded-2xl py-4 items-center active:opacity-80 ${
                canProceed() ? 'bg-blue-600' : 'bg-blue-300'
              }`}
              disabled={!canProceed()}
              onPress={() => {
                hapticLight();
                if (activePage < TOTAL_PAGES - 1) {
                  scrollToPage(activePage + 1);
                }
              }}
            >
              <Text className="text-white text-base font-semibold">
                {activePage === 0
                  ? t('common.continue')
                  : isIntentSlide && !canProceed()
                  ? t('common.next')
                  : t('common.continue')}
              </Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={handleSignIn}>
              <Text className="text-blue-600 text-sm font-medium">
                I have an account — Sign In
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
