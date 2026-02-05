package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JournalEntry struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;index" json:"user_id"`
	MoodEmoji   string         `gorm:"type:varchar(10)" json:"mood_emoji"`
	MoodScore   int            `gorm:"default:50" json:"mood_score"`
	Content     string         `gorm:"type:text" json:"content"`
	PhotoURL    string         `gorm:"type:text" json:"photo_url"`
	CardColor   string         `gorm:"type:varchar(7)" json:"card_color"`
	EntryDate   time.Time      `gorm:"index" json:"entry_date"`
	IsPrivate   bool           `gorm:"default:true" json:"is_private"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type JournalStreak struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;uniqueIndex" json:"user_id"`
	CurrentStreak int       `gorm:"default:0" json:"current_streak"`
	LongestStreak int       `gorm:"default:0" json:"longest_streak"`
	TotalEntries  int       `gorm:"default:0" json:"total_entries"`
	LastEntryDate time.Time `json:"last_entry_date"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

var MoodEmojis = []string{"😊", "😢", "😡", "😰", "😴", "🥳", "😌", "🤔", "😍", "😤"}
var CardColors = []string{"#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", "#fef2f2"}
