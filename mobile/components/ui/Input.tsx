import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { cn } from '../../lib/cn';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
        </Text>
      )}
      <TextInput
        className={cn(
          'w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900',
          isFocused
            ? 'border-primary-500 ring-2 ring-primary-200'
            : 'border-gray-300',
          error && 'border-red-500',
          className
        )}
        placeholderTextColor="#9ca3af"
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="mt-1 text-sm text-red-500">{error}</Text>
      )}
    </View>
  );
}
