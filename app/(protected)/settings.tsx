import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';
import { useProGate } from '../../lib/useProGate';
import api from '../../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBiometricAvailable, getBiometricType } from '../../lib/biometrics';
import {
  hapticWarning,
  hapticMedium,
  hapticLight,
  hapticSelection,
  hapticSuccess,
  hapticError,
} from '../../lib/haptics';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function SettingsScreen() {
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const { isSubscribed, handleRestore } = useSubscription();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const { requirePro } = useProGate();

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const available = await isBiometricAvailable();
      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
      // Load persisted settings
      try {
        const stored = await AsyncStorage.getItem('@daiyly_settings');
        if (stored) {
          const s = JSON.parse(stored);
          if (s.notificationsEnabled !== undefined) setNotificationsEnabled(s.notificationsEnabled);
          if (s.biometricEnabled !== undefined) setBiometricEnabled(s.biometricEnabled);
        }
      } catch {}
    };
    init();
  }, []);

  const persistSetting = async (key: string, value: boolean) => {
    try {
      const stored = await AsyncStorage.getItem('@daiyly_settings');
      const s = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem('@daiyly_settings', JSON.stringify({ ...s, [key]: value }));
    } catch {}
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Failed to delete account'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const showDeletePasswordModal = () => setShowDeleteModal(true);

  const confirmDelete = () => {
    hapticWarning();
    Alert.alert(
      'Delete Account',
      'This action is permanent. All your data will be erased and cannot be recovered. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (isSubscribed) {
              Alert.alert(
                'Active Subscription',
                'Deleting your account will NOT cancel your subscription. You must cancel it separately to avoid being charged.',
                [
                  {
                    text: 'Manage Subscription',
                    onPress: () => {
                      Platform.OS === 'ios'
                        ? Linking.openURL('https://apps.apple.com/account/subscriptions')
                        : Linking.openURL('https://play.google.com/store/account/subscriptions');
                    },
                  },
                  {
                    text: 'Continue Deletion',
                    style: 'destructive',
                    onPress: showDeletePasswordModal,
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            } else {
              showDeletePasswordModal();
            }
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    hapticMedium();
    setIsRestoring(true);
    try {
      const success = await handleRestore();
      if (success) {
        Alert.alert('Restored', 'Your purchases have been restored.');
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any previous purchases.'
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportData = async () => {
    hapticMedium();
    setIsExporting(true);
    try {
      // Fetch all journal entries (paginate until done)
      let allEntries: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let fetchFailed = false;

      while (hasMore) {
        try {
          const response = await api.get('/journals', {
            params: { limit, offset },
          });
          const data = response.data;
          const entries = data.entries || data.data || [];
          allEntries = [...allEntries, ...entries];
          offset += limit;
          hasMore = entries.length === limit;
        } catch {
          // Partial failure — export what we have so far
          fetchFailed = true;
          hasMore = false;
        }
      }

      if (allEntries.length === 0) {
        Alert.alert('No Data', fetchFailed
          ? 'Failed to fetch entries. Please check your connection and try again.'
          : 'You have no journal entries to export.');
        return;
      }

      // Format as JSON
      const exportData = {
        exported_at: new Date().toISOString(),
        total_entries: allEntries.length,
        partial: fetchFailed,
        entries: allEntries,
      };
      const jsonString = JSON.stringify(exportData, null, 2);

      // Write to temp file using new expo-file-system API
      const fileName = `daiyly-export-${new Date().toISOString().split('T')[0]}.json`;
      const file = new File(Paths.cache, fileName);
      file.create();
      file.write(jsonString);

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Journal Data',
          UTI: 'public.json',
        });
        if (fetchFailed) {
          Alert.alert(
            'Partial Export',
            `Exported ${allEntries.length} entries. Some entries could not be fetched due to a network error.`
          );
        }
        hapticSuccess();
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
        hapticError();
      }
    } catch (err: any) {
      hapticError();
      Alert.alert(
        'Export Failed',
        err?.response?.data?.message || 'Failed to export data. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = () => {
    hapticLight();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 mt-6 px-1">
      {title}
    </Text>
  );

  const SettingsRow = ({
    icon,
    iconColor,
    label,
    subtitle,
    onPress,
    rightElement,
    destructive,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
  }) => (
    <Pressable
      className="flex-row items-center p-4 active:bg-surface-muted"
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View
        className="w-9 h-9 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: `${iconColor}15` }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${
            destructive ? 'text-red-600' : 'text-text-primary'
          }`}
        >
          {label}
        </Text>
        {subtitle && (
          <Text
            className={`text-xs mt-0.5 ${
              destructive ? 'text-red-400' : 'text-text-secondary'
            }`}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement || (
        onPress && (
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#475569' : '#D1D5DB'} />
        )
      )}
    </Pressable>
  );

  const THEME_OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-2 bg-background border-b border-border">
          <Text className="text-2xl font-bold text-text-primary">Settings</Text>
        </View>

        <View className="px-5">
          {/* Profile Section */}
          <SectionHeader title="Profile" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <View className="p-4 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
                <Ionicons name="person" size={22} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  {isGuest
                    ? 'Guest User'
                    : user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text className="text-xs text-text-secondary mt-0.5">
                  {isGuest ? 'No account' : user?.email}
                </Text>
              </View>
              {isSubscribed && (
                <View className="bg-amber-50 dark:bg-amber-900/30 rounded-full px-2.5 py-1 border border-amber-200 dark:border-amber-700">
                  <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    PRO
                  </Text>
                </View>
              )}
            </View>

            {isGuest && (
              <Pressable
                className="p-4 border-t border-border flex-row items-center"
                onPress={() => {
                  hapticLight();
                  router.push('/(auth)/register');
                }}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color="#2563EB"
                />
                <Text className="text-sm font-medium text-blue-600 ml-2">
                  Create Account
                </Text>
              </Pressable>
            )}
          </View>

          {/* Appearance */}
          <SectionHeader title="Appearance" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <View className="p-4">
              <View className="flex-row items-center mb-3">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.15)' }}
                >
                  <Ionicons name="color-palette-outline" size={18} color="#8B5CF6" />
                </View>
                <Text className="text-sm font-medium text-text-primary">Theme</Text>
              </View>
              <View className="flex-row rounded-xl bg-surface-muted p-1" style={{ gap: 4 }}>
                {THEME_OPTIONS.map((option) => {
                  const isActive = themeMode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
                        isActive
                          ? 'bg-background'
                          : ''
                      }`}
                      style={isActive ? {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isDark ? 0.3 : 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      } : undefined}
                      onPress={() => {
                        hapticSelection();
                        setThemeMode(option.value);
                      }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={isActive ? (isDark ? '#F1F5F9' : '#111827') : (isDark ? '#64748B' : '#9CA3AF')}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        className={`text-xs font-medium ${
                          isActive
                            ? 'text-text-primary'
                            : 'text-text-muted'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Notifications */}
          <SectionHeader title="Notifications" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="notifications-outline"
              iconColor="#2563EB"
              label="Push Notifications"
              subtitle="Coming soon in a future update"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(val) => {
                    hapticSelection();
                    if (val) {
                      Alert.alert(
                        'Coming Soon',
                        'Push notifications will be available in a future update.'
                      );
                      return;
                    }
                    setNotificationsEnabled(false);
                    persistSetting('notificationsEnabled', false);
                  }}
                  trackColor={{ true: '#2563EB' }}
                />
              }
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="time-outline"
              iconColor="#8B5CF6"
              label="Notification Center"
              subtitle="View reminders and reports"
              onPress={() => {
                hapticLight();
                router.push('/(protected)/notification-center');
              }}
            />
          </View>

          {/* Security */}
          <SectionHeader title="Security" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            {biometricType && (
              <>
                <SettingsRow
                  icon="finger-print"
                  iconColor="#10B981"
                  label={biometricType}
                  subtitle={`Use ${biometricType} to unlock the app`}
                  rightElement={
                    <Switch
                      value={biometricEnabled}
                      onValueChange={(val) => {
                        hapticSelection();
                        setBiometricEnabled(val);
                        persistSetting('biometricEnabled', val);
                      }}
                      trackColor={{ true: '#10B981' }}
                    />
                  }
                />
                <View className="h-px bg-border ml-16" />
              </>
            )}
            <SettingsRow
              icon="log-out-outline"
              iconColor="#6B7280"
              label="Sign Out"
              onPress={handleLogout}
            />
          </View>

          {/* Subscription */}
          <SectionHeader title="Subscription" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            {!isSubscribed && (
              <>
                <SettingsRow
                  icon="diamond-outline"
                  iconColor="#F59E0B"
                  label="Upgrade to Premium"
                  subtitle="$4.99/mo or $29.99/yr"
                  onPress={() => {
                    hapticLight();
                    router.push('/(protected)/paywall?source=settings');
                  }}
                />
                <View className="h-px bg-border ml-16" />
              </>
            )}
            <SettingsRow
              icon="refresh-outline"
              iconColor="#2563EB"
              label={isRestoring ? 'Restoring...' : 'Restore Purchases'}
              onPress={isRestoring ? undefined : handleRestorePurchases}
            />
          </View>

          {/* Data & Sharing */}
          <SectionHeader title="Data & Sharing" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="share-social-outline"
              iconColor="#8B5CF6"
              label="Share Mood Cards"
              subtitle={isSubscribed ? 'Create beautiful share cards' : 'Premium feature'}
              onPress={() => {
                hapticLight();
                requirePro('Shareable Mood Cards', () => {
                  router.push('/(protected)/sharing');
                });
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="download-outline"
              iconColor="#10B981"
              label={isExporting ? 'Exporting...' : 'Export Data'}
              subtitle={isSubscribed ? 'Export as JSON' : 'Premium feature'}
              onPress={() => {
                hapticLight();
                requirePro('Data Export', () => {
                  if (!isExporting) handleExportData();
                });
              }}
            />
          </View>

          {/* About */}
          <SectionHeader title="About" />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#6B7280"
              label="Privacy Policy"
              onPress={() => {
                hapticLight();
                Linking.openURL('https://vexellabspro.com/daiyly/privacy');
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#6B7280"
              label="Terms of Service"
              onPress={() => {
                hapticLight();
                Linking.openURL('https://vexellabspro.com/daiyly/terms');
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="information-circle-outline"
              iconColor="#6B7280"
              label="Version"
              subtitle="1.0.0"
            />
          </View>

          {/* Danger Zone */}
          {!isGuest && (
            <>
              <SectionHeader title="Danger Zone" />
              <View className="bg-surface-elevated rounded-xl overflow-hidden border border-red-100 dark:border-red-900">
                <SettingsRow
                  icon="trash-outline"
                  iconColor="#EF4444"
                  label="Delete Account"
                  subtitle="Permanently remove all your data"
                  onPress={confirmDelete}
                  destructive
                />
              </View>
            </>
          )}

          {/* Bottom Spacing */}
          <View className="h-32" />
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
      >
        <Text className="mb-4 text-sm text-text-secondary">
          Enter your password to confirm account deletion. This cannot be
          undone.
        </Text>
        <View className="mb-4">
          <Input
            placeholder="Your password"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
          />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowDeleteModal(false)}
            />
          </View>
          <View className="flex-1">
            <Button
              title="Delete"
              variant="destructive"
              onPress={handleDeleteAccount}
              isLoading={isDeleting}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
