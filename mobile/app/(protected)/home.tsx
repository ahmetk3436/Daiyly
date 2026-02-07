import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { hapticSuccess, hapticError, hapticSelection } from '../../lib/haptics';
import { saveGuestEntry, incrementGuestUses, hasGuestUsesRemaining } from '../../lib/guest';
import { shareResult } from '../../lib/share';
import MoodCard, { getMoodLabel } from '../../components/ui/MoodCard';
import type { JournalEntry, JournalStreak } from '../../types/journal';

const MOOD_EMOJIS = ['\u{1F60A}', '\u{1F622}', '\u{1F621}', '\u{1F630}', '\u{1F634}', '\u{1F973}', '\u{1F60C}', '\u{1F914}', '\u{1F60D}', '\u{1F624}'];
const CARD_COLORS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe', '#fef2f2'];
const MOOD_SCORES = [
  { value: 20, label: 'Low' },
  { value: 40, label: 'Meh' },
  { value: 60, label: 'OK' },
  { value: 80, label: 'Good' },
  { value: 100, label: 'Great' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning \u2600\uFE0F';
  if (hour >= 12 && hour < 17) return 'Good afternoon \u{1F324}';
  return 'Good evening \u{1F319}';
}

export default function HomeScreen() {
  const { user, isGuest, guestUsageCount, canUseFeature, incrementGuestUsage } = useAuth();
  const router = useRouter();

  const [moodEmoji, setMoodEmoji] = useState('');
  const [moodScore, setMoodScore] = useState(60);
  const [content, setContent] = useState('');
  const [cardColor, setCardColor] = useState('#dbeafe');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!isGuest) {
        const [streakRes, entriesRes] = await Promise.all([
          api.get('/streak'),
          api.get('/journals?limit=1&offset=0'),
        ]);
        setStreak(streakRes.data);
        const entries = entriesRes.data.entries || [];
        if (entries.length > 0) {
          const latest = entries[0];
          const today = new Date().toISOString().slice(0, 10);
          const entryDate = latest.entry_date?.slice(0, 10);
          if (entryDate === today) {
            setTodayEntry(latest);
          }
        }
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setIsLoadingData(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!moodEmoji) {
      Alert.alert('Select Mood', 'Please select a mood emoji first.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Write Something', 'Please write about your day.');
      return;
    }

    if (isGuest) {
      const hasUses = await hasGuestUsesRemaining();
      if (!hasUses) {
        Alert.alert(
          'Free Limit Reached',
          'You have used all 3 free entries. Sign up to continue journaling!',
          [
            { text: 'Sign Up', onPress: () => router.push('/(auth)/register') },
            { text: 'Later', style: 'cancel' },
          ]
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isGuest) {
        await saveGuestEntry({
          id: Date.now().toString(),
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          content: content.trim(),
          card_color: cardColor,
          created_at: new Date().toISOString(),
        });
        await incrementGuestUses();
        await incrementGuestUsage();
      } else {
        await api.post('/journals', {
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          content: content.trim(),
          card_color: cardColor,
          is_private: true,
        });
        // Refresh streak
        try {
          const streakRes = await api.get('/streak');
          setStreak(streakRes.data);
        } catch {
          // ignore
        }
      }

      hapticSuccess();
      setShowSuccess(true);
    } catch (err: unknown) {
      hapticError();
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save entry.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    const label = getMoodLabel(moodScore);
    shareResult(moodEmoji, label, streak?.current_streak || 0);
  };

  const handleDismissSuccess = () => {
    setShowSuccess(false);
    setMoodEmoji('');
    setMoodScore(60);
    setContent('');
    setCardColor('#dbeafe');
  };

  if (isLoadingData && !isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-base text-gray-500 mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (showSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100, justifyContent: 'center', flexGrow: 1 }}
        >
          <MoodCard
            moodEmoji={moodEmoji}
            moodScore={moodScore}
            date={new Date().toISOString()}
            streakCount={streak?.current_streak || 0}
            cardColor={cardColor}
            onShare={handleShare}
          />
          <Pressable
            className="bg-blue-600 rounded-2xl py-4 mx-4 mt-6 items-center"
            onPress={handleShare}
          >
            <Text className="text-white font-bold text-base">Share Your Mood</Text>
          </Pressable>
          <Pressable className="mt-3 items-center py-3" onPress={handleDismissSuccess}>
            <Text className="text-gray-500 text-base">Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View className="px-4 pt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-gray-900">Daiyly</Text>
              <Text className="text-sm text-gray-500">
                {isGuest
                  ? getGreeting()
                  : `${getGreeting()}, ${user?.email?.split('@')[0] || ''}`}
              </Text>
            </View>
            {isGuest && (
              <View className="rounded-2xl bg-blue-50 px-4 py-2">
                <Text className="text-xs font-medium text-blue-600">
                  {3 - guestUsageCount} free left
                </Text>
              </View>
            )}
          </View>

          {/* Streak Banner */}
          {streak && streak.total_entries > 0 && (
            <View className="bg-blue-50 rounded-2xl p-4 mx-4 mt-4 flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="text-xl">{'\u{1F525}'}</Text>
                <Text className="text-lg font-bold text-gray-900">
                  {streak.current_streak} day streak
                </Text>
              </View>
              <Text className="text-sm text-gray-500">
                Total: {streak.total_entries}
              </Text>
            </View>
          )}

          {/* Mood Emoji Picker */}
          <Text className="text-xl font-bold text-gray-900 px-4 mt-6">
            How are you feeling?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {MOOD_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                className="w-14 h-14 rounded-full items-center justify-center mx-1"
                style={
                  moodEmoji === emoji
                    ? { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6' }
                    : { backgroundColor: '#f3f4f6' }
                }
                onPress={() => {
                  hapticSelection();
                  setMoodEmoji(emoji);
                }}
              >
                <Text className="text-3xl">{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Mood Score */}
          <Text className="text-base font-medium text-gray-700 px-4 mt-4">
            Mood Level: {moodScore}
          </Text>
          <View className="flex-row px-4 mt-2" style={{ gap: 8 }}>
            {MOOD_SCORES.map((item) => (
              <Pressable
                key={item.value}
                className="flex-1 items-center py-2 rounded-xl"
                style={{
                  backgroundColor: moodScore === item.value ? '#2563eb' : '#f3f4f6',
                }}
                onPress={() => {
                  hapticSelection();
                  setMoodScore(item.value);
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: moodScore === item.value ? '#ffffff' : '#6b7280' }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Card Color Picker */}
          <Text className="text-base font-medium text-gray-700 px-4 mt-4">
            Card Color
          </Text>
          <View className="flex-row px-4 mt-2" style={{ gap: 8 }}>
            {CARD_COLORS.map((color) => (
              <Pressable
                key={color}
                className="w-10 h-10 rounded-full"
                style={{
                  backgroundColor: color,
                  borderWidth: cardColor === color ? 3 : 1,
                  borderColor: cardColor === color ? '#2563eb' : '#d1d5db',
                }}
                onPress={() => {
                  hapticSelection();
                  setCardColor(color);
                }}
              />
            ))}
          </View>

          {/* Journal Content */}
          <TextInput
            className="bg-gray-50 rounded-2xl p-4 mx-4 mt-4 text-base text-gray-900"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            placeholder="Write about your day..."
            placeholderTextColor="#9ca3af"
            multiline
            value={content}
            onChangeText={setContent}
          />

          {/* Submit Button */}
          <Pressable
            className="mx-4 mt-6 rounded-2xl py-4 items-center"
            style={{
              backgroundColor: !moodEmoji || !content.trim() ? '#93c5fd' : '#2563eb',
              opacity: isSubmitting ? 0.7 : 1,
            }}
            onPress={handleSubmit}
            disabled={isSubmitting || !moodEmoji || !content.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">Save Entry</Text>
            )}
          </Pressable>

          {/* Guest upgrade prompt */}
          {isGuest && (
            <Pressable
              className="mx-4 mt-4 mb-4 items-center py-3"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="text-blue-600 text-sm font-medium">
                Sign Up to Save Your Entries Forever
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
