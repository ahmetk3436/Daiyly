import '../global.css';
import '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { PaywallConfigProvider } from '../contexts/PaywallConfigContext';
import { initLanguage } from '../lib/i18n';
import { refreshApiBaseUrl, getRemoteMinVersion } from '../lib/api';
import { compareVersions, getAppVersion, shouldCheckVersion, markVersionChecked } from '../lib/version';
import ForceUpdateModal, { wasRecentlyDismissed } from '../components/ForceUpdateModal';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  environment: __DEV__ ? 'development' : 'production',
  // Scrub request body and user email from error events before sending to Sentry.
  // Prevents journal entry content, passwords, and tokens from leaking to a third party.
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = '[scrubbed]';
    }
    if (event.user?.email) {
      delete event.user.email;
    }
    return event;
  },
});

function ThemedApp() {
  const { isDark } = useTheme();

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
            <PaywallConfigProvider>
              <ThemedApp />
            </PaywallConfigProvider>
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

export default Sentry.wrap(RootLayout);
