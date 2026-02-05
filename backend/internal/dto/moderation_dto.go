package dto

import "github.com/google/uuid"

// --- Report DTOs ---

type CreateReportRequest struct {
	ContentType string `json:"content_type"` // "user", "post", "comment"
	ContentID   string `json:"content_id"`
	Reason      string `json:"reason"`
}

type ReportResponse struct {
	ID          uuid.UUID `json:"id"`
	ReporterID  uuid.UUID `json:"reporter_id"`
	ContentType string    `json:"content_type"`
	ContentID   string    `json:"content_id"`
	Reason      string    `json:"reason"`
	Status      string    `json:"status"`
	AdminNote   string    `json:"admin_note,omitempty"`
	CreatedAt   string    `json:"created_at"`
}

type ActionReportRequest struct {
	Status    string `json:"status"`     // "reviewed", "actioned", "dismissed"
	AdminNote string `json:"admin_note"`
}

// --- Block DTOs ---

type BlockUserRequest struct {
	BlockedID uuid.UUID `json:"blocked_id"`
}

// --- Account Deletion DTOs ---

type DeleteAccountRequest struct {
	Password string `json:"password"` // Require password confirmation for security
}

// --- Apple Sign-In DTOs ---

type AppleSignInRequest struct {
	IdentityToken string `json:"identity_token"` // JWT from Apple
	AuthCode      string `json:"authorization_code"`
	FullName      string `json:"full_name,omitempty"`
	Email         string `json:"email,omitempty"` // Only sent on first sign-in
}
