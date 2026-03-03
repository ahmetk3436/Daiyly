import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from './api';
import type { GuestEntry } from '../types/journal';

// Use count is not sensitive — a plain counter is fine in AsyncStorage
export const GUEST_USES_KEY = 'guest_uses_count';

// Journal content is personal — store in SecureStore, one entry per key
const GUEST_ENTRY_IDS_KEY = 'guest_entry_ids';
const GUEST_ENTRY_PREFIX = 'guest_entry_';

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

async function getEntryIDs(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(GUEST_ENTRY_IDS_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return [];
}

async function setEntryIDs(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(GUEST_ENTRY_IDS_KEY, JSON.stringify(ids));
}

export async function saveGuestEntry(entry: GuestEntry): Promise<void> {
  await SecureStore.setItemAsync(GUEST_ENTRY_PREFIX + entry.id, JSON.stringify(entry));
  const ids = await getEntryIDs();
  if (!ids.includes(entry.id)) {
    ids.push(entry.id);
    await setEntryIDs(ids);
  }
}

export async function getGuestEntries(): Promise<GuestEntry[]> {
  try {
    const ids = await getEntryIDs();
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await SecureStore.getItemAsync(GUEST_ENTRY_PREFIX + id);
          return raw ? (JSON.parse(raw) as GuestEntry) : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((e): e is GuestEntry => e !== null);
  } catch {
    return [];
  }
}

export async function clearGuestData(): Promise<void> {
  const ids = await getEntryIDs();
  // Delete the index first — orphaned entries are unreachable on crash
  try {
    await SecureStore.deleteItemAsync(GUEST_ENTRY_IDS_KEY);
  } catch {}
  await Promise.all(
    ids.map((id) => SecureStore.deleteItemAsync(GUEST_ENTRY_PREFIX + id).catch(() => {})),
  );
  await AsyncStorage.removeItem(GUEST_USES_KEY);
}

/**
 * Migrate guest entries to the authenticated user's account via API.
 * Only removes successfully migrated entries — failures stay for retry.
 * Returns the number of entries successfully migrated.
 */
export async function migrateGuestEntries(): Promise<number> {
  const guestEntries = await getGuestEntries();
  if (guestEntries.length === 0) return 0;

  const results = await Promise.allSettled(
    guestEntries.map((entry) =>
      api.post('/journals', {
        mood_emoji: entry.mood_emoji,
        mood_score: entry.mood_score,
        content: entry.content,
        card_color: entry.card_color,
        tags: entry.tags || [],
      }),
    ),
  );

  const migratedIds = new Set<string>();
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      migratedIds.add(guestEntries[i].id);
    } else {
      console.warn('[guest] migration failed for entry', guestEntries[i].id, result.reason);
    }
  });

  if (migratedIds.size === guestEntries.length) {
    await clearGuestData();
  } else if (migratedIds.size > 0) {
    const remainingIDs = guestEntries
      .filter((e) => !migratedIds.has(e.id))
      .map((e) => e.id);
    await Promise.all(
      [...migratedIds].map((id) =>
        SecureStore.deleteItemAsync(GUEST_ENTRY_PREFIX + id).catch(() => {}),
      ),
    );
    await setEntryIDs(remainingIDs);
  }

  return migratedIds.size;
}
