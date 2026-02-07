import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  isBiometricAvailable,
  getBiometricType,
  authenticateWithBiometrics,
} from '../../lib/biometrics';
import {
  hapticWarning,
  hapticSelection,
  hapticSuccess,
  hapticError,
} from '../../lib/haptics';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

const BIOMETRIC_PREF_KEY = 'biometric_enabled';

export default function SettingsScreen() {
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const { isSubscribed, handleRestore } = useSubscription();
  const router = useRouter();

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSettings = useCallback(async () => {
    const available = await isBiometricAvailable();
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
      const pref = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
      setBiometricEnabled(pref === 'true');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSettings();
    setIsRefreshing(false);
  }, [loadSettings]);

  const handleBiometricToggle = async (value: boolean) => {
    hapticSelection();
    if (value) {
      const success = await authenticateWithBiometrics('Enable biometric lock');
      if (success) {
        setBiometricEnabled(true);
        await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'true');
      }
    } else {
      setBiometricEnabled(false);
      await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'false');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
      hapticSuccess();
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      hapticError();
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete account';
      Alert.alert('Error', message);
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
    hapticSelection();
    try {
      const success = await handleRestore();
      if (success) {
        hapticSuccess();
        Alert.alert('Success', 'Purchases restored successfully!');
      } else {
        Alert.alert('Not Found', 'No previous purchases found.');
      }
    } catch {
      hapticError();
      Alert.alert('Error', 'Failed to restore purchases.');
    }
  };

  const handleLogout = async () => {
    hapticWarning();
    await logout();
    router.replace('/(auth)/login');
  };

  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          <Text className="text-3xl font-bold text-gray-900 px-4 pt-4">Settings</Text>

          <View className="bg-white rounded-2xl mx-4 mt-6 p-6 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            <Text className="text-lg font-semibold text-gray-900 mb-2">Create an Account</Text>
            <Text className="text-sm text-gray-500 text-center mb-4">
              Sign up to save your journal entries and unlock unlimited features.
            </Text>
            <Pressable
              className="rounded-xl bg-blue-600 px-8 py-3"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="text-base font-semibold text-white">Sign Up Free</Text>
            </Pressable>
          </View>

          <View className="bg-white rounded-2xl mx-4 mt-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            <Pressable className="p-4" onPress={handleRestorePurchases}>
              <Text className="text-base font-medium text-blue-600">Restore Purchases</Text>
            </Pressable>
          </View>

          <View className="bg-white rounded-2xl mx-4 mt-4 p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            <Text className="text-sm text-gray-500">App Version</Text>
            <Text className="text-base font-medium text-gray-900 mt-1">1.0.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const emailInitial = user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-3xl font-bold text-gray-900 px-4 pt-4">Settings</Text>

        {/* Profile Section */}
        <View className="bg-white rounded-2xl mx-4 mt-4 p-4 flex-row items-center" style={{ gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-2xl font-bold text-blue-600">{emailInitial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900">{user?.email}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Member</Text>
          </View>
        </View>

        {/* Subscription Section */}
        <View className="bg-white rounded-2xl mx-4 mt-4 p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text className="text-lg font-bold text-gray-900">Subscription</Text>
          {isSubscribed ? (
            <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
              <View className="bg-green-100 rounded-full px-3 py-1">
                <Text className="text-sm font-medium text-green-700">Premium Active</Text>
              </View>
            </View>
          ) : (
            <View className="mt-2">
              <Text className="text-sm text-gray-500">Free Plan</Text>
              <Pressable
                className="bg-blue-600 rounded-xl py-3 mt-3 items-center"
                onPress={() => router.push('/(protected)/paywall')}
              >
                <Text className="text-white font-semibold">Upgrade to Premium</Text>
              </Pressable>
            </View>
          )}
          <Pressable className="mt-3" onPress={handleRestorePurchases}>
            <Text className="text-sm text-blue-600 font-medium">Restore Purchases</Text>
          </Pressable>
        </View>

        {/* Security Section */}
        <View className="bg-white rounded-2xl mx-4 mt-4 p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text className="text-lg font-bold text-gray-900 mb-2">Security</Text>
          {biometricType && (
            <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
              <View>
                <Text className="text-base font-medium text-gray-900">{biometricType}</Text>
                <Text className="text-sm text-gray-500">
                  Use {biometricType} to unlock
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ true: '#2563eb', false: '#d1d5db' }}
              />
            </View>
          )}
          <Pressable className="py-3" onPress={handleLogout}>
            <Text className="text-base font-medium text-gray-900">Sign Out</Text>
          </Pressable>
        </View>

        {/* About Section */}
        <View className="bg-white rounded-2xl mx-4 mt-4 p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text className="text-lg font-bold text-gray-900 mb-2">About</Text>
          <View className="py-2 border-b border-gray-100">
            <Text className="text-sm text-gray-500">App Version</Text>
            <Text className="text-base font-medium text-gray-900">1.0.0</Text>
          </View>
          <Pressable
            className="py-2 border-b border-gray-100"
            onPress={() => Linking.openURL('https://daiyly.app/privacy')}
          >
            <Text className="text-base font-medium text-blue-600">Privacy Policy</Text>
          </Pressable>
          <Pressable
            className="py-2"
            onPress={() => Linking.openURL('https://daiyly.app/terms')}
          >
            <Text className="text-base font-medium text-blue-600">Terms of Service</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View className="bg-white rounded-2xl mx-4 mt-4 mb-8 p-4 border border-red-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text className="text-lg font-bold text-red-600 mb-2">Danger Zone</Text>
          <Pressable className="py-2" onPress={confirmDelete}>
            <Text className="text-base font-medium text-red-500">Delete Account</Text>
            <Text className="text-sm text-red-400 mt-0.5">
              Permanently remove all your data
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
      >
        <Text className="mb-4 text-sm text-gray-500">
          Enter your password to confirm account deletion. This cannot be undone.
        </Text>
        <View className="mb-4">
          <Input
            placeholder="Your password"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
          />
        </View>
        <View className="flex-row" style={{ gap: 12 }}>
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
