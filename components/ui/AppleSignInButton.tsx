import React, { useState } from 'react';
import { Platform, View, Text, Pressable, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight, hapticError } from '../../lib/haptics';

interface AppleSignInButtonProps {
  onError?: (error: string) => void;
  isLoading?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

// 2025-2026 Trend: Android fallback, loading state, enhanced design
export default function AppleSignInButton({
  onError,
  isLoading: externalIsLoading = false,
  onLoadingChange,
}: AppleSignInButtonProps) {
  const { loginWithApple } = useAuth();
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalIsLoading || internalLoading;

  const setLoading = (loading: boolean) => {
    setInternalLoading(loading);
    onLoadingChange?.(loading);
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      hapticLight();

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
        // User cancelled - not an error
        setLoading(false);
        return;
      }
      hapticError();
      onError?.(err.message || 'Apple Sign In failed');
    } finally {
      setLoading(false);
    }
  };

  // iOS: Native Apple Sign In button
  if (Platform.OS === 'ios') {
    return (
      <View className="mt-4">
        <View className="mb-4 flex-row items-center">
          <View className="h-px flex-1 bg-gray-300" />
          <Text className="mx-4 text-sm text-gray-500">or</Text>
          <View className="h-px flex-1 bg-gray-300" />
        </View>

        <View pointerEvents={isLoading ? 'none' : 'auto'} style={{ opacity: isLoading ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ width: '100%', height: 56 }}
            onPress={handleAppleSignIn}
          />
        </View>
      </View>
    );
  }

  // Android: Custom button (fallback)
  return (
    <View className="mt-4">
      <View className="mb-4 flex-row items-center">
        <View className="h-px flex-1 bg-gray-300" />
        <Text className="mx-4 text-sm text-gray-500">or</Text>
        <View className="h-px flex-1 bg-gray-300" />
      </View>

      <Pressable
        className="flex-row items-center justify-center rounded-xl bg-black py-3.5 active:opacity-80 disabled:opacity-50"
        onPress={handleAppleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Ionicons name="logo-apple" size={22} color="#ffffff" />
            <Text className="ml-2 text-base font-semibold text-white">
              Sign in with Apple
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
