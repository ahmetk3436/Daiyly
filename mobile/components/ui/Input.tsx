import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '../../lib/cn';
import { hapticSelection } from '../../lib/haptics';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  maxLength?: number;
  showCharCount?: boolean;
  leftIcon?: React.ReactNode;
}

// 2025-2026 Trend: Enhanced input with error states, character count, password toggle
export default function Input({
  label,
  error,
  maxLength,
  showCharCount = false,
  leftIcon,
  className,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  const charCount = props.value?.toString().length || 0;

  return (
    <View className="w-full">
      {label && (
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          {showCharCount && maxLength && (
            <Text
              className={cn(
                'text-xs',
                charCount > maxLength * 0.9 ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {charCount}/{maxLength}
            </Text>
          )}
        </View>
      )}

      <View className="relative">
        {leftIcon && (
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            {leftIcon}
          </View>
        )}

        <TextInput
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900',
            isFocused
              ? 'border-primary-500 ring-2 ring-primary-200'
              : error
              ? 'border-red-500'
              : 'border-gray-300',
            leftIcon && 'pl-12',
            isPassword && 'pr-12',
            className
          )}
          placeholderTextColor="#9ca3af"
          onFocus={(e) => {
            setIsFocused(true);
            hapticSelection();
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          maxLength={maxLength}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />

        {isPassword && (
          <Pressable
            className="absolute right-4 top-1/2 -translate-y-1/2"
            onPress={() => {
              hapticSelection();
              setShowPassword(!showPassword);
            }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9ca3af"
            />
          </Pressable>
        )}
      </View>

      {error && (
        <View className="flex-row items-center gap-1 mt-1">
          <Ionicons name="alert-circle" size={14} color="#ef4444" />
          <Text className="text-sm text-red-500 flex-1">{error}</Text>
        </View>
      )}
    </View>
  );
}

// Search input variant for 2025-2026 gesture-first navigation
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}) {
  return (
    <View className="relative">
      <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
        <Ionicons name="search-outline" size={20} color="#9ca3af" />
      </View>
      <TextInput
        className="w-full rounded-full border-0 bg-gray-100 px-4 py-3 pl-12 pr-12 text-base text-gray-900"
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChange}
        onFocus={() => hapticSelection()}
      />
      {value.length > 0 && (
        <Pressable
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-200 rounded-full w-6 h-6 items-center justify-center"
          onPress={() => {
            hapticSelection();
            onChange('');
            onClear?.();
          }}
        >
          <Ionicons name="close" size={14} color="#6b7280" />
        </Pressable>
      )}
    </View>
  );
}
