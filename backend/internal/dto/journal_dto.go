package dto

import "github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/models"

type CreateJournalRequest struct {
	MoodEmoji string `json:"mood_emoji"`
	MoodScore int    `json:"mood_score"`
	Content   string `json:"content"`
	PhotoURL  string `json:"photo_url"`
	CardColor string `json:"card_color"`
	IsPrivate bool   `json:"is_private"`
}

type UpdateJournalRequest struct {
	MoodEmoji *string `json:"mood_emoji"`
	MoodScore *int    `json:"mood_score"`
	Content   *string `json:"content"`
	PhotoURL  *string `json:"photo_url"`
	CardColor *string `json:"card_color"`
	IsPrivate *bool   `json:"is_private"`
}

type JournalListResponse struct {
	Entries []models.JournalEntry `json:"entries"`
	Total   int64                 `json:"total"`
	Limit   int                   `json:"limit"`
	Offset  int                   `json:"offset"`
}

type WeeklyInsights struct {
	AverageMoodScore int          `json:"average_mood_score"`
	MoodTrend        string       `json:"mood_trend"`
	TopMood          string       `json:"top_mood"`
	TotalEntries     int          `json:"total_entries"`
	DailyScores      []DailyScore `json:"daily_scores"`
}

type DailyScore struct {
	Date  string `json:"date"`
	Score int    `json:"score"`
}
