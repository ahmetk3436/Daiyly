import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { hapticSuccess, hapticError } from '../../lib/haptics';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';

interface ReportButtonProps {
  contentType: 'user' | 'post' | 'comment';
  contentId: string;
}

// Report button (Apple Guideline 1.2 — every piece of UGC must have one)
export default function ReportButton({
  contentType,
  contentId,
}: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReport = async () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your report.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/reports', {
        content_type: contentType,
        content_id: contentId,
        reason,
      });
      hapticSuccess();
      setShowModal(false);
      setReason('');
      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. We will review this within 24 hours.'
      );
    } catch {
      hapticError();
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Pressable
        className="flex-row items-center gap-1 p-2"
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="flag-outline" size={16} color="#ef4444" />
        <Text className="text-sm text-red-500">Report</Text>
      </Pressable>

      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Report Content"
      >
        <Text className="mb-4 text-sm text-gray-600">
          Tell us why you are reporting this {contentType}. Our team reviews all
          reports within 24 hours.
        </Text>
        <View className="mb-4">
          <Input
            label="Reason"
            placeholder="Describe the issue..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowModal(false)}
            />
          </View>
          <View className="flex-1">
            <Button
              title="Submit"
              variant="destructive"
              onPress={handleReport}
              isLoading={isSubmitting}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
