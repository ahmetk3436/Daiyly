import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { user, isGuest, guestUsageCount } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
      <View className="flex-1 px-6 pt-8">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-white">Daiyly</Text>
            <Text className="text-sm text-gray-400">
              {isGuest ? 'Your daily journal' : `Welcome, ${user?.email?.split('@')[0]}`}
            </Text>
          </View>
          {isGuest && (
            <View className="rounded-2xl bg-amber-900/30 px-4 py-2">
              <Text className="text-xs text-amber-400">{3 - guestUsageCount} free left</Text>
            </View>
          )}
        </View>

        <View className="flex-1 items-center justify-center">
          <View className="rounded-2xl bg-gray-900 border border-gray-800 p-8 items-center">
            <Ionicons name="book-outline" size={48} color="#f59e0b" />
            <Text className="mt-4 text-center text-lg font-semibold text-white">
              Your Journal Awaits
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-400">
              Start writing your thoughts and track your daily journey.
            </Text>
          </View>
        </View>

        {isGuest && (
          <Pressable
            className="mb-6 rounded-xl bg-amber-600 py-4 items-center"
            onPress={() => router.push('/(auth)/register')}
          >
            <Text className="text-base font-semibold text-white">Sign Up to Save Your Entries</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
