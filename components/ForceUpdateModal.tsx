import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY = '@daiyly_force_update_dismiss';
const DISMISS_DURATION = 60 * 60 * 1000; // 1 hour

interface ForceUpdateModalProps {
  visible: boolean;
  onDismiss?: () => void;
}

/**
 * Check if user recently dismissed the force update modal (within 1 hour).
 * Call this before showing the modal.
 */
export async function wasRecentlyDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < DISMISS_DURATION;
  } catch {
    return false;
  }
}

export default function ForceUpdateModal({ visible, onDismiss }: ForceUpdateModalProps) {
  const [showDismissHint, setShowDismissHint] = useState(false);

  const storeUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id6740804151'
      : 'https://play.google.com/store/apps/details?id=com.ahmetkizilkaya.daiyly';

  const handleDismiss = useCallback(async () => {
    await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    onDismiss?.();
  }, [onDismiss]);

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-6xl mb-6">🔄</Text>
        <Text className="text-2xl font-bold text-center text-text-primary mb-3">
          Update Required
        </Text>
        <Text className="text-base text-center text-text-secondary mb-8">
          A new version of Daiyly is available. Please update to continue using
          the app.
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-4 rounded-2xl"
          onPress={() => {
            Linking.openURL(storeUrl);
            // Show dismiss hint after user goes to store
            setShowDismissHint(true);
          }}
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-lg">Update Now</Text>
        </TouchableOpacity>

        {showDismissHint && (
          <View className="mt-6 items-center">
            <Text className="text-xs text-text-muted text-center mb-3 px-4">
              Update not showing in the store yet? It may take a few hours to
              appear in your region.
            </Text>
            <TouchableOpacity onPress={handleDismiss} activeOpacity={0.7}>
              <Text className="text-sm text-text-secondary underline">
                Try again later
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
