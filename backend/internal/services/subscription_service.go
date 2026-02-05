package services

import (
	"fmt"
	"time"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubscriptionService struct {
	db *gorm.DB
}

func NewSubscriptionService(db *gorm.DB) *SubscriptionService {
	return &SubscriptionService{db: db}
}

func (s *SubscriptionService) HandleWebhookEvent(event *dto.RevenueCatEvent) error {
	switch event.Type {
	case "INITIAL_PURCHASE":
		return s.handleInitialPurchase(event)
	case "RENEWAL":
		return s.handleRenewal(event)
	case "CANCELLATION":
		return s.handleCancellation(event)
	case "EXPIRATION":
		return s.handleExpiration(event)
	default:
		// Log unknown event type but don't fail
		return nil
	}
}

func (s *SubscriptionService) handleInitialPurchase(event *dto.RevenueCatEvent) error {
	sub := models.Subscription{
		ID:                 uuid.New(),
		RevenueCatID:       event.AppUserID,
		ProductID:          event.ProductID,
		Status:             "active",
		CurrentPeriodStart: msToTime(event.PurchasedAtMs),
		CurrentPeriodEnd:   msToTime(event.ExpirationAtMs),
	}

	// Try to link to existing user by RevenueCat app_user_id
	var user models.User
	if err := s.db.Where("id = ?", event.AppUserID).First(&user).Error; err == nil {
		sub.UserID = user.ID
	}

	return s.db.Create(&sub).Error
}

func (s *SubscriptionService) handleRenewal(event *dto.RevenueCatEvent) error {
	var sub models.Subscription
	if err := s.db.Where("revenuecat_id = ?", event.AppUserID).First(&sub).Error; err != nil {
		return fmt.Errorf("subscription not found for renewal: %w", err)
	}

	return s.db.Model(&sub).Updates(map[string]interface{}{
		"status":               "active",
		"current_period_end":   msToTime(event.ExpirationAtMs),
		"current_period_start": msToTime(event.PurchasedAtMs),
	}).Error
}

func (s *SubscriptionService) handleCancellation(event *dto.RevenueCatEvent) error {
	return s.db.Model(&models.Subscription{}).
		Where("revenuecat_id = ?", event.AppUserID).
		Update("status", "cancelled").Error
}

func (s *SubscriptionService) handleExpiration(event *dto.RevenueCatEvent) error {
	return s.db.Model(&models.Subscription{}).
		Where("revenuecat_id = ?", event.AppUserID).
		Update("status", "expired").Error
}

func msToTime(ms int64) time.Time {
	return time.Unix(ms/1000, (ms%1000)*int64(time.Millisecond))
}
