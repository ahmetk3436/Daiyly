import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@daiyly_cache_';

export interface CachedData<T> {
  data: T;
  cachedAt: string;
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const payload: CachedData<T> = { data, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch {}
}

export async function cacheGet<T>(key: string): Promise<CachedData<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData<T>;
  } catch {
    return null;
  }
}
