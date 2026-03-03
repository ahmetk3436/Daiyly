import '../global.css';
import '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
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
  // Scrub request body, user email, and network breadcrumbs before sending to Sentry.
  // Journal API endpoint URLs in breadcrumbs reveal writing behavior patterns and
  // may qualify as health data under FTC HBNR 2024.
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = '[scrubbed]';
    }
    if (event.user?.email) {
      delete event.user.email;
    }
    const breadcrumbs: any[] = (event as any).breadcrumbs?.values ?? [];
    for (const bc of breadcrumbs) {
      if (bc.category === 'xhr' || bc.category === 'fetch' || bc.category === 'http') {
        bc.data = undefined;
        // Scrub URL — endpoint paths (e.g. /entries/:uuid) are behavioral health
        // data under FTC HBNR 2024. Remove entirely, keep only the category tag.
        bc.url = undefined;
      }
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
  const [isBackground, setIsBackground] = useState(false);

  // Blank the screen during app-switcher snapshot to protect journal privacy
  // (FTC HBNR 2024: mental health/journaling data is covered health data).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setIsBackground(state === 'background' || state === 'inactive');
    });
    return () => sub.remove();
  }, []);

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
    <View className="flex-1">
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
      {isBackground && <View className="absolute inset-0 bg-black" />}
    </View>
  );
}

export default Sentry.wrap(RootLayout);
