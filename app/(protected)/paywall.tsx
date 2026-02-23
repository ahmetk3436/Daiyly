import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  type PurchasesPackage,
} from '../../lib/purchases';
import { hapticLight, hapticSuccess, hapticError } from '../../lib/haptics';

// RevenueCat UI
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
  NOT_PRESENTED: 'NOT_PRESENTED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
};
try {
  const mod = require('react-native-purchases-ui');
  RevenueCatUI = mod.default ?? mod;
  if (mod.PAYWALL_RESULT) PAYWALL_RESULT = mod.PAYWALL_RESULT;
} catch {
  // react-native-purchases-ui not available
}

const PREMIUM_FEATURES = [
  {
    icon: 'analytics-outline' as const,
    title: 'AI Weekly Insights',
    desc: 'Smart mood analysis & patterns',
  },
  {
    icon: 'cloud-outline' as const,
    title: 'Word Cloud Analysis',
    desc: 'Visualize your most used words',
  },
  {
    icon: 'infinite-outline' as const,
    title: 'Unlimited History',
    desc: 'Access all your past entries',
  },
  {
    icon: 'search-outline' as const,
    title: 'Full-Text Search',
    desc: 'Search across all entries',
  },
  {
    icon: 'share-outline' as const,
    title: 'Shareable Mood Cards',
    desc: 'Beautiful cards for social media',
  },
  {
    icon: 'download-outline' as const,
    title: 'Data Export',
    desc: 'Export as CSV or JSON',
  },
];

function FallbackPaywall({
  onPurchaseCompleted,
  onDismiss,
}: {
  onPurchaseCompleted: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>(
    'annual'
  );

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await getOfferings();
      if (offerings && offerings.availablePackages) {
        setPackages(offerings.availablePackages);
      }
    } catch (e) {
      setError('Failed to load subscription options');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    setError(null);
    try {
      await purchasePackage(pkg);
      hapticSuccess();
      await onPurchaseCompleted();
    } catch (e: any) {
      hapticError();
      setError(e?.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      await restorePurchases();
      hapticSuccess();
      await onPurchaseCompleted();
    } catch (e: any) {
      hapticError();
      setError(e?.message || 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Close Button */}
        <View className="px-5 pt-3">
          <Pressable
            onPress={onDismiss}
            className="self-end w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>

        {/* Header */}
        <View className="items-center px-6 pt-4 pb-6">
          <View className="w-16 h-16 rounded-2xl bg-blue-100 items-center justify-center mb-4">
            <Ionicons name="diamond" size={32} color="#2563EB" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center">
            Unlock Premium
          </Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            Get unlimited access to all features
          </Text>
        </View>

        {/* Plan Selection */}
        <View className="px-5 mb-6">
          {/* Annual Plan */}
          <Pressable
            onPress={() => {
              hapticLight();
              setSelectedPlan('annual');
            }}
            className={`rounded-2xl p-4 mb-3 border-2 ${
              selectedPlan === 'annual'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <View className="flex-row items-center">
                  <Text className="text-base font-bold text-gray-900">
                    Annual
                  </Text>
                  <View className="bg-green-100 rounded-full px-2 py-0.5 ml-2 border border-green-200">
                    <Text className="text-xs font-bold text-green-700">
                      SAVE 50%
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-500 mt-0.5">
                  $29.99/year ($2.50/month)
                </Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selectedPlan === 'annual'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}
              >
                {selectedPlan === 'annual' && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </View>
          </Pressable>

          {/* Monthly Plan */}
          <Pressable
            onPress={() => {
              hapticLight();
              setSelectedPlan('monthly');
            }}
            className={`rounded-2xl p-4 border-2 ${
              selectedPlan === 'monthly'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-bold text-gray-900">
                  Monthly
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  $4.99/month
                </Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selectedPlan === 'monthly'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}
              >
                {selectedPlan === 'monthly' && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </View>
          </Pressable>
        </View>

        {/* Trial Badge */}
        <View className="mx-5 mb-6 bg-amber-50 rounded-xl p-3 border border-amber-100 flex-row items-center">
          <Ionicons name="gift-outline" size={20} color="#D97706" />
          <Text className="text-sm text-amber-700 ml-2 flex-1">
            Start with a <Text className="font-bold">3-day free trial</Text>.
            Cancel anytime.
          </Text>
        </View>

        {/* Features */}
        <View className="px-5 mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">
            What you get
          </Text>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View
              key={index}
              className="flex-row items-center py-3"
            >
              <View className="w-9 h-9 rounded-lg bg-blue-50 items-center justify-center mr-3">
                <Ionicons
                  name={feature.icon}
                  size={18}
                  color="#2563EB"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {feature.title}
                </Text>
                <Text className="text-xs text-gray-500">{feature.desc}</Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#22C55E"
              />
            </View>
          ))}
        </View>

        {error && (
          <View className="mx-5 mb-4 bg-red-50 rounded-xl p-3 border border-red-100">
            <Text className="text-sm text-red-600 text-center">{error}</Text>
          </View>
        )}

        {/* Purchase Button */}
        <View className="px-5 mb-4">
          <Pressable
            className={`rounded-2xl py-4 items-center ${
              purchasing ? 'bg-gray-300' : 'bg-blue-600 active:bg-blue-700'
            }`}
            onPress={() => {
              hapticLight();
              // Find the matching package from RevenueCat offerings
              if (packages.length > 0) {
                const pkg =
                  packages.find((p) =>
                    selectedPlan === 'annual'
                      ? p.packageType === 'ANNUAL' ||
                        p.identifier?.includes('annual')
                      : p.packageType === 'MONTHLY' ||
                        p.identifier?.includes('monthly')
                  ) || packages[0];
                handlePurchase(pkg);
              }
            }}
            disabled={purchasing || packages.length === 0}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-bold">
                {selectedPlan === 'annual'
                  ? 'Start Free Trial - $29.99/yr'
                  : 'Subscribe - $4.99/mo'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Restore + Dismiss */}
        <View className="items-center px-5">
          <Pressable
            onPress={handleRestore}
            disabled={restoring}
            className="py-3"
          >
            {restoring ? (
              <ActivityIndicator color="#6B7280" size="small" />
            ) : (
              <Text className="text-sm text-gray-500">Restore Purchase</Text>
            )}
          </Pressable>
          <Pressable onPress={onDismiss} className="py-2">
            <Text className="text-sm text-gray-400">Maybe Later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PaywallScreen() {
  const { checkSubscription } = useSubscription();

  const handleDismiss = () => router.back();

  const handlePurchaseCompleted = async () => {
    await checkSubscription();
    router.back();
  };

  if (!RevenueCatUI) {
    return (
      <FallbackPaywall
        onPurchaseCompleted={handlePurchaseCompleted}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <RevenueCatUI.Paywall
      onDismiss={handleDismiss}
      onPurchaseCompleted={handlePurchaseCompleted}
      onRestoreCompleted={handlePurchaseCompleted}
      onPurchaseError={() => router.back()}
      onRestoreError={() => router.back()}
    />
  );
}
