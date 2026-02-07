package services

import (
	"errors"
	"time"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrInvalidMoodEmoji = errors.New("invalid mood emoji")
	ErrInvalidMoodScore = errors.New("mood score must be between 1 and 100")
	ErrInvalidCardColor = errors.New("invalid card color")
	ErrJournalNotFound  = errors.New("journal entry not found")
	ErrNotOwner         = errors.New("you do not own this journal entry")
)

type JournalService struct {
	db *gorm.DB
}

func NewJournalService(db *gorm.DB) *JournalService {
	return &JournalService{db: db}
}

func (s *JournalService) CreateEntry(userID uuid.UUID, req dto.CreateJournalRequest) (*models.JournalEntry, error) {
	// Validate mood emoji
	if !isValidMoodEmoji(req.MoodEmoji) {
		return nil, ErrInvalidMoodEmoji
	}

	// Validate mood score
	if req.MoodScore < 1 || req.MoodScore > 100 {
		return nil, ErrInvalidMoodScore
	}

	// Validate card color (default if empty)
	if req.CardColor == "" {
		req.CardColor = "#dbeafe"
	}
	if !isValidCardColor(req.CardColor) {
		return nil, ErrInvalidCardColor
	}

	entry := models.JournalEntry{
		ID:        uuid.New(),
		UserID:    userID,
		MoodEmoji: req.MoodEmoji,
		MoodScore: req.MoodScore,
		Content:   req.Content,
		PhotoURL:  req.PhotoURL,
		CardColor: req.CardColor,
		EntryDate: time.Now().UTC(),
		IsPrivate: req.IsPrivate,
	}

	if err := s.db.Create(&entry).Error; err != nil {
		return nil, err
	}

	// Update streak after creating entry
	_ = s.UpdateStreak(userID)

	return &entry, nil
}

func (s *JournalService) GetEntries(userID uuid.UUID, limit, offset int) ([]models.JournalEntry, int64, error) {
	var entries []models.JournalEntry
	var total int64

	s.db.Model(&models.JournalEntry{}).Where("user_id = ?", userID).Count(&total)

	err := s.db.Where("user_id = ?", userID).
		Order("entry_date DESC").
		Limit(limit).
		Offset(offset).
		Find(&entries).Error

	return entries, total, err
}

func (s *JournalService) GetEntry(userID uuid.UUID, entryID uuid.UUID) (*models.JournalEntry, error) {
	var entry models.JournalEntry
	if err := s.db.First(&entry, "id = ?", entryID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrJournalNotFound
		}
		return nil, err
	}

	if entry.UserID != userID {
		return nil, ErrNotOwner
	}

	return &entry, nil
}

func (s *JournalService) UpdateEntry(userID uuid.UUID, entryID uuid.UUID, req dto.UpdateJournalRequest) (*models.JournalEntry, error) {
	entry, err := s.GetEntry(userID, entryID)
	if err != nil {
		return nil, err
	}

	if req.MoodEmoji != nil {
		if !isValidMoodEmoji(*req.MoodEmoji) {
			return nil, ErrInvalidMoodEmoji
		}
		entry.MoodEmoji = *req.MoodEmoji
	}

	if req.MoodScore != nil {
		if *req.MoodScore < 1 || *req.MoodScore > 100 {
			return nil, ErrInvalidMoodScore
		}
		entry.MoodScore = *req.MoodScore
	}

	if req.Content != nil {
		entry.Content = *req.Content
	}

	if req.PhotoURL != nil {
		entry.PhotoURL = *req.PhotoURL
	}

	if req.CardColor != nil {
		if !isValidCardColor(*req.CardColor) {
			return nil, ErrInvalidCardColor
		}
		entry.CardColor = *req.CardColor
	}

	if req.IsPrivate != nil {
		entry.IsPrivate = *req.IsPrivate
	}

	if err := s.db.Save(entry).Error; err != nil {
		return nil, err
	}

	return entry, nil
}

func (s *JournalService) DeleteEntry(userID uuid.UUID, entryID uuid.UUID) error {
	entry, err := s.GetEntry(userID, entryID)
	if err != nil {
		return err
	}

	return s.db.Delete(entry).Error
}

func (s *JournalService) GetStreak(userID uuid.UUID) (*models.JournalStreak, error) {
	var streak models.JournalStreak
	err := s.db.Where("user_id = ?", userID).First(&streak).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create default streak
		streak = models.JournalStreak{
			ID:            uuid.New(),
			UserID:        userID,
			CurrentStreak: 0,
			LongestStreak: 0,
			TotalEntries:  0,
		}
		if createErr := s.db.Create(&streak).Error; createErr != nil {
			return nil, createErr
		}
		return &streak, nil
	}
	if err != nil {
		return nil, err
	}
	return &streak, nil
}

func (s *JournalService) UpdateStreak(userID uuid.UUID) error {
	streak, err := s.GetStreak(userID)
	if err != nil {
		return err
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	lastEntry := streak.LastEntryDate.UTC().Truncate(24 * time.Hour)

	if today.Equal(lastEntry) {
		// Already journaled today, do nothing to streak count
		return nil
	}

	yesterday := today.AddDate(0, 0, -1)
	if lastEntry.Equal(yesterday) {
		// Consecutive day
		streak.CurrentStreak++
	} else {
		// Streak broken or first entry
		streak.CurrentStreak = 1
	}

	if streak.CurrentStreak > streak.LongestStreak {
		streak.LongestStreak = streak.CurrentStreak
	}

	streak.TotalEntries++
	streak.LastEntryDate = time.Now().UTC()

	return s.db.Save(streak).Error
}

func (s *JournalService) GetWeeklyInsights(userID uuid.UUID) (*dto.WeeklyInsights, error) {
	sevenDaysAgo := time.Now().UTC().AddDate(0, 0, -7)

	var entries []models.JournalEntry
	err := s.db.Where("user_id = ? AND entry_date >= ?", userID, sevenDaysAgo).
		Order("entry_date ASC").
		Find(&entries).Error
	if err != nil {
		return nil, err
	}

	if len(entries) == 0 {
		return &dto.WeeklyInsights{
			AverageMoodScore: 0,
			MoodTrend:        "stable",
			TopMood:          "",
			TotalEntries:     0,
			DailyScores:      []dto.DailyScore{},
		}, nil
	}

	// Calculate average
	totalScore := 0
	emojiCount := make(map[string]int)
	dailyScores := []dto.DailyScore{}

	for _, e := range entries {
		totalScore += e.MoodScore
		emojiCount[e.MoodEmoji]++
		dailyScores = append(dailyScores, dto.DailyScore{
			Date:  e.EntryDate.Format("2006-01-02"),
			Score: e.MoodScore,
		})
	}

	avgScore := totalScore / len(entries)

	// Find top mood
	topMood := ""
	maxCount := 0
	for emoji, count := range emojiCount {
		if count > maxCount {
			maxCount = count
			topMood = emoji
		}
	}

	// Calculate trend
	trend := "stable"
	if len(entries) >= 2 {
		mid := len(entries) / 2
		firstHalfTotal := 0
		for i := 0; i < mid; i++ {
			firstHalfTotal += entries[i].MoodScore
		}
		secondHalfTotal := 0
		for i := mid; i < len(entries); i++ {
			secondHalfTotal += entries[i].MoodScore
		}
		firstHalfAvg := firstHalfTotal / mid
		secondHalfAvg := secondHalfTotal / (len(entries) - mid)
		diff := secondHalfAvg - firstHalfAvg
		if diff > 5 {
			trend = "improving"
		} else if diff < -5 {
			trend = "declining"
		}
	}

	return &dto.WeeklyInsights{
		AverageMoodScore: avgScore,
		MoodTrend:        trend,
		TopMood:          topMood,
		TotalEntries:     len(entries),
		DailyScores:      dailyScores,
	}, nil
}

func isValidMoodEmoji(emoji string) bool {
	for _, valid := range models.MoodEmojis {
		if emoji == valid {
			return true
		}
	}
	return false
}

func isValidCardColor(color string) bool {
	for _, valid := range models.CardColors {
		if color == valid {
			return true
		}
	}
	return false
}
