import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { JournalEntry } from '../types/journal';

const OTD_DATE_KEY = '@daiyly_otd_date';

/**
 * Given all entries, return groups matching today's month+day in prior years (1–3 years back).
 * Returns an array sorted by daysAgo ascending (oldest first).
 */
export function getOnThisDayEntries(
  allEntries: JournalEntry[]
): { daysAgo: number; entries: JournalEntry[] }[] {
  const now = new Date();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const results: { daysAgo: number; entries: JournalEntry[] }[] = [];

  for (let yearsBack = 1; yearsBack <= 3; yearsBack++) {
    const targetYear = now.getFullYear() - yearsBack;
    const matching = allEntries.filter((e) => {
      const d = new Date(e.created_at);
      return (
        d.getFullYear() === targetYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDay
      );
    });
    if (matching.length > 0) {
      const daysAgo = yearsBack * 365;
      results.push({ daysAgo, entries: matching });
    }
  }

  return results;
}

/**
 * Schedule a local notification for 9 AM if "On This Day" entries exist and
 * we haven't already scheduled one today.
 */
export async function scheduleOnThisDayNotification(
  entry: JournalEntry,
  yearsAgo: number
): Promise<void> {
  try {
    const today = new Date().toDateString();
    const lastScheduled = await AsyncStorage.getItem(OTD_DATE_KEY);
    if (lastScheduled === today) {
      return; // Already scheduled today
    }

    const preview = entry.content ? entry.content.slice(0, 60) : '';
    const yearLabel = yearsAgo === 1 ? '1 year' : `${yearsAgo} years`;

    const trigger = new Date();
    trigger.setHours(9, 0, 0, 0);
    // If 9 AM has already passed, don't schedule for earlier today
    if (trigger <= new Date()) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `On This Day — ${yearLabel} Ago`,
        body: preview
          ? `"${preview}${entry.content.length > 60 ? '...' : ''}"`
          : `You wrote an entry ${yearLabel} ago today.`,
        data: { entryId: entry.id, type: 'on_this_day' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    await AsyncStorage.setItem(OTD_DATE_KEY, today);
  } catch {
    // Non-critical — silently ignore scheduling errors
  }
}
