import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { INTENT_PLAN_KEY } from '../onboarding';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Invalid email format');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password);

      // Check if user came from onboarding with a plan intent → route to paywall
      const intentPlan = await AsyncStorage.getItem(INTENT_PLAN_KEY);
      if (intentPlan) {
        await AsyncStorage.removeItem(INTENT_PLAN_KEY);
        router.replace('/(protected)/paywall');
      } else {
        router.replace('/(protected)/home');
      }
    } catch (err: any) {
      Sentry.captureException(err);
      setError(
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="mb-2 text-3xl font-bold text-text-primary">
          Create account
        </Text>
        <Text className="mb-8 text-base text-text-secondary">
          Start your journaling journey
        </Text>

        {error ? (
          <View className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 p-3">
            <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <View className="mb-4">
          <Input
            label="Password"
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        <View className="mb-6">
          <Input
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        <Button
          title="Create Account"
          onPress={handleRegister}
          isLoading={isLoading}
          size="lg"
        />

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-text-secondary">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="font-semibold text-blue-600">Sign In</Text>
            </Pressable>
          </Link>
        </View>

        <Text className="text-center text-xs text-text-muted mt-4 px-4">
          By creating an account, you agree to our{' '}
          <Text
            className="text-blue-600 underline"
            onPress={() => Linking.openURL('https://vexellabspro.com/daiyly/terms')}
          >
            Terms of Service
          </Text>{' '}and{' '}
          <Text
            className="text-blue-600 underline"
            onPress={() => Linking.openURL('https://vexellabspro.com/daiyly/privacy')}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
