import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { isBiometricAvailable, getBiometricType } from '../../lib/biometrics';
import { hapticWarning, hapticMedium } from '../../lib/haptics';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function SettingsScreen() {
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const router = useRouter();
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      const available = await isBiometricAvailable();
      if (available) { const type = await getBiometricType(); setBiometricType(type); }
    };
    checkBiometrics();
  }, []);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try { await deleteAccount(deletePassword); setShowDeleteModal(false); }
    catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed to delete account'); }
    finally { setIsDeleting(false); }
  };

  const confirmDelete = () => {
    hapticWarning();
    Alert.alert('Delete Account', 'This action is permanent. All your data will be erased and cannot be recovered. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setShowDeleteModal(true) },
    ]);
  };

  const handleRestorePurchases = () => {
    hapticMedium();
    Alert.alert('Restore Purchases', 'Checking for previous purchases...');
  };

  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
        <View className="flex-1 px-6 pt-8">
          <Text className="mb-8 text-3xl font-bold text-white">Settings</Text>
          <View className="mb-6 rounded-2xl bg-gray-900 border border-gray-800 p-6 items-center">
            <Text className="text-lg font-semibold text-white mb-2">Create an Account</Text>
            <Text className="text-sm text-gray-400 text-center mb-4">Sign up to save your journal entries and unlock unlimited features.</Text>
            <Pressable className="rounded-xl bg-amber-600 px-8 py-3" onPress={() => router.push('/(auth)/register')}>
              <Text className="text-base font-semibold text-white">Sign Up Free</Text>
            </Pressable>
          </View>
          <View className="rounded-xl bg-gray-900 border border-gray-800">
            <Pressable className="p-4" onPress={handleRestorePurchases}>
              <Text className="text-base font-medium text-amber-400">Restore Purchases</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
      <View className="flex-1 px-6 pt-8">
        <Text className="mb-8 text-3xl font-bold text-white">Settings</Text>

        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Account</Text>
        <View className="mb-6 rounded-xl bg-gray-900 border border-gray-800 p-4">
          <Text className="text-sm text-gray-500">Email</Text>
          <Text className="mt-0.5 text-base font-medium text-white">{user?.email}</Text>
        </View>

        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Security</Text>
        <View className="mb-6 rounded-xl bg-gray-900 border border-gray-800">
          {biometricType && (
            <View className="flex-row items-center justify-between border-b border-gray-800 p-4">
              <View>
                <Text className="text-base font-medium text-white">{biometricType}</Text>
                <Text className="text-sm text-gray-500">Use {biometricType} to unlock the app</Text>
              </View>
              <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ true: '#f59e0b' }} />
            </View>
          )}
          <Pressable className="p-4" onPress={logout}>
            <Text className="text-base font-medium text-white">Sign Out</Text>
          </Pressable>
        </View>

        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Purchases</Text>
        <View className="mb-6 rounded-xl bg-gray-900 border border-gray-800">
          <Pressable className="p-4" onPress={handleRestorePurchases}>
            <Text className="text-base font-medium text-amber-400">Restore Purchases</Text>
          </Pressable>
        </View>

        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Danger Zone</Text>
        <View className="rounded-xl bg-red-950/30 border border-red-900/50">
          <Pressable className="p-4" onPress={confirmDelete}>
            <Text className="text-base font-medium text-red-400">Delete Account</Text>
            <Text className="mt-0.5 text-sm text-red-500/70">Permanently remove all your data</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Deletion">
        <Text className="mb-4 text-sm text-gray-400">Enter your password to confirm account deletion. This cannot be undone.</Text>
        <View className="mb-4"><Input placeholder="Your password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry /></View>
        <View className="flex-row gap-3">
          <View className="flex-1"><Button title="Cancel" variant="outline" onPress={() => setShowDeleteModal(false)} /></View>
          <View className="flex-1"><Button title="Delete" variant="destructive" onPress={handleDeleteAccount} isLoading={isDeleting} /></View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
