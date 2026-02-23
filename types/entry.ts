export interface Entry {
  id: string;
  content: string;
  emoji: string;
  card_color: string;
  score: number;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface EntriesResponse {
  entries: Entry[];
  total: number;
  has_more: boolean;
}
