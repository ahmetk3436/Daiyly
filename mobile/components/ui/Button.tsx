import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  type PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cn } from '../../lib/cn';
import { hapticLight } from '../../lib/haptics';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-primary-600 active:bg-primary-700',
  secondary: 'bg-gray-600 active:bg-gray-700',
  outline: 'border-2 border-primary-600 bg-transparent active:bg-primary-50',
  destructive: 'bg-red-600 active:bg-red-700',
  gradient: '', // Handled separately with LinearGradient
};

const variantTextStyles = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-primary-600',
  destructive: 'text-white',
  gradient: 'text-white',
};

const sizeStyles = {
  sm: 'px-3 py-2',
  md: 'px-5 py-3',
  lg: 'px-7 py-4',
};

const sizeTextStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

// 2025-2026 Trend: Purple-to-pink gradient for primary actions
const GRADIENT_COLORS = ['#8B5CF6', '#EC4899'];

export default function Button({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  fullWidth = false,
  icon,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const isGradient = variant === 'gradient';

  const buttonContent = (
    <>
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'outline' ? '#2563eb' : '#ffffff'}
          size={size === 'sm' ? 'small' : 'small'}
        />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon}
          <Text
            className={cn(
              'font-semibold',
              variantTextStyles[variant],
              sizeTextStyles[size]
            )}
          >
            {title}
          </Text>
        </View>
      )}
    </>
  );

  const baseClassName = cn(
    'items-center justify-center rounded-xl overflow-hidden',
    variantStyles[variant],
    sizeStyles[size],
    isDisabled && 'opacity-50',
    fullWidth && 'w-full'
  );

  if (isGradient && !isDisabled) {
    return (
      <Pressable
        className={baseClassName}
        disabled={isDisabled}
        onPressIn={() => hapticLight()}
        style={style}
        {...props}
      >
        <LinearGradient
          colors={GRADIENT_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="w-full h-full items-center justify-center"
        >
          {buttonContent}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      className={baseClassName}
      disabled={isDisabled}
      onPressIn={() => hapticLight()}
      style={style}
      {...props}
    >
      {buttonContent}
    </Pressable>
  );
}

// Shimmer loading variant for 2025-2026 progressive loading trend
export function ShimmerButton({ width = 100 }: { width?: number }) {
  return (
    <View
      style={{ width }}
      className="h-12 bg-gray-200 rounded-xl overflow-hidden"
    >
      <View
        className="w-full h-full"
        style={{
          backgroundColor: '#f3f4f6',
          transform: [{ skewX: '-15deg' }],
        }}
      />
    </View>
  );
}
