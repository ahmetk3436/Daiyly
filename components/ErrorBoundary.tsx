import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// Sentry removed - using no-op stub
const Sentry = {
  init: () => {},
  captureException: (e: any) => console.error(e),
  captureMessage: (m: string) => console.warn(m),
  setUser: (_u: any) => {},
  addBreadcrumb: (_b: any) => {},
  withScope: (cb: any) => cb({ setExtra: () => {}, setTag: () => {} }),
  Native: { wrap: (c: any) => c },
  wrap: (c: any) => c,
  ReactNavigationInstrumentation: class {},
  ReactNativeTracing: class {},
};

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
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
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>The app encountered an unexpected error. Please try again.</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  message: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
