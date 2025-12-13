package cdp

import (
	"context"
	"testing"
	"time"
)

// MockEventRepository for testing
type MockEventRepository struct {
	events []*Event
}

func NewMockEventRepository() *MockEventRepository {
	return &MockEventRepository{
		events: make([]*Event, 0),
	}
}

func (m *MockEventRepository) Store(ctx context.Context, event *Event) error {
	m.events = append(m.events, event)
	return nil
}

func (m *MockEventRepository) Query(ctx context.Context, filter EventFilter) ([]*Event, error) {
	var result []*Event
	for _, e := range m.events {
		if filter.TenantID != "" && e.TenantID != filter.TenantID {
			continue
		}
		if filter.CustomerID != "" && e.CustomerID != filter.CustomerID {
			continue
		}
		if filter.Type != "" && e.Type != EventType(filter.Type) {
			continue
		}
		result = append(result, e)
	}
	return result, nil
}

func (m *MockEventRepository) Count(ctx context.Context, filter EventFilter) (int, error) {
	events, _ := m.Query(ctx, filter)
	return len(events), nil
}

func (m *MockEventRepository) GetCustomerEvents(ctx context.Context, tenantID, customerID string, limit int) ([]*Event, error) {
	var result []*Event
	for _, e := range m.events {
		if e.TenantID == tenantID && e.CustomerID == customerID {
			result = append(result, e)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// MockProfileRepository for testing
type MockProfileRepository struct {
	profiles map[string]*CustomerProfile
}

func NewMockProfileRepository() *MockProfileRepository {
	return &MockProfileRepository{
		profiles: make(map[string]*CustomerProfile),
	}
}

func (m *MockProfileRepository) Get(ctx context.Context, tenantID, customerID string) (*CustomerProfile, error) {
	key := tenantID + ":" + customerID
	if p, ok := m.profiles[key]; ok {
		return p, nil
	}
	return nil, ErrProfileNotFound
}

func (m *MockProfileRepository) GetByEmail(ctx context.Context, tenantID, email string) (*CustomerProfile, error) {
	for _, p := range m.profiles {
		if p.TenantID == tenantID && p.Email == email {
			return p, nil
		}
	}
	return nil, ErrProfileNotFound
}

func (m *MockProfileRepository) Upsert(ctx context.Context, profile *CustomerProfile) error {
	key := profile.TenantID + ":" + profile.ID
	m.profiles[key] = profile
	return nil
}

func (m *MockProfileRepository) List(ctx context.Context, filter ProfileFilter) ([]*CustomerProfile, int, error) {
	var result []*CustomerProfile
	for _, p := range m.profiles {
		if filter.TenantID != "" && p.TenantID != filter.TenantID {
			continue
		}
		if filter.Segment != "" && p.RFMSegment != filter.Segment {
			continue
		}
		result = append(result, p)
	}
	return result, len(result), nil
}

func (m *MockProfileRepository) UpdateRFM(ctx context.Context, tenantID, customerID string, rfm RFMScore) error {
	key := tenantID + ":" + customerID
	if p, ok := m.profiles[key]; ok {
		p.RecencyScore = rfm.Recency
		p.FrequencyScore = rfm.Frequency
		p.MonetaryScore = rfm.Monetary
		p.RFMScore = rfm.Total
		p.RFMSegment = rfm.Segment
	}
	return nil
}

func (m *MockProfileRepository) AddToSegment(ctx context.Context, tenantID, customerID, segment string) error {
	key := tenantID + ":" + customerID
	if p, ok := m.profiles[key]; ok {
		p.Segments = append(p.Segments, segment)
	}
	return nil
}

func (m *MockProfileRepository) RemoveFromSegment(ctx context.Context, tenantID, customerID, segment string) error {
	key := tenantID + ":" + customerID
	if p, ok := m.profiles[key]; ok {
		newSegments := make([]string, 0)
		for _, s := range p.Segments {
			if s != segment {
				newSegments = append(newSegments, s)
			}
		}
		p.Segments = newSegments
	}
	return nil
}

// MockSegmentRepository for testing
type MockSegmentRepository struct {
	segments map[string]*Segment
	members  map[string][]string
}

func NewMockSegmentRepository() *MockSegmentRepository {
	return &MockSegmentRepository{
		segments: make(map[string]*Segment),
		members:  make(map[string][]string),
	}
}

func (m *MockSegmentRepository) Create(ctx context.Context, segment *Segment) error {
	m.segments[segment.ID] = segment
	return nil
}

func (m *MockSegmentRepository) Get(ctx context.Context, id string) (*Segment, error) {
	if s, ok := m.segments[id]; ok {
		return s, nil
	}
	return nil, ErrSegmentNotFound
}

func (m *MockSegmentRepository) Update(ctx context.Context, segment *Segment) error {
	m.segments[segment.ID] = segment
	return nil
}

func (m *MockSegmentRepository) Delete(ctx context.Context, id string) error {
	delete(m.segments, id)
	return nil
}

func (m *MockSegmentRepository) List(ctx context.Context, tenantID string) ([]*Segment, error) {
	var result []*Segment
	for _, s := range m.segments {
		if s.TenantID == tenantID {
			result = append(result, s)
		}
	}
	return result, nil
}

func (m *MockSegmentRepository) AddMember(ctx context.Context, segmentID, customerID string) error {
	m.members[segmentID] = append(m.members[segmentID], customerID)
	return nil
}

func (m *MockSegmentRepository) RemoveMember(ctx context.Context, segmentID, customerID string) error {
	members := m.members[segmentID]
	newMembers := make([]string, 0)
	for _, id := range members {
		if id != customerID {
			newMembers = append(newMembers, id)
		}
	}
	m.members[segmentID] = newMembers
	return nil
}

func (m *MockSegmentRepository) GetMembers(ctx context.Context, segmentID string, limit, offset int) ([]string, int, error) {
	members := m.members[segmentID]
	return members, len(members), nil
}

// MockAutomationRepository for testing
type MockAutomationRepository struct {
	automations map[string]*Automation
}

func NewMockAutomationRepository() *MockAutomationRepository {
	return &MockAutomationRepository{
		automations: make(map[string]*Automation),
	}
}

func (m *MockAutomationRepository) Create(ctx context.Context, automation *Automation) error {
	m.automations[automation.ID] = automation
	return nil
}

func (m *MockAutomationRepository) Get(ctx context.Context, id string) (*Automation, error) {
	if a, ok := m.automations[id]; ok {
		return a, nil
	}
	return nil, ErrAutomationNotFound
}

func (m *MockAutomationRepository) Update(ctx context.Context, automation *Automation) error {
	m.automations[automation.ID] = automation
	return nil
}

func (m *MockAutomationRepository) Delete(ctx context.Context, id string) error {
	delete(m.automations, id)
	return nil
}

func (m *MockAutomationRepository) List(ctx context.Context, tenantID string) ([]*Automation, error) {
	var result []*Automation
	for _, a := range m.automations {
		if a.TenantID == tenantID {
			result = append(result, a)
		}
	}
	return result, nil
}

func (m *MockAutomationRepository) GetByTrigger(ctx context.Context, tenantID string, triggerType TriggerType) ([]*Automation, error) {
	var result []*Automation
	for _, a := range m.automations {
		if a.TenantID == tenantID && a.TriggerType == triggerType && a.IsActive {
			result = append(result, a)
		}
	}
	return result, nil
}

func (m *MockAutomationRepository) IncrementStats(ctx context.Context, id, stat string) error {
	return nil
}

func TestCDPService_TrackEvent(t *testing.T) {
	eventRepo := NewMockEventRepository()
	profileRepo := NewMockProfileRepository()
	segmentRepo := NewMockSegmentRepository()
	automationRepo := NewMockAutomationRepository()

	service := NewCDPService(eventRepo, profileRepo, segmentRepo, automationRepo)
	service.Start()
	defer service.Stop()

	// Create a profile first
	profile := &CustomerProfile{
		ID:       "customer-1",
		TenantID: "tenant-1",
		Email:    "test@example.com",
	}
	profileRepo.Upsert(context.Background(), profile)

	event := &Event{
		TenantID:   "tenant-1",
		CustomerID: "customer-1",
		SessionID:  "session-1",
		Type:       EventProductView,
		Properties: map[string]interface{}{
			"product_id":   "prod-1",
			"product_name": "Test Product",
		},
		Timestamp: time.Now(),
	}

	err := service.TrackEvent(context.Background(), event)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Wait for async processing
	time.Sleep(100 * time.Millisecond)

	// Check event was stored
	if len(eventRepo.events) != 1 {
		t.Errorf("expected 1 event, got %d", len(eventRepo.events))
	}

	stored := eventRepo.events[0]
	if stored.Type != EventProductView {
		t.Errorf("expected type %s, got %s", EventProductView, stored.Type)
	}
}

func TestCDPService_GetProfile(t *testing.T) {
	eventRepo := NewMockEventRepository()
	profileRepo := NewMockProfileRepository()
	segmentRepo := NewMockSegmentRepository()
	automationRepo := NewMockAutomationRepository()

	service := NewCDPService(eventRepo, profileRepo, segmentRepo, automationRepo)

	profile := &CustomerProfile{
		ID:          "customer-1",
		TenantID:    "tenant-1",
		Email:       "test@example.com",
		FirstName:   "John",
		LastName:    "Doe",
		TotalOrders: 5,
		TotalSpent:  10000,
		RFMSegment:  SegmentLoyal,
	}
	profileRepo.Upsert(context.Background(), profile)

	found, err := service.GetProfile(context.Background(), "tenant-1", "customer-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if found.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", found.Email)
	}

	if found.RFMSegment != SegmentLoyal {
		t.Errorf("expected segment %s, got %s", SegmentLoyal, found.RFMSegment)
	}
}

func TestCDPService_CalculateRFM(t *testing.T) {
	eventRepo := NewMockEventRepository()
	profileRepo := NewMockProfileRepository()
	segmentRepo := NewMockSegmentRepository()
	automationRepo := NewMockAutomationRepository()

	service := NewCDPService(eventRepo, profileRepo, segmentRepo, automationRepo)

	// High value customer - recent, frequent, high spending
	profile := &CustomerProfile{
		ID:                "customer-1",
		TenantID:          "tenant-1",
		TotalOrders:       50,
		TotalSpent:        100000,
		AverageOrderValue: 2000,
		LastOrderDate:     timePtr(time.Now().AddDate(0, 0, -5)),
		DaysSinceOrder:    5,
	}
	profileRepo.Upsert(context.Background(), profile)

	rfm, err := service.CalculateRFM(context.Background(), "tenant-1", "customer-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should be a high scorer (champion or loyal)
	if rfm.Total < 10 {
		t.Errorf("expected high RFM score, got %d", rfm.Total)
	}

	if rfm.Segment != SegmentChampion && rfm.Segment != SegmentLoyal {
		t.Errorf("expected champion or loyal segment, got %s", rfm.Segment)
	}
}

func TestCDPService_CreateSegment(t *testing.T) {
	eventRepo := NewMockEventRepository()
	profileRepo := NewMockProfileRepository()
	segmentRepo := NewMockSegmentRepository()
	automationRepo := NewMockAutomationRepository()

	service := NewCDPService(eventRepo, profileRepo, segmentRepo, automationRepo)

	input := CreateSegmentInput{
		TenantID:    "tenant-1",
		Name:        "High Spenders",
		Description: "Customers who spent more than 50000",
		Type:        SegmentTypeDynamic,
		Criteria: SegmentCriteria{
			Conditions: []SegmentCondition{
				{
					Field:    "total_spent",
					Operator: "gte",
					Value:    50000,
				},
			},
		},
	}

	segment, err := service.CreateSegment(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if segment.Name != "High Spenders" {
		t.Errorf("expected name High Spenders, got %s", segment.Name)
	}

	if segment.Type != SegmentTypeDynamic {
		t.Errorf("expected type %s, got %s", SegmentTypeDynamic, segment.Type)
	}
}

func TestCDPService_CreateAutomation(t *testing.T) {
	eventRepo := NewMockEventRepository()
	profileRepo := NewMockProfileRepository()
	segmentRepo := NewMockSegmentRepository()
	automationRepo := NewMockAutomationRepository()

	service := NewCDPService(eventRepo, profileRepo, segmentRepo, automationRepo)

	input := CreateAutomationInput{
		TenantID:    "tenant-1",
		Name:        "Abandoned Cart Recovery",
		Description: "Send email when cart is abandoned",
		TriggerType: TriggerCartAbandoned,
		TriggerConfig: map[string]interface{}{
			"delay_minutes": 15,
		},
		Actions: []AutomationAction{
			{
				Type: ActionSendEmail,
				Config: map[string]interface{}{
					"template": "abandoned_cart",
					"subject":  "You left something in your cart!",
				},
			},
		},
	}

	automation, err := service.CreateAutomation(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if automation.TriggerType != TriggerCartAbandoned {
		t.Errorf("expected trigger %s, got %s", TriggerCartAbandoned, automation.TriggerType)
	}

	if len(automation.Actions) != 1 {
		t.Errorf("expected 1 action, got %d", len(automation.Actions))
	}
}

func TestCDPService_SegmentMatching(t *testing.T) {
	tests := []struct {
		name      string
		profile   *CustomerProfile
		condition SegmentCondition
		expected  bool
	}{
		{
			name:      "total_spent gte matches",
			profile:   &CustomerProfile{TotalSpent: 60000},
			condition: SegmentCondition{Field: "total_spent", Operator: "gte", Value: 50000},
			expected:  true,
		},
		{
			name:      "total_spent gte does not match",
			profile:   &CustomerProfile{TotalSpent: 30000},
			condition: SegmentCondition{Field: "total_spent", Operator: "gte", Value: 50000},
			expected:  false,
		},
		{
			name:      "total_orders gt matches",
			profile:   &CustomerProfile{TotalOrders: 15},
			condition: SegmentCondition{Field: "total_orders", Operator: "gt", Value: 10},
			expected:  true,
		},
		{
			name:      "rfm_segment eq matches",
			profile:   &CustomerProfile{RFMSegment: SegmentChampion},
			condition: SegmentCondition{Field: "rfm_segment", Operator: "eq", Value: SegmentChampion},
			expected:  true,
		},
		{
			name:      "days_since_order lte matches",
			profile:   &CustomerProfile{DaysSinceOrder: 7},
			condition: SegmentCondition{Field: "days_since_order", Operator: "lte", Value: 30},
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := matchCondition(tt.profile, tt.condition)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestRFMSegmentCalculation(t *testing.T) {
	tests := []struct {
		name     string
		r, f, m  int
		expected RFMSegmentType
	}{
		{"champion high scores", 5, 5, 5, SegmentChampion},
		{"loyal customer", 4, 4, 4, SegmentLoyal},
		{"at risk low recency", 2, 4, 4, SegmentAtRisk},
		{"cant lose high value low recency", 1, 5, 5, SegmentCantLose},
		{"lost customer", 1, 1, 1, SegmentLost},
		{"new customer", 5, 1, 1, SegmentNew},
		{"potential loyalist", 5, 3, 3, SegmentPotentialLoyalist},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateRFMSegment(tt.r, tt.f, tt.m)
			if result != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestEventTypes(t *testing.T) {
	eventTypes := []EventType{
		EventPageView,
		EventProductView,
		EventAddToCart,
		EventRemoveFromCart,
		EventCartAbandoned,
		EventPurchase,
		EventSearch,
		EventWishlistAdd,
		EventReview,
		EventLogin,
		EventSignup,
	}

	for _, et := range eventTypes {
		if et == "" {
			t.Error("event type should not be empty")
		}
	}
}

func TestLifecycleStages(t *testing.T) {
	stages := []LifecycleStage{
		StageNew,
		StageActive,
		StageEngaged,
		StageLoyal,
		StageAtRisk,
		StageChurned,
	}

	for _, s := range stages {
		if s == "" {
			t.Error("lifecycle stage should not be empty")
		}
	}
}

// Helper function
func timePtr(t time.Time) *time.Time {
	return &t
}

// matchCondition helper for testing
func matchCondition(profile *CustomerProfile, condition SegmentCondition) bool {
	var fieldValue interface{}

	switch condition.Field {
	case "total_spent":
		fieldValue = profile.TotalSpent
	case "total_orders":
		fieldValue = profile.TotalOrders
	case "rfm_segment":
		fieldValue = profile.RFMSegment
	case "days_since_order":
		fieldValue = profile.DaysSinceOrder
	default:
		return false
	}

	switch condition.Operator {
	case "eq":
		return fieldValue == condition.Value
	case "gt":
		return toFloat(fieldValue) > toFloat(condition.Value)
	case "gte":
		return toFloat(fieldValue) >= toFloat(condition.Value)
	case "lt":
		return toFloat(fieldValue) < toFloat(condition.Value)
	case "lte":
		return toFloat(fieldValue) <= toFloat(condition.Value)
	}

	return false
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case float64:
		return val
	}
	return 0
}

// calculateRFMSegment helper for testing
func calculateRFMSegment(r, f, m int) RFMSegmentType {
	total := r + f + m

	// Champion: high in all dimensions
	if r >= 4 && f >= 4 && m >= 4 {
		return SegmentChampion
	}

	// Loyal: good in all dimensions
	if r >= 3 && f >= 3 && m >= 3 {
		return SegmentLoyal
	}

	// Can't Lose: high value but haven't purchased recently
	if r <= 2 && f >= 4 && m >= 4 {
		return SegmentCantLose
	}

	// At Risk: used to be good customers
	if r <= 2 && f >= 3 && m >= 3 {
		return SegmentAtRisk
	}

	// New: recent but not frequent
	if r >= 4 && f <= 2 {
		return SegmentNew
	}

	// Potential Loyalist: recent and moderate engagement
	if r >= 4 && f >= 2 && f <= 4 {
		return SegmentPotentialLoyalist
	}

	// Lost: low in all dimensions
	if total <= 5 {
		return SegmentLost
	}

	return SegmentOther
}
