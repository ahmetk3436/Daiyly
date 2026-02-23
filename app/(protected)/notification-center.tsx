import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, hapticSelection } from '../../lib/haptics';

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

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'reminder',
    title: 'Daily Reminder',
    message: "How are you feeling today? Take a moment to journal.",
    time: '2h ago',
    read: false,
    icon: 'notifications-outline',
    color: '#2563EB',
  },
  {
    id: '2',
    type: 'insight',
    title: 'Weekly Insight Ready',
    message: 'Your mood has been improving this week! Check your insights.',
    time: '1d ago',
    read: false,
    icon: 'analytics-outline',
    color: '#8B5CF6',
  },
  {
    id: '3',
    type: 'streak',
    title: 'Streak Alert',
    message: "Don't break your 7-day streak! Journal today to keep going.",
    time: '5h ago',
    read: true,
    icon: 'flame-outline',
    color: '#F59E0B',
  },
  {
    id: '4',
    type: 'weekly',
    title: 'Weekly Report',
    message: 'Your February week 3 report is ready. You wrote 5 entries with an average mood of 72.',
    time: '3d ago',
    read: true,
    icon: 'document-text-outline',
    color: '#10B981',
  },
];

export default function NotificationCenterScreen() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
        {/* Notification Preferences */}
        <View className="px-5 pt-5 pb-3">
          <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Preferences
          </Text>
          <View className="bg-gray-50 rounded-xl overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color="#2563EB"
                />
                <View className="ml-3">
                  <Text className="text-sm font-medium text-gray-900">
                    Daily Reminder
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Remind to journal each day
                  </Text>
                </View>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={(val) => {
                  hapticSelection();
                  setDailyReminder(val);
                }}
                trackColor={{ true: '#2563EB' }}
              />
            </View>
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="flame-outline"
                  size={20}
                  color="#F59E0B"
                />
                <View className="ml-3">
                  <Text className="text-sm font-medium text-gray-900">
                    Streak Alerts
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Warn before streak breaks
                  </Text>
                </View>
              </View>
              <Switch
                value={streakAlerts}
                onValueChange={(val) => {
                  hapticSelection();
                  setStreakAlerts(val);
                }}
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
                  <Text className="text-sm font-medium text-gray-900">
                    Weekly Reports
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Summary of your week
                  </Text>
                </View>
              </View>
              <Switch
                value={weeklyReports}
                onValueChange={(val) => {
                  hapticSelection();
                  setWeeklyReports(val);
                }}
                trackColor={{ true: '#10B981' }}
              />
            </View>
          </View>
        </View>

        {/* Notifications List */}
        <View className="px-5 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Recent
            </Text>
            {unreadCount > 0 && (
              <View className="bg-blue-100 rounded-full px-2 py-0.5">
                <Text className="text-xs font-bold text-blue-600">
                  {unreadCount} new
                </Text>
              </View>
            )}
          </View>

          {notifications.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color="#D1D5DB"
              />
              <Text className="text-base font-medium text-gray-400 mt-3">
                No notifications
              </Text>
              <Text className="text-sm text-gray-400 mt-1">
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
                    ? 'bg-white border border-gray-100'
                    : 'bg-blue-50 border border-blue-100'
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
                          ? 'font-medium text-gray-700'
                          : 'font-bold text-gray-900'
                      }`}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-400">{item.time}</Text>
                  </View>
                  <Text
                    className="text-xs text-gray-500 mt-1"
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
