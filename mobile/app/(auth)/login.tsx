import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight } from '../../lib/haptics';
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
      router.replace('/(protected)/home');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = async () => {
    hapticLight();
    await continueAsGuest();
    router.replace('/(protected)/home');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable className="flex-1 justify-center px-8" onPress={Keyboard.dismiss}>
          <View className="items-center mb-8">
            <Text className="text-5xl">{'\u{1F4D3}'}</Text>
            <Text className="text-3xl font-bold text-gray-900 mt-2">Daiyly</Text>
            <Text className="text-base text-gray-500 mt-1">Your aesthetic mood journal</Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-xl bg-red-50 p-3">
              <Text className="text-sm text-red-600 text-center">{error}</Text>
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

          <Button title="Sign In" onPress={handleLogin} isLoading={isLoading} size="lg" />
          <AppleSignInButton onError={(msg: string) => setError(msg)} />

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-gray-500">{"Don't have an account? "}</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text className="font-semibold text-blue-600">Sign Up</Text>
              </Pressable>
            </Link>
          </View>

          <Pressable className="mt-4 items-center py-3" onPress={handleGuestMode}>
            <Text className="text-blue-600 text-sm">
              Skip for now {'\u2014'} 3 free entries
            </Text>
          </Pressable>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
