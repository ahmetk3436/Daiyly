import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-8 pt-12">
        <Text className="mb-2 text-3xl font-bold text-gray-900">
          App Factory
        </Text>
        <Text className="mb-8 text-base text-gray-500">
          Welcome, {user?.email}
        </Text>

        <View className="flex-1 items-center justify-center">
          <View className="rounded-2xl bg-primary-50 p-8">
            <Text className="text-center text-lg font-semibold text-primary-700">
              Your MVP starts here.
            </Text>
            <Text className="mt-2 text-center text-sm text-primary-600">
              This is the Phase 0 Master Template.
            </Text>
          </View>
        </View>

        <View className="pb-8">
          <Button
            title="Sign Out"
            variant="outline"
            onPress={logout}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
