import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { isDark } = useTheme();

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-text-secondary">
          {label}
        </Text>
      )}
      <TextInput
        className={cn(
          'w-full rounded-xl border bg-input-bg px-4 py-3 text-base text-text-primary',
          isFocused
            ? 'border-blue-500'
            : 'border-border-strong',
          error && 'border-red-500',
          className
        )}
        placeholderTextColor={isDark ? '#64748B' : '#9ca3af'}
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
