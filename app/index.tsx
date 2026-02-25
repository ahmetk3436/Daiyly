import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenOnboarding } from '../lib/onboarding';

export default function Index() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(true);

  useEffect(() => {
    const check = async () => {
      const seen = await hasSeenOnboarding();
      setOnboardingSeen(seen);
      setOnboardingChecked(true);
    };
    check();
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Show onboarding for first-time users
  if (!onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  if (isAuthenticated || isGuest) {
    return <Redirect href="/(protected)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
