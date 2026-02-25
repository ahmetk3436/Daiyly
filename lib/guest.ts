import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import type { GuestEntry } from '../types/journal';

export const GUEST_USES_KEY = 'guest_uses_count';
export const GUEST_ENTRIES_KEY = 'guest_entries';

export async function getGuestUsesCount(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(GUEST_USES_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementGuestUses(): Promise<number> {
  const current = await getGuestUsesCount();
  const newCount = current + 1;
  await AsyncStorage.setItem(GUEST_USES_KEY, newCount.toString());
  return newCount;
}

export async function hasGuestUsesRemaining(): Promise<boolean> {
  const count = await getGuestUsesCount();
  return count < 3;
}

export async function saveGuestEntry(entry: GuestEntry): Promise<void> {
  const existing = await getGuestEntries();
  existing.push(entry);
  await AsyncStorage.setItem(GUEST_ENTRIES_KEY, JSON.stringify(existing));
}

export async function getGuestEntries(): Promise<GuestEntry[]> {
  try {
    const value = await AsyncStorage.getItem(GUEST_ENTRIES_KEY);
    if (value) {
      return JSON.parse(value) as GuestEntry[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function clearGuestData(): Promise<void> {
  await AsyncStorage.multiRemove([GUEST_USES_KEY, GUEST_ENTRIES_KEY]);
}

/**
 * Migrate guest entries to the authenticated user's account via API.
 * Only removes successfully migrated entries — failures stay for retry.
 * Returns the number of entries successfully migrated.
 */
export async function migrateGuestEntries(): Promise<number> {
  const guestEntries = await getGuestEntries();
  if (guestEntries.length === 0) return 0;

  const migratedIds = new Set<string>();
  for (const entry of guestEntries) {
    try {
      await api.post('/journals', {
        mood_emoji: entry.mood_emoji,
        mood_score: entry.mood_score,
        content: entry.content,
        card_color: entry.card_color,
        tags: entry.tags || [],
      });
      migratedIds.add(entry.id);
    } catch {
      // Keep failed entries for retry on next trigger
    }
  }

  if (migratedIds.size === guestEntries.length) {
    // All entries migrated — full cleanup
    await clearGuestData();
  } else if (migratedIds.size > 0) {
    // Partial success — remove only migrated entries, keep failures
    const remaining = guestEntries.filter((e) => !migratedIds.has(e.id));
    await AsyncStorage.setItem(GUEST_ENTRIES_KEY, JSON.stringify(remaining));
  }

  return migratedIds.size;
}