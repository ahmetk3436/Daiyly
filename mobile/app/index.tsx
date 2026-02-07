import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { hasSeenOnboarding } from '../lib/onboarding';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      const seenOnboarding = await hasSeenOnboarding();

      if (!seenOnboarding) {
        router.replace('/onboarding');
      } else {
        // Onboarding seen, check auth state
        if (!isLoading) {
          if (isAuthenticated || isGuest) {
            router.replace('/(protected)/home');
          } else {
            router.replace('/(auth)/login');
          }
        }
      }
      setIsCheckingOnboarding(false);
    };

    checkStatus();
  }, [isLoading, isAuthenticated, isGuest]);

  if (isCheckingOnboarding || isLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return null;
}