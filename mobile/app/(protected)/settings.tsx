import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { isBiometricAvailable, getBiometricType } from '../../lib/biometrics';
import { hapticWarning, hapticMedium } from '../../lib/haptics';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      const available = await isBiometricAvailable();
      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
    };
    checkBiometrics();
  }, []);

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

  // Restore Purchases (Guideline 3.1 — required on every paywall)
  const handleRestorePurchases = () => {
    hapticMedium();
    // In production, call RevenueCat's restorePurchases method:
    // await Purchases.restorePurchases();
    Alert.alert('Restore Purchases', 'Checking for previous purchases...');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-8">
        <Text className="mb-8 text-3xl font-bold text-gray-900">Settings</Text>

        {/* Account Section */}
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Account
        </Text>
        <View className="mb-6 rounded-xl bg-gray-50 p-4">
          <Text className="text-sm text-gray-500">Email</Text>
          <Text className="mt-0.5 text-base font-medium text-gray-900">
            {user?.email}
          </Text>
        </View>

        {/* Security Section */}
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Security
        </Text>
        <View className="mb-6 rounded-xl bg-gray-50">
          {biometricType && (
            <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
              <View>
                <Text className="text-base font-medium text-gray-900">
                  {biometricType}
                </Text>
                <Text className="text-sm text-gray-500">
                  Use {biometricType} to unlock the app
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                trackColor={{ true: '#2563eb' }}
              />
            </View>
          )}
          <Pressable className="p-4" onPress={logout}>
            <Text className="text-base font-medium text-gray-900">
              Sign Out
            </Text>
          </Pressable>
        </View>

        {/* Purchases Section (Guideline 3.1) */}
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Purchases
        </Text>
        <View className="mb-6 rounded-xl bg-gray-50">
          <Pressable className="p-4" onPress={handleRestorePurchases}>
            <Text className="text-base font-medium text-primary-600">
              Restore Purchases
            </Text>
          </Pressable>
        </View>

        {/* Danger Zone — Account Deletion (Guideline 5.1.1) */}
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Danger Zone
        </Text>
        <View className="rounded-xl bg-red-50">
          <Pressable className="p-4" onPress={confirmDelete}>
            <Text className="text-base font-medium text-red-600">
              Delete Account
            </Text>
            <Text className="mt-0.5 text-sm text-red-400">
              Permanently remove all your data
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
      >
        <Text className="mb-4 text-sm text-gray-600">
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
