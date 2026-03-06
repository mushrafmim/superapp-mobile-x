// internal/models/models.go
package models

import (
	"errors"
	"pay-slip-app/internal/constants"
	"time"
)

// User represents an authenticated employee in the system.
// ... (User struct remains the same)
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"-"`
}

// PaySlip represents a single pay slip record stored in MySQL.
type PaySlip struct {
	ID         string    `json:"id"`
	UserID     string    `json:"userId"`
	UserEmail  string    `json:"userEmail,omitempty"`
	Month      int       `json:"month"`
	Year       int       `json:"year"`
	FileURL    string    `json:"fileUrl"` // Firebase Storage download URL
	UploadedBy string    `json:"uploadedBy"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// PaySlipsResponse is the unified response for GET /api/pay-slips.
type PaySlipsResponse struct {
	Data       []PaySlip `json:"data"`
	Total      int       `json:"total"`
	NextCursor string    `json:"nextCursor,omitempty"`
}

// CreatePaySlipRequest is the JSON body for POST /api/pay-slips.
type CreatePaySlipRequest struct {
	UserID  string `json:"userId"`
	Month   int    `json:"month"`
	Year    int    `json:"year"`
	FileURL string `json:"fileUrl"`
}

func (r *CreatePaySlipRequest) Validate() error {
	if r.UserID == "" {
		return errors.New("userId is required")
	}
	if r.Month < 1 || r.Month > 12 {
		return errors.New("month must be between 1 and 12")
	}
	if r.Year < 2000 {
		return errors.New("year must be 2000 or later")
	}
	if r.FileURL == "" {
		return errors.New("fileUrl is required")
	}
	return nil
}

// UpdateUserRoleRequest is used by PUT /api/users/:id/role.
type UpdateUserRoleRequest struct {
	Role string `json:"role"`
}

func (r *UpdateUserRoleRequest) Validate() error {
	if r.Role != string(constants.RoleAdmin) && r.Role != string(constants.RoleUser) {
		return errors.New("role must be either 'admin' or 'user'")
	}
	return nil
}
