// internal/handlers/handlers.go
package handlers

import (
	"encoding/json"
	"net/http"
	"pay-slip-app/internal/constants"
	"pay-slip-app/internal/models"
	"pay-slip-app/internal/services"
	"pay-slip-app/internal/storage"
)

type Handler struct {
	UserService    *services.UserService
	PaySlipService *services.PaySlipService
	Storage        *storage.FirebaseStorage
}

func New(userService *services.UserService, paySlipService *services.PaySlipService, storage *storage.FirebaseStorage) *Handler {
	return &Handler{
		UserService:    userService,
		PaySlipService: paySlipService,
		Storage:        storage,
	}
}


// ── helpers ───────────────────────────────────────────────────────────────────

func mustGetUser(r *http.Request) *models.User {
	val := r.Context().Value(constants.ContextUserKey)
	if val == nil {
		return nil
	}
	return val.(*models.User)
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

