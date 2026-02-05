package handlers

import (
	"errors"
	"strconv"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type ModerationHandler struct {
	moderationService *services.ModerationService
}

func NewModerationHandler(moderationService *services.ModerationService) *ModerationHandler {
	return &ModerationHandler{moderationService: moderationService}
}

// --- User-facing endpoints ---

// CreateReport allows any authenticated user to report content (Apple Guideline 1.2).
func (h *ModerationHandler) CreateReport(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	var req dto.CreateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid request body",
		})
	}

	report, err := h.moderationService.CreateReport(userID, &req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(report)
}

// BlockUser allows a user to block another user (Apple Guideline 1.2 - immediate hiding).
func (h *ModerationHandler) BlockUser(c *fiber.Ctx) error {
	blockerID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	var req dto.BlockUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid request body",
		})
	}

	if err := h.moderationService.BlockUser(blockerID, req.BlockedID); err != nil {
		if errors.Is(err, services.ErrSelfBlock) || errors.Is(err, services.ErrAlreadyBlocked) {
			return c.Status(fiber.StatusConflict).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to block user",
		})
	}

	return c.JSON(fiber.Map{"message": "User blocked successfully"})
}

// UnblockUser removes a block.
func (h *ModerationHandler) UnblockUser(c *fiber.Ctx) error {
	blockerID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	blockedIDStr := c.Params("id")
	blockedID, err := uuid.Parse(blockedIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid user ID",
		})
	}

	if err := h.moderationService.UnblockUser(blockerID, blockedID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to unblock user",
		})
	}

	return c.JSON(fiber.Map{"message": "User unblocked successfully"})
}

// --- Admin endpoints ---

// ListReports returns all reports (admin moderation panel).
func (h *ModerationHandler) ListReports(c *fiber.Ctx) error {
	status := c.Query("status", "")
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	reports, total, err := h.moderationService.ListReports(status, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to fetch reports",
		})
	}

	return c.JSON(fiber.Map{
		"reports": reports,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// ActionReport lets admins review/action/dismiss a report.
func (h *ModerationHandler) ActionReport(c *fiber.Ctx) error {
	reportIDStr := c.Params("id")
	reportID, err := uuid.Parse(reportIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid report ID",
		})
	}

	var req dto.ActionReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid request body",
		})
	}

	if err := h.moderationService.ActionReport(reportID, &req); err != nil {
		if errors.Is(err, services.ErrReportNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: err.Error(),
		})
	}

	return c.JSON(fiber.Map{"message": "Report updated successfully"})
}

// extractUserID gets the user UUID from the JWT claims in context.
func extractUserID(c *fiber.Ctx) (uuid.UUID, error) {
	token, ok := c.Locals("user").(*jwt.Token)
	if !ok {
		return uuid.Nil, errors.New("invalid token in context")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, errors.New("invalid claims")
	}

	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, errors.New("missing sub claim")
	}

	return uuid.Parse(sub)
}
