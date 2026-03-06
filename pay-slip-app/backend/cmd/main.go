// cmd/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"pay-slip-app/internal/configs"
	"pay-slip-app/internal/database"
	"pay-slip-app/internal/handlers"
	"pay-slip-app/internal/services"
	"pay-slip-app/internal/storage"
	"time"

	"pay-slip-app/pkg/auth"

	gcs "cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

func main() {
	// Load configuration from environment variables.
	cfg := configs.Load()

	ctx := context.Background()

	// Build option slice — use service-account JSON if provided, otherwise ADC.
	var opts []option.ClientOption
	if cfg.Firebase.Credentials != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.Firebase.Credentials))
	}

	// ── MySQL (users) ────────────────────────────────────────────────────────
	dbConn, err := database.NewDatabase(cfg.DB)
	if err != nil {
		log.Fatalf("Could not connect to the database: %v", err)
	}

	// MySQL (users and pay slip metadata) ─────────────────────────────────────
	userService := services.NewUserService(dbConn)
	paySlipService := services.NewPaySlipService(dbConn)

	// ── Firebase Storage (GCS) ───────────────────────────────────────────────
	gcsClient, err := gcs.NewClient(ctx, opts...)
	if err != nil {
		log.Fatalf("Failed to create GCS client: %v", err)
	}
	defer gcsClient.Close()
	paySlipStorage := storage.New(gcsClient, cfg.Firebase.StorageBucket)

	// ── Auth ─────────────────────────────────────────────────────────────────
	authenticator, err := auth.New(userService, cfg.Auth)
	if err != nil {
		log.Fatalf("Failed to initialize authenticator: %v", err)
	}
	defer authenticator.Close()

	// ── HTTP server ───────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	h := handlers.New(userService, paySlipService, paySlipStorage)

	// Auth middleware wrapper
	auth := authenticator.AuthMiddleware

	// User endpoints
	mux.Handle("GET /api/me", auth(http.HandlerFunc(h.GetCurrentUser)))
	mux.Handle("GET /api/users", auth(http.HandlerFunc(h.GetUsers)))
	mux.Handle("PUT /api/users/{id}/role", auth(http.HandlerFunc(h.UpdateUserRole)))

	// Pay slip endpoints
	mux.Handle("POST /api/upload", auth(http.HandlerFunc(h.UploadFile)))
	mux.Handle("POST /api/pay-slips", auth(http.HandlerFunc(h.CreatePaySlip)))
	mux.Handle("GET /api/pay-slips", auth(http.HandlerFunc(h.GetPaySlips)))
	mux.Handle("GET /api/pay-slips/{id}", auth(http.HandlerFunc(h.GetPaySlipByID)))
	mux.Handle("DELETE /api/pay-slips/{id}", auth(http.HandlerFunc(h.DeletePaySlip)))

	// Health check (no auth required).
	mux.Handle("GET /ping", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"message": "pong"}`)
	}))

	// CORS middleware.
	handler := cors(mux)

	server := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,  // Time to read the entire request
		WriteTimeout: 15 * time.Second,  // Time to write the response
		IdleTimeout:  120 * time.Second, // Time to keep idle connections open
	}

	log.Printf("Server running on :%s\n", cfg.App.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to run server: %v", err)
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// If no origin header is present, proceed without setting CORS headers.
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Allow all origins (wildcard).
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
