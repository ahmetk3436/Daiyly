const EMOTION_AI_BASE = 'https://emotionsenseml.vexellabspro.com';

export interface EmotionAIResult {
  emotions: Array<{ type: string; score: number }>;
  dominantEmotion: string;
}

export async function analyzeTextEmotion(text: string): Promise<EmotionAIResult | null> {
  if (!text || text.trim().length < 20) return null;
  try {
    const res = await fetch(`${EMOTION_AI_BASE}/api/v1/analyze/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.substring(0, 2000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch {
    return null;
  }
}

export function getEmotionColor(emotion: string): string {
  const map: Record<string, string> = {
    happy: '#FBBF24', joy: '#FBBF24',
    sad: '#60A5FA', sadness: '#60A5FA',
    angry: '#EF4444', anger: '#EF4444',
    fear: '#A78BFA', anxious: '#A78BFA',
    surprise: '#F97316',
    disgust: '#34D399',
    neutral: '#94A3B8', calm: '#94A3B8',
  };
  return map[emotion?.toLowerCase()] ?? '#94A3B8';
}

export function getEmotionEmoji(emotion: string): string {
  const map: Record<string, string> = {
    happy: '😊', joy: '😄',
    sad: '😢', sadness: '😔',
    angry: '😠', anger: '😡',
    fear: '😨', anxious: '😰',
    surprise: '😲',
    disgust: '🤢',
    neutral: '😐', calm: '😌',
  };
  return map[emotion?.toLowerCase()] ?? '🤔';
}
