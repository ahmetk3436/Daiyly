import * as SecureStore from 'expo-secure-store';
import type { GuestEntry } from '../types/journal';

const GUEST_USES_KEY = 'guest_uses_count';
const GUEST_ENTRIES_KEY = 'guest_entries';

export async function getGuestUsesCount(): Promise<number> {
  try {
    const value = await SecureStore.getItemAsync(GUEST_USES_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementGuestUses(): Promise<number> {
  const current = await getGuestUsesCount();
  const newCount = current + 1;
  await SecureStore.setItemAsync(GUEST_USES_KEY, newCount.toString());
  return newCount;
}

export async function hasGuestUsesRemaining(): Promise<boolean> {
  const count = await getGuestUsesCount();
  return count < 3;
}

export async function saveGuestEntry(entry: GuestEntry): Promise<void> {
  const existing = await getGuestEntries();
  existing.push(entry);
  await SecureStore.setItemAsync(GUEST_ENTRIES_KEY, JSON.stringify(existing));
}

export async function getGuestEntries(): Promise<GuestEntry[]> {
  try {
    const value = await SecureStore.getItemAsync(GUEST_ENTRIES_KEY);
    if (value) {
      return JSON.parse(value) as GuestEntry[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function clearGuestData(): Promise<void> {
  await SecureStore.deleteItemAsync(GUEST_USES_KEY);
  await SecureStore.deleteItemAsync(GUEST_ENTRIES_KEY);
}
