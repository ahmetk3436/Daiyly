import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBiometricAvailable, getBiometricType } from '../../lib/biometrics';
import {
  hapticWarning,
  hapticMedium,
  hapticLight,
  hapticSelection,
} from '../../lib/haptics';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function SettingsScreen() {
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const { isSubscribed, handleRestore } = useSubscription();

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
          onPress: () => setShowDeleteModal(true),
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
    <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 mt-6 px-1">
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
      className="flex-row items-center p-4 active:bg-gray-50"
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
            destructive ? 'text-red-600' : 'text-gray-900'
          }`}
        >
          {label}
        </Text>
        {subtitle && (
          <Text
            className={`text-xs mt-0.5 ${
              destructive ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement || (
        onPress && (
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        )
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-2 bg-white border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">Settings</Text>
        </View>

        <View className="px-5">
          {/* Profile Section */}
          <SectionHeader title="Profile" />
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
            <View className="p-4 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
                <Ionicons name="person" size={22} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {isGuest
                    ? 'Guest User'
                    : user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {isGuest ? 'No account' : user?.email}
                </Text>
              </View>
              {isSubscribed && (
                <View className="bg-amber-50 rounded-full px-2.5 py-1 border border-amber-200">
                  <Text className="text-xs font-bold text-amber-700">
                    PRO
                  </Text>
                </View>
              )}
            </View>

            {isGuest && (
              <Pressable
                className="p-4 border-t border-gray-100 flex-row items-center"
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

          {/* Notifications */}
          <SectionHeader title="Notifications" />
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
            <SettingsRow
              icon="notifications-outline"
              iconColor="#2563EB"
              label="Push Notifications"
              subtitle="Daily reminders and insights"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(val) => {
                    hapticSelection();
                    setNotificationsEnabled(val);
                    persistSetting('notificationsEnabled', val);
                  }}
                  trackColor={{ true: '#2563EB' }}
                />
              }
            />
            <View className="h-px bg-gray-100 ml-16" />
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
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
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
                <View className="h-px bg-gray-100 ml-16" />
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
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
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
                <View className="h-px bg-gray-100 ml-16" />
              </>
            )}
            <SettingsRow
              icon="refresh-outline"
              iconColor="#2563EB"
              label={isRestoring ? 'Restoring...' : 'Restore Purchases'}
              onPress={isRestoring ? undefined : handleRestorePurchases}
            />
          </View>

          {/* About */}
          <SectionHeader title="About" />
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#6B7280"
              label="Privacy Policy"
              onPress={() => {
                hapticLight();
                Linking.openURL('https://daiyly.app/privacy');
              }}
            />
            <View className="h-px bg-gray-100 ml-16" />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#6B7280"
              label="Terms of Service"
              onPress={() => {
                hapticLight();
                Linking.openURL('https://daiyly.app/terms');
              }}
            />
            <View className="h-px bg-gray-100 ml-16" />
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
              <View className="bg-white rounded-xl overflow-hidden border border-red-100">
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
        <Text className="mb-4 text-sm text-gray-600">
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
