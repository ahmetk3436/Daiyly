import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION_CHECK_KEY = '@daiyly_last_version_check';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Returns true if `current` >= `minimum` using semver comparison.
 */
export function compareVersions(current: string, minimum: string): boolean {
  const c = current.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] || 0) < (m[i] || 0)) return false;
    if ((c[i] || 0) > (m[i] || 0)) return true;
  }
  return true; // equal
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

export async function shouldCheckVersion(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(VERSION_CHECK_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > CHECK_INTERVAL;
  } catch {
    return true;
  }
}

export async function markVersionChecked(): Promise<void> {
  await AsyncStorage.setItem(VERSION_CHECK_KEY, Date.now().toString());
}
