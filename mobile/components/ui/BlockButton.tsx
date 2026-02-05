import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { hapticSuccess, hapticError, hapticWarning } from '../../lib/haptics';

interface BlockButtonProps {
  userId: string;
  userName?: string;
  onBlocked?: () => void;
}

// Block button (Apple Guideline 1.2 — immediate content hiding)
export default function BlockButton({
  userId,
  userName = 'this user',
  onBlocked,
}: BlockButtonProps) {
  const handleBlock = () => {
    hapticWarning();
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? Their content will be immediately hidden from your view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/blocks', { blocked_id: userId });
              hapticSuccess();
              onBlocked?.();
              Alert.alert(
                'User Blocked',
                `${userName} has been blocked. Their content is now hidden.`
              );
            } catch {
              hapticError();
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <Pressable
      className="flex-row items-center gap-1 p-2"
      onPress={handleBlock}
    >
      <Ionicons name="ban-outline" size={16} color="#ef4444" />
      <Text className="text-sm text-red-500">Block</Text>
    </Pressable>
  );
}
