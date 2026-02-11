import React, { useState } from 'react';
import { Alert, Pressable, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { hapticSuccess, hapticError, hapticSelection, hapticLight } from '../../lib/haptics';
import { BottomSheet } from './Modal';
import Button from './Button';

interface ReportButtonProps {
  contentType: 'user' | 'post' | 'comment';
  contentId: string;
}

// 2025-2026 Trend: Quick chips for category selection, BottomSheet UI
const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or misleading', icon: 'alert-circle-outline' as const },
  { id: 'harassment', label: 'Harassment', icon: 'person-outline' as const },
  { id: 'hate', label: 'Hate speech', icon: 'flag-outline' as const },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'eye-off-outline' as const },
  { id: 'violence', label: 'Violence or harm', icon: 'warning-outline' as const },
  { id: 'intellectual', label: 'Copyright issue', icon: 'document-outline' as const },
  { id: 'privacy', label: 'Privacy violation', icon: 'lock-closed-outline' as const },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

export default function ReportButton({
  contentType,
  contentId,
}: ReportButtonProps) {
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReport = async () => {
    if (!selectedCategory) {
      Alert.alert('Select a Category', 'Please select a category for your report.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/reports', {
        content_type: contentType,
        content_id: contentId,
        category: selectedCategory,
        reason: customReason || REPORT_CATEGORIES.find(c => c.id === selectedCategory)?.label,
      });
      hapticSuccess();
      setShowBottomSheet(false);
      setSelectedCategory('');
      setCustomReason('');
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
        onPress={() => {
          hapticLight();
          setShowBottomSheet(true);
        }}
      >
        <Ionicons name="flag-outline" size={16} color="#ef4444" />
        <Text className="text-sm text-red-500">Report</Text>
      </Pressable>

      <BottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        snapPoint="70%"
      >
        <View className="pb-6">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="flag-outline" size={20} color="#ef4444" />
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-900">Report Content</Text>
              <Text className="text-sm text-gray-500">
                Help us keep the community safe
              </Text>
            </View>
          </View>

          {/* Category Chips */}
          <Text className="text-base font-semibold text-gray-900 mb-3">
            What's the issue?
          </Text>
          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            className="max-h-40 mb-4"
          >
            <View className="flex-row flex-wrap gap-2">
              {REPORT_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <Pressable
                    key={category.id}
                    className={`flex-row items-center gap-2 px-3 py-2 rounded-full border ${
                      isSelected
                        ? 'bg-red-50 border-red-500'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                    onPress={() => {
                      hapticSelection();
                      setSelectedCategory(category.id);
                    }}
                  >
                    <Ionicons
                      name={category.icon}
                      size={16}
                      color={isSelected ? '#ef4444' : '#6b7280'}
                    />
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? 'text-red-600' : 'text-gray-700'
                      }`}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Custom Reason */}
          {selectedCategory === 'other' && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Additional Details
              </Text>
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <Text
                  className="text-base text-gray-900 min-h-[60px]"
                  placeholder="Describe the issue..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  value={customReason}
                  onChangeText={setCustomReason}
                  onFocus={() => hapticSelection()}
                />
                <Text className="text-xs text-gray-400 text-right mt-1">
                  {customReason.length}/500
                </Text>
              </View>
            </View>
          )}

          {/* Info Text */}
          <View className="bg-blue-50 rounded-xl p-3 mb-4 flex-row gap-2">
            <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
            <Text className="text-sm text-blue-700 flex-1">
              Your report is anonymous. We review all reports within 24 hours.
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
                title="Submit Report"
                variant="destructive"
                onPress={handleReport}
                isLoading={isSubmitting}
                disabled={!selectedCategory}
                size="sm"
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
