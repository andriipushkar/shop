package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidHash         = errors.New("invalid password hash format")
	ErrIncompatibleVersion = errors.New("incompatible argon2 version")
	ErrPasswordTooShort    = errors.New("password must be at least 8 characters")
	ErrPasswordTooLong     = errors.New("password must be at most 72 characters")
	ErrPasswordMismatch    = errors.New("password does not match")
)

// Argon2Params holds argon2 parameters
type Argon2Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultArgon2Params returns secure default parameters
func DefaultArgon2Params() *Argon2Params {
	return &Argon2Params{
		Memory:      64 * 1024, // 64 MB
		Iterations:  3,
		Parallelism: 2,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// PasswordHasher handles password hashing operations
type PasswordHasher struct {
	params *Argon2Params
}

// NewPasswordHasher creates a new password hasher
func NewPasswordHasher(params *Argon2Params) *PasswordHasher {
	if params == nil {
		params = DefaultArgon2Params()
	}
	return &PasswordHasher{params: params}
}

// Hash hashes a password using argon2id
func (h *PasswordHasher) Hash(password string) (string, error) {
	if err := validatePassword(password); err != nil {
		return "", err
	}

	salt := make([]byte, h.params.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		h.params.Iterations,
		h.params.Memory,
		h.params.Parallelism,
		h.params.KeyLength,
	)

	// Format: $argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encodedHash := fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		h.params.Memory,
		h.params.Iterations,
		h.params.Parallelism,
		b64Salt,
		b64Hash,
	)

	return encodedHash, nil
}

// Verify verifies a password against a hash
func (h *PasswordHasher) Verify(password, encodedHash string) error {
	params, salt, hash, err := decodeHash(encodedHash)
	if err != nil {
		return err
	}

	otherHash := argon2.IDKey(
		[]byte(password),
		salt,
		params.Iterations,
		params.Memory,
		params.Parallelism,
		params.KeyLength,
	)

	if subtle.ConstantTimeCompare(hash, otherHash) != 1 {
		return ErrPasswordMismatch
	}

	return nil
}

// NeedsRehash checks if password needs rehashing with new parameters
func (h *PasswordHasher) NeedsRehash(encodedHash string) bool {
	params, _, _, err := decodeHash(encodedHash)
	if err != nil {
		return true
	}

	return params.Memory != h.params.Memory ||
		params.Iterations != h.params.Iterations ||
		params.Parallelism != h.params.Parallelism ||
		params.KeyLength != h.params.KeyLength
}

// decodeHash decodes an argon2id hash
func decodeHash(encodedHash string) (*Argon2Params, []byte, []byte, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return nil, nil, nil, ErrInvalidHash
	}

	if parts[1] != "argon2id" {
		return nil, nil, nil, ErrInvalidHash
	}

	var version int
	_, err := fmt.Sscanf(parts[2], "v=%d", &version)
	if err != nil {
		return nil, nil, nil, err
	}
	if version != argon2.Version {
		return nil, nil, nil, ErrIncompatibleVersion
	}

	params := &Argon2Params{}
	_, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &params.Memory, &params.Iterations, &params.Parallelism)
	if err != nil {
		return nil, nil, nil, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, nil, nil, err
	}
	params.SaltLength = uint32(len(salt))

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, nil, nil, err
	}
	params.KeyLength = uint32(len(hash))

	return params, salt, hash, nil
}

// validatePassword validates password requirements
func validatePassword(password string) error {
	if len(password) < 8 {
		return ErrPasswordTooShort
	}
	if len(password) > 72 {
		return ErrPasswordTooLong
	}
	return nil
}

// GenerateRandomPassword generates a random password
func GenerateRandomPassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}

	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}

	return string(b), nil
}

// GenerateResetToken generates a password reset token
func GenerateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// ValidatePasswordStrength checks password strength
func ValidatePasswordStrength(password string) (int, []string) {
	score := 0
	var issues []string

	if len(password) < 8 {
		issues = append(issues, "Password must be at least 8 characters")
	} else {
		score++
	}

	if len(password) >= 12 {
		score++
	}

	hasLower := false
	hasUpper := false
	hasDigit := false
	hasSpecial := false

	for _, c := range password {
		switch {
		case c >= 'a' && c <= 'z':
			hasLower = true
		case c >= 'A' && c <= 'Z':
			hasUpper = true
		case c >= '0' && c <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}

	if hasLower {
		score++
	} else {
		issues = append(issues, "Add lowercase letters")
	}

	if hasUpper {
		score++
	} else {
		issues = append(issues, "Add uppercase letters")
	}

	if hasDigit {
		score++
	} else {
		issues = append(issues, "Add numbers")
	}

	if hasSpecial {
		score++
	} else {
		issues = append(issues, "Add special characters")
	}

	return score, issues
}
