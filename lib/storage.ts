import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// App-scoped keys prevent cross-app keychain reads when multiple apps share
// the same Apple Team ID (HSP7DV4L29). Generic 'access_token' keys can be
// read by any app signed under the same team.
const ACCESS_TOKEN_KEY = 'daiyly_access_token';
const REFRESH_TOKEN_KEY = 'daiyly_refresh_token';

// AsyncStorage fallback keys — only used in Expo Go (dev) where SecureStore
// silently returns null after a JS reload/restart.
const FALLBACK_ACCESS_KEY = '@daiyly_access_token_fallback';
const FALLBACK_REFRESH_KEY = '@daiyly_refresh_token_fallback';

// Production builds must never write tokens to plaintext AsyncStorage.
const isExpoGo = Constants.appOwnership === 'expo';

async function readFromSecureOrFallback(
  secureKey: string,
  fallbackKey: string,
): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(secureKey);
    if (val) return val;
  } catch {
    // SecureStore unavailable — fall through
  }
  if (!isExpoGo) return null;
  try {
    return await AsyncStorage.getItem(fallbackKey);
  } catch {
    return null;
  }
}

export const getAccessToken = (): Promise<string | null> =>
  readFromSecureOrFallback(ACCESS_TOKEN_KEY, FALLBACK_ACCESS_KEY);

export const getRefreshToken = (): Promise<string | null> =>
  readFromSecureOrFallback(REFRESH_TOKEN_KEY, FALLBACK_REFRESH_KEY);

export const setTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  // Write to SecureStore (primary) — parallel
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken).catch(() => {}),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken).catch(() => {}),
  ]);
  // Write AsyncStorage fallback only in Expo Go (development) — parallel
  if (isExpoGo) {
    await Promise.all([
      AsyncStorage.setItem(FALLBACK_ACCESS_KEY, accessToken).catch(() => {}),
      AsyncStorage.setItem(FALLBACK_REFRESH_KEY, refreshToken).catch(() => {}),
    ]);
  }
};

export const clearTokens = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
    // Also purge legacy generic keys (pre-scoped key migration, wave 4)
    SecureStore.deleteItemAsync('access_token').catch(() => {}),
    SecureStore.deleteItemAsync('refresh_token').catch(() => {}),
    AsyncStorage.removeItem(FALLBACK_ACCESS_KEY).catch(() => {}),
    AsyncStorage.removeItem(FALLBACK_REFRESH_KEY).catch(() => {}),
  ]);
};
