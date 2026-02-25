import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
import { trackEntrySaved } from '../../lib/review';
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

const DRAFT_KEY = '@daiyly_draft';

interface DraftData {
  selectedMood: string | null;
  moodScore: number;
  title: string;
  content: string;
  cardColor: string;
  selectedTags: string[];
  savedAt: string;
}

export default function NewEntryScreen() {
  const { isAuthenticated, isGuest } = useAuth();
  const { isDark } = useTheme();
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
  const [draftRestored, setDraftRestored] = useState(false);
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (params.quickMood) return; // Skip draft restore if quick mood was tapped
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const draft: DraftData = JSON.parse(raw);
        if (draft.content || draft.title || draft.selectedMood) {
          setSelectedMood(draft.selectedMood);
          setMoodScore(draft.moodScore);
          setTitle(draft.title);
          setContent(draft.content);
          setCardColor(draft.cardColor);
          setSelectedTags(draft.selectedTags || []);
          setDraftRestored(true);
          // Auto-hide indicator after 3s
          setTimeout(() => setDraftRestored(false), 3000);
        }
      } catch {}
    }).catch(() => {});
  }, []);

  // Debounced draft save
  const saveDraft = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const draft: DraftData = {
        selectedMood, moodScore, title, content, cardColor, selectedTags,
        savedAt: new Date().toISOString(),
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    }, 1000);
  }, [selectedMood, moodScore, title, content, cardColor, selectedTags]);

  // Trigger draft save on any change
  useEffect(() => {
    saveDraft();
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [saveDraft]);

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
      // Local date string (YYYY-MM-DD) for correct timezone
      const entryDate = new Date().toISOString().split('T')[0];

      if (isAuthenticated) {
        // Save via API
        const payload: Record<string, unknown> = {
          mood_emoji: selectedMood,
          mood_score: moodScore,
          content: content.trim() || (title.trim() || ''),
          card_color: cardColor,
          tags: selectedTags,
          entry_date: entryDate,
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
          tags: selectedTags,
          created_at: new Date().toISOString(),
          entry_date: entryDate,
        });
        await incrementGuestUses();
      }

      // Clear draft on successful save
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      hapticSuccess();
      trackEntrySaved().catch(() => {}); // fire-and-forget review prompt
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border">
          <Pressable
            onPress={() => {
              hapticLight();
              router.back();
            }}
            className="flex-row items-center"
          >
            <Ionicons name="chevron-back" size={24} color={isDark ? '#94A3B8' : '#374151'} />
            <Text className="text-base text-text-secondary ml-1">Back</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary">
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
          {/* Draft Restored Indicator */}
          {draftRestored && (
            <View className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-4 py-2.5 mt-3 flex-row items-center border border-blue-100 dark:border-blue-800">
              <Ionicons name="document-outline" size={16} color="#2563EB" />
              <Text className="text-xs text-blue-700 dark:text-blue-300 ml-2 font-medium">
                Draft restored
              </Text>
            </View>
          )}

          {/* Mood Selector */}
          <View className="mt-5">
            <Text className="text-base font-semibold text-text-primary mb-3">
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
                        isSelected ? 'border-2' : 'border border-border-strong'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? `${mood.color}15`
                          : isDark ? '#1E293B' : '#F9FAFB',
                        borderColor: isSelected ? mood.color : isDark ? '#475569' : '#E5E7EB',
                      }}
                    >
                      <Text className="text-2xl">{mood.emoji}</Text>
                    </View>
                    <Text
                      className={`text-xs mt-1 ${
                        isSelected ? 'font-semibold' : 'text-text-secondary'
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
              <Text className="text-base font-semibold text-text-primary">
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
                        isSelected ? '' : 'bg-surface-muted'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: getMoodScoreColor(score) }
                          : undefined
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-text-secondary'
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
              className="bg-input-bg rounded-xl px-4 py-3.5 text-base text-text-primary"
              placeholder="How are you feeling? (optional)"
              placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Journal Content */}
          <View className="mt-4">
            <Text className="text-base font-semibold text-text-primary mb-2">
              Journal
            </Text>
            <TextInput
              multiline
              className="bg-input-bg rounded-xl p-4 text-base text-text-primary min-h-[200px]"
              placeholder="What's on your mind? Write freely..."
              placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
              style={{ lineHeight: 24 }}
            />
          </View>

          {/* Activity Tags */}
          <View className="mt-6">
            <Text className="text-base font-semibold text-text-primary mb-3">
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
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                        : 'bg-surface-elevated border-border-strong'
                    }`}
                  >
                    <Ionicons
                      name={tag.icon}
                      size={16}
                      color={isSelected ? '#2563EB' : (isDark ? '#94A3B8' : '#6B7280')}
                    />
                    <Text
                      className={`text-sm ml-1.5 ${
                        isSelected
                          ? 'font-semibold text-blue-700 dark:text-blue-400'
                          : 'text-text-secondary'
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
            <Text className="text-base font-semibold text-text-primary mb-3">
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
                          : 'border-2 border-border-strong'
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
          className="px-5 py-4 bg-background border-t border-border"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving || !selectedMood}
            className={`rounded-2xl py-4 items-center flex-row justify-center ${
              !selectedMood ? 'bg-surface-muted' : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={!selectedMood ? (isDark ? '#475569' : '#9CA3AF') : '#FFFFFF'} />
                <Text className={`text-base font-bold ml-2 ${!selectedMood ? 'text-text-muted' : 'text-white'}`}>
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
