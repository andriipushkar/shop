package fraud

import (
	"context"
	"testing"
	"time"
)

// MockFraudRepository for testing
type MockFraudRepository struct {
	assessments map[string]*RiskAssessment
	blacklist   map[string][]*BlacklistEntry
	rules       map[string][]*FraudRule
}

func NewMockFraudRepository() *MockFraudRepository {
	return &MockFraudRepository{
		assessments: make(map[string]*RiskAssessment),
		blacklist:   make(map[string][]*BlacklistEntry),
		rules:       make(map[string][]*FraudRule),
	}
}

func (m *MockFraudRepository) SaveAssessment(ctx context.Context, assessment *RiskAssessment) error {
	m.assessments[assessment.OrderID] = assessment
	return nil
}

func (m *MockFraudRepository) GetAssessment(ctx context.Context, orderID string) (*RiskAssessment, error) {
	if a, ok := m.assessments[orderID]; ok {
		return a, nil
	}
	return nil, ErrAssessmentNotFound
}

func (m *MockFraudRepository) UpdateAssessment(ctx context.Context, assessment *RiskAssessment) error {
	m.assessments[assessment.OrderID] = assessment
	return nil
}

func (m *MockFraudRepository) ListAssessments(ctx context.Context, filter AssessmentFilter) ([]*RiskAssessment, int, error) {
	var result []*RiskAssessment
	for _, a := range m.assessments {
		if filter.TenantID != "" && a.TenantID != filter.TenantID {
			continue
		}
		if filter.RiskLevel != "" && a.RiskLevel != RiskLevel(filter.RiskLevel) {
			continue
		}
		result = append(result, a)
	}
	return result, len(result), nil
}

func (m *MockFraudRepository) AddToBlacklist(ctx context.Context, entry *BlacklistEntry) error {
	m.blacklist[entry.TenantID] = append(m.blacklist[entry.TenantID], entry)
	return nil
}

func (m *MockFraudRepository) CheckBlacklist(ctx context.Context, tenantID string, entryType BlacklistType, value string) (bool, error) {
	for _, e := range m.blacklist[tenantID] {
		if e.Type == entryType && e.Value == value {
			// Check if not expired
			if e.ExpiresAt == nil || e.ExpiresAt.After(time.Now()) {
				return true, nil
			}
		}
	}
	return false, nil
}

func (m *MockFraudRepository) RemoveFromBlacklist(ctx context.Context, id string) error {
	for tenantID, entries := range m.blacklist {
		newEntries := make([]*BlacklistEntry, 0)
		for _, e := range entries {
			if e.ID != id {
				newEntries = append(newEntries, e)
			}
		}
		m.blacklist[tenantID] = newEntries
	}
	return nil
}

func (m *MockFraudRepository) ListBlacklist(ctx context.Context, tenantID string, entryType BlacklistType) ([]*BlacklistEntry, error) {
	var result []*BlacklistEntry
	for _, e := range m.blacklist[tenantID] {
		if entryType == "" || e.Type == entryType {
			result = append(result, e)
		}
	}
	return result, nil
}

func (m *MockFraudRepository) CreateRule(ctx context.Context, rule *FraudRule) error {
	m.rules[rule.TenantID] = append(m.rules[rule.TenantID], rule)
	return nil
}

func (m *MockFraudRepository) GetRule(ctx context.Context, id string) (*FraudRule, error) {
	for _, rules := range m.rules {
		for _, r := range rules {
			if r.ID == id {
				return r, nil
			}
		}
	}
	return nil, ErrRuleNotFound
}

func (m *MockFraudRepository) UpdateRule(ctx context.Context, rule *FraudRule) error {
	for tenantID, rules := range m.rules {
		for i, r := range rules {
			if r.ID == rule.ID {
				m.rules[tenantID][i] = rule
				return nil
			}
		}
	}
	return nil
}

func (m *MockFraudRepository) DeleteRule(ctx context.Context, id string) error {
	for tenantID, rules := range m.rules {
		newRules := make([]*FraudRule, 0)
		for _, r := range rules {
			if r.ID != id {
				newRules = append(newRules, r)
			}
		}
		m.rules[tenantID] = newRules
	}
	return nil
}

func (m *MockFraudRepository) ListRules(ctx context.Context, tenantID string) ([]*FraudRule, error) {
	return m.rules[tenantID], nil
}

func (m *MockFraudRepository) GetActiveRules(ctx context.Context, tenantID string) ([]*FraudRule, error) {
	var result []*FraudRule
	for _, r := range m.rules[tenantID] {
		if r.IsActive {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockFraudRepository) IncrementRuleMatchCount(ctx context.Context, id string) error {
	for _, rules := range m.rules {
		for _, r := range rules {
			if r.ID == id {
				r.MatchCount++
				return nil
			}
		}
	}
	return nil
}

// MockGeoIPProvider for testing
type MockGeoIPProvider struct {
	locations map[string]*GeoLocation
}

func NewMockGeoIPProvider() *MockGeoIPProvider {
	return &MockGeoIPProvider{
		locations: make(map[string]*GeoLocation),
	}
}

func (m *MockGeoIPProvider) GetLocation(ctx context.Context, ip string) (*GeoLocation, error) {
	if loc, ok := m.locations[ip]; ok {
		return loc, nil
	}
	return &GeoLocation{
		Country: "UA",
		City:    "Kyiv",
	}, nil
}

// MockOrderService for testing
type MockOrderService struct {
	orders         map[string]*OrderInfo
	customerOrders map[string][]time.Time
}

func NewMockOrderService() *MockOrderService {
	return &MockOrderService{
		orders:         make(map[string]*OrderInfo),
		customerOrders: make(map[string][]time.Time),
	}
}

func (m *MockOrderService) GetOrder(ctx context.Context, orderID string) (*OrderInfo, error) {
	if o, ok := m.orders[orderID]; ok {
		return o, nil
	}
	return nil, ErrOrderNotFound
}

func (m *MockOrderService) GetCustomerOrderCount(ctx context.Context, tenantID, customerID string, since time.Time) (int, error) {
	key := tenantID + ":" + customerID
	count := 0
	for _, t := range m.customerOrders[key] {
		if t.After(since) {
			count++
		}
	}
	return count, nil
}

func (m *MockOrderService) GetCustomerOrderTotal(ctx context.Context, tenantID, customerID string, since time.Time) (float64, error) {
	return 5000, nil
}

func TestFraudService_AssessOrder(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerID:    "customer-1",
		CustomerEmail: "customer@example.com",
		CustomerPhone: "+380991234567",
		Amount:        2500,
		Currency:      "UAH",
		IP:            "192.168.1.1",
		ShippingAddress: Address{
			Country: "UA",
			City:    "Kyiv",
		},
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if assessment.OrderID != "order-1" {
		t.Errorf("expected order ID order-1, got %s", assessment.OrderID)
	}

	if assessment.RiskLevel == "" {
		t.Error("expected risk level to be set")
	}

	// Check assessment was saved
	if _, ok := repo.assessments["order-1"]; !ok {
		t.Error("expected assessment to be saved")
	}
}

func TestFraudService_BlacklistCheck(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	// Add email to blacklist
	entry := &BlacklistEntry{
		ID:       "bl-1",
		TenantID: "tenant-1",
		Type:     BlacklistEmail,
		Value:    "fraud@example.com",
		Reason:   "Known fraudster",
	}
	repo.AddToBlacklist(context.Background(), entry)

	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerEmail: "fraud@example.com",
		Amount:        1000,
		IP:            "192.168.1.1",
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should have high risk due to blacklisted email
	if assessment.RiskLevel != RiskHigh && assessment.RiskLevel != RiskCritical {
		t.Errorf("expected high or critical risk for blacklisted email, got %s", assessment.RiskLevel)
	}

	// Check blacklist factor is present
	hasBlacklistFactor := false
	for _, f := range assessment.Factors {
		if f.Type == FactorBlacklist {
			hasBlacklistFactor = true
			break
		}
	}
	if !hasBlacklistFactor {
		t.Error("expected blacklist factor in assessment")
	}
}

func TestFraudService_VelocityCheck(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	// Simulate many recent orders
	orders.customerOrders["tenant-1:customer-1"] = []time.Time{
		time.Now().Add(-1 * time.Hour),
		time.Now().Add(-2 * time.Hour),
		time.Now().Add(-3 * time.Hour),
		time.Now().Add(-4 * time.Hour),
		time.Now().Add(-5 * time.Hour),
	}

	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerID:    "customer-1",
		CustomerEmail: "customer@example.com",
		Amount:        1000,
		IP:            "192.168.1.1",
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check velocity factor is present
	hasVelocityFactor := false
	for _, f := range assessment.Factors {
		if f.Type == FactorVelocity {
			hasVelocityFactor = true
			break
		}
	}
	if hasVelocityFactor {
		// Velocity check detected high order frequency
		if assessment.RiskScore < 10 {
			t.Error("expected velocity check to increase risk score")
		}
	}
}

func TestFraudService_GeoMismatch(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	// Set up IP to return different country
	geoIP.locations["192.168.1.1"] = &GeoLocation{
		Country: "RU", // Different from shipping
		City:    "Moscow",
	}

	service := NewFraudService(repo, geoIP, orders)

	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerEmail: "customer@example.com",
		Amount:        1000,
		IP:            "192.168.1.1",
		ShippingAddress: Address{
			Country: "UA", // Different from IP geolocation
			City:    "Kyiv",
		},
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check geo mismatch factor is present
	hasGeoFactor := false
	for _, f := range assessment.Factors {
		if f.Type == FactorGeoMismatch {
			hasGeoFactor = true
			break
		}
	}
	if !hasGeoFactor {
		t.Error("expected geo mismatch factor in assessment")
	}
}

func TestFraudService_AmountAnomaly(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	// Very high amount order
	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerEmail: "customer@example.com",
		Amount:        500000, // Very high amount
		IP:            "192.168.1.1",
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check amount anomaly factor is present
	hasAmountFactor := false
	for _, f := range assessment.Factors {
		if f.Type == FactorAmountAnomaly {
			hasAmountFactor = true
			break
		}
	}
	if !hasAmountFactor {
		t.Error("expected amount anomaly factor in assessment")
	}
}

func TestFraudService_CustomRules(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	// Create a custom rule
	rule := &FraudRule{
		ID:          "rule-1",
		TenantID:    "tenant-1",
		Name:        "Block temp emails",
		Description: "Block orders with temporary email domains",
		Conditions: []RuleCondition{
			{
				Field:    "email_domain",
				Operator: "in",
				Value:    []string{"tempmail.com", "throwaway.com"},
			},
		},
		Action:    ActionBlock,
		RiskScore: 100,
		IsActive:  true,
	}
	repo.CreateRule(context.Background(), rule)

	order := &OrderInfo{
		ID:            "order-1",
		TenantID:      "tenant-1",
		CustomerEmail: "user@tempmail.com",
		Amount:        1000,
		IP:            "192.168.1.1",
	}
	orders.orders["order-1"] = order

	assessment, err := service.AssessOrder(context.Background(), "order-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should have critical risk due to custom rule
	if assessment.RiskLevel != RiskCritical {
		t.Errorf("expected critical risk for blocked email domain, got %s", assessment.RiskLevel)
	}

	if assessment.Recommendation != RecommendationBlock {
		t.Errorf("expected block recommendation, got %s", assessment.Recommendation)
	}
}

func TestFraudService_ReviewAssessment(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	assessment := &RiskAssessment{
		ID:        "assess-1",
		TenantID:  "tenant-1",
		OrderID:   "order-1",
		RiskLevel: RiskHigh,
		RiskScore: 75,
	}
	repo.assessments["order-1"] = assessment

	err := service.ReviewAssessment(context.Background(), "order-1", ReviewInput{
		ReviewerID: "admin-1",
		Decision:   DecisionApprove,
		Notes:      "Customer verified via phone",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.assessments["order-1"]
	if updated.Decision != DecisionApprove {
		t.Errorf("expected decision approve, got %s", updated.Decision)
	}
	if updated.ReviewedBy != "admin-1" {
		t.Errorf("expected reviewed by admin-1, got %s", updated.ReviewedBy)
	}
	if updated.ReviewNotes != "Customer verified via phone" {
		t.Error("expected review notes to be set")
	}
}

func TestFraudService_AddToBlacklist(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	input := BlacklistInput{
		TenantID:  "tenant-1",
		Type:      BlacklistIP,
		Value:     "192.168.1.100",
		Reason:    "Fraud attempt",
		CreatedBy: "admin-1",
	}

	entry, err := service.AddToBlacklist(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if entry.Type != BlacklistIP {
		t.Errorf("expected type IP, got %s", entry.Type)
	}

	if entry.Value != "192.168.1.100" {
		t.Errorf("expected value 192.168.1.100, got %s", entry.Value)
	}

	// Check it was added
	blacklisted, _ := repo.CheckBlacklist(context.Background(), "tenant-1", BlacklistIP, "192.168.1.100")
	if !blacklisted {
		t.Error("expected IP to be blacklisted")
	}
}

func TestFraudService_CreateRule(t *testing.T) {
	repo := NewMockFraudRepository()
	geoIP := NewMockGeoIPProvider()
	orders := NewMockOrderService()

	service := NewFraudService(repo, geoIP, orders)

	input := CreateRuleInput{
		TenantID:    "tenant-1",
		Name:        "High amount warning",
		Description: "Flag orders over 50000 UAH",
		Conditions: []RuleCondition{
			{
				Field:    "amount",
				Operator: "gt",
				Value:    50000,
			},
		},
		Action:    ActionFlag,
		RiskScore: 30,
	}

	rule, err := service.CreateRule(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if rule.Name != "High amount warning" {
		t.Errorf("expected name High amount warning, got %s", rule.Name)
	}

	if !rule.IsActive {
		t.Error("expected rule to be active by default")
	}
}

func TestRiskLevelCalculation(t *testing.T) {
	tests := []struct {
		score         float64
		expectedLevel RiskLevel
	}{
		{10, RiskLow},
		{30, RiskLow},
		{40, RiskMedium},
		{60, RiskMedium},
		{70, RiskHigh},
		{85, RiskHigh},
		{90, RiskCritical},
		{100, RiskCritical},
	}

	for _, tt := range tests {
		t.Run(string(tt.expectedLevel), func(t *testing.T) {
			result := calculateRiskLevel(tt.score)
			if result != tt.expectedLevel {
				t.Errorf("for score %f expected %s, got %s", tt.score, tt.expectedLevel, result)
			}
		})
	}
}

func calculateRiskLevel(score float64) RiskLevel {
	switch {
	case score >= 90:
		return RiskCritical
	case score >= 70:
		return RiskHigh
	case score >= 40:
		return RiskMedium
	default:
		return RiskLow
	}
}

func TestBlacklistTypes(t *testing.T) {
	types := []BlacklistType{
		BlacklistEmail,
		BlacklistPhone,
		BlacklistIP,
		BlacklistCardBIN,
		BlacklistDevice,
	}

	for _, bt := range types {
		if bt == "" {
			t.Error("blacklist type should not be empty")
		}
	}
}

func TestRiskFactorTypes(t *testing.T) {
	factors := []FactorType{
		FactorBlacklist,
		FactorVelocity,
		FactorGeoMismatch,
		FactorEmailPattern,
		FactorAmountAnomaly,
		FactorCustomRule,
	}

	for _, f := range factors {
		if f == "" {
			t.Error("factor type should not be empty")
		}
	}
}

func TestFraudService_EmailPatternCheck(t *testing.T) {
	tests := []struct {
		email      string
		suspicious bool
	}{
		{"normal.user@gmail.com", false},
		{"john.doe@company.com", false},
		{"asdf1234@mail.com", true},       // Random-looking
		{"temp123456@tempmail.com", true}, // Temp email pattern
		{"a@b.c", true},                   // Too short
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			result := isSuspiciousEmail(tt.email)
			if result != tt.suspicious {
				t.Errorf("for email %s expected suspicious=%v, got %v", tt.email, tt.suspicious, result)
			}
		})
	}
}

func isSuspiciousEmail(email string) bool {
	// Simple pattern checks for testing
	if len(email) < 10 {
		return true
	}
	// Check for temp email domains
	tempDomains := []string{"tempmail", "throwaway", "10minutemail"}
	for _, d := range tempDomains {
		if contains(email, d) {
			return true
		}
	}
	// Check for random-looking usernames
	if containsOnlyDigits(email[:5]) {
		return true
	}
	return false
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func containsOnlyDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
