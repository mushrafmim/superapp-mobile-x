package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"pay-slip-app/internal/constants"
	"pay-slip-app/internal/models"
	"strconv"
	"strings"
	"time"
)

// ── PaySlip handlers ──────────────────────────────────────────────────────────

// UploadFile handles POST /api/upload [admin only]
func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if currentUser.Role != string(constants.RoleAdmin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Enforce max upload size (10MB)
	r.Body = http.MaxBytesReader(w, r.Body, int64(constants.MaxUploadSizeMB)<<20)

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file is required and must be under 10MB", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ctx := r.Context()
	url, err := h.Storage.UploadFile(ctx, file, header.Filename)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to upload to storage: %v", err), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"fileUrl": url})
}

// CreatePaySlip handles POST /api/pay-slips  [admin only]
func (h *Handler) CreatePaySlip(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if currentUser.Role != string(constants.RoleAdmin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req models.CreatePaySlipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Resolve the target user's email
	targetUser, err := h.UserService.GetUserByID(req.UserID)
	if err != nil {
		http.Error(w, "userId not found", http.StatusBadRequest)
		return
	}
	userEmail := targetUser.Email

	// Upsert check
	existing, err := h.PaySlipService.GetPaySlipByUserMonthYear(req.UserID, req.Month, req.Year)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Extract the clean path
	cleanPath := h.Storage.ExtractPathFromURL(req.FileURL)

	if existing != nil {
		if err := h.PaySlipService.UpdatePaySlipFile(existing.ID, cleanPath, currentUser.ID); err != nil {
			http.Error(w, "Failed to update pay slip", http.StatusInternalServerError)
			return
		}
		updated, err := h.PaySlipService.GetPaySlipByID(existing.ID)
		if err != nil {
			http.Error(w, "Failed to retrieve updated pay slip", http.StatusInternalServerError)
			return
		}

		// Sign the URL before sending back
		if signed, err := h.Storage.GetSignedURL(updated.FileURL); err == nil {
			updated.FileURL = signed
		}

		jsonResponse(w, http.StatusOK, updated)
		return
	}

	ps := &models.PaySlip{
		UserID:     req.UserID,
		UserEmail:  userEmail,
		Month:      req.Month,
		Year:       req.Year,
		FileURL:    cleanPath,
		UploadedBy: currentUser.ID,
		CreatedAt:  time.Now(),
	}
	if err := h.PaySlipService.InsertPaySlip(ps); err != nil {
		http.Error(w, "Failed to save pay slip", http.StatusInternalServerError)
		return
	}

	// Sign the URL before sending back to frontend
	if signed, err := h.Storage.GetSignedURL(ps.FileURL); err == nil {
		ps.FileURL = signed
	}

	jsonResponse(w, http.StatusCreated, ps)
}

// GetPaySlips handles GET /api/pay-slips
func (h *Handler) GetPaySlips(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	isAdmin := currentUser.Role == string(constants.RoleAdmin)

	// 1. Parse Pagination Params
	limitStr := r.URL.Query().Get("limit")
	cursorStr := r.URL.Query().Get("cursor")

	var limit int
	if limitStr != "" {
		limit, _ = strconv.Atoi(limitStr)
	}
	if limit <= 0 {
		limit = 20 // Default limit if not specified or invalid
	}

	var afterID string
	var afterCreatedAt *time.Time

	if cursorStr != "" {
		decoded, err := base64.StdEncoding.DecodeString(cursorStr)
		if err == nil {
			parts := strings.Split(string(decoded), "|")
			if len(parts) == 2 {
				ts, err := time.Parse(time.RFC3339, parts[0])
				if err == nil {
					afterCreatedAt = &ts
					afterID = parts[1]
				}
			}
		}
	}

	var slips []models.PaySlip
	var total int
	var err error
	if isAdmin {
		slips, total, err = h.PaySlipService.GetPaySlips(limit, afterID, afterCreatedAt)
	} else {
		slips, total, err = h.PaySlipService.GetPaySlipsByUserID(currentUser.ID, limit, afterID, afterCreatedAt)
	}

	if err != nil {
		http.Error(w, "Failed to get pay slips", http.StatusInternalServerError)
		return
	}

	// 2. Refresh Signed URLs for the response
	data := slips
	if limit > 0 && len(slips) > limit {
		data = slips[:limit]
	}

	for i := range data {
		if signed, err := h.Storage.GetSignedURL(data[i].FileURL); err == nil {
			data[i].FileURL = signed
		}
	}

	var nextCursor string
	if limit > 0 && len(slips) > limit {
		last := data[limit-1]
		nextCursor = base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s|%s", last.CreatedAt.Format(time.RFC3339), last.ID)))
	}

	jsonResponse(w, http.StatusOK, models.PaySlipsResponse{
		Data:       data,
		Total:      total,
		NextCursor: nextCursor,
	})
}

// GetPaySlipByID handles GET /api/pay-slips/{id}
func (h *Handler) GetPaySlipByID(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ps, err := h.PaySlipService.GetPaySlipByID(r.PathValue("id"))
	if err != nil {
		http.Error(w, "Pay slip not found", http.StatusNotFound)
		return
	}

	if currentUser.Role != string(constants.RoleAdmin) && ps.UserID != currentUser.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Generate fresh signed URL
	if signed, err := h.Storage.GetSignedURL(ps.FileURL); err == nil {
		ps.FileURL = signed
	}

	jsonResponse(w, http.StatusOK, ps)
}

// DeletePaySlip handles DELETE /api/pay-slips/{id}  [admin only]
func (h *Handler) DeletePaySlip(w http.ResponseWriter, r *http.Request) {
	currentUser := mustGetUser(r)
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if currentUser.Role != string(constants.RoleAdmin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	id := r.PathValue("id")
	if _, err := h.PaySlipService.GetPaySlipByID(id); err != nil {
		http.Error(w, "Pay slip not found", http.StatusNotFound)
		return
	}

	if err := h.PaySlipService.DeletePaySlip(id); err != nil {
		http.Error(w, "Failed to delete pay slip", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
