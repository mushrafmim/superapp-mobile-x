// internal/storage/storage.go
package storage

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"time"

	"cloud.google.com/go/storage"
	"github.com/google/uuid"
)

// FirebaseStorage wraps a GCS client scoped to a single bucket.

// GetSignedURL generates a V4 Signed URL for the given object path.
func (s *FirebaseStorage) GetSignedURL(objectPath string) (string, error) {
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		Expires:        time.Now().Add(1 * time.Hour), // 1 hour expiration
	}

	url, err := s.client.Bucket(s.bucket).SignedURL(objectPath, opts)
	if err != nil {
		return "", fmt.Errorf("storage: failed to generate signed URL: %w", err)
	}

	return url, nil
}

// FirebaseStorage wraps a GCS client scoped to a single bucket.
type FirebaseStorage struct {
	client *storage.Client
	bucket string
}

// New creates a FirebaseStorage backed by the given GCS client and bucket name.
func New(client *storage.Client, bucket string) *FirebaseStorage {
	return &FirebaseStorage{client: client, bucket: bucket}
}

// UploadFile uploads a file to Firebase Storage and returns the clean storage path.
func (s *FirebaseStorage) UploadFile(ctx context.Context, r io.Reader, originalFilename string) (string, error) {
	ext := filepath.Ext(originalFilename)
	objectPath := "pay-slips/" + uuid.New().String() + ext

	wc := s.client.Bucket(s.bucket).Object(objectPath).NewWriter(ctx)
	// Set Content-Type based on extension for better browser handling
	wc.ContentType = s.getContentType(ext)
	
	if _, err := io.Copy(wc, r); err != nil {
		_ = wc.Close()
		return "", fmt.Errorf("storage: copy to GCS failed: %w", err)
	}
	if err := wc.Close(); err != nil {
		return "", fmt.Errorf("storage: close GCS writer failed: %w", err)
	}

	return objectPath, nil
}

func (s *FirebaseStorage) getContentType(ext string) string {
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	default:
		return "application/octet-stream"
	}
}
