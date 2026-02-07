import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { setOnboardingSeen } from '../lib/onboarding';
import { hapticLight } from '../lib/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(xOffset / SCREEN_WIDTH);

    if (newIndex !== currentPage) {
      setCurrentPage(newIndex);
      hapticLight();
    }
  };

  const handleGetStarted = async () => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleSignIn = async () => {
    hapticLight();
    await setOnboardingSeen();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          className="flex-1"
        >
          {/* Page 1: Welcome */}
          <View style={{ width: SCREEN_WIDTH }} className="flex-1 justify-center items-center px-6">
            <View className="flex-1 justify-center items-center">
              <Text className="text-8xl mb-6">{'\u{1F4D3}'}</Text>
              <Text className="text-3xl font-bold text-gray-900 text-center">
                Welcome to Daiyly
              </Text>
              <Text className="text-lg text-gray-500 mt-2 text-center">
                Your aesthetic mood journal
              </Text>
              <Text className="text-base text-gray-600 mt-4 text-center px-8 leading-6">
                Capture your feelings, track your moods, and discover patterns in your emotional journey.
              </Text>
            </View>
          </View>

          {/* Page 2: Features */}
          <View style={{ width: SCREEN_WIDTH }} className="flex-1 justify-center items-center px-8">
            <View className="flex-1 justify-center items-center">
              <Text className="text-8xl mb-6">{'\u2728'}</Text>
              <Text className="text-3xl font-bold text-gray-900 text-center">
                Beautiful & Personal
              </Text>
              <View className="mt-8 w-full" style={{ gap: 16 }}>
                <View className="flex-row items-center bg-gray-50 p-4 rounded-2xl" style={{ gap: 16 }}>
                  <Text className="text-2xl">{'\u{1F3A8}'}</Text>
                  <Text className="text-base text-gray-700 font-medium flex-1">
                    Choose colors that match your mood
                  </Text>
                </View>
                <View className="flex-row items-center bg-gray-50 p-4 rounded-2xl" style={{ gap: 16 }}>
                  <Text className="text-2xl">{'\u{1F4CA}'}</Text>
                  <Text className="text-base text-gray-700 font-medium flex-1">
                    Track your emotional patterns
                  </Text>
                </View>
                <View className="flex-row items-center bg-gray-50 p-4 rounded-2xl" style={{ gap: 16 }}>
                  <Text className="text-2xl">{'\u{1F525}'}</Text>
                  <Text className="text-base text-gray-700 font-medium flex-1">
                    Build daily journaling streaks
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Page 3: CTA */}
          <View style={{ width: SCREEN_WIDTH }} className="flex-1 justify-center items-center px-8">
            <View className="flex-1 justify-center items-center">
              <Text className="text-8xl mb-6">{'\u{1F680}'}</Text>
              <Text className="text-3xl font-bold text-gray-900 text-center">
                Start Your Journey
              </Text>
              <View className="w-full mt-12">
                <Pressable
                  onPress={handleGetStarted}
                  className="w-full bg-blue-600 rounded-2xl py-4"
                  style={{ shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                >
                  <Text className="text-white text-center font-bold text-lg">
                    Try Free
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSignIn}
                  className="w-full border-2 border-blue-600 rounded-2xl py-4 mt-3"
                >
                  <Text className="text-blue-600 text-center font-bold text-lg">
                    Sign In
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Dots Container */}
        <View className="absolute bottom-10 w-full flex-row justify-center" style={{ gap: 12 }}>
          {[0, 1, 2].map((idx) => (
            <View
              key={idx}
              className="rounded-full"
              style={{
                width: currentPage === idx ? 12 : 8,
                height: currentPage === idx ? 12 : 8,
                backgroundColor: currentPage === idx ? '#2563eb' : '#d1d5db',
              }}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
