import React, { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
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
import * as AppleAuthentication from 'expo-apple-authentication';
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
import { scheduleSmartReminder, cancelSmartReminder } from '../../lib/smartReminders';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const { isSubscribed, handleRestore } = useSubscription();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const { requirePro } = useProGate();

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smartRemindersEnabled, setSmartRemindersEnabled] = useState(false);
  const [smartRemindersLoading, setSmartRemindersLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

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
          if (s.smartRemindersEnabled !== undefined) setSmartRemindersEnabled(s.smartRemindersEnabled);
        }
      } catch (err) { Sentry.captureException(err); }
    };
    init();
  }, []);

  const persistSetting = async (key: string, value: boolean) => {
    try {
      const stored = await AsyncStorage.getItem('@daiyly_settings');
      const s = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem('@daiyly_settings', JSON.stringify({ ...s, [key]: value }));
    } catch (err) { Sentry.captureException(err); }
  };

  const handleSmartRemindersToggle = async (enabled: boolean) => {
    hapticSelection();
    setSmartRemindersEnabled(enabled);
    await persistSetting('smartRemindersEnabled', enabled);

    if (enabled) {
      setSmartRemindersLoading(true);
      try {
        // Fetch recent entries to determine the best reminder time
        let entries: Array<{ created_at: string }> = [];
        try {
          const response = await api.get('/journals', { params: { limit: 50, offset: 0 } });
          entries = response.data?.entries || response.data?.data || [];
        } catch {
          // Could not fetch — scheduleSmartReminder will use the default hour
        }
        await scheduleSmartReminder(entries);
        hapticSuccess();
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        setSmartRemindersLoading(false);
      }
    } else {
      await cancelSmartReminder();
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
    } catch (err: any) {
      Sentry.captureException(err);
      Alert.alert(
        t('common.error'),
        err.response?.data?.message || t('settings.deleteAccountFailed')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Apple users: re-authenticate with Apple to get fresh authorizationCode for token revocation
  const handleAppleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.authorizationCode) {
        throw new Error('No authorization code received from Apple');
      }
      await deleteAccount(undefined, credential.authorizationCode);
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled Apple re-auth — do nothing
      } else {
        Sentry.captureException(err);
        Alert.alert(
          t('common.error'),
          err.response?.data?.message || err.message || t('settings.deleteAccountFailed')
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const showDeletePasswordModal = () => setShowDeleteModal(true);

  // Apple users skip password modal — re-auth with Apple instead
  const proceedWithDeletion = () => {
    if (user?.is_apple_user) {
      handleAppleDeleteAccount();
    } else {
      showDeletePasswordModal();
    }
  };

  const confirmDelete = () => {
    hapticWarning();
    Alert.alert(
      t('settings.deleteAccountTitle'),
      t('settings.deleteAccountBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (isSubscribed) {
              Alert.alert(
                t('settings.activeSubscriptionTitle'),
                t('settings.activeSubscriptionBody'),
                [
                  {
                    text: t('settings.manageSubscription'),
                    onPress: () => {
                      Platform.OS === 'ios'
                        ? Linking.openURL('https://apps.apple.com/account/subscriptions')
                        : Linking.openURL('https://play.google.com/store/account/subscriptions');
                    },
                  },
                  {
                    text: t('settings.continueDeletion'),
                    style: 'destructive',
                    onPress: proceedWithDeletion,
                  },
                  { text: t('common.cancel'), style: 'cancel' },
                ]
              );
            } else {
              proceedWithDeletion();
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
        Alert.alert(t('settings.restoredSuccess'), t('settings.restoredSuccessBody'));
      } else {
        Alert.alert(
          t('settings.noPurchasesFound'),
          t('settings.noPurchasesBody')
        );
      }
    } catch (e) {
      Sentry.captureException(e);
      Alert.alert(t('common.error'), t('settings.restoreFailed'));
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
        } catch (err) {
          Sentry.captureException(err);
          // Partial failure — export what we have so far
          fetchFailed = true;
          hasMore = false;
        }
      }

      if (allEntries.length === 0) {
        Alert.alert(t('settings.noData'), fetchFailed
          ? t('settings.failedFetchEntries')
          : t('settings.noEntriesToExport'));
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
          Alert.alert(t('settings.partialExport'), `Exported ${allEntries.length} entries. Some entries could not be fetched due to a network error.`);
        }
        hapticSuccess();
      } else {
        Alert.alert(t('common.error'), t('settings.sharingNotAvailable'));
        hapticError();
      }
    } catch (err: any) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(
        t('settings.exportFailed'),
        err?.response?.data?.message || t('settings.exportFailed')
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    hapticMedium();
    setIsExportingCSV(true);
    try {
      // Fetch all entries (paginate)
      let allEntries: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let fetchFailed = false;

      while (hasMore) {
        try {
          const response = await api.get('/journals', { params: { limit, offset } });
          const data = response.data;
          const entries = data.entries || data.data || [];
          allEntries = [...allEntries, ...entries];
          offset += limit;
          hasMore = entries.length === limit;
        } catch (err) {
          Sentry.captureException(err);
          fetchFailed = true;
          hasMore = false;
        }
      }

      if (allEntries.length === 0) {
        Alert.alert(t('settings.noData'), fetchFailed
          ? t('settings.failedFetchEntries')
          : t('settings.noEntriesToExport'));
        return;
      }

      // Build CSV
      const headers = ['date', 'mood_emoji', 'mood_score', 'content', 'tags', 'card_color'];
      const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = allEntries.map((e: any) => [
        escape(e.entry_date || e.created_at?.split('T')[0] || ''),
        escape(e.mood_emoji || ''),
        escape(String(e.mood_score ?? '')),
        escape(e.content || ''),
        escape((e.tags || []).join(', ')),
        escape(e.card_color || ''),
      ].join(','));
      const csvString = [headers.join(','), ...rows].join('\n');

      const fileName = `daiyly-export-${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File(Paths.cache, fileName);
      file.create();
      file.write(csvString);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Journal as CSV',
          UTI: 'public.comma-separated-values-text',
        });
        hapticSuccess();
        if (fetchFailed) {
          Alert.alert(t('settings.partialExport'), `Exported ${allEntries.length} entries. Some entries could not be fetched.`);
        }
      } else {
        Alert.alert(t('common.error'), t('settings.sharingNotAvailable'));
        hapticError();
      }
    } catch (err: any) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(t('settings.exportFailed'), err?.response?.data?.message || t('settings.exportFailed'));
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleLogout = () => {
    hapticLight();
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
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
    { value: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-2 bg-background border-b border-border">
          <Text className="text-2xl font-bold text-text-primary">{t('settings.title')}</Text>
        </View>

        <View className="px-5">
          {/* Profile Section */}
          <SectionHeader title={t('settings.profile')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <View className="p-4 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
                <Ionicons name="person" size={22} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  {isGuest
                    ? t('settings.guestUser')
                    : user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text className="text-xs text-text-secondary mt-0.5">
                  {isGuest ? t('settings.noAccount') : user?.email}
                </Text>
              </View>
              {isSubscribed && (
                <View className="bg-amber-50 dark:bg-amber-900/30 rounded-full px-2.5 py-1 border border-amber-200 dark:border-amber-700">
                  <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    {t('common.pro')}
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
                  {t('settings.createAccount')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Appearance */}
          <SectionHeader title={t('settings.appearance')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <View className="p-4">
              <View className="flex-row items-center mb-3">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.15)' }}
                >
                  <Ionicons name="color-palette-outline" size={18} color="#8B5CF6" />
                </View>
                <Text className="text-sm font-medium text-text-primary">{t('settings.theme')}</Text>
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
          <SectionHeader title={t('settings.notifications')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="notifications-outline"
              iconColor="#2563EB"
              label={t('settings.pushNotifications')}
              subtitle={t('settings.pushNotificationsSubtitle')}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(val) => {
                    hapticSelection();
                    if (val) {
                      Alert.alert(
                        t('settings.comingSoonAlert'),
                        t('settings.comingSoonAlertBody')
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
              icon="bulb-outline"
              iconColor="#F59E0B"
              label={t('settings.smartReminders')}
              subtitle={
                smartRemindersEnabled
                  ? t('settings.smartRemindersOn')
                  : t('settings.smartRemindersOff')
              }
              rightElement={
                smartRemindersLoading ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Switch
                    value={smartRemindersEnabled}
                    onValueChange={handleSmartRemindersToggle}
                    trackColor={{ true: '#F59E0B' }}
                  />
                )
              }
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="time-outline"
              iconColor="#8B5CF6"
              label={t('settings.notificationCenter')}
              subtitle={t('settings.notificationCenterSubtitle')}
              onPress={() => {
                hapticLight();
                router.push('/(protected)/notification-center');
              }}
            />
          </View>

          {/* Security */}
          <SectionHeader title={t('settings.security')} />
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
              label={t('settings.signOut')}
              onPress={handleLogout}
            />
          </View>

          {/* Subscription */}
          <SectionHeader title={t('settings.subscription')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            {!isSubscribed && (
              <>
                <SettingsRow
                  icon="diamond-outline"
                  iconColor="#F59E0B"
                  label={t('settings.upgradeToPremium')}
                  subtitle={t('settings.upgradeToPremiumSubtitle')}
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
              label={isRestoring ? t('settings.restoring') : t('settings.restorePurchases')}
              onPress={isRestoring ? undefined : handleRestorePurchases}
            />
          </View>

          {/* Year in Review */}
          <SectionHeader title={t('settings.yearInReview')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="calendar-outline"
              iconColor="#F59E0B"
              label={t('yearReview.title', { year: new Date().getFullYear() - 1 })}
              subtitle={t('settings.yearInReviewSubtitle')}
              onPress={() => {
                hapticLight();
                requirePro('Year in Review', () => {
                  router.push('/(protected)/year-in-review');
                });
              }}
            />
          </View>

          {/* Data & Sharing */}
          <SectionHeader title={t('settings.dataSharing')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="share-social-outline"
              iconColor="#8B5CF6"
              label={t('settings.shareMoodCards')}
              subtitle={isSubscribed ? t('settings.shareMoodCardsSubtitle') : t('settings.premiumFeature')}
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
              label={isExporting ? t('settings.exporting') : t('settings.exportData')}
              subtitle={isSubscribed ? t('settings.exportDataSubtitle') : t('settings.premiumFeature')}
              onPress={() => {
                hapticLight();
                requirePro('Data Export', () => {
                  if (!isExporting) handleExportData();
                });
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#10B981"
              label={isExportingCSV ? t('settings.exporting') : t('settings.exportCSV')}
              subtitle={isSubscribed ? t('settings.exportCSVSubtitle') : t('settings.premiumFeature')}
              onPress={() => {
                hapticLight();
                requirePro('CSV Export', () => {
                  if (!isExportingCSV) handleExportCSV();
                });
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="medical-outline"
              iconColor="#2563EB"
              label={t('settings.therapistReport')}
              subtitle={t('settings.therapistReportSubtitle')}
              onPress={() => {
                hapticLight();
                requirePro('Therapist Report', () => {
                  router.push('/(protected)/therapist-report');
                });
              }}
            />
          </View>

          {/* About */}
          <SectionHeader title={t('settings.about')} />
          <View className="bg-surface-elevated rounded-xl overflow-hidden border border-border">
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#6B7280"
              label={t('settings.privacyPolicy')}
              onPress={() => {
                hapticLight();
                Linking.openURL('https://vexellabspro.com/daiyly/privacy');
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#6B7280"
              label={t('settings.termsOfService')}
              onPress={() => {
                hapticLight();
                Linking.openURL('https://vexellabspro.com/daiyly/terms');
              }}
            />
            <View className="h-px bg-border ml-16" />
            <SettingsRow
              icon="information-circle-outline"
              iconColor="#6B7280"
              label={t('settings.version')}
              subtitle="1.0.0"
            />
          </View>

          {/* Danger Zone */}
          {!isGuest && (
            <>
              <SectionHeader title={t('settings.dangerZone')} />
              <View className="bg-surface-elevated rounded-xl overflow-hidden border border-red-100 dark:border-red-900">
                <SettingsRow
                  icon="trash-outline"
                  iconColor="#EF4444"
                  label={t('settings.deleteAccount')}
                  subtitle={t('settings.permanentlyRemoveData')}
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
        title={t('settings.confirmDeletion')}
      >
        <Text className="mb-4 text-sm text-text-secondary">
          {t('settings.enterPasswordConfirm')}
        </Text>
        <View className="mb-4">
          <Input
            placeholder={t('settings.yourPassword')}
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
          />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title={t('common.cancel')}
              variant="outline"
              onPress={() => setShowDeleteModal(false)}
            />
          </View>
          <View className="flex-1">
            <Button
              title={t('common.delete')}
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
