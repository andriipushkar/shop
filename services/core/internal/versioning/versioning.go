package versioning

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

// Version represents an API version
type Version struct {
	Major int
	Minor int
}

// String returns the version as a string
func (v Version) String() string {
	return fmt.Sprintf("v%d.%d", v.Major, v.Minor)
}

// ShortString returns the short version string (e.g., "v1")
func (v Version) ShortString() string {
	return fmt.Sprintf("v%d", v.Major)
}

// Compare compares two versions
// Returns: -1 if v < other, 0 if v == other, 1 if v > other
func (v Version) Compare(other Version) int {
	if v.Major < other.Major {
		return -1
	}
	if v.Major > other.Major {
		return 1
	}
	if v.Minor < other.Minor {
		return -1
	}
	if v.Minor > other.Minor {
		return 1
	}
	return 0
}

// IsCompatible checks if version is compatible with target
func (v Version) IsCompatible(target Version) bool {
	return v.Major == target.Major && v.Minor >= target.Minor
}

// Predefined versions
var (
	V1   = Version{Major: 1, Minor: 0}
	V1_1 = Version{Major: 1, Minor: 1}
	V2   = Version{Major: 2, Minor: 0}

	// CurrentVersion is the current API version
	CurrentVersion = V1

	// MinSupportedVersion is the minimum supported version
	MinSupportedVersion = V1

	// DeprecatedVersions are versions marked for deprecation
	DeprecatedVersions = map[Version]bool{}
)

var versionRegex = regexp.MustCompile(`^v(\d+)(?:\.(\d+))?$`)

// ParseVersion parses a version string
func ParseVersion(s string) (Version, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	matches := versionRegex.FindStringSubmatch(s)
	if matches == nil {
		return Version{}, fmt.Errorf("invalid version format: %s", s)
	}

	major, _ := strconv.Atoi(matches[1])
	minor := 0
	if len(matches) > 2 && matches[2] != "" {
		minor, _ = strconv.Atoi(matches[2])
	}

	return Version{Major: major, Minor: minor}, nil
}

// VersionFromRequest extracts version from request
func VersionFromRequest(r *http.Request) Version {
	// 1. Check URL path (e.g., /api/v1/products)
	if v := extractVersionFromPath(r.URL.Path); v.Major > 0 {
		return v
	}

	// 2. Check Accept header (e.g., application/vnd.shop.v1+json)
	if v := extractVersionFromAcceptHeader(r.Header.Get("Accept")); v.Major > 0 {
		return v
	}

	// 3. Check custom header (e.g., X-API-Version: v1)
	if v := extractVersionFromHeader(r.Header.Get("X-API-Version")); v.Major > 0 {
		return v
	}

	// 4. Check query parameter (e.g., ?version=v1)
	if v := extractVersionFromQuery(r.URL.Query().Get("version")); v.Major > 0 {
		return v
	}

	return CurrentVersion
}

func extractVersionFromPath(path string) Version {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	for _, part := range parts {
		if strings.HasPrefix(part, "v") {
			if v, err := ParseVersion(part); err == nil {
				return v
			}
		}
	}
	return Version{}
}

func extractVersionFromAcceptHeader(accept string) Version {
	// Parse: application/vnd.shop.v1+json
	re := regexp.MustCompile(`application/vnd\.shop\.(v\d+(?:\.\d+)?)\+json`)
	matches := re.FindStringSubmatch(accept)
	if len(matches) > 1 {
		if v, err := ParseVersion(matches[1]); err == nil {
			return v
		}
	}
	return Version{}
}

func extractVersionFromHeader(header string) Version {
	if header == "" {
		return Version{}
	}
	v, _ := ParseVersion(header)
	return v
}

func extractVersionFromQuery(query string) Version {
	if query == "" {
		return Version{}
	}
	v, _ := ParseVersion(query)
	return v
}

// contextKey is the type for context keys
type contextKey string

const versionContextKey contextKey = "api_version"

// Middleware adds version to request context
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version := VersionFromRequest(r)

		// Validate version
		if version.Compare(MinSupportedVersion) < 0 {
			http.Error(w, fmt.Sprintf("API version %s is no longer supported. Minimum version: %s",
				version.String(), MinSupportedVersion.String()), http.StatusGone)
			return
		}

		// Add deprecation warning header
		if DeprecatedVersions[version] {
			w.Header().Set("X-API-Deprecated", "true")
			w.Header().Set("Warning", fmt.Sprintf(`299 - "API version %s is deprecated"`, version.String()))
		}

		// Add version to response headers
		w.Header().Set("X-API-Version", version.String())

		// Add version to context
		ctx := r.Context()
		ctx = SetVersionInContext(ctx, version)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// SetVersionInContext sets version in context
func SetVersionInContext(ctx context.Context, v Version) context.Context {
	return context.WithValue(ctx, versionContextKey, v)
}

// GetVersionFromContext gets version from context
func GetVersionFromContext(ctx context.Context) Version {
	if v, ok := ctx.Value(versionContextKey).(Version); ok {
		return v
	}
	return CurrentVersion
}

// Router handles version-specific routing
type Router struct {
	handlers map[Version]http.Handler
	fallback http.Handler
}

// NewRouter creates a new versioned router
func NewRouter() *Router {
	return &Router{
		handlers: make(map[Version]http.Handler),
	}
}

// Handle registers a handler for a specific version
func (vr *Router) Handle(version Version, handler http.Handler) {
	vr.handlers[version] = handler
}

// Fallback sets the fallback handler
func (vr *Router) Fallback(handler http.Handler) {
	vr.fallback = handler
}

// ServeHTTP implements http.Handler
func (vr *Router) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	version := VersionFromRequest(r)

	// Find exact match
	if handler, ok := vr.handlers[version]; ok {
		handler.ServeHTTP(w, r)
		return
	}

	// Find compatible version (same major, highest minor <= requested)
	var bestMatch Version
	var bestHandler http.Handler
	for v, h := range vr.handlers {
		if v.Major == version.Major && v.Minor <= version.Minor {
			if bestHandler == nil || v.Minor > bestMatch.Minor {
				bestMatch = v
				bestHandler = h
			}
		}
	}

	if bestHandler != nil {
		bestHandler.ServeHTTP(w, r)
		return
	}

	// Use fallback
	if vr.fallback != nil {
		vr.fallback.ServeHTTP(w, r)
		return
	}

	http.Error(w, fmt.Sprintf("API version %s is not supported", version.String()),
		http.StatusNotFound)
}

// VersionedEndpoint allows different implementations per version
type VersionedEndpoint struct {
	implementations map[Version]http.HandlerFunc
}

// NewVersionedEndpoint creates a new versioned endpoint
func NewVersionedEndpoint() *VersionedEndpoint {
	return &VersionedEndpoint{
		implementations: make(map[Version]http.HandlerFunc),
	}
}

// Register registers an implementation for a version
func (ve *VersionedEndpoint) Register(version Version, handler http.HandlerFunc) *VersionedEndpoint {
	ve.implementations[version] = handler
	return ve
}

// Handler returns the http.Handler
func (ve *VersionedEndpoint) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		version := VersionFromRequest(r)

		// Find best matching implementation
		var bestVersion Version
		var bestHandler http.HandlerFunc

		for v, h := range ve.implementations {
			if v.Major == version.Major && v.Minor <= version.Minor {
				if bestHandler == nil || v.Compare(bestVersion) > 0 {
					bestVersion = v
					bestHandler = h
				}
			}
		}

		if bestHandler != nil {
			bestHandler(w, r)
			return
		}

		// Fallback to latest version of same major
		for v, h := range ve.implementations {
			if v.Major == version.Major {
				if bestHandler == nil || v.Compare(bestVersion) > 0 {
					bestVersion = v
					bestHandler = h
				}
			}
		}

		if bestHandler != nil {
			bestHandler(w, r)
			return
		}

		http.Error(w, "Endpoint not available for this API version", http.StatusNotFound)
	}
}
