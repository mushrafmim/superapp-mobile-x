package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"resource-app/internal/api"
	"resource-app/internal/auth"
	"resource-app/internal/config"
	"resource-app/internal/db"
	"resource-app/internal/store"
	"resource-app/internal/user"
	"resource-app/internal/resource"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		// Try loading from parent directory if not found in current (for dev convenience)
		if err := godotenv.Load("../../.env"); err != nil {
			log.Println("Warning: .env file not found, using environment variables")
		}
	}

	// Initialize JWKS for authentication
	if err := auth.InitJWKS(); err != nil {
		log.Printf("Warning: JWKS initialization failed: %v", err)
		log.Println("Running without JWT authentication validation (if JWKS_URL is required)")
	} else {
		log.Println("JWKS initialized successfully")
	}

	// Initialize database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Construct DSN from separate fields if DATABASE_URL is not set
		dbUser := config.GetEnv("DB_USER", "root")
		dbPass := config.GetEnv("DB_PASSWORD", "password")
		dbHost := config.GetEnv("DB_HOST", "localhost")
		dbPort := config.GetEnv("DB_PORT", "3306")
		dbName := config.GetEnv("DB_NAME", "resource_app")

		dbURL = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			dbUser, dbPass, dbHost, dbPort, dbName)
	}

	database, err := db.NewDatabase(dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize store
	dbStore := store.NewDBStore(database)

	// Initialize user service
	userRepo := user.NewGormUserRepository(database)
	userService := user.NewService(userRepo)

	// Initialize resource repository
	resourceRepo := resource.NewGormRepository(database)

	// Initialize resource service
	resourceService := resource.NewService(resourceRepo)

	// Create Gin router
	r := gin.Default()

	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // Adjust for production
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API Routes
	apiGroup := r.Group("/api")

	// Apply authentication middleware if JWKS_URL is set, otherwise use Dev mode

	// Apply authentication middleware if JWKS_URL is set
	if os.Getenv("JWKS_URL") != "" {
		apiGroup.Use(auth.AuthMiddleware(userService))
	} else {
		apiGroup.Use(auth.DevAuthMiddleware(userService))
	}

	// Users
	user.RegisterRoutes(apiGroup, userService)

	// Resources
	apiGroup.GET("/resources", resource.HandleGetResources(resourceService))
	apiGroup.POST("/resources", resource.HandleAddResource(resourceService))
	apiGroup.PUT("/resources/:id", resource.HandleUpdateResource(resourceService))
	apiGroup.DELETE("/resources/:id", resource.HandleDeleteResource(resourceService))

	// Bookings
	apiGroup.GET("/bookings", api.HandleGetBookings(dbStore))
	apiGroup.POST("/bookings", api.HandleCreateBooking(dbStore))
	apiGroup.POST("/bookings/:id/process", api.HandleProcessBooking(dbStore))
	apiGroup.POST("/bookings/:id/reschedule", api.HandleRescheduleBooking(dbStore))
	apiGroup.DELETE("/bookings/:id", api.HandleCancelBooking(dbStore))

	// Stats
	apiGroup.GET("/stats", api.HandleGetStats(dbStore))
	// holidays
	apiGroup.GET("/holidays", api.HandleGetHolidays())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": config.ServiceName,
		})
	})

	// Start server
	port := config.GetEnv("PORT", config.DefaultPort)
	log.Printf("Starting %s on port %s", config.ServiceName, port)


	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
