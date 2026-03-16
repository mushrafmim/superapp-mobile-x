package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"resource-app/internal/auth"
	"resource-app/internal/models"
	"resource-app/internal/store"
	usr "resource-app/internal/user"
)

// --- Bookings ---

func HandleGetBookings(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		bookings, err := store.GetBookings()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookings"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": bookings})
	}
}

func HandleCreateBooking(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.Booking
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		req.ID = uuid.New().String()
		req.UserID = user.ID
		req.CreatedAt = time.Now()

		// Auto-confirm for admins, pending for users
		if user.Role == usr.RoleAdmin {
			req.Status = models.StatusConfirmed
		} else {
			req.Status = models.StatusPending
		}

		if err := store.CreateBooking(&req); err != nil {
			// Check for conflict error
			if err.Error() == "conflict detected: this slot is already booked" {
				c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"success": true, "data": req})
	}
}

func HandleProcessBooking(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Status          models.BookingStatus `json:"status" binding:"required"`
			RejectionReason *string              `json:"rejectionReason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := store.UpdateBookingStatus(id, req.Status, req.RejectionReason); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update booking status"})
			return
		}

		// Fetch updated booking to return
		// For now just return success
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func HandleRescheduleBooking(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Start time.Time `json:"start" binding:"required"`
			End   time.Time `json:"end" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := store.RescheduleBooking(id, req.Start, req.End); err != nil {
			if err.Error() == "conflict detected in new time slot" {
				c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reschedule booking"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func HandleCancelBooking(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := store.CancelBooking(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel booking"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": true})
	}
}

// --- Stats ---

func HandleGetStats(store *store.DBStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := store.GetUtilizationStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate stats"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
	}
}

