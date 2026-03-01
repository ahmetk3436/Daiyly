import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePaywallConfig } from '../../contexts/PaywallConfigContext';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import {
  resolveHeadline,
  resolveUrgency,
  getDefaultPlan,
  type PlanConfig,
} from '../../lib/paywallConfig';

const INTENT_PLAN_KEY = '@daiyly_intent_plan';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { checkSubscription, handlePurchase, handleRestore, offerings } = useSubscription();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { config, isLoading } = usePaywallConfig();

  const firstName = user?.email
    ? user.email.split('@')[0].split('.')[0].replace(/[^a-zA-Z]/g, '')
    : null;
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : null;

  const defaultPlan = getDefaultPlan(config);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>(
    defaultPlan.id as 'annual' | 'monthly'
  );
  const [purchasing, setPurchasing] = useState(false);
  const [showUrgency, setShowUrgency] = useState(false);

  const secondaryColor = isDark ? '#CBD5E1' : '#6B7280';
  const primaryColor = '#2563EB';

  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const ts = await AsyncStorage.getItem('@daiyly_trial_start');
        const daysSince = ts
          ? Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
          : 0;
        setShowUrgency(resolveUrgency(config, daysSince));
      } catch {
        setShowUrgency(false);
      }
    })();
  }, [config]);

  useEffect(() => {
    if (!isLoading) {
      setSelectedPlan(getDefaultPlan(config).id as 'annual' | 'monthly');
    }
  }, [isLoading, config]);

  // Honor intent plan from onboarding
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const intent = await AsyncStorage.getItem(INTENT_PLAN_KEY);
        if (intent === 'annual' || intent === 'monthly') {
          setSelectedPlan(intent);
        }
      } catch {}
    })();
  }, []);

  const handleDismiss = () => router.back();

  const handlePurchaseCompleted = async () => {
    await checkSubscription();
    hapticSuccess();
    router.back();
  };

  const handleSubscribe = async () => {
    if (!offerings?.availablePackages) return;
    setPurchasing(true);
    try {
      const pkg = offerings.availablePackages.find((p: any) =>
        selectedPlan === 'annual' ? p.packageType === 'ANNUAL' : p.packageType === 'MONTHLY'
      ) ?? offerings.availablePackages[0];
      if (pkg) {
        const success = await handlePurchase(pkg);
        if (success) await handlePurchaseCompleted();
      }
    } catch {} finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    hapticLight();
    const success = await handleRestore();
    if (success) await handlePurchaseCompleted();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const headline = resolveHeadline(config, displayName);

  const renderPlanCard = (plan: PlanConfig) => {
    const isSelected = selectedPlan === plan.id;
    return (
      <Pressable
        key={plan.id}
        className={`mb-3 rounded-2xl border-2 p-4 ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-border bg-surface'
        }`}
        onPress={() => { hapticLight(); setSelectedPlan(plan.id as 'annual' | 'monthly'); }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-text-primary">{plan.label}</Text>
              {plan.badge ? (
                <View className="rounded-full bg-green-500 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-white">{plan.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-0.5 text-sm text-text-secondary">
              {plan.price}{plan.per_month ? ` · ${plan.per_month}` : ''}
            </Text>
          </View>
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
              isSelected ? 'border-blue-500 bg-blue-500' : 'border-border'
            }`}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Close Button */}
      <Pressable
        className="absolute right-5 z-10 h-8 w-8 items-center justify-center rounded-full bg-surface-elevated"
        style={{ top: insets.top + 12 }}
        onPress={handleDismiss}
      >
        <Ionicons name="close" size={18} color={secondaryColor} />
      </Pressable>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View className="items-center px-6 pb-6 pt-12" style={{ backgroundColor: '#2563EB10' }}>
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <Ionicons name="diamond" size={32} color="#FFFFFF" />
          </View>

          <Text className="mb-2 text-center text-2xl font-bold text-text-primary">
            {headline}
          </Text>
          <Text className="text-center text-sm text-text-secondary">
            {config.subtitle}
          </Text>

          {/* Social Proof */}
          <View className="mt-4 flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: '#10B98115' }}>
            <Ionicons name="people" size={16} color="#10B981" />
            <Text className="text-xs font-semibold" style={{ color: '#10B981' }}>
              {config.social_proof}
            </Text>
          </View>
        </View>

        {/* ── Urgency Banner ────────────────────────────────────── */}
        {showUrgency && (
          <View
            className="mx-6 mt-4 flex-row items-center gap-2 rounded-xl px-4 py-3"
            style={{ backgroundColor: '#F59E0B15' }}
          >
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text className="flex-1 text-xs font-semibold" style={{ color: '#D97706' }}>
              {config.urgency_text}
            </Text>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#F59E0B20' }}>
              <Text className="text-[10px] font-bold" style={{ color: '#D97706' }}>
                {config.urgency_badge}
              </Text>
            </View>
          </View>
        )}

        {/* ── Features ──────────────────────────────────────────── */}
        <View className="px-6 py-6">
          {config.features.map((feature, i) => (
            <View key={i} className="mb-3.5 flex-row items-center gap-3">
              <View
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: '#2563EB15' }}
              >
                <Ionicons name={feature.icon as any} size={16} color={primaryColor} />
              </View>
              <Text className="flex-1 text-sm text-text-primary">{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Plans ─────────────────────────────────────────────── */}
        <View className="px-6">
          {[...config.plans]
            .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
            .map(renderPlanCard)}

          {/* Trial badge */}
          <View className="mb-4 flex-row items-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: '#F59E0B15' }}>
            <Ionicons name="gift-outline" size={18} color="#D97706" />
            <Text className="flex-1 text-xs" style={{ color: '#D97706' }}>
              {config.trial_notice}
            </Text>
          </View>

          {/* Subscribe Button */}
          <Pressable
            className="mb-1 items-center rounded-2xl bg-blue-600 py-4 active:opacity-90"
            onPress={handleSubscribe}
            disabled={purchasing}
            style={{ opacity: purchasing ? 0.6 : 1 }}
          >
            <Text className="text-base font-semibold text-white">
              {purchasing ? config.cta_processing : config.cta_primary}
            </Text>
          </Pressable>

          {/* Subtext */}
          <Text className="mb-4 text-center text-xs text-text-muted">
            {config.cta_subtext}
          </Text>

          {/* Restore */}
          <Pressable className="mb-2 items-center py-2" onPress={handleRestorePurchases}>
            <Text className="text-sm text-text-muted">{config.restore_text}</Text>
          </Pressable>

          {/* Fine print */}
          <Text className="text-center text-[10px] text-text-muted">
            {t('paywall.finePrint')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
