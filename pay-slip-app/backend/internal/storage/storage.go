// internal/storage/storage.go
package storage

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/google/uuid"
)

// FirebaseStorage wraps a GCS client scoped to a single bucket.
type FirebaseStorage struct {
	client *storage.Client
	bucket string
}

// New creates a FirebaseStorage backed by the given GCS client and bucket name.
func New(client *storage.Client, bucket string) *FirebaseStorage {
	return &FirebaseStorage{client: client, bucket: bucket}
}

// UploadFile uploads a file to Firebase Storage and returns a temporary signed URL.
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

	// For immediate frontend preview/processing, return a signed URL.
	return s.GetSignedURL(objectPath)
}

// GetSignedURL generates a V4 Signed URL for the given object path.
func (s *FirebaseStorage) GetSignedURL(objectPath string) (string, error) {
	// If it's already a full URL (legacy or external), just return it
	if len(objectPath) > 8 && (objectPath[:8] == "https://" || objectPath[:7] == "http://") {
		return objectPath, nil
	}

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

// ExtractPathFromURL extracts the object path from a GCS/Firebase URL.
func (s *FirebaseStorage) ExtractPathFromURL(rawURL string) string {
	// If it doesn't look like a URL, it's likely already a path
	if len(rawURL) < 8 || (rawURL[:8] != "https://" && rawURL[:7] != "http://") {
		return rawURL
	}

	// Try to find the folder path
	if idx := strings.Index(rawURL, "pay-slips/"); idx != -1 {
		path := rawURL[idx:]
		// Strip query parameters
		if qIdx := strings.Index(path, "?"); qIdx != -1 {
			path = path[:qIdx]
		}
		// Unescape %2F if present
		path = strings.ReplaceAll(path, "%2F", "/")
		return path
	}

	return rawURL
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
