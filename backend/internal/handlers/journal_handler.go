package handlers

import (
	"errors"
	"strconv"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type JournalHandler struct {
	service *services.JournalService
}

func NewJournalHandler(service *services.JournalService) *JournalHandler {
	return &JournalHandler{service: service}
}

func (h *JournalHandler) Create(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	var req dto.CreateJournalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid request body",
		})
	}

	entry, err := h.service.CreateEntry(userID, req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidMoodEmoji) ||
			errors.Is(err, services.ErrInvalidMoodScore) ||
			errors.Is(err, services.ErrInvalidCardColor) {
			return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to create journal entry",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(entry)
}

func (h *JournalHandler) List(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit > 100 {
		limit = 100
	}

	entries, total, err := h.service.GetEntries(userID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to fetch journal entries",
		})
	}

	return c.JSON(dto.JournalListResponse{
		Entries: entries,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
	})
}

func (h *JournalHandler) Get(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	entryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid entry ID",
		})
	}

	entry, err := h.service.GetEntry(userID, entryID)
	if err != nil {
		if errors.Is(err, services.ErrJournalNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		if errors.Is(err, services.ErrNotOwner) {
			return c.Status(fiber.StatusForbidden).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to fetch journal entry",
		})
	}

	return c.JSON(entry)
}

func (h *JournalHandler) Update(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	entryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid entry ID",
		})
	}

	var req dto.UpdateJournalRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid request body",
		})
	}

	entry, err := h.service.UpdateEntry(userID, entryID, req)
	if err != nil {
		if errors.Is(err, services.ErrJournalNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		if errors.Is(err, services.ErrNotOwner) {
			return c.Status(fiber.StatusForbidden).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		if errors.Is(err, services.ErrInvalidMoodEmoji) ||
			errors.Is(err, services.ErrInvalidMoodScore) ||
			errors.Is(err, services.ErrInvalidCardColor) {
			return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to update journal entry",
		})
	}

	return c.JSON(entry)
}

func (h *JournalHandler) Delete(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	entryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error: true, Message: "Invalid entry ID",
		})
	}

	err = h.service.DeleteEntry(userID, entryID)
	if err != nil {
		if errors.Is(err, services.ErrJournalNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		if errors.Is(err, services.ErrNotOwner) {
			return c.Status(fiber.StatusForbidden).JSON(dto.ErrorResponse{
				Error: true, Message: err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to delete journal entry",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *JournalHandler) GetStreak(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	streak, err := h.service.GetStreak(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to fetch streak",
		})
	}

	return c.JSON(streak)
}

func (h *JournalHandler) GetWeeklyInsights(c *fiber.Ctx) error {
	userID, err := extractUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error: true, Message: "Unauthorized",
		})
	}

	insights, err := h.service.GetWeeklyInsights(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error: true, Message: "Failed to fetch weekly insights",
		})
	}

	return c.JSON(insights)
}
