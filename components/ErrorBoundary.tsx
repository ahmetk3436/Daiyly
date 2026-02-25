import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Functional wrapper to access useColorScheme hook for ErrorBoundary fallback
function ErrorFallback({ onRestart }: { onRestart: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className="flex-1 justify-center items-center p-6"
      style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }}
    >
      <Text style={{ fontSize: 64, marginBottom: 16 }}>😵</Text>
      <Text
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: isDark ? '#F1F5F9' : '#1F2937',
          marginBottom: 8,
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: isDark ? '#94A3B8' : '#6B7280',
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        The app encountered an unexpected error. Please try again.
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#2563EB',
          paddingHorizontal: 32,
          paddingVertical: 14,
          borderRadius: 12,
        }}
        onPress={onRestart}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRestart = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRestart={this.handleRestart} />;
    }
    return this.props.children;
  }
}
