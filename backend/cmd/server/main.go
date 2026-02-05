package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/config"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/database"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/handlers"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/middleware"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/routes"
	"github.com/ahmetcoskunkizilkaya/fully-autonomous-mobile-system/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"time"
)

func main() {
	cfg := config.Load()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if cfg.DBPassword == "" {
		log.Fatal("DB_PASSWORD environment variable is required")
	}

	// Database
	if err := database.Connect(cfg); err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	if err := database.Migrate(); err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	// Services
	authService := services.NewAuthService(database.DB, cfg)
	subscriptionService := services.NewSubscriptionService(database.DB)
	moderationService := services.NewModerationService(database.DB)

	// Handlers
	authHandler := handlers.NewAuthHandler(authService)
	healthHandler := handlers.NewHealthHandler()
	webhookHandler := handlers.NewWebhookHandler(subscriptionService, cfg)
	moderationHandler := handlers.NewModerationHandler(moderationService)

	// Fiber app
	app := fiber.New(fiber.Config{
		BodyLimit:    4 * 1024 * 1024, // 4MB
		ErrorHandler: customErrorHandler,
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(fiberlogger.New(fiberlogger.Config{
		Format: "${time} | ${status} | ${latency} | ${ip} | ${method} | ${path}\n",
	}))
	app.Use(middleware.CORS(cfg))

	// Rate limiter on auth endpoints
	authLimiter := limiter.New(limiter.Config{
		Max:               20,
		Expiration:        1 * time.Minute,
		LimiterMiddleware: limiter.SlidingWindow{},
	})
	app.Use("/api/auth", authLimiter)

	// Routes
	routes.Setup(app, cfg, authHandler, healthHandler, webhookHandler, moderationHandler)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	log.Printf("Server running on port %s", cfg.Port)

	<-quit
	log.Println("Shutting down server...")
	if err := app.Shutdown(); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}
	log.Println("Server stopped")
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error":   true,
		"message": err.Error(),
	})
}
