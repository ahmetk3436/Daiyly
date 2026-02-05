import React from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../contexts/AuthContext';
import { hapticError } from '../../lib/haptics';

interface AppleSignInButtonProps {
  onError?: (error: string) => void;
}

export default function AppleSignInButton({ onError }: AppleSignInButtonProps) {
  const { loginWithApple } = useAuth();

  // Sign in with Apple is only available on iOS
  if (Platform.OS !== 'ios') {
    return null;
  }

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;

      await loginWithApple(
        credential.identityToken,
        credential.authorizationCode || '',
        fullName,
        credential.email || undefined
      );
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return; // User cancelled
      }
      hapticError();
      onError?.(err.message || 'Apple Sign In failed');
    }
  };

  return (
    <View className="mt-4">
      <View className="mb-4 flex-row items-center">
        <View className="h-px flex-1 bg-gray-300" />
        <Text className="mx-4 text-sm text-gray-500">or</Text>
        <View className="h-px flex-1 bg-gray-300" />
      </View>

      <Pressable
        className="flex-row items-center justify-center rounded-xl bg-black py-3.5 active:opacity-80"
        onPress={handleAppleSignIn}
      >
        <Text className="mr-2 text-lg text-white">{'\uF8FF'}</Text>
        <Text className="text-base font-semibold text-white">
          Sign in with Apple
        </Text>
      </Pressable>
    </View>
  );
}
