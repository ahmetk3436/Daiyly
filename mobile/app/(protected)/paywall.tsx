import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PurchasesPackage } from '../../lib/purchases';
import { hapticSuccess, hapticMedium } from '../../lib/haptics';

export default function PaywallScreen() {
  const { offerings, isLoading, handlePurchase, handleRestore } =
    useSubscription();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePackagePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.identifier);
    try {
      const success = await handlePurchase(pkg);
      if (success) {
        hapticSuccess();
        Alert.alert('Success', 'Subscription activated!');
        router.back();
      } else {
        Alert.alert('Error', 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    hapticMedium();
    const success = await handleRestore();
    if (success) {
      hapticSuccess();
      Alert.alert('Success', 'Purchases restored!');
      router.back();
    } else {
      Alert.alert('Not Found', 'No previous purchases found.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="items-center border-b border-gray-100 px-6 pb-6 pt-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Ionicons name="diamond-outline" size={32} color="#2563eb" />
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">
            Upgrade to Premium
          </Text>
          <Text className="text-center text-base text-gray-500">
            Unlock all premium features
          </Text>
        </View>

        {/* Features */}
        <View className="px-6 py-6">
          <Feature icon="infinite" text="Unlimited access" />
          <Feature icon="sparkles" text="Premium features" />
          <Feature icon="time" text="No ads" />
          <Feature icon="headset" text="Priority support" />
        </View>

        {/* Packages */}
        {offerings?.availablePackages.map((pkg: PurchasesPackage) => (
          <TouchableOpacity
            key={pkg.identifier}
            className="mx-6 mb-4 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 p-5"
            onPress={() => handlePackagePurchase(pkg)}
            disabled={purchasing === pkg.identifier}
            style={purchasing === pkg.identifier ? { opacity: 0.7 } : undefined}
          >
            <View className="flex-1">
              <Text className="mb-1 text-lg font-semibold text-gray-900">
                {pkg.product.title}
              </Text>
              <Text className="mb-2 text-sm text-gray-500">
                {pkg.product.description}
              </Text>
              <Text className="text-2xl font-bold text-blue-600">
                {pkg.product.priceString}
              </Text>
            </View>
            {purchasing === pkg.identifier && (
              <ActivityIndicator color="#2563eb" style={{ marginLeft: 16 }} />
            )}
          </TouchableOpacity>
        ))}

        {/* Restore */}
        <TouchableOpacity
          className="mx-6 mt-2 items-center rounded-xl border border-blue-600 p-4"
          onPress={handleRestorePurchases}
        >
          <Text className="text-base font-semibold text-blue-600">
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text className="mx-6 mb-8 mt-4 text-center text-xs text-gray-400">
          Subscription automatically renews unless canceled 24 hours before the
          end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View className="mb-4 flex-row items-center">
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color="#16a34a"
      />
      <Text className="ml-3 text-base text-gray-700">{text}</Text>
    </View>
  );
}
