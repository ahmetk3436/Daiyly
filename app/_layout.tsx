import '../global.css';
import '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { initLanguage } from '../lib/i18n';
import { refreshApiBaseUrl, getRemoteMinVersion } from '../lib/api';
import { compareVersions, getAppVersion, shouldCheckVersion, markVersionChecked } from '../lib/version';
import ForceUpdateModal, { wasRecentlyDismissed } from '../components/ForceUpdateModal';

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
  const [forceUpdate, setForceUpdate] = useState(false);

  useEffect(() => {
    const init = async () => {
      await refreshApiBaseUrl();
      initLanguage();

      // Force update check (skips if user dismissed within last hour)
      const minVersion = getRemoteMinVersion();
      if (minVersion) {
        const needsCheck = await shouldCheckVersion();
        if (needsCheck) {
          const isOk = compareVersions(getAppVersion(), minVersion);
          if (!isOk) {
            const dismissed = await wasRecentlyDismissed();
            if (!dismissed) setForceUpdate(true);
          }
          await markVersionChecked();
        }
      }
    };
    init();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedApp />
          </AuthProvider>
        </ThemeProvider>
        <ForceUpdateModal
          visible={forceUpdate}
          onDismiss={() => setForceUpdate(false)}
        />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default RootLayout;
