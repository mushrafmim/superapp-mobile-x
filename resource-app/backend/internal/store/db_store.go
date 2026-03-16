package store

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"resource-app/internal/models"
	"resource-app/internal/resource"
)

// DBStore handles database operations
type DBStore struct {
	db *gorm.DB
}

// NewDBStore creates a new DBStore
func NewDBStore(db *gorm.DB) *DBStore {
	return &DBStore{db: db}
}

// --- Bookings ---

func (s *DBStore) GetBookings() ([]models.Booking, error) {
	var bookings []models.Booking
	result := s.db.Find(&bookings)
	return bookings, result.Error
}

func (s *DBStore) CreateBooking(booking *models.Booking) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Lock the resource to serialize bookings for this resource
		// This prevents race conditions where two users try to book the same slot simultaneously
		var lockedResource resource.Resource
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedResource, "id = ?", booking.ResourceID).Error; err != nil {
			return err
		}

		// 2. Perform conflict check within the transaction
		var count int64
		tx.Model(&models.Booking{}).Where(
			"resource_id = ? AND status NOT IN ? AND ((start < ? AND end > ?))",
			booking.ResourceID,
			[]models.BookingStatus{models.StatusCancelled, models.StatusRejected},
			booking.End, booking.Start,
		).Count(&count)

		if count > 0 {
			return errors.New("conflict detected: this slot is already booked")
		}

		// 3. Create the booking
		return tx.Create(booking).Error
	})
}

func (s *DBStore) UpdateBookingStatus(id string, status models.BookingStatus, rejectionReason *string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if rejectionReason != nil {
		updates["rejection_reason"] = *rejectionReason
	}
	return s.db.Model(&models.Booking{}).Where("id = ?", id).Updates(updates).Error
}

func (s *DBStore) RescheduleBooking(id string, start, end time.Time) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Get original booking to check resource ID
		var booking models.Booking
		if err := tx.First(&booking, "id = ?", id).Error; err != nil {
			return err
		}

		// 1. Lock the resource to prevent concurrent modifications
		var lockedResource resource.Resource
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedResource, "id = ?", booking.ResourceID).Error; err != nil {
			return err
		}

		// 2. Conflict check excluding self
		var count int64
		tx.Model(&models.Booking{}).Where(
			"id != ? AND resource_id = ? AND status NOT IN ? AND ((start < ? AND end > ?))",
			id, booking.ResourceID,
			[]models.BookingStatus{models.StatusCancelled, models.StatusRejected},
			end, start,
		).Count(&count)

		if count > 0 {
			return errors.New("conflict detected in new time slot")
		}

		// 3. Update the booking
		return tx.Model(&models.Booking{}).Where("id = ?", id).Updates(map[string]interface{}{
			"start":  start,
			"end":    end,
			"status": models.StatusProposed,
		}).Error
	})
}

func (s *DBStore) CancelBooking(id string) error {
	return s.db.Model(&models.Booking{}).Where("id = ?", id).Update("status", models.StatusCancelled).Error
}

// --- Stats ---

type ResourceUsageStats struct {
	ResourceID      string `json:"resourceId"`
	ResourceName    string `json:"resourceName"`
	ResourceType    string `json:"resourceType"`
	BookingCount    int    `json:"bookingCount"`
	TotalHours      int    `json:"totalHours"`
	UtilizationRate int    `json:"utilizationRate"`
}

func (s *DBStore) GetUtilizationStats() ([]ResourceUsageStats, error) {
	// This is a simplified implementation. In a real app, you'd likely do this with a complex SQL query.
	// For now, we'll fetch resources and bookings and calculate in memory to match the mock implementation.
	
	resourceRepo := resource.NewGormRepository(s.db)
	resources, err := resourceRepo.GetResources()
	if err != nil {
		return nil, err
	}

	var stats []ResourceUsageStats

	for _, res := range resources {
		var bookings []models.Booking
		s.db.Where("resource_id = ? AND status = ?", res.ID, models.StatusConfirmed).Find(&bookings)

		totalMs := int64(0)
		for _, b := range bookings {
			totalMs += b.End.Sub(b.Start).Milliseconds()
		}
		totalHours := int(totalMs / (1000 * 60 * 60))
		utilizationRate := 0
		if totalHours > 0 {
			utilizationRate = int((float64(totalHours) / 160.0) * 100.0) // Assumes 160h monthly capacity
			if utilizationRate > 100 {
				utilizationRate = 100
			}
		}

		stats = append(stats, ResourceUsageStats{
			ResourceID:      res.ID,
			ResourceName:    res.Name,
			ResourceType:    res.Type,
			BookingCount:    len(bookings),
			TotalHours:      totalHours,
			UtilizationRate: utilizationRate,
		})
	}

	return stats, nil
}