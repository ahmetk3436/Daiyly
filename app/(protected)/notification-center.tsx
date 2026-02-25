import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, ActivityIndicator, Alert, Linking, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight, hapticSelection, hapticError } from '../../lib/haptics';
import api from '../../lib/api';

const NOTIF_PREFS_KEY = '@daiyly_notification_prefs';

interface NotificationItem {
  id: string;
  type: 'reminder' | 'insight' | 'streak' | 'weekly';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface NotifPrefs {
  dailyReminder: boolean;
  streakAlerts: boolean;
  weeklyReports: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  dailyReminder: true,
  streakAlerts: true,
  weeklyReports: true,
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function NotificationCenterScreen() {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [osPermissionGranted, setOsPermissionGranted] = useState<boolean | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Check OS notification permission
  const checkOsPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setOsPermissionGranted(status === 'granted');
    } catch {
      setOsPermissionGranted(null);
    }
  }, []);

  // Check on mount + re-check when app resumes (user may toggle in OS Settings)
  useEffect(() => {
    checkOsPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkOsPermission();
    });
    return () => sub.remove();
  }, [checkOsPermission]);

  // Load persisted notification preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
        if (stored) {
          const prefs: NotifPrefs = JSON.parse(stored);
          setDailyReminder(prefs.dailyReminder ?? true);
          setStreakAlerts(prefs.streakAlerts ?? true);
          setWeeklyReports(prefs.weeklyReports ?? true);
        }
      } catch {}
    };
    loadPrefs();
  }, []);

  const persistPrefs = async (prefs: NotifPrefs) => {
    try {
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  };

  const updatePref = async (key: keyof NotifPrefs, value: boolean) => {
    hapticSelection();

    // If turning ON, verify OS permission first
    if (value) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        // Try requesting permission
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          hapticError();
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in your device settings to receive reminders.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return; // Don't toggle the switch
        }
        setOsPermissionGranted(true);
      }
    }

    const newPrefs = { dailyReminder, streakAlerts, weeklyReports, [key]: value };
    if (key === 'dailyReminder') setDailyReminder(value);
    if (key === 'streakAlerts') setStreakAlerts(value);
    if (key === 'weeklyReports') setWeeklyReports(value);
    persistPrefs(newPrefs);
  };

  // Fetch real data and generate notification items
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const items: NotificationItem[] = [];
    const now = new Date();

    if (!isAuthenticated) {
      // For guests, show a single reminder to create an account
      items.push({
        id: 'guest-reminder',
        type: 'reminder',
        title: 'Daily Reminder',
        message: "How are you feeling today? Take a moment to journal.",
        time: timeAgo(now),
        read: false,
        icon: 'notifications-outline',
        color: '#2563EB',
      });
      setNotifications(items);
      setLoading(false);
      return;
    }

    try {
      // Fetch streak and insights in parallel
      const [streakRes, insightsRes] = await Promise.allSettled([
        api.get('/streak'),
        api.get('/journals/insights'),
      ]);

      // Generate streak notification
      if (streakRes.status === 'fulfilled' && streakRes.value.data) {
        const streak = streakRes.value.data;
        const currentStreak = streak.current_streak || 0;

        if (currentStreak > 0) {
          items.push({
            id: 'streak-current',
            type: 'streak',
            title: 'Streak Update',
            message: currentStreak >= 7
              ? `Amazing! Your ${currentStreak}-day streak is going strong!`
              : `You're on a ${currentStreak}-day streak. Keep it up!`,
            time: timeAgo(new Date(streak.last_entry_date || now)),
            read: false,
            icon: 'flame-outline',
            color: '#F59E0B',
          });
        } else {
          items.push({
            id: 'streak-broken',
            type: 'streak',
            title: 'Streak Alert',
            message: "Your streak has reset. Journal today to start a new one!",
            time: timeAgo(now),
            read: false,
            icon: 'flame-outline',
            color: '#F59E0B',
          });
        }
      }

      // Generate insights notification
      if (insightsRes.status === 'fulfilled' && insightsRes.value.data?.data) {
        const insights = insightsRes.value.data.data;
        const avgScore = Math.round(insights.average_mood_score || 0);
        const topEmoji = insights.top_mood_emoji || '';
        const totalEntries = insights.total_entries || 0;

        if (totalEntries > 0 && topEmoji) {
          items.push({
            id: 'insight-mood',
            type: 'insight',
            title: 'Weekly Insight',
            message: `Your most common mood this week was ${topEmoji} with an average score of ${avgScore}/100.`,
            time: timeAgo(now),
            read: false,
            icon: 'analytics-outline',
            color: '#8B5CF6',
          });
        }

        if (totalEntries > 0) {
          items.push({
            id: 'insight-entries',
            type: 'weekly',
            title: 'Weekly Summary',
            message: `You wrote ${totalEntries} entries this week with ${insights.total_words || 0} total words. ${insights.mood_trend === 'improving' ? 'Your mood is trending up!' : insights.mood_trend === 'declining' ? 'Consider some self-care this week.' : 'Your mood has been steady.'}`,
            time: timeAgo(now),
            read: true,
            icon: 'document-text-outline',
            color: '#10B981',
          });
        }
      }

      // Always show daily reminder
      items.push({
        id: 'daily-reminder',
        type: 'reminder',
        title: 'Daily Reminder',
        message: "How are you feeling today? Take a moment to journal.",
        time: timeAgo(now),
        read: true,
        icon: 'notifications-outline',
        color: '#2563EB',
      });
    } catch {
      // If API fails, show a generic reminder
      items.push({
        id: 'fallback-reminder',
        type: 'reminder',
        title: 'Daily Reminder',
        message: "How are you feeling today? Take a moment to journal.",
        time: timeAgo(now),
        read: false,
        icon: 'notifications-outline',
        color: '#2563EB',
      });
    }

    setNotifications(items);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = (id: string) => {
    hapticLight();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    hapticSelection();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationPress = (item: NotificationItem) => {
    markAsRead(item.id);
    switch (item.type) {
      case 'insight':
      case 'weekly':
        router.push('/(protected)/insights');
        break;
      case 'streak':
      case 'reminder':
        router.push('/(protected)/new-entry');
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
          Notifications
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text className="text-sm font-medium text-blue-600">
              Read All
            </Text>
          </Pressable>
        ) : (
          <View className="w-16" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        {/* OS Permission Warning */}
        {osPermissionGranted === false && (dailyReminder || streakAlerts || weeklyReports) && (
          <Pressable
            className="mx-5 mt-4 bg-red-50 dark:bg-red-900/20 rounded-xl p-3.5 flex-row items-center border border-red-100 dark:border-red-800 active:opacity-80"
            onPress={() => Linking.openSettings()}
          >
            <View className="bg-red-100 dark:bg-red-800 w-9 h-9 rounded-lg items-center justify-center mr-3">
              <Ionicons name="warning-outline" size={18} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-red-800 dark:text-red-200">
                Notifications Blocked by System
              </Text>
              <Text className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                Tap to open Settings and allow notifications
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#EF4444" />
          </Pressable>
        )}

        {/* Notification Preferences */}
        <View className="px-5 pt-5 pb-3">
          <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Preferences
          </Text>
          <View className="bg-surface rounded-xl overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color="#2563EB"
                />
                <View className="ml-3">
                  <Text className="text-sm font-medium text-text-primary">
                    Daily Reminder
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Remind to journal each day
                  </Text>
                </View>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={(val) => updatePref('dailyReminder', val)}
                trackColor={{ true: '#2563EB' }}
              />
            </View>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="flame-outline"
                  size={20}
                  color="#F59E0B"
                />
                <View className="ml-3">
                  <Text className="text-sm font-medium text-text-primary">
                    Streak Alerts
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Warn before streak breaks
                  </Text>
                </View>
              </View>
              <Switch
                value={streakAlerts}
                onValueChange={(val) => updatePref('streakAlerts', val)}
                trackColor={{ true: '#F59E0B' }}
              />
            </View>
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#10B981"
                />
                <View className="ml-3">
                  <Text className="text-sm font-medium text-text-primary">
                    Weekly Reports
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Summary of your week
                  </Text>
                </View>
              </View>
              <Switch
                value={weeklyReports}
                onValueChange={(val) => updatePref('weeklyReports', val)}
                trackColor={{ true: '#10B981' }}
              />
            </View>
          </View>
        </View>

        {/* Notifications List */}
        <View className="px-5 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recent
            </Text>
            {unreadCount > 0 && (
              <View className="bg-blue-100 dark:bg-blue-900/40 rounded-full px-2 py-0.5">
                <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {unreadCount} new
                </Text>
              </View>
            )}
          </View>

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-sm text-text-muted mt-3">Loading...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={isDark ? '#475569' : '#D1D5DB'}
              />
              <Text className="text-base font-medium text-text-muted mt-3">
                No notifications
              </Text>
              <Text className="text-sm text-text-muted mt-1">
                You're all caught up!
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleNotificationPress(item)}
                className={`rounded-xl p-4 mb-2 flex-row active:scale-[0.98] ${
                  item.read
                    ? 'bg-surface-elevated border border-border'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                }`}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.color}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm ${
                        item.read
                          ? 'font-medium text-text-primary'
                          : 'font-bold text-text-primary'
                      }`}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-text-muted">{item.time}</Text>
                  </View>
                  <Text
                    className="text-xs text-text-secondary mt-1"
                    numberOfLines={2}
                  >
                    {item.message}
                  </Text>
                </View>
                {!item.read && (
                  <View className="w-2 h-2 rounded-full bg-blue-600 ml-2 mt-1" />
                )}
              </Pressable>
            ))
          )}
        </View>

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
