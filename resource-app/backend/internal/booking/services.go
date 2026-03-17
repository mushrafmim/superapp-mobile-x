package booking

import (
	"time"

	usr "resource-app/internal/user"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetBookings() ([]Booking, error) {
	return s.repo.GetBookings()
}

func (s *Service) CreateBooking(booking *Booking, userID string, userRole usr.Role) error {
	booking.ID = uuid.New().String()
	booking.UserID = userID
	booking.CreatedAt = time.Now()

	if userRole == usr.RoleAdmin {
		booking.Status = StatusConfirmed
	} else {
		booking.Status = StatusPending
	}

	return s.repo.CreateBooking(booking)
}

func (s *Service) UpdateBookingStatus(id string, status BookingStatus, rejectionReason *string) (*Booking, error) {
	return s.repo.UpdateBookingStatus(id, status, rejectionReason)
}

func (s *Service) RescheduleBooking(id string, newStart, newEnd time.Time) (*Booking, error) {
	return s.repo.RescheduleBooking(id, newStart, newEnd)
}

func (s *Service) CancelBooking(id string) error {
	return s.repo.CancelBooking(id)
}
