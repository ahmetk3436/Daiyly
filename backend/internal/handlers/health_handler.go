package handlers

import (
	"time"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/database"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/dto"
	"github.com/gofiber/fiber/v2"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Check(c *fiber.Ctx) error {
	dbStatus := "ok"
	if err := database.Ping(); err != nil {
		dbStatus = "unhealthy: " + err.Error()
	}

	return c.JSON(dto.HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		DB:        dbStatus,
	})
}
