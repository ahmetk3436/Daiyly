import { Share, Platform } from 'react-native';

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

/**
 * Share an image from a local URI
 */
export const shareImage = async (uri: string): Promise<void> => {
  try {
    await Share.share({
      url: uri,
      title: 'Share your mood',
    });
  } catch (error) {
    console.error('Error sharing image:', error);
    throw error;
  }
};

/**
 * Share a text message about the mood entry
 */
export const shareMoodCard = async (entry: {
  mood_emoji: string;
  mood_label: string;
  mood_score: number;
  content?: string;
}): Promise<void> => {
  try {
    const message = `Today I'm feeling ${entry.mood_emoji} ${entry.mood_label} (${entry.mood_score}/10)\n\n${entry.content ? `"${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}"` : ''}\n\nTrack your daily mood with Daiyly!`;

    await Share.share({
      message,
      title: 'My Mood Today',
    });
  } catch (error) {
    console.error('Error sharing mood card:', error);
    throw error;
  }
};

/**
 * Share an image with a text message
 */
export const shareImageWithMessage = async (
  uri: string,
  message: string
): Promise<void> => {
  try {
    await Share.share({
      url: uri,
      message,
      title: 'Share your mood',
    });
  } catch (error) {
    console.error('Error sharing image with message:', error);
    throw error;
  }
};
