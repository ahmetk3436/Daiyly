import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  type ModalProps as RNModalProps,
} from 'react-native';

interface ModalProps extends Omit<RNModalProps, 'visible'> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({
  visible,
  onClose,
  title,
  children,
  ...props
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...props}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          onPress={() => {}}
        >
          {title && (
            <Text className="mb-4 text-xl font-bold text-gray-900">
              {title}
            </Text>
          )}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
