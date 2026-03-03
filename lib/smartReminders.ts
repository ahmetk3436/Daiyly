/**
 * smartReminders.ts
 *
 * Analyzes past journal entry timestamps to find when the user typically
 * journals, then schedules a single daily local notification at that time.
 *
 * All operations are fire-and-forget safe: any error is swallowed so the
 * caller never crashes when notification permission is denied or the API
 * is unavailable.
 */

import * as Notifications from 'expo-notifications';

const NOTIFICATION_ID = 'daiyly-smart-reminder';
const DEFAULT_HOUR = 21; // 9 PM fallback when no entries exist

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return the mode (most common value) of an array of numbers. */
function mode(values: number[]): number {
  if (values.length === 0) return DEFAULT_HOUR;

  const freq = new Map<number, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  let bestVal = values[0];
  let bestCount = 0;
  for (const [val, count] of freq.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestVal = val;
    }
  }
  return bestVal;
}

/**
 * Check whether the user has already journaled today or yesterday within
 * a ±1 hour window of the target hour.
 * Returns true if we should skip scheduling (user is already in the habit).
 */
function hasRecentEntryNearHour(
  entries: Array<{ created_at: string }>,
  targetHour: number
): boolean {
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    const ts = new Date(entry.created_at).getTime();
    if (isNaN(ts)) continue;

    const ageMs = now - ts;
    if (ageMs > threeDaysMs) continue; // older than 3 days — ignore

    const entryHour = new Date(ts).getHours();
    if (Math.abs(entryHour - targetHour) <= 1) {
      return true; // user journaled recently near this hour
    }
  }
  return false;
}

/** Build a trigger date for the next occurrence of {hour}:00. */
function nextOccurrenceOf(hour: number): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, 0, 0, 0);

  if (candidate <= now) {
    // That time already passed today — schedule for tomorrow
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyzes entry timestamps to find when the user typically journals,
 * then schedules a daily local notification at that time.
 *
 * Safe to call multiple times — cancels the previous reminder before
 * scheduling a new one.
 */
export async function scheduleSmartReminder(
  entries: Array<{ created_at: string }>
): Promise<void> {
  try {
    // Request permission — silently abort if denied
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // Extract the hour of each past entry
    const hours: number[] = [];
    for (const entry of entries) {
      const d = new Date(entry.created_at);
      if (!isNaN(d.getTime())) {
        hours.push(d.getHours());
      }
    }

    // Find most common journaling hour; default to 21:00
    const targetHour = hours.length > 0 ? mode(hours) : DEFAULT_HOUR;

    // Skip if the user has journaled in the last 3 days near this hour
    if (hasRecentEntryNearHour(entries, targetHour)) return;

    // Cancel any existing smart reminder before scheduling a fresh one
    await cancelSmartReminder();

    const triggerDate = nextOccurrenceOf(targetHour);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'Time to reflect \uD83D\uDCD4',
        body: 'Your streak is waiting \u2014 take 2 minutes to journal today.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch {
    // Silently swallow — notification errors must never crash the app
  }
}

/**
 * Cancels the scheduled smart reminder notification, if any.
 */
export async function cancelSmartReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Silently swallow
  }
}
