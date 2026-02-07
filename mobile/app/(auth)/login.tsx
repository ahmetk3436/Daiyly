import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import AppleSignInButton from '../../components/ui/AppleSignInButton';

export default function LoginScreen() {
  const { login, continueAsGuest } = useAuth();
  const router = useRouter();
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
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = async () => {
    await continueAsGuest();
    router.replace('/(protected)/home');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="mb-2 text-3xl font-bold text-white">Welcome back</Text>
        <Text className="mb-8 text-base text-gray-400">Sign in to your journal</Text>

        {error ? (
          <View className="mb-4 rounded-lg bg-red-900/30 p-3">
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
        </View>
        <View className="mb-6">
          <Input label="Password" placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" />
        </View>

        <Button title="Sign In" onPress={handleLogin} isLoading={isLoading} size="lg" />
        <AppleSignInButton onError={(msg) => setError(msg)} />

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-gray-400">Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Text className="font-semibold text-amber-400">Sign Up</Text>
          </Link>
        </View>

        <Pressable className="mt-4 items-center py-3" onPress={handleGuestMode}>
          <Text className="text-sm text-gray-500">Try Without Account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
