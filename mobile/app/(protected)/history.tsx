import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { getGuestEntries } from '../../lib/guest';
import type { JournalEntry, GuestEntry } from '../../types/journal';

interface DisplayEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  entry_date: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  } catch {
    return '';
  }
}

function EntryCard({ entry }: { entry: DisplayEntry }) {
  return (
    <View
      className="mx-4 mb-4 rounded-2xl p-4"
      style={{
        backgroundColor: entry.card_color || '#dbeafe',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-3xl">{entry.mood_emoji}</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-sm text-gray-600">
            {formatDate(entry.entry_date || entry.created_at)}
          </Text>
          <View className="bg-white/80 rounded-full px-2 py-1">
            <Text className="text-xs font-medium text-gray-700">
              {entry.mood_score}
            </Text>
          </View>
        </View>
      </View>
      <Text className="text-base text-gray-800 mt-2" numberOfLines={3}>
        {entry.content}
      </Text>
      <Text className="text-xs text-gray-500 mt-2">
        {timeAgo(entry.created_at)}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { isGuest } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasError, setHasError] = useState(false);

  const fetchEntries = useCallback(
    async (pageNum: number, append = false) => {
      try {
        setHasError(false);

        if (isGuest) {
          const guestEntries = await getGuestEntries();
          const mapped: DisplayEntry[] = guestEntries
            .map((e: GuestEntry) => ({
              id: e.id,
              mood_emoji: e.mood_emoji,
              mood_score: e.mood_score,
              content: e.content,
              card_color: e.card_color,
              entry_date: e.created_at,
              created_at: e.created_at,
            }))
            .reverse();
          setEntries(mapped);
          setTotal(mapped.length);
        } else {
          const offset = pageNum * 20;
          const res = await api.get(`/journals?limit=20&offset=${offset}`);
          const data = res.data;
          const newEntries: DisplayEntry[] = (data.entries || []).map(
            (e: JournalEntry) => ({
              id: e.id,
              mood_emoji: e.mood_emoji,
              mood_score: e.mood_score,
              content: e.content,
              card_color: e.card_color,
              entry_date: e.entry_date,
              created_at: e.created_at,
            })
          );

          if (append) {
            setEntries((prev) => [...prev, ...newEntries]);
          } else {
            setEntries(newEntries);
          }
          setTotal(data.total || 0);
          setPage(pageNum);
        }
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [isGuest]
  );

  useEffect(() => {
    fetchEntries(0);
  }, [fetchEntries]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchEntries(0);
    setIsRefreshing(false);
  }, [fetchEntries]);

  const onEndReached = useCallback(() => {
    if (!isGuest && entries.length < total) {
      fetchEntries(page + 1, true);
    }
  }, [entries.length, total, page, isGuest, fetchEntries]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-base text-gray-500 mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8" edges={['top']}>
        <Text className="text-5xl">{'\u26A0\uFE0F'}</Text>
        <Text className="text-xl font-bold text-gray-900 mt-4">Something went wrong</Text>
        <Text className="text-base text-gray-500 mt-2 text-center">
          Could not load your journal entries.
        </Text>
        <Pressable
          className="bg-blue-600 rounded-2xl py-3 px-8 mt-6"
          onPress={() => {
            setIsLoading(true);
            fetchEntries(0);
          }}
        >
          <Text className="text-white font-bold">Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900">Journal History</Text>
        <Text className="text-sm text-gray-500 mt-1">{total} entries</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        className="mt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-6xl">{'\u{1F4DD}'}</Text>
            <Text className="text-xl font-bold text-gray-400 mt-4">No entries yet</Text>
            <Text className="text-base text-gray-400 mt-2 text-center px-8">
              Start journaling to see your history here
            </Text>
            <Pressable
              className="bg-blue-600 rounded-2xl py-3 px-8 mt-6"
              onPress={() => router.push('/(protected)/home')}
            >
              <Text className="text-white font-bold">Write First Entry</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          !isGuest && entries.length < total ? (
            <View className="py-4 items-center">
              <ActivityIndicator color="#2563eb" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
