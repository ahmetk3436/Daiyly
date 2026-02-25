import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Modal } from 'react-native';

interface ForceUpdateModalProps {
  visible: boolean;
}

export default function ForceUpdateModal({ visible }: ForceUpdateModalProps) {
  const storeUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id6740804151'
      : 'https://play.google.com/store/apps/details?id=com.ahmetkizilkaya.daiyly';

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
          onPress={() => Linking.openURL(storeUrl)}
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-lg">Update Now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
