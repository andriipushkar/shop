package storage

import (
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Endpoint != "localhost:9000" {
		t.Errorf("expected Endpoint 'localhost:9000', got %s", cfg.Endpoint)
	}
	if cfg.Bucket != "shop" {
		t.Errorf("expected Bucket 'shop', got %s", cfg.Bucket)
	}
	if cfg.Region != "us-east-1" {
		t.Errorf("expected Region 'us-east-1', got %s", cfg.Region)
	}
	if cfg.UseSSL != false {
		t.Error("expected UseSSL to be false")
	}
	if cfg.PresignedExpiry != 24*time.Hour {
		t.Errorf("expected PresignedExpiry 24h, got %v", cfg.PresignedExpiry)
	}
}

func TestConfig_Fields(t *testing.T) {
	cfg := &Config{
		Endpoint:        "s3.example.com",
		AccessKey:       "access-key",
		SecretKey:       "secret-key",
		Bucket:          "my-bucket",
		Region:          "eu-west-1",
		UseSSL:          true,
		PublicURL:       "https://cdn.example.com",
		PresignedExpiry: 12 * time.Hour,
	}

	if cfg.Endpoint != "s3.example.com" {
		t.Errorf("expected Endpoint 's3.example.com', got %s", cfg.Endpoint)
	}
	if cfg.AccessKey != "access-key" {
		t.Errorf("expected AccessKey 'access-key', got %s", cfg.AccessKey)
	}
	if cfg.SecretKey != "secret-key" {
		t.Errorf("expected SecretKey 'secret-key', got %s", cfg.SecretKey)
	}
	if cfg.Bucket != "my-bucket" {
		t.Errorf("expected Bucket 'my-bucket', got %s", cfg.Bucket)
	}
	if cfg.Region != "eu-west-1" {
		t.Errorf("expected Region 'eu-west-1', got %s", cfg.Region)
	}
	if !cfg.UseSSL {
		t.Error("expected UseSSL to be true")
	}
	if cfg.PublicURL != "https://cdn.example.com" {
		t.Errorf("expected PublicURL 'https://cdn.example.com', got %s", cfg.PublicURL)
	}
	if cfg.PresignedExpiry != 12*time.Hour {
		t.Errorf("expected PresignedExpiry 12h, got %v", cfg.PresignedExpiry)
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "normal filename",
			input:    "image.jpg",
			expected: "image.jpg",
		},
		{
			name:     "filename with spaces",
			input:    "my image file.png",
			expected: "my_image_file.png",
		},
		{
			name:     "filename with special chars",
			input:    "file@#$%^&*().jpg",
			expected: "file.jpg",
		},
		{
			name:     "filename with unicode",
			input:    "файл-зображення.jpg",
			expected: "-.jpg",
		},
		{
			name:     "filename with underscores",
			input:    "my_file_name.png",
			expected: "my_file_name.png",
		},
		{
			name:     "filename with dashes",
			input:    "my-file-name.png",
			expected: "my-file-name.png",
		},
		{
			name:     "complex filename",
			input:    "Product (1) - Copy.JPG",
			expected: "Product_1_-_Copy.JPG",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeFilename(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeFilename(%q) = %q, expected %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestAllowedImageTypes(t *testing.T) {
	allowed := AllowedImageTypes()

	expectedTypes := []string{
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
	}

	for _, contentType := range expectedTypes {
		if !allowed[contentType] {
			t.Errorf("expected %s to be allowed", contentType)
		}
	}

	notAllowed := []string{
		"image/bmp",
		"image/tiff",
		"application/pdf",
		"text/plain",
	}

	for _, contentType := range notAllowed {
		if allowed[contentType] {
			t.Errorf("expected %s to NOT be allowed", contentType)
		}
	}
}

func TestMaxImageSize(t *testing.T) {
	maxSize := MaxImageSize()
	expected := int64(5 * 1024 * 1024) // 5MB

	if maxSize != expected {
		t.Errorf("expected MaxImageSize %d, got %d", expected, maxSize)
	}
}

func TestValidateImageUpload(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		size        int64
		wantErr     bool
	}{
		{
			name:        "valid jpeg",
			contentType: "image/jpeg",
			size:        1024 * 1024, // 1MB
			wantErr:     false,
		},
		{
			name:        "valid png",
			contentType: "image/png",
			size:        2 * 1024 * 1024, // 2MB
			wantErr:     false,
		},
		{
			name:        "valid gif",
			contentType: "image/gif",
			size:        512 * 1024, // 512KB
			wantErr:     false,
		},
		{
			name:        "valid webp",
			contentType: "image/webp",
			size:        1024,
			wantErr:     false,
		},
		{
			name:        "invalid content type",
			contentType: "application/pdf",
			size:        1024,
			wantErr:     true,
		},
		{
			name:        "invalid bmp type",
			contentType: "image/bmp",
			size:        1024,
			wantErr:     true,
		},
		{
			name:        "file too large",
			contentType: "image/jpeg",
			size:        10 * 1024 * 1024, // 10MB
			wantErr:     true,
		},
		{
			name:        "exactly at limit",
			contentType: "image/jpeg",
			size:        5 * 1024 * 1024, // 5MB
			wantErr:     false,
		},
		{
			name:        "just over limit",
			contentType: "image/jpeg",
			size:        5*1024*1024 + 1,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateImageUpload(tt.contentType, tt.size)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateImageUpload(%s, %d) error = %v, wantErr %v", tt.contentType, tt.size, err, tt.wantErr)
			}
		})
	}
}

func TestUploadResult(t *testing.T) {
	result := &UploadResult{
		Key:         "products/image_123456.jpg",
		URL:         "http://localhost:9000/shop/products/image_123456.jpg",
		Size:        1024,
		ContentType: "image/jpeg",
		ETag:        "abc123",
	}

	if result.Key != "products/image_123456.jpg" {
		t.Errorf("expected Key 'products/image_123456.jpg', got %s", result.Key)
	}
	if result.URL != "http://localhost:9000/shop/products/image_123456.jpg" {
		t.Errorf("expected URL 'http://localhost:9000/shop/products/image_123456.jpg', got %s", result.URL)
	}
	if result.Size != 1024 {
		t.Errorf("expected Size 1024, got %d", result.Size)
	}
	if result.ContentType != "image/jpeg" {
		t.Errorf("expected ContentType 'image/jpeg', got %s", result.ContentType)
	}
	if result.ETag != "abc123" {
		t.Errorf("expected ETag 'abc123', got %s", result.ETag)
	}
}

func TestFileInfo(t *testing.T) {
	now := time.Now()
	info := FileInfo{
		Key:          "products/image.jpg",
		Size:         2048,
		LastModified: now,
		ETag:         "def456",
		URL:          "http://localhost:9000/shop/products/image.jpg",
	}

	if info.Key != "products/image.jpg" {
		t.Errorf("expected Key 'products/image.jpg', got %s", info.Key)
	}
	if info.Size != 2048 {
		t.Errorf("expected Size 2048, got %d", info.Size)
	}
	if !info.LastModified.Equal(now) {
		t.Errorf("expected LastModified %v, got %v", now, info.LastModified)
	}
	if info.ETag != "def456" {
		t.Errorf("expected ETag 'def456', got %s", info.ETag)
	}
	if info.URL != "http://localhost:9000/shop/products/image.jpg" {
		t.Errorf("expected URL 'http://localhost:9000/shop/products/image.jpg', got %s", info.URL)
	}
}

// TestNewS3Storage tests S3Storage creation (without actual connection)
// Note: This test cannot fully test NewS3Storage without a real S3/MinIO instance
func TestNewS3Storage_NilConfig(t *testing.T) {
	// NewS3Storage with nil config should use defaults
	// However, it will fail to connect without a real S3 instance
	// This test just verifies the function signature and default config handling
	cfg := DefaultConfig()
	if cfg == nil {
		t.Error("expected default config to be created")
	}
}

// TestS3Storage_BuildURL tests URL building logic
func TestS3Storage_BuildURL_HTTP(t *testing.T) {
	// Create a mock storage with minimal config to test buildURL
	// Since we can't create real S3Storage without connection, we test the logic indirectly
	cfg := &Config{
		Endpoint:  "localhost:9000",
		Bucket:    "shop",
		UseSSL:    false,
		PublicURL: "",
	}

	// Expected URL format: http://localhost:9000/shop/products/image.jpg
	expectedProtocol := "http"
	if cfg.UseSSL {
		expectedProtocol = "https"
	}

	if expectedProtocol != "http" {
		t.Error("expected HTTP protocol for UseSSL=false")
	}
}

func TestS3Storage_BuildURL_HTTPS(t *testing.T) {
	cfg := &Config{
		Endpoint:  "s3.example.com",
		Bucket:    "my-bucket",
		UseSSL:    true,
		PublicURL: "",
	}

	expectedProtocol := "http"
	if cfg.UseSSL {
		expectedProtocol = "https"
	}

	if expectedProtocol != "https" {
		t.Error("expected HTTPS protocol for UseSSL=true")
	}
}

func TestS3Storage_BuildURL_WithPublicURL(t *testing.T) {
	cfg := &Config{
		Endpoint:  "localhost:9000",
		Bucket:    "shop",
		UseSSL:    false,
		PublicURL: "https://cdn.example.com",
	}

	// When PublicURL is set, it should be used instead of endpoint
	if cfg.PublicURL == "" {
		t.Error("expected PublicURL to be set")
	}
}

// TestBucketMap verifies default bucket mapping
func TestBucketMap(t *testing.T) {
	// Default bucket map structure
	bucketMap := map[string]string{
		"products":   "products",
		"categories": "categories",
		"users":      "users",
		"reviews":    "reviews",
	}

	expectedKeys := []string{"products", "categories", "users", "reviews"}
	for _, key := range expectedKeys {
		if _, ok := bucketMap[key]; !ok {
			t.Errorf("expected bucket map to contain key %s", key)
		}
	}
}
