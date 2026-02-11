import React, { useState } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  type ModalProps as RNModalProps,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../lib/haptics';
import { cn } from '../../lib/cn';

interface ModalProps extends Omit<RNModalProps, 'visible'> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showCloseButton?: boolean;
  swipeToDismiss?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'w-full h-full',
};

// 2025-2026 Trend: Swipe dismiss, backdrop blur, size variants
export default function Modal({
  visible,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  swipeToDismiss = true,
  ...props
}: ModalProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  const handleGestureStart = (event: any) => {
    if (!swipeToDismiss) return;
    setStartY(event.nativeEvent.pageY);
  };

  const handleGestureMove = (event: any) => {
    if (!swipeToDismiss) return;
    const deltaY = event.nativeEvent.pageY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleGestureEnd = (event: any) => {
    if (!swipeToDismiss) return;
    const deltaY = event.nativeEvent.pageY - startY;
    if (deltaY > 100) {
      hapticLight();
      onClose();
    }
    setCurrentY(0);
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      {...props}
    >
      {/* Backdrop with blur effect */}
      <Pressable
        className="flex-1"
        onPress={() => {
          hapticLight();
          onClose();
        }}
      >
        <BlurView intensity={20} tint="dark" className="flex-1" />
      </Pressable>

      {/* Modal Content */}
      <Pressable
        className="absolute inset-0 items-center justify-center p-6"
        onPress={() => {}}
        style={{ gap: 0 }}
      >
        <View
          className={cn(
            'w-full rounded-3xl bg-white shadow-2xl overflow-hidden',
            sizeStyles[size]
          )}
          style={{
            transform: [{ translateY: currentY }],
            opacity: currentY > 0 ? 1 - currentY / 300 : 1,
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => swipeToDismiss}
          onResponderGrant={handleGestureStart}
          onResponderMove={handleGestureMove}
          onResponderRelease={handleGestureEnd}
        >
          {/* Handle for swipe indicator */}
          {swipeToDismiss && Platform.OS === 'ios' && (
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>
          )}

          {/* Header */}
          {(title || showCloseButton) && (
            <View className="flex-row items-center justify-between px-6 pt-4 pb-2 border-b border-gray-100">
              {title ? (
                <Text className="text-xl font-bold text-gray-900 flex-1">
                  {title}
                </Text>
              ) : (
                <View className="flex-1" />
              )}
              {showCloseButton && (
                <Pressable
                  className="w-8 h-8 items-center justify-center rounded-full bg-gray-100"
                  onPress={() => {
                    hapticLight();
                    onClose();
                  }}
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </Pressable>
              )}
            </View>
          )}

          {/* Content */}
          {size === 'full' ? (
            <ScrollView className="flex-1 px-6 py-4">{children}</ScrollView>
          ) : (
            <View className="px-6 py-4">{children}</View>
          )}
        </View>
      </Pressable>
    </RNModal>
  );
}

// Bottom Sheet variant (common in 2025-2026 apps)
export function BottomSheet({
  visible,
  onClose,
  children,
  snapPoint = '50%',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoint?: string;
}) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  const handleGestureStart = (event: any) => {
    setStartY(event.nativeEvent.pageY);
  };

  const handleGestureMove = (event: any) => {
    const deltaY = event.nativeEvent.pageY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleGestureEnd = (event: any) => {
    const deltaY = event.nativeEvent.pageY - startY;
    if (deltaY > 100) {
      hapticLight();
      onClose();
    }
    setCurrentY(0);
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1"
        onPress={() => {
          hapticLight();
          onClose();
        }}
      >
        <BlurView intensity={20} tint="dark" className="flex-1" />
      </Pressable>

      <View
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        style={{
          height: snapPoint === '50%' ? SCREEN_HEIGHT * 0.5 : SCREEN_HEIGHT * 0.7,
          transform: [{ translateY: currentY }],
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleGestureStart}
        onResponderMove={handleGestureMove}
        onResponderRelease={handleGestureEnd}
      >
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 bg-gray-300 rounded-full" />
        </View>
        <View className="flex-1 px-6 py-4">{children}</View>
      </View>
    </RNModal>
  );
}
