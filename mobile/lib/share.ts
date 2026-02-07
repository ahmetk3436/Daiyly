import { Share } from 'react-native';

export async function shareResult(
  moodEmoji: string,
  moodLabel: string,
  streakCount: number
): Promise<void> {
  try {
    await Share.share({
      message: `${moodEmoji} My mood today: ${moodLabel}! ${streakCount} day streak on Daiyly \u{1F4D3}`,
      title: 'My Daiyly Mood',
    });
  } catch {
    // User dismissed share sheet, ignore
  }
}
