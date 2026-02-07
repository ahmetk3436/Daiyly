export interface JournalEntry {
  id: string;
  user_id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  photo_url: string;
  card_color: string;
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

export interface GuestEntry {
  id: string;
  mood_emoji: string;
  mood_score: number;
  content: string;
  card_color: string;
  created_at: string;
}
