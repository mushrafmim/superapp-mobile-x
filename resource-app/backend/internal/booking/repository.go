package booking

import (
	"errors"
	"time"

	"resource-app/internal/resource"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	GetBookings() ([]Booking, error)
	CreateBooking(booking *Booking) error
	UpdateBookingStatus(id string, status BookingStatus, rejectionReason *string) (*Booking, error)
	RescheduleBooking(id string, newStart, newEnd time.Time) (*Booking, error)
	CancelBooking(id string) error
}

// GormRepository implements Repository using GORM
type GormRepository struct {
	db *gorm.DB
}

// NewGormRepository creates a new instance of GormRepository
func NewGormRepository(db *gorm.DB) *GormRepository {
	return &GormRepository{db: db}
}

func (r *GormRepository) GetBookings() ([]Booking, error) {
	var bookings []Booking
	result := r.db.Find(&bookings)
	return bookings, result.Error
}

// CreateBooking creates a new booking with pessimistic locking to prevent conflicts
// Uses transaction with resource-level locking to serialize bookings for a resource
func (r *GormRepository) CreateBooking(booking *Booking) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Lock the resource to serialize bookings for this resource
		// This prevents race conditions where two users try to book the same slot simultaneously
		var lockedResource resource.Resource
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&lockedResource, "id = ?", booking.ResourceID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrResourceNotFound
			}
			return err
		}

		// 2. Perform conflict check within the transaction
		// Check for overlapping bookings excluding cancelled and rejected bookings
		var count int64
		if err := tx.Model(&Booking{}).
			Where(
				"resource_id = ? AND status NOT IN ? AND ((start < ? AND end > ?))",
				booking.ResourceID,
				[]BookingStatus{StatusCancelled, StatusRejected},
				booking.End,
				booking.Start,
			).
			Count(&count).Error; err != nil {
			return err
		}

		if count > 0 {
			return ErrBookingConflict
		}

		// 3. Create the booking
		return tx.Create(booking).Error
	})
}

// UpdateBookingStatus updates the status of a booking with optional rejection reason
func (r *GormRepository) UpdateBookingStatus(id string, status BookingStatus, rejectionReason *string) (*Booking, error) {
	updates := map[string]interface{}{
		"status": status,
	}
	if rejectionReason != nil {
		updates["rejection_reason"] = *rejectionReason
	}
	result := r.db.Model(&Booking{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, ErrBookingNotFound
	}

	var booking Booking
	if err := r.db.First(&booking, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &booking, nil
}

// RescheduleBooking reschedules a booking to new start and end times
// Uses transaction to validate the new time slot before rescheduling
func (r *GormRepository) RescheduleBooking(id string, newStart, newEnd time.Time) (*Booking, error) {
	var updated Booking
	if err := r.db.Transaction(func(tx *gorm.DB) error {
		// Get original booking to check resource ID
		var booking Booking
		if err := tx.First(&booking, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBookingNotFound
			}
			return err
		}

		// 1. Lock the resource to prevent concurrent modifications
		var lockedResource resource.Resource
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&lockedResource, "id = ?", booking.ResourceID).Error; err != nil {
			return err
		}

		// 2. Conflict check excluding self in the new time slot
		var count int64
		if err := tx.Model(&Booking{}).
			Where(
				"id != ? AND resource_id = ? AND status NOT IN ? AND ((start < ? AND end > ?))",
				id,
				booking.ResourceID,
				[]BookingStatus{StatusCancelled, StatusRejected},
				newEnd,
				newStart,
			).
			Count(&count).Error; err != nil {
				return err
			}

		if count > 0 {
			return ErrRescheduleSlotConflict
		}

		// 3. Update the booking with new times and set status to Proposed
		if err := tx.Model(&Booking{}).
			Where("id = ?", id).
			Updates(map[string]interface{}{
				"start":  newStart,
				"end":    newEnd,
				"status": StatusProposed,
			}).Error; err != nil {
			return err
		}

		return tx.First(&updated, "id = ?", id).Error
	}); err != nil {
		return nil, err
	}

	return &updated, nil
}

// CancelBooking cancels a booking by updating its status
func (r *GormRepository) CancelBooking(id string) error {
	result := r.db.Model(&Booking{}).
		Where("id = ?", id).
		Update("status", StatusCancelled)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrBookingNotFound
	}
	return nil
}
