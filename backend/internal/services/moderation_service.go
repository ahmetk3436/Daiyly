package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrReportNotFound = errors.New("report not found")
	ErrAlreadyBlocked = errors.New("user already blocked")
	ErrSelfBlock      = errors.New("cannot block yourself")
)

// ProfanityPatterns is a basic regex-based content filter (Apple Guideline 1.2).
// In production, replace or augment with an API-based filter (e.g., Perspective API).
var ProfanityPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(spam|scam)\b`),
	// Add more patterns as needed
}

type ModerationService struct {
	db *gorm.DB
}

func NewModerationService(db *gorm.DB) *ModerationService {
	return &ModerationService{db: db}
}

// --- Content Filtering ---

// FilterContent checks text against profanity patterns. Returns true if clean.
func (s *ModerationService) FilterContent(text string) (bool, string) {
	for _, pattern := range ProfanityPatterns {
		if pattern.MatchString(text) {
			return false, fmt.Sprintf("Content contains prohibited terms matching: %s", pattern.String())
		}
	}
	return true, ""
}

// SanitizeContent removes or replaces prohibited content.
func (s *ModerationService) SanitizeContent(text string) string {
	result := text
	for _, pattern := range ProfanityPatterns {
		result = pattern.ReplaceAllString(result, "[filtered]")
	}
	return result
}

// --- Reports ---

func (s *ModerationService) CreateReport(reporterID uuid.UUID, req *dto.CreateReportRequest) (*models.Report, error) {
	validTypes := map[string]bool{"user": true, "post": true, "comment": true}
	if !validTypes[req.ContentType] {
		return nil, errors.New("invalid content_type: must be user, post, or comment")
	}

	if strings.TrimSpace(req.Reason) == "" {
		return nil, errors.New("reason is required")
	}

	report := models.Report{
		ID:          uuid.New(),
		ReporterID:  reporterID,
		ContentType: req.ContentType,
		ContentID:   req.ContentID,
		Reason:      req.Reason,
		Status:      "pending",
	}

	if err := s.db.Create(&report).Error; err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	return &report, nil
}

func (s *ModerationService) ListReports(status string, limit, offset int) ([]models.Report, int64, error) {
	var reports []models.Report
	var total int64

	query := s.db.Model(&models.Report{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&reports).Error; err != nil {
		return nil, 0, err
	}

	return reports, total, nil
}

func (s *ModerationService) ActionReport(reportID uuid.UUID, req *dto.ActionReportRequest) error {
	validStatuses := map[string]bool{"reviewed": true, "actioned": true, "dismissed": true}
	if !validStatuses[req.Status] {
		return errors.New("invalid status: must be reviewed, actioned, or dismissed")
	}

	result := s.db.Model(&models.Report{}).
		Where("id = ?", reportID).
		Updates(map[string]interface{}{
			"status":     req.Status,
			"admin_note": req.AdminNote,
		})

	if result.RowsAffected == 0 {
		return ErrReportNotFound
	}

	return result.Error
}

// --- Blocking ---

func (s *ModerationService) BlockUser(blockerID, blockedID uuid.UUID) error {
	if blockerID == blockedID {
		return ErrSelfBlock
	}

	var existing models.Block
	if err := s.db.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).First(&existing).Error; err == nil {
		return ErrAlreadyBlocked
	}

	block := models.Block{
		ID:        uuid.New(),
		BlockerID: blockerID,
		BlockedID: blockedID,
	}

	return s.db.Create(&block).Error
}

func (s *ModerationService) UnblockUser(blockerID, blockedID uuid.UUID) error {
	return s.db.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Delete(&models.Block{}).Error
}

func (s *ModerationService) GetBlockedIDs(userID uuid.UUID) ([]uuid.UUID, error) {
	var blocks []models.Block
	if err := s.db.Where("blocker_id = ?", userID).Find(&blocks).Error; err != nil {
		return nil, err
	}

	ids := make([]uuid.UUID, len(blocks))
	for i, b := range blocks {
		ids[i] = b.BlockedID
	}
	return ids, nil
}
