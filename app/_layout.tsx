import '../global.css';
import '../lib/i18n';
import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { initLanguage } from '../lib/i18n';
import { refreshApiBaseUrl } from '../lib/api';

function ThemedApp() {
  const { isDark } = useTheme();
  const { setColorScheme } = useColorScheme();

  // Sync ThemeContext preference to NativeWind's color scheme
  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

function RootLayout() {
  useEffect(() => {
    refreshApiBaseUrl();
    initLanguage();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedApp />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default RootLayout;
