export interface JournalEntry {
  id: string;
  user_id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  photo_url: string;
  card_color: string;
  tags?: string[];
  entry_date: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_entries: number;
  last_entry_date: string;
}

export interface JournalListResponse {
  entries: JournalEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface WeeklyInsights {
  average_mood_score: number;
  mood_trend: string;
  top_mood: string;
  total_entries: number;
  daily_scores: DailyScore[];
}

export interface DailyScore {
  date: string;
  score: number;
}

export interface WeeklyReport {
  narrative: string;
  key_themes: string[];
  mood_explanation: string;
  suggestion: string;
  week_start: string;
  stats: {
    total_entries: number;
    avg_mood_score: number;
    top_mood_emoji: string;
  };
}

export interface GuestEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  tags?: string[];
  created_at: string;
  entry_date?: string;
}

export interface MoodOption {
  emoji: string;
  label: string;
  color: string;
  value: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '\u{1F60A}', label: 'Happy', color: '#22c55e', value: 'happy' },
  { emoji: '\u{1F60C}', label: 'Calm', color: '#06b6d4', value: 'calm' },
  { emoji: '\u{1F614}', label: 'Sad', color: '#6366f1', value: 'sad' },
  { emoji: '\u{1F624}', label: 'Angry', color: '#ef4444', value: 'angry' },
  { emoji: '\u{1F630}', label: 'Anxious', color: '#f59e0b', value: 'anxious' },
  { emoji: '\u{1F634}', label: 'Tired', color: '#8b5cf6', value: 'tired' },
  { emoji: '\u{1F973}', label: 'Excited', color: '#ec4899', value: 'excited' },
  { emoji: '\u{1F610}', label: 'Neutral', color: '#64748b', value: 'neutral' },
];
