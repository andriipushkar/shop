package abtesting

import (
	"context"
	"testing"
	"time"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	experiments map[string]*Experiment
	assignments map[string]*Assignment
	events      []*Event
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		experiments: make(map[string]*Experiment),
		assignments: make(map[string]*Assignment),
		events:      make([]*Event, 0),
	}
}

func (m *MockRepository) GetExperiment(ctx context.Context, id string) (*Experiment, error) {
	if exp, ok := m.experiments[id]; ok {
		return exp, nil
	}
	return nil, ErrExperimentNotFound
}

func (m *MockRepository) GetExperimentByName(ctx context.Context, name string) (*Experiment, error) {
	for _, exp := range m.experiments {
		if exp.Name == name {
			return exp, nil
		}
	}
	return nil, ErrExperimentNotFound
}

func (m *MockRepository) GetActiveExperiments(ctx context.Context) ([]*Experiment, error) {
	var result []*Experiment
	for _, exp := range m.experiments {
		if exp.Status == StatusRunning {
			result = append(result, exp)
		}
	}
	return result, nil
}

func (m *MockRepository) SaveExperiment(ctx context.Context, exp *Experiment) error {
	m.experiments[exp.ID] = exp
	return nil
}

func (m *MockRepository) UpdateExperimentStats(ctx context.Context, expID, variantID string, impressions, conversions int64) error {
	exp, ok := m.experiments[expID]
	if !ok {
		return ErrExperimentNotFound
	}
	for i := range exp.Variants {
		if exp.Variants[i].ID == variantID {
			exp.Variants[i].Impressions += impressions
			exp.Variants[i].Conversions += conversions
			break
		}
	}
	return nil
}

func (m *MockRepository) GetAssignment(ctx context.Context, userID, experimentID string) (*Assignment, error) {
	key := userID + ":" + experimentID
	if a, ok := m.assignments[key]; ok {
		return a, nil
	}
	return nil, ErrVariantNotFound
}

func (m *MockRepository) SaveAssignment(ctx context.Context, assignment *Assignment) error {
	key := assignment.UserID + ":" + assignment.ExperimentID
	m.assignments[key] = assignment
	return nil
}

func (m *MockRepository) SaveEvent(ctx context.Context, event *Event) error {
	event.ID = "evt-" + string(rune(len(m.events)))
	m.events = append(m.events, event)
	return nil
}

func (m *MockRepository) GetEvents(ctx context.Context, experimentID string, startTime, endTime time.Time) ([]*Event, error) {
	var result []*Event
	for _, e := range m.events {
		if e.ExperimentID == experimentID {
			result = append(result, e)
		}
	}
	return result, nil
}

func createTestExperiment() *Experiment {
	return &Experiment{
		ID:     "exp-1",
		Name:   "button_color_test",
		Status: StatusRunning,
		Variants: []Variant{
			{ID: "var-control", Name: "Control", Weight: 50, IsControl: true},
			{ID: "var-test", Name: "Test", Weight: 50, IsControl: false},
		},
		StartDate: time.Now().Add(-24 * time.Hour),
		CreatedAt: time.Now().Add(-24 * time.Hour),
	}
}

func TestService_GetVariant(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	exp := createTestExperiment()
	repo.SaveExperiment(ctx, exp)

	t.Run("Returns variant for user", func(t *testing.T) {
		variant, err := svc.GetVariant(ctx, "user-1", "button_color_test", nil)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if variant == nil {
			t.Fatal("Expected variant to be returned")
		}
		if variant.ID != "var-control" && variant.ID != "var-test" {
			t.Errorf("Unexpected variant ID: %s", variant.ID)
		}
	})

	t.Run("Returns consistent variant for same user", func(t *testing.T) {
		variant1, _ := svc.GetVariant(ctx, "user-2", "button_color_test", nil)
		variant2, _ := svc.GetVariant(ctx, "user-2", "button_color_test", nil)

		if variant1.ID != variant2.ID {
			t.Error("Expected same variant for same user")
		}
	})

	t.Run("Returns error for non-existent experiment", func(t *testing.T) {
		_, err := svc.GetVariant(ctx, "user-1", "non_existent", nil)
		if err != ErrExperimentNotFound {
			t.Errorf("Expected ErrExperimentNotFound, got %v", err)
		}
	})

	t.Run("Returns error for non-running experiment", func(t *testing.T) {
		pausedExp := createTestExperiment()
		pausedExp.ID = "exp-paused"
		pausedExp.Name = "paused_test"
		pausedExp.Status = StatusPaused
		repo.SaveExperiment(ctx, pausedExp)

		_, err := svc.GetVariant(ctx, "user-1", "paused_test", nil)
		if err != ErrExperimentNotActive {
			t.Errorf("Expected ErrExperimentNotActive, got %v", err)
		}
	})
}

func TestService_Targeting(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	exp := createTestExperiment()
	exp.Targeting = &Targeting{
		Countries:      []string{"UA", "US"},
		Devices:        []string{"mobile"},
		NewUsersOnly:   true,
		MinOrdersCount: 0,
	}
	repo.SaveExperiment(ctx, exp)

	t.Run("Matches targeting", func(t *testing.T) {
		userContext := &UserContext{
			Country:   "UA",
			Device:    "mobile",
			IsNewUser: true,
		}

		variant, err := svc.GetVariant(ctx, "user-target", "button_color_test", userContext)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		// Should get a non-control variant based on hash
		if variant == nil {
			t.Error("Expected variant for matching user")
		}
	})

	t.Run("Returns control for non-matching user", func(t *testing.T) {
		userContext := &UserContext{
			Country:   "DE", // Not in target countries
			Device:    "mobile",
			IsNewUser: true,
		}

		variant, err := svc.GetVariant(ctx, "user-notarget", "button_color_test", userContext)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if !variant.IsControl {
			t.Error("Expected control variant for non-matching user")
		}
	})
}

func TestService_TrackEvents(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	exp := createTestExperiment()
	repo.SaveExperiment(ctx, exp)

	t.Run("Track impression", func(t *testing.T) {
		err := svc.TrackImpression(ctx, "user-1", "exp-1", "var-control")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Check stats updated
		updated, _ := repo.GetExperiment(ctx, "exp-1")
		if updated.Variants[0].Impressions != 1 {
			t.Errorf("Expected 1 impression, got %d", updated.Variants[0].Impressions)
		}
	})

	t.Run("Track conversion", func(t *testing.T) {
		err := svc.TrackConversion(ctx, "user-1", "exp-1", "var-control", map[string]interface{}{
			"value": 99.99,
		})
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Check stats updated
		updated, _ := repo.GetExperiment(ctx, "exp-1")
		if updated.Variants[0].Conversions != 1 {
			t.Errorf("Expected 1 conversion, got %d", updated.Variants[0].Conversions)
		}
	})
}

func TestService_GetExperimentResults(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	exp := createTestExperiment()
	exp.Variants[0].Impressions = 1000
	exp.Variants[0].Conversions = 50 // 5% conversion
	exp.Variants[1].Impressions = 1000
	exp.Variants[1].Conversions = 75 // 7.5% conversion
	repo.SaveExperiment(ctx, exp)

	results, err := svc.GetExperimentResults(ctx, "exp-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	t.Run("Calculates conversion rates", func(t *testing.T) {
		if results.Variants[0].ConversionRate != 0.05 {
			t.Errorf("Expected 0.05 conversion rate, got %f", results.Variants[0].ConversionRate)
		}
		if results.Variants[1].ConversionRate != 0.075 {
			t.Errorf("Expected 0.075 conversion rate, got %f", results.Variants[1].ConversionRate)
		}
	})

	t.Run("Calculates lift", func(t *testing.T) {
		// Lift = (0.075 - 0.05) / 0.05 * 100 = 50%
		expectedLift := 50.0
		// Use tolerance for floating point comparison
		if results.Variants[1].Lift < expectedLift-0.1 || results.Variants[1].Lift > expectedLift+0.1 {
			t.Errorf("Expected %f lift, got %f", expectedLift, results.Variants[1].Lift)
		}
	})
}

func TestDetectDevice(t *testing.T) {
	tests := []struct {
		userAgent string
		expected  string
	}{
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)", "mobile"},
		{"Mozilla/5.0 (Linux; Android 10)", "mobile"},
		{"Mozilla/5.0 (iPad; CPU OS 14_0)", "tablet"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "desktop"},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "desktop"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := detectDevice(tt.userAgent)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestHashUserID(t *testing.T) {
	t.Run("Deterministic", func(t *testing.T) {
		hash1 := hashUserID("user-123")
		hash2 := hashUserID("user-123")
		if hash1 != hash2 {
			t.Error("Hash should be deterministic")
		}
	})

	t.Run("Different for different users", func(t *testing.T) {
		hash1 := hashUserID("user-1")
		hash2 := hashUserID("user-2")
		if hash1 == hash2 {
			t.Error("Hash should be different for different users")
		}
	})
}

func TestVariant_WeightDistribution(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	exp := createTestExperiment()
	repo.SaveExperiment(ctx, exp)

	// Test distribution with many users
	controlCount := 0
	testCount := 0

	for i := 0; i < 1000; i++ {
		userID := string(rune(i)) + "-user"
		variant, _ := svc.GetVariant(ctx, userID, "button_color_test", nil)
		if variant.IsControl {
			controlCount++
		} else {
			testCount++
		}
	}

	// With 50/50 split, expect roughly equal distribution (within 10% tolerance)
	diff := abs(controlCount - testCount)
	if diff > 100 { // 10% of 1000
		t.Errorf("Distribution too skewed: control=%d, test=%d", controlCount, testCount)
	}
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
