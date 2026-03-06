package handlers

import (
	"encoding/json"
	"net/http"
	"pay-slip-app/internal/constants"
	"pay-slip-app/internal/models"
)

// ── User handlers ─────────────────────────────────────────────────────────────

// GetCurrentUser handles GET /api/me
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := mustGetUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	jsonResponse(w, http.StatusOK, user)
}

// GetUsers handles GET /api/users  [admin only]
func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if currentUser.Role != string(constants.RoleAdmin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	users, err := h.UserService.GetAllUsers()
	if err != nil {
		http.Error(w, "Failed to get users", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, users)
}

// UpdateUserRole handles PUT /api/users/{id}/role  [admin only]
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if currentUser.Role != string(constants.RoleAdmin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	userID := r.PathValue("id")
	var req models.UpdateUserRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.UserService.UpdateUserRole(userID, req.Role); err != nil {
		http.Error(w, "Failed to update user role", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, map[string]string{"message": "User role updated successfully"})
}
