package abtesting

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

var (
	ErrExperimentNotFound  = errors.New("experiment not found")
	ErrExperimentNotActive = errors.New("experiment is not active")
	ErrVariantNotFound     = errors.New("variant not found")
)

// Status represents experiment status
type Status string

const (
	StatusDraft     Status = "draft"
	StatusRunning   Status = "running"
	StatusPaused    Status = "paused"
	StatusCompleted Status = "completed"
	StatusArchived  Status = "archived"
)

// Experiment represents an A/B test
type Experiment struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Status      Status     `json:"status"`
	Variants    []Variant  `json:"variants"`
	Targeting   *Targeting `json:"targeting,omitempty"`
	StartDate   time.Time  `json:"start_date"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Variant represents a test variant
type Variant struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Weight      int                    `json:"weight"` // Percentage (0-100)
	IsControl   bool                   `json:"is_control"`
	Config      map[string]interface{} `json:"config,omitempty"`
	Impressions int64                  `json:"impressions"`
	Conversions int64                  `json:"conversions"`
}

// Targeting defines who sees the experiment
type Targeting struct {
	UserPercent    int      `json:"user_percent"`   // Percentage of users to include
	Countries      []string `json:"countries"`      // Include only these countries
	Devices        []string `json:"devices"`        // desktop, mobile, tablet
	NewUsersOnly   bool     `json:"new_users_only"`
	MinOrdersCount int      `json:"min_orders_count"`
	UserSegments   []string `json:"user_segments"`
}

// Assignment represents a user's variant assignment
type Assignment struct {
	UserID       string    `json:"user_id"`
	ExperimentID string    `json:"experiment_id"`
	VariantID    string    `json:"variant_id"`
	AssignedAt   time.Time `json:"assigned_at"`
}

// Event represents a tracking event
type Event struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	ExperimentID string                 `json:"experiment_id"`
	VariantID    string                 `json:"variant_id"`
	EventType    string                 `json:"event_type"` // impression, conversion, click, etc.
	Properties   map[string]interface{} `json:"properties,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

// Repository defines the A/B testing data store
type Repository interface {
	// Experiments
	GetExperiment(ctx context.Context, id string) (*Experiment, error)
	GetExperimentByName(ctx context.Context, name string) (*Experiment, error)
	GetActiveExperiments(ctx context.Context) ([]*Experiment, error)
	SaveExperiment(ctx context.Context, exp *Experiment) error
	UpdateExperimentStats(ctx context.Context, expID, variantID string, impressions, conversions int64) error

	// Assignments
	GetAssignment(ctx context.Context, userID, experimentID string) (*Assignment, error)
	SaveAssignment(ctx context.Context, assignment *Assignment) error

	// Events
	SaveEvent(ctx context.Context, event *Event) error
	GetEvents(ctx context.Context, experimentID string, startTime, endTime time.Time) ([]*Event, error)
}

// Service handles A/B testing logic
type Service struct {
	repo    Repository
	cache   sync.Map // Local cache for experiments
	randGen *rand.Rand
	mu      sync.RWMutex
}

// NewService creates a new A/B testing service
func NewService(repo Repository) *Service {
	return &Service{
		repo:    repo,
		randGen: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GetVariant returns the variant for a user in an experiment
func (s *Service) GetVariant(ctx context.Context, userID, experimentName string, userContext *UserContext) (*Variant, error) {
	exp, err := s.getExperimentCached(ctx, experimentName)
	if err != nil {
		return nil, err
	}

	if exp.Status != StatusRunning {
		return nil, ErrExperimentNotActive
	}

	// Check targeting
	if !s.matchesTargeting(exp.Targeting, userContext) {
		// Return control variant for non-matching users
		return s.getControlVariant(exp)
	}

	// Check existing assignment
	assignment, err := s.repo.GetAssignment(ctx, userID, exp.ID)
	if err == nil && assignment != nil {
		return s.getVariantByID(exp, assignment.VariantID)
	}

	// Assign variant
	variant := s.assignVariant(userID, exp)

	// Save assignment
	assignment = &Assignment{
		UserID:       userID,
		ExperimentID: exp.ID,
		VariantID:    variant.ID,
		AssignedAt:   time.Now(),
	}
	_ = s.repo.SaveAssignment(ctx, assignment)

	return variant, nil
}

// TrackImpression tracks an impression event
func (s *Service) TrackImpression(ctx context.Context, userID, experimentID, variantID string) error {
	event := &Event{
		UserID:       userID,
		ExperimentID: experimentID,
		VariantID:    variantID,
		EventType:    "impression",
		CreatedAt:    time.Now(),
	}

	if err := s.repo.SaveEvent(ctx, event); err != nil {
		return err
	}

	return s.repo.UpdateExperimentStats(ctx, experimentID, variantID, 1, 0)
}

// TrackConversion tracks a conversion event
func (s *Service) TrackConversion(ctx context.Context, userID, experimentID, variantID string, properties map[string]interface{}) error {
	event := &Event{
		UserID:       userID,
		ExperimentID: experimentID,
		VariantID:    variantID,
		EventType:    "conversion",
		Properties:   properties,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.SaveEvent(ctx, event); err != nil {
		return err
	}

	return s.repo.UpdateExperimentStats(ctx, experimentID, variantID, 0, 1)
}

// GetExperimentResults returns experiment results
func (s *Service) GetExperimentResults(ctx context.Context, experimentID string) (*ExperimentResults, error) {
	exp, err := s.repo.GetExperiment(ctx, experimentID)
	if err != nil {
		return nil, err
	}

	results := &ExperimentResults{
		Experiment: exp,
		Variants:   make([]VariantResults, len(exp.Variants)),
	}

	var controlRate float64

	for i, v := range exp.Variants {
		rate := 0.0
		if v.Impressions > 0 {
			rate = float64(v.Conversions) / float64(v.Impressions)
		}

		if v.IsControl {
			controlRate = rate
		}

		results.Variants[i] = VariantResults{
			Variant:        v,
			ConversionRate: rate,
		}
	}

	// Calculate lift for non-control variants
	for i := range results.Variants {
		if !results.Variants[i].Variant.IsControl && controlRate > 0 {
			results.Variants[i].Lift = (results.Variants[i].ConversionRate - controlRate) / controlRate * 100
		}
	}

	return results, nil
}

// UserContext provides context for targeting decisions
type UserContext struct {
	Country     string
	Device      string
	IsNewUser   bool
	OrdersCount int
	Segments    []string
}

// ExperimentResults contains experiment results
type ExperimentResults struct {
	Experiment *Experiment      `json:"experiment"`
	Variants   []VariantResults `json:"variants"`
}

// VariantResults contains variant-specific results
type VariantResults struct {
	Variant        Variant `json:"variant"`
	ConversionRate float64 `json:"conversion_rate"`
	Lift           float64 `json:"lift,omitempty"` // Percentage lift vs control
}

func (s *Service) getExperimentCached(ctx context.Context, name string) (*Experiment, error) {
	if cached, ok := s.cache.Load(name); ok {
		return cached.(*Experiment), nil
	}

	exp, err := s.repo.GetExperimentByName(ctx, name)
	if err != nil {
		return nil, err
	}

	s.cache.Store(name, exp)
	return exp, nil
}

func (s *Service) matchesTargeting(targeting *Targeting, uc *UserContext) bool {
	if targeting == nil || uc == nil {
		return true
	}

	// Check user percentage
	if targeting.UserPercent < 100 {
		hash := hashUserID(uc.Country) // Use a stable hash
		if int(hash%100) >= targeting.UserPercent {
			return false
		}
	}

	// Check country
	if len(targeting.Countries) > 0 {
		found := false
		for _, c := range targeting.Countries {
			if c == uc.Country {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check device
	if len(targeting.Devices) > 0 {
		found := false
		for _, d := range targeting.Devices {
			if d == uc.Device {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check new user
	if targeting.NewUsersOnly && !uc.IsNewUser {
		return false
	}

	// Check orders count
	if targeting.MinOrdersCount > 0 && uc.OrdersCount < targeting.MinOrdersCount {
		return false
	}

	return true
}

func (s *Service) assignVariant(userID string, exp *Experiment) *Variant {
	// Use deterministic assignment based on user ID
	hash := hashUserID(userID + exp.ID)
	bucket := int(hash % 100)

	cumulative := 0
	for i := range exp.Variants {
		cumulative += exp.Variants[i].Weight
		if bucket < cumulative {
			return &exp.Variants[i]
		}
	}

	// Fallback to last variant
	return &exp.Variants[len(exp.Variants)-1]
}

func (s *Service) getControlVariant(exp *Experiment) (*Variant, error) {
	for i := range exp.Variants {
		if exp.Variants[i].IsControl {
			return &exp.Variants[i], nil
		}
	}
	return nil, ErrVariantNotFound
}

func (s *Service) getVariantByID(exp *Experiment, variantID string) (*Variant, error) {
	for i := range exp.Variants {
		if exp.Variants[i].ID == variantID {
			return &exp.Variants[i], nil
		}
	}
	return nil, ErrVariantNotFound
}

func hashUserID(userID string) uint64 {
	h := sha256.Sum256([]byte(userID))
	hex := hex.EncodeToString(h[:8])
	var result uint64
	fmt.Sscanf(hex, "%x", &result)
	return result
}

// Middleware adds A/B testing to requests
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract user context from request
		uc := &UserContext{
			Device: detectDevice(r.UserAgent()),
		}

		// Store in context for handlers
		ctx := context.WithValue(r.Context(), "ab_context", uc)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func detectDevice(userAgent string) string {
	// Simplified device detection
	ua := userAgent
	if len(ua) > 100 {
		ua = ua[:100]
	}
	switch {
	case containsAny(ua, "Mobile", "Android", "iPhone"):
		return "mobile"
	case containsAny(ua, "iPad", "Tablet"):
		return "tablet"
	default:
		return "desktop"
	}
}

func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
