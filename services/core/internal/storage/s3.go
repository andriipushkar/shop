package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Config holds S3/MinIO configuration
type Config struct {
	Endpoint        string
	AccessKey       string
	SecretKey       string
	Bucket          string
	Region          string
	UseSSL          bool
	PublicURL       string
	PresignedExpiry time.Duration
}

// DefaultConfig returns default S3 configuration
func DefaultConfig() *Config {
	return &Config{
		Endpoint:        "localhost:9000",
		Bucket:          "shop",
		Region:          "us-east-1",
		UseSSL:          false,
		PresignedExpiry: 24 * time.Hour,
	}
}

// S3Storage handles file storage operations
type S3Storage struct {
	client    *minio.Client
	config    *Config
	bucketMap map[string]string
}

// NewS3Storage creates a new S3 storage handler
func NewS3Storage(config *Config) (*S3Storage, error) {
	if config == nil {
		config = DefaultConfig()
	}

	client, err := minio.New(config.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(config.AccessKey, config.SecretKey, ""),
		Secure: config.UseSSL,
		Region: config.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create S3 client: %w", err)
	}

	storage := &S3Storage{
		client: client,
		config: config,
		bucketMap: map[string]string{
			"products":   "products",
			"categories": "categories",
			"users":      "users",
			"reviews":    "reviews",
		},
	}

	return storage, nil
}

// EnsureBucket creates bucket if it doesn't exist
func (s *S3Storage) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.config.Bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}

	if !exists {
		err = s.client.MakeBucket(ctx, s.config.Bucket, minio.MakeBucketOptions{
			Region: s.config.Region,
		})
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}

		// Set bucket policy for public read access to products
		policy := `{
			"Version": "2012-10-17",
			"Statement": [
				{
					"Effect": "Allow",
					"Principal": {"AWS": ["*"]},
					"Action": ["s3:GetObject"],
					"Resource": ["arn:aws:s3:::` + s.config.Bucket + `/products/*"]
				},
				{
					"Effect": "Allow",
					"Principal": {"AWS": ["*"]},
					"Action": ["s3:GetObject"],
					"Resource": ["arn:aws:s3:::` + s.config.Bucket + `/categories/*"]
				}
			]
		}`

		err = s.client.SetBucketPolicy(ctx, s.config.Bucket, policy)
		if err != nil {
			// Non-fatal error, just log it
			fmt.Printf("Warning: failed to set bucket policy: %v\n", err)
		}
	}

	return nil
}

// UploadFile uploads a file to S3
func (s *S3Storage) UploadFile(ctx context.Context, folder, filename string, reader io.Reader, size int64, contentType string) (*UploadResult, error) {
	// Sanitize filename
	filename = sanitizeFilename(filename)

	// Generate unique filename
	ext := path.Ext(filename)
	baseName := strings.TrimSuffix(filename, ext)
	uniqueName := fmt.Sprintf("%s_%d%s", baseName, time.Now().UnixNano(), ext)

	// Build object path
	objectPath := path.Join(folder, uniqueName)

	// Upload
	info, err := s.client.PutObject(ctx, s.config.Bucket, objectPath, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	// Build URL
	fileURL := s.buildURL(objectPath)

	return &UploadResult{
		Key:         objectPath,
		URL:         fileURL,
		Size:        info.Size,
		ContentType: contentType,
		ETag:        info.ETag,
	}, nil
}

// DeleteFile deletes a file from S3
func (s *S3Storage) DeleteFile(ctx context.Context, objectPath string) error {
	err := s.client.RemoveObject(ctx, s.config.Bucket, objectPath, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// GetPresignedURL generates a presigned URL for private files
func (s *S3Storage) GetPresignedURL(ctx context.Context, objectPath string, expiry time.Duration) (string, error) {
	if expiry == 0 {
		expiry = s.config.PresignedExpiry
	}

	presignedURL, err := s.client.PresignedGetObject(ctx, s.config.Bucket, objectPath, expiry, url.Values{})
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedURL.String(), nil
}

// GetUploadPresignedURL generates a presigned URL for uploads
func (s *S3Storage) GetUploadPresignedURL(ctx context.Context, objectPath string, expiry time.Duration) (string, error) {
	if expiry == 0 {
		expiry = 15 * time.Minute
	}

	presignedURL, err := s.client.PresignedPutObject(ctx, s.config.Bucket, objectPath, expiry)
	if err != nil {
		return "", fmt.Errorf("failed to generate upload presigned URL: %w", err)
	}

	return presignedURL.String(), nil
}

// ListFiles lists files in a folder
func (s *S3Storage) ListFiles(ctx context.Context, prefix string) ([]FileInfo, error) {
	var files []FileInfo

	objectCh := s.client.ListObjects(ctx, s.config.Bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for object := range objectCh {
		if object.Err != nil {
			return nil, fmt.Errorf("failed to list files: %w", object.Err)
		}

		files = append(files, FileInfo{
			Key:          object.Key,
			Size:         object.Size,
			LastModified: object.LastModified,
			ETag:         object.ETag,
			URL:          s.buildURL(object.Key),
		})
	}

	return files, nil
}

// CopyFile copies a file within S3
func (s *S3Storage) CopyFile(ctx context.Context, srcPath, dstPath string) error {
	src := minio.CopySrcOptions{
		Bucket: s.config.Bucket,
		Object: srcPath,
	}
	dst := minio.CopyDestOptions{
		Bucket: s.config.Bucket,
		Object: dstPath,
	}

	_, err := s.client.CopyObject(ctx, dst, src)
	if err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	return nil
}

// buildURL builds the public URL for an object
func (s *S3Storage) buildURL(objectPath string) string {
	if s.config.PublicURL != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimSuffix(s.config.PublicURL, "/"), s.config.Bucket, objectPath)
	}

	protocol := "http"
	if s.config.UseSSL {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", protocol, s.config.Endpoint, s.config.Bucket, objectPath)
}

// UploadResult represents upload result
type UploadResult struct {
	Key         string `json:"key"`
	URL         string `json:"url"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	ETag        string `json:"etag"`
}

// FileInfo represents file information
type FileInfo struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"last_modified"`
	ETag         string    `json:"etag"`
	URL          string    `json:"url"`
}

// sanitizeFilename sanitizes filename
func sanitizeFilename(filename string) string {
	// Replace spaces with underscores
	filename = strings.ReplaceAll(filename, " ", "_")

	// Remove special characters except dots and underscores
	var result strings.Builder
	for _, r := range filename {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
			result.WriteRune(r)
		}
	}

	return result.String()
}

// AllowedImageTypes returns allowed image MIME types
func AllowedImageTypes() map[string]bool {
	return map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}
}

// MaxImageSize returns max image size in bytes (5MB)
func MaxImageSize() int64 {
	return 5 * 1024 * 1024
}

// ValidateImageUpload validates image upload
func ValidateImageUpload(contentType string, size int64) error {
	if !AllowedImageTypes()[contentType] {
		return fmt.Errorf("invalid image type: %s, allowed: jpeg, png, gif, webp", contentType)
	}

	if size > MaxImageSize() {
		return fmt.Errorf("image too large: %d bytes, max: %d bytes", size, MaxImageSize())
	}

	return nil
}
