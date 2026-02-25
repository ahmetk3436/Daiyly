import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_STATE_KEY = '@daiyly_review_state';
const COOLDOWN_DAYS = 90;

interface ReviewState {
  lastPromptedAt: number | null;
  totalEntries: number;
  promptCount: number;
}

async function getState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY);
    return raw
      ? JSON.parse(raw)
      : { lastPromptedAt: null, totalEntries: 0, promptCount: 0 };
  } catch {
    return { lastPromptedAt: null, totalEntries: 0, promptCount: 0 };
  }
}

async function setState(s: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(s));
}

export async function maybeRequestReview(
  trigger: 'entry_saved' | 'streak_milestone'
): Promise<void> {
  const available = await StoreReview.isAvailableAsync();
  if (!available) return;

  const state = await getState();

  // Cooldown: no more than once per 90 days
  if (
    state.lastPromptedAt &&
    Date.now() - state.lastPromptedAt < COOLDOWN_DAYS * 86400000
  )
    return;

  // Max 3 prompts lifetime
  if (state.promptCount >= 3) return;

  let shouldPrompt = false;

  if (trigger === 'entry_saved') {
    state.totalEntries++;
    // Prompt at 5th, 20th, 50th entry
    shouldPrompt = [5, 20, 50].includes(state.totalEntries);
  }

  if (trigger === 'streak_milestone') {
    shouldPrompt = true; // Caller already filters milestones
  }

  if (shouldPrompt) {
    await StoreReview.requestReview();
    state.lastPromptedAt = Date.now();
    state.promptCount++;
  }

  await setState(state);
}

/** Call on every entry save — cheap counter increment, prompts only at milestones. */
export async function trackEntrySaved(): Promise<void> {
  await maybeRequestReview('entry_saved');
}
