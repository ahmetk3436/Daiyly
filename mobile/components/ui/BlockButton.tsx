import React, { useState } from 'react';
import { Pressable, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { hapticSuccess, hapticError, hapticWarning, hapticLight } from '../../lib/haptics';
import { BottomSheet } from './Modal';
import Button from './Button';

interface BlockButtonProps {
  userId: string;
  userName?: string;
  onBlocked?: () => void;
}

// 2025-2026 Trend: Custom modal, undo action, enhanced UX
export default function BlockButton({
  userId,
  userName = 'this user',
  onBlocked,
}: BlockButtonProps) {
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showUndo, setShowUndo] = useState(false);

  const handleBlock = async () => {
    setIsBlocking(true);
    try {
      await api.post('/blocks', { blocked_id: userId });
      hapticSuccess();
      setShowBottomSheet(false);
      onBlocked?.();

      // Show undo toast (simulated with Alert)
      setShowUndo(true);
      Alert.alert(
        'User Blocked',
        `${userName} has been blocked. Their content is now hidden.`,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Undo',
            style: 'cancel',
            onPress: () => {
              hapticLight();
              handleUnblock();
            },
          },
        ]
      );
    } catch {
      hapticError();
      Alert.alert('Error', 'Failed to block user. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async () => {
    try {
      await api.delete(`/blocks/${userId}`);
      hapticSuccess();
      Alert.alert('Unblocked', `${userName} has been unblocked.`);
    } catch {
      hapticError();
    }
  };

  return (
    <>
      <Pressable
        className="flex-row items-center gap-1 p-2"
        onPress={() => {
          hapticLight();
          setShowBottomSheet(true);
        }}
      >
        <Ionicons name="ban-outline" size={16} color="#ef4444" />
        <Text className="text-sm text-red-500">Block</Text>
      </Pressable>

      <BottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        snapPoint="50%"
      >
        <View className="pb-6">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="ban-outline" size={24} color="#ef4444" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">Block User</Text>
              <Text className="text-sm text-gray-500">
                Are you sure you want to block {userName}?
              </Text>
            </View>
          </View>

          {/* What happens when blocked */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              When you block {userName}:
            </Text>
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text className="text-sm text-gray-700 flex-1">
                  Their content will be hidden
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text className="text-sm text-gray-700 flex-1">
                  They won't see your content
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text className="text-sm text-gray-700 flex-1">
                  They can't message you
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="information-circle" size={16} color="#3b82f6" />
                <Text className="text-sm text-blue-600 flex-1">
                  You can unblock anytime from Settings
                </Text>
              </View>
            </View>
          </View>

          {/* Warning */}
          <View className="bg-amber-50 rounded-xl p-3 mb-4 flex-row gap-2">
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text className="text-sm text-amber-700 flex-1">
              This won't remove content they've already posted. Report their content if it violates our guidelines.
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowBottomSheet(false)}
                size="sm"
              />
            </View>
            <View className="flex-1">
              <Button
                title="Block"
                variant="destructive"
                onPress={handleBlock}
                isLoading={isBlocking}
                size="sm"
              />
            </View>
          </View>

          {/* Report link */}
          <Pressable
            className="mt-3 items-center py-2"
            onPress={() => {
              setShowBottomSheet(false);
              // Navigate to report or show report modal
            }}
          >
            <Text className="text-sm text-blue-600">
              Report this user instead
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}
