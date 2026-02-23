import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import {
  saveGuestEntry,
  getGuestEntries,
  hasGuestUsesRemaining,
  incrementGuestUses,
} from '../../lib/guest';
import {
  hapticLight,
  hapticSelection,
  hapticSuccess,
  hapticError,
  hapticMedium,
} from '../../lib/haptics';
import { MOOD_OPTIONS } from '../../types/journal';

const MOOD_SCORES: number[] = [20, 40, 60, 80, 100];

const CARD_COLORS: string[] = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#22C55E', // Green
];

const ACTIVITY_TAGS = [
  { id: 'work', label: 'Work', icon: 'briefcase-outline' as const },
  { id: 'exercise', label: 'Exercise', icon: 'fitness-outline' as const },
  { id: 'social', label: 'Social', icon: 'people-outline' as const },
  { id: 'reading', label: 'Reading', icon: 'book-outline' as const },
  { id: 'nature', label: 'Nature', icon: 'leaf-outline' as const },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline' as const },
  { id: 'cooking', label: 'Cooking', icon: 'restaurant-outline' as const },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline' as const },
  { id: 'meditation', label: 'Meditate', icon: 'flower-outline' as const },
  { id: 'family', label: 'Family', icon: 'heart-outline' as const },
];

export default function NewEntryScreen() {
  const { isAuthenticated, isGuest } = useAuth();
  const params = useLocalSearchParams<{ quickMood?: string }>();

  const [selectedMood, setSelectedMood] = useState<string | null>(
    params.quickMood || null
  );
  const [moodScore, setMoodScore] = useState<number>(60);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cardColor, setCardColor] = useState('#6366F1');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Auto-set mood score from selected mood
  useEffect(() => {
    if (selectedMood) {
      const moodOption = MOOD_OPTIONS.find((m) => m.emoji === selectedMood);
      if (moodOption) {
        switch (moodOption.value) {
          case 'happy':
          case 'excited':
            setMoodScore(80);
            break;
          case 'calm':
            setMoodScore(70);
            break;
          case 'neutral':
            setMoodScore(50);
            break;
          case 'anxious':
          case 'tired':
            setMoodScore(40);
            break;
          case 'sad':
            setMoodScore(30);
            break;
          case 'angry':
            setMoodScore(20);
            break;
        }
      }
    }
  }, [selectedMood]);

  const toggleTag = (tagId: string) => {
    hapticSelection();
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    if (!selectedMood) {
      hapticError();
      Alert.alert('Select a Mood', 'Please select how you are feeling.');
      return;
    }

    setSaving(true);

    try {
      if (isAuthenticated) {
        // Save via API
        const payload: Record<string, unknown> = {
          mood_emoji: selectedMood,
          mood_score: moodScore,
          content: content.trim() || (title.trim() || ''),
          card_color: cardColor,
        };

        await api.post('/journals', payload);
      } else {
        // Guest mode: save locally
        const canUse = await hasGuestUsesRemaining();
        if (!canUse) {
          hapticError();
          Alert.alert(
            'Guest Limit Reached',
            'You have used all 3 free entries. Create a free account to continue journaling!',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Sign Up',
                onPress: () => router.push('/(auth)/register'),
              },
            ]
          );
          setSaving(false);
          return;
        }

        await saveGuestEntry({
          id: `guest_${Date.now()}`,
          mood_emoji: selectedMood,
          mood_score: moodScore,
          content: content.trim() || (title.trim() || ''),
          card_color: cardColor,
          created_at: new Date().toISOString(),
        });
        await incrementGuestUses();
      }

      hapticSuccess();
      router.back();
    } catch (err: any) {
      hapticError();
      const message =
        err?.response?.data?.message ||
        'Failed to save entry. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const getMoodScoreLabel = (score: number): string => {
    if (score >= 80) return 'Great';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Okay';
    if (score >= 20) return 'Low';
    return 'Tough';
  };

  const getMoodScoreColor = (score: number): string => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#3B82F6';
    if (score >= 40) return '#F59E0B';
    if (score >= 20) return '#F97316';
    return '#EF4444';
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
          <Pressable
            onPress={() => {
              hapticLight();
              router.back();
            }}
            className="flex-row items-center"
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
            <Text className="text-base text-gray-600 ml-1">Back</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">
            New Entry
          </Text>
          <View className="w-16" />
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Mood Selector */}
          <View className="mt-5">
            <Text className="text-base font-semibold text-gray-800 mb-3">
              How are you feeling?
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = selectedMood === mood.emoji;
                return (
                  <Pressable
                    key={mood.value}
                    onPress={() => {
                      hapticSelection();
                      setSelectedMood(mood.emoji);
                    }}
                    className="items-center"
                  >
                    <View
                      className={`w-16 h-16 rounded-full items-center justify-center ${
                        isSelected ? 'border-2' : 'border border-gray-200'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? `${mood.color}15`
                          : '#F9FAFB',
                        borderColor: isSelected ? mood.color : '#E5E7EB',
                      }}
                    >
                      <Text className="text-2xl">{mood.emoji}</Text>
                    </View>
                    <Text
                      className={`text-xs mt-1 ${
                        isSelected ? 'font-semibold' : 'text-gray-500'
                      }`}
                      style={isSelected ? { color: mood.color } : undefined}
                    >
                      {mood.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Mood Score */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-gray-800">
                Rate your mood
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{
                  backgroundColor: `${getMoodScoreColor(moodScore)}15`,
                }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: getMoodScoreColor(moodScore) }}
                >
                  {moodScore} - {getMoodScoreLabel(moodScore)}
                </Text>
              </View>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {MOOD_SCORES.map((score) => {
                const isSelected = moodScore === score;
                return (
                  <Pressable
                    key={score}
                    className="flex-1"
                    onPress={() => {
                      hapticLight();
                      setMoodScore(score);
                    }}
                  >
                    <View
                      className={`py-3 rounded-xl items-center ${
                        isSelected ? '' : 'bg-gray-100'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: getMoodScoreColor(score) }
                          : undefined
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-gray-600'
                        }`}
                      >
                        {score}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Title Input */}
          <View className="mt-6">
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900"
              placeholder="How are you feeling? (optional)"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Journal Content */}
          <View className="mt-4">
            <Text className="text-base font-semibold text-gray-800 mb-2">
              Journal
            </Text>
            <TextInput
              multiline
              className="bg-gray-50 rounded-xl p-4 text-base text-gray-900 min-h-[200px]"
              placeholder="What's on your mind? Write freely..."
              placeholderTextColor="#9CA3AF"
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
              style={{ lineHeight: 24 }}
            />
          </View>

          {/* Activity Tags */}
          <View className="mt-6">
            <Text className="text-base font-semibold text-gray-800 mb-3">
              Activities
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {ACTIVITY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    className={`flex-row items-center rounded-full px-3.5 py-2 border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Ionicons
                      name={tag.icon}
                      size={16}
                      color={isSelected ? '#2563EB' : '#6B7280'}
                    />
                    <Text
                      className={`text-sm ml-1.5 ${
                        isSelected
                          ? 'font-semibold text-blue-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Card Color */}
          <View className="mt-6">
            <Text className="text-base font-semibold text-gray-800 mb-3">
              Card Color
            </Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {CARD_COLORS.map((color) => {
                const isSelected = cardColor === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
                      hapticLight();
                      setCardColor(color);
                    }}
                  >
                    <View
                      className={`w-10 h-10 rounded-full ${
                        isSelected
                          ? 'border-[3px] border-blue-500'
                          : 'border-2 border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Save Button (sticky bottom) */}
        <View
          className="px-5 py-4 bg-white border-t border-gray-100"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving || !selectedMood}
            className={`rounded-2xl py-4 items-center flex-row justify-center ${
              !selectedMood ? 'bg-gray-300' : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text className="text-white text-base font-bold ml-2">
                  Save Entry
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
