import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import AppleSignInButton from '../../components/ui/AppleSignInButton';
import { hapticLight } from '../../lib/haptics';

export default function LoginScreen() {
  const { login, enterGuestMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Login failed. Please try again.'
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
          Welcome back
        </Text>
        <Text className="mb-8 text-base text-text-secondary">
          Sign in to your account
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

        <View className="mb-6">
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
        </View>

        <Button
          title="Sign In"
          onPress={handleLogin}
          isLoading={isLoading}
          size="lg"
        />

        {/* Sign in with Apple — equal visual prominence (Guideline 4.8) */}
        <AppleSignInButton onError={(msg) => setError(msg)} />

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-text-secondary">Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="font-semibold text-blue-600">Sign Up</Text>
            </Pressable>
          </Link>
        </View>

        {/* Guest Mode */}
        <Pressable
          className="mt-4 py-3 items-center active:opacity-70"
          onPress={() => {
            hapticLight();
            enterGuestMode();
            router.replace('/(protected)/home');
          }}
        >
          <Text className="text-sm text-text-muted">
            Continue as Guest (3 free entries)
          </Text>
        </Pressable>

        <Text className="text-center text-xs text-text-muted mt-4 px-4">
          By continuing, you agree to our{' '}
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
