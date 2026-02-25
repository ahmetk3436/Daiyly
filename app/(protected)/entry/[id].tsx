import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../lib/api';
import { getGuestEntries, GUEST_ENTRIES_KEY } from '../../../lib/guest';
import { useAuth } from '../../../contexts/AuthContext';
import {
  hapticLight,
  hapticSuccess,
  hapticError,
  hapticSelection,
} from '../../../lib/haptics';
import {
  ShareableMoodCard,
  getMoodLabel,
} from '../../../components/ui/MoodCard';
import { useTheme } from '../../../contexts/ThemeContext';
import type { JournalEntry } from '../../../types/journal';

const MOOD_EMOJIS: string[] = [
  '\u{1F60A}',
  '\u{1F60C}',
  '\u{1F610}',
  '\u{1F614}',
  '\u{1F622}',
  '\u{1F62D}',
  '\u{1F624}',
  '\u{1F970}',
  '\u{1F634}',
  '\u{1F914}',
];

const CARD_COLORS: string[] = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#22C55E',
];

const MOOD_SCORES: number[] = [20, 40, 60, 80, 100];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getMoodScoreColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark } = useTheme();
  const { isGuest } = useAuth();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editMoodScore, setEditMoodScore] = useState(50);
  const [editMoodEmoji, setEditMoodEmoji] = useState('\u{1F60A}');
  const [editCardColor, setEditCardColor] = useState('#6366F1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchEntry = useCallback(async () => {
    try {
      setLoading(true);
      let fetchedEntry: JournalEntry;

      if (isGuest) {
        // Guest mode: load from AsyncStorage
        const guestEntries = await getGuestEntries();
        const found = guestEntries.find((e) => e.id === id);
        if (!found) {
          hapticError();
          setEntry(null);
          return;
        }
        fetchedEntry = found as unknown as JournalEntry;
      } else {
        // Authenticated: load from API
        const response = await api.get(`/journals/${id}`);
        fetchedEntry = response.data.data || response.data;
      }

      setEntry(fetchedEntry);
      setEditContent(fetchedEntry.content);
      setEditMoodScore(fetchedEntry.mood_score || 50);
      setEditMoodEmoji(fetchedEntry.mood_emoji || '\u{1F60A}');
      setEditCardColor(fetchedEntry.card_color || '#6366F1');
    } catch (error: any) {
      console.error('Failed to fetch entry:', error);
      hapticError();
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [id, isGuest]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handleEdit = () => {
    hapticSelection();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    hapticLight();
    if (entry) {
      setEditContent(entry.content);
      setEditMoodScore(entry.mood_score || 50);
      setEditMoodEmoji(entry.mood_emoji || '\u{1F60A}');
      setEditCardColor(entry.card_color || '#6366F1');
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      hapticError();
      Alert.alert('Error', 'Please write something in your journal entry.');
      return;
    }

    try {
      setSaving(true);

      if (isGuest) {
        // Guest mode: update in AsyncStorage
        const guestEntries = await getGuestEntries();
        const idx = guestEntries.findIndex((e) => e.id === id);
        if (idx !== -1) {
          guestEntries[idx] = {
            ...guestEntries[idx],
            content: editContent.trim(),
            mood_score: editMoodScore,
            mood_emoji: editMoodEmoji,
            card_color: editCardColor,
          };
          await AsyncStorage.setItem(GUEST_ENTRIES_KEY, JSON.stringify(guestEntries));
          setEntry(guestEntries[idx] as unknown as JournalEntry);
        }
      } else {
        const response = await api.put(`/journals/${id}`, {
          content: editContent.trim(),
          mood_score: editMoodScore,
          mood_emoji: editMoodEmoji,
          card_color: editCardColor,
        });
        const updatedEntry = response.data.data || response.data;
        setEntry(updatedEntry);
      }

      setIsEditing(false);
      hapticSuccess();
    } catch (error: any) {
      console.error('Failed to save entry:', error);
      hapticError();
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    hapticSelection();
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => hapticLight() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              if (isGuest) {
                // Guest mode: remove from AsyncStorage
                const guestEntries = await getGuestEntries();
                const filtered = guestEntries.filter((e) => e.id !== id);
                await AsyncStorage.setItem(GUEST_ENTRIES_KEY, JSON.stringify(filtered));
              } else {
                await api.delete(`/journals/${id}`);
              }
              hapticSuccess();
              router.back();
            } catch (error: any) {
              console.error('Failed to delete entry:', error);
              hapticError();
              Alert.alert(
                'Error',
                'Failed to delete entry. Please try again.'
              );
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = () => {
    hapticLight();
    router.push({
      pathname: '/(protected)/sharing',
      params: { entryId: id, cardType: 'entry' },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-text-muted mt-4">Loading entry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center p-6">
          <View className="bg-red-50 dark:bg-red-900/30 w-16 h-16 rounded-full items-center justify-center mb-4">
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <Text className="text-lg font-semibold text-text-primary mb-2">
            Entry not found
          </Text>
          <Text className="text-sm text-text-secondary text-center mb-6">
            Unable to load this journal entry. Please check your connection.
          </Text>
          <View className="flex-row" style={{ gap: 12 }}>
            <Pressable
              className="bg-blue-600 rounded-xl py-3 px-5"
              onPress={() => {
                hapticLight();
                fetchEntry();
              }}
            >
              <Text className="text-white font-semibold text-sm">
                Try Again
              </Text>
            </Pressable>
            <Pressable
              className="bg-surface-muted rounded-xl py-3 px-5"
              onPress={() => {
                hapticLight();
                router.back();
              }}
            >
              <Text className="text-text-primary font-semibold text-sm">
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
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

          {!isEditing && (
            <View className="flex-row" style={{ gap: 8 }}>
              {!isGuest && (
                <Pressable
                  onPress={handleShare}
                  className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full"
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color="#2563EB"
                  />
                </Pressable>
              )}
              <Pressable
                onPress={handleEdit}
                className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full"
              >
                <Ionicons
                  name="pencil-outline"
                  size={20}
                  color="#2563EB"
                />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="bg-red-50 dark:bg-red-900/30 p-2 rounded-full"
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="#EF4444"
                />
              </Pressable>
            </View>
          )}
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* VIEW MODE */}
          {!isEditing && (
            <>
              {/* Shareable MoodCard Preview */}
              <View className="items-center mb-5">
                <ShareableMoodCard
                  entry={{
                    mood_emoji: entry.mood_emoji || '\u{1F60A}',
                    mood_score: entry.mood_score || 50,
                    content: entry.content,
                    card_color: entry.card_color || '#6366F1',
                    entry_date: entry.entry_date || entry.created_at,
                  }}
                />
              </View>

              {/* Entry Detail Card */}
              <View className="bg-surface-elevated rounded-2xl p-5 border border-border mb-4">
                {/* Date + Time */}
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-sm font-medium text-text-secondary">
                      {formatDate(entry.entry_date || entry.created_at)}
                    </Text>
                    <Text className="text-xs text-text-muted mt-0.5">
                      {formatTime(entry.created_at)}
                    </Text>
                  </View>
                  <View
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor: entry.card_color || '#6366F1',
                    }}
                  />
                </View>

                {/* Mood Section */}
                <View
                  className="flex-row items-center mb-4 pb-4 border-b border-border"
                  style={{ gap: 16 }}
                >
                  <Text className="text-5xl">
                    {entry.mood_emoji || '\u{1F60A}'}
                  </Text>
                  <View>
                    <Text className="text-sm text-text-muted">Mood Score</Text>
                    <View className="flex-row items-baseline">
                      <Text
                        className="text-2xl font-bold"
                        style={{
                          color: getMoodScoreColor(entry.mood_score || 0),
                        }}
                      >
                        {entry.mood_score || 0}
                      </Text>
                      <Text className="text-sm text-text-muted ml-0.5">
                        /100
                      </Text>
                    </View>
                    <Text
                      className="text-xs font-medium"
                      style={{
                        color: getMoodScoreColor(entry.mood_score || 0),
                      }}
                    >
                      {getMoodLabel(entry.mood_score || 0)}
                    </Text>
                  </View>
                </View>

                {/* Content */}
                <Text className="text-base text-text-primary leading-relaxed">
                  {entry.content}
                </Text>

                {/* Updated timestamp */}
                {entry.updated_at &&
                  entry.updated_at !== entry.created_at && (
                    <Text className="text-xs text-text-muted mt-4 italic">
                      Edited{' '}
                      {new Date(entry.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
              </View>

              {/* Share CTA (authenticated only) */}
              {!isGuest && (
                <Pressable
                  className="bg-blue-600 rounded-2xl py-4 items-center flex-row justify-center mb-4 active:bg-blue-700"
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                  <Text className="text-base font-semibold text-white ml-2">
                    Share This Entry
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* EDIT MODE */}
          {isEditing && (
            <View className="bg-surface-elevated rounded-2xl p-5 border border-border mb-4">
              {/* Date Display */}
              <Text className="text-sm text-text-secondary mb-4">
                {formatDate(entry.entry_date || entry.created_at)}
              </Text>

              {/* Content Input */}
              <TextInput
                multiline
                className="bg-input-bg rounded-xl p-4 text-base min-h-[150px] text-text-primary"
                placeholder="What's on your mind?"
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                value={editContent}
                onChangeText={setEditContent}
                textAlignVertical="top"
              />

              {/* Mood Emoji Picker */}
              <Text className="text-sm font-semibold text-text-primary mt-4 mb-2">
                How are you feeling?
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <View className="flex-row" style={{ gap: 10 }}>
                  {MOOD_EMOJIS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => {
                        hapticSelection();
                        setEditMoodEmoji(emoji);
                      }}
                    >
                      <View
                        className={`w-13 h-13 rounded-full items-center justify-center ${
                          editMoodEmoji === emoji
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500'
                            : 'bg-surface-muted'
                        }`}
                        style={{ width: 52, height: 52 }}
                      >
                        <Text className="text-2xl">{emoji}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Mood Score Picker */}
              <Text className="text-sm font-semibold text-text-primary mt-4 mb-2">
                Rate your day (1-100)
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {MOOD_SCORES.map((score) => (
                  <Pressable
                    key={score}
                    className="flex-1"
                    onPress={() => {
                      hapticLight();
                      setEditMoodScore(score);
                    }}
                  >
                    <View
                      className={`py-3 rounded-xl items-center ${
                        editMoodScore === score ? '' : 'bg-surface-muted'
                      }`}
                      style={
                        editMoodScore === score
                          ? { backgroundColor: getMoodScoreColor(score) }
                          : undefined
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          editMoodScore === score
                            ? 'text-white'
                            : 'text-text-secondary'
                        }`}
                      >
                        {score}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Card Color Picker */}
              <Text className="text-sm font-semibold text-text-primary mt-4 mb-2">
                Card color
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                {CARD_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => {
                      hapticLight();
                      setEditCardColor(color);
                    }}
                  >
                    <View
                      className={`w-10 h-10 rounded-full ${
                        editCardColor === color
                          ? 'border-[3px] border-blue-500'
                          : 'border-2 border-border-strong'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  </Pressable>
                ))}
              </View>

              {/* Action Buttons */}
              <View className="flex-row mt-6" style={{ gap: 12 }}>
                <Pressable className="flex-1" onPress={handleCancelEdit}>
                  <View className="bg-surface-muted rounded-xl py-4 items-center">
                    <Text className="text-base font-semibold text-text-secondary">
                      Cancel
                    </Text>
                  </View>
                </Pressable>
                <Pressable className="flex-1" onPress={handleSave}>
                  <View className="bg-blue-600 rounded-xl py-4 items-center">
                    <Text className="text-base font-semibold text-white">
                      Save Changes
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Saving/Deleting Overlay */}
        {(saving || deleting) && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }}
          >
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-text-secondary mt-3 font-medium">
              {saving ? 'Saving...' : 'Deleting...'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
