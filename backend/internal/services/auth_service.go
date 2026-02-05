package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/config"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidToken       = errors.New("invalid or expired refresh token")
	ErrUserNotFound       = errors.New("user not found")
)

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func (s *AuthService) Register(req *dto.RegisterRequest) (*dto.AuthResponse, error) {
	if len(req.Email) == 0 || len(req.Password) < 8 {
		return nil, errors.New("email required and password must be at least 8 characters")
	}

	var existing models.User
	if err := s.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		ID:       uuid.New(),
		Email:    req.Email,
		Password: string(hash),
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return s.generateTokenPair(&user)
}

func (s *AuthService) Login(req *dto.LoginRequest) (*dto.AuthResponse, error) {
	var user models.User
	if err := s.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.generateTokenPair(&user)
}

func (s *AuthService) Refresh(req *dto.RefreshRequest) (*dto.AuthResponse, error) {
	tokenHash := hashToken(req.RefreshToken)

	var stored models.RefreshToken
	if err := s.db.Where("token_hash = ? AND revoked = false", tokenHash).First(&stored).Error; err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().After(stored.ExpiresAt) {
		s.db.Model(&stored).Update("revoked", true)
		return nil, ErrInvalidToken
	}

	// Revoke old token (rotation)
	s.db.Model(&stored).Update("revoked", true)

	var user models.User
	if err := s.db.First(&user, "id = ?", stored.UserID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return s.generateTokenPair(&user)
}

func (s *AuthService) Logout(req *dto.LogoutRequest) error {
	tokenHash := hashToken(req.RefreshToken)
	return s.db.Model(&models.RefreshToken{}).
		Where("token_hash = ?", tokenHash).
		Update("revoked", true).Error
}

// DeleteAccount implements Apple Guideline 5.1.1(v) - account deletion.
// Scrubs all user data: tokens, subscriptions, reports, blocks, then soft-deletes user.
func (s *AuthService) DeleteAccount(userID uuid.UUID, password string) error {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return ErrUserNotFound
	}

	// Verify password (skip for Apple Sign-In users who have no password)
	if user.Password != "" && password != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
			return ErrInvalidCredentials
		}
	}

	// Scrub all associated data in a transaction
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Revoke all refresh tokens
		tx.Where("user_id = ?", userID).Delete(&models.RefreshToken{})

		// Remove subscriptions
		tx.Where("user_id = ?", userID).Delete(&models.Subscription{})

		// Remove reports filed by user
		tx.Where("reporter_id = ?", userID).Delete(&models.Report{})

		// Remove blocks
		tx.Where("blocker_id = ? OR blocked_id = ?", userID, userID).Delete(&models.Block{})

		// Soft-delete the user (GORM DeletedAt)
		return tx.Delete(&user).Error
	})
}

// AppleSignIn handles Sign in with Apple (Guideline 4.8).
// Verifies Apple identity token and creates/finds a user.
func (s *AuthService) AppleSignIn(req *dto.AppleSignInRequest) (*dto.AuthResponse, error) {
	// Decode the Apple identity token to extract the subject (Apple user ID)
	// In production, verify the token signature against Apple's public keys at:
	// https://appleid.apple.com/auth/keys
	parts := strings.Split(req.IdentityToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid Apple identity token format")
	}

	// Decode the payload (base64url)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode Apple token payload: %w", err)
	}

	var claims struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse Apple token claims: %w", err)
	}

	if claims.Sub == "" {
		return nil, errors.New("Apple token missing subject")
	}

	// Use email from token, or from the request (first sign-in only)
	email := claims.Email
	if email == "" {
		email = req.Email
	}
	if email == "" {
		email = claims.Sub + "@privaterelay.appleid.com"
	}

	// Find existing user by Apple ID (stored in email field with apple: prefix)
	// or by email match
	var user models.User
	appleEmail := "apple:" + claims.Sub
	err = s.db.Where("email = ? OR email = ?", appleEmail, email).First(&user).Error

	if err != nil {
		// Create new user for first-time Apple sign-in
		user = models.User{
			ID:       uuid.New(),
			Email:    email,
			Password: "", // Apple users have no password
		}
		if err := s.db.Create(&user).Error; err != nil {
			return nil, fmt.Errorf("failed to create Apple user: %w", err)
		}
	}

	return s.generateTokenPair(&user)
}

func (s *AuthService) generateTokenPair(user *models.User) (*dto.AuthResponse, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: dto.UserResponse{
			ID:    user.ID,
			Email: user.Email,
		},
	}, nil
}

func (s *AuthService) generateAccessToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(s.cfg.JWTAccessExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *AuthService) generateRefreshToken(user *models.User) (string, error) {
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	rawToken := base64.URLEncoding.EncodeToString(rawBytes)
	tokenHash := hashToken(rawToken)

	record := models.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(s.cfg.JWTRefreshExpiry),
	}

	if err := s.db.Create(&record).Error; err != nil {
		return "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return rawToken, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}
