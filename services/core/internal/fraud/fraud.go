package fraud

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

var (
	ErrHighRiskOrder     = errors.New("order flagged as high risk")
	ErrBlacklistedEntity = errors.New("entity is blacklisted")
)

// RiskLevel represents the risk level of an order
type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

// RiskFactor represents a fraud risk factor
type RiskFactor struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Score       float64 `json:"score"` // 0-100
	Weight      float64 `json:"weight"` // Importance multiplier
}

// RiskAssessment represents the fraud risk assessment of an order
type RiskAssessment struct {
	ID            string       `json:"id"`
	TenantID      string       `json:"tenant_id"`
	OrderID       string       `json:"order_id"`
	RiskLevel     RiskLevel    `json:"risk_level"`
	RiskScore     float64      `json:"risk_score"` // 0-100
	Factors       []RiskFactor `json:"factors"`
	Recommendation string      `json:"recommendation"` // approve, review, reject
	ReviewedBy    string       `json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time   `json:"reviewed_at,omitempty"`
	ReviewNotes   string       `json:"review_notes,omitempty"`
	Decision      string       `json:"decision,omitempty"` // approved, rejected
	CreatedAt     time.Time    `json:"created_at"`
}

// OrderData represents order data for risk assessment
type OrderData struct {
	OrderID         string
	TenantID        string
	CustomerID      string
	CustomerEmail   string
	CustomerPhone   string
	CustomerName    string
	ShippingCity    string
	ShippingCountry string
	BillingCity     string
	BillingCountry  string
	IP              string
	UserAgent       string
	PaymentMethod   string
	CardBIN         string // First 6 digits of card
	CardLast4       string
	Amount          float64
	Currency        string
	ItemCount       int
	IsNewCustomer   bool
	PreviousOrders  int
	TotalSpent      float64
	SessionID       string
	DeviceID        string
	PromoCode       string
}

// BlacklistEntry represents a blacklisted entity
type BlacklistEntry struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenant_id"`
	Type       string    `json:"type"` // email, phone, ip, card_bin, device
	Value      string    `json:"value"`
	Reason     string    `json:"reason"`
	CreatedBy  string    `json:"created_by"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
}

// FraudRule represents a custom fraud detection rule
type FraudRule struct {
	ID          string          `json:"id"`
	TenantID    string          `json:"tenant_id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Conditions  []RuleCondition `json:"conditions"`
	Action      string          `json:"action"` // flag, block, review
	RiskScore   float64         `json:"risk_score"` // Score to add if matched
	IsActive    bool            `json:"is_active"`
	Priority    int             `json:"priority"`
	MatchCount  int             `json:"match_count"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// RuleCondition represents a condition in a fraud rule
type RuleCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, lt, gte, lte, contains, in, regex
	Value    interface{} `json:"value"`
	Logic    string      `json:"logic,omitempty"` // and, or (for next condition)
}

// VelocityCheck tracks order velocity
type VelocityCheck struct {
	TenantID    string
	Field       string // email, ip, card, phone, device
	Value       string
	WindowHours int
	MaxCount    int
}

// GeoIPInfo represents geographic information from IP
type GeoIPInfo struct {
	IP          string  `json:"ip"`
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	Region      string  `json:"region"`
	City        string  `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	ISP         string  `json:"isp,omitempty"`
	IsProxy     bool    `json:"is_proxy"`
	IsVPN       bool    `json:"is_vpn"`
	IsTor       bool    `json:"is_tor"`
	IsHosting   bool    `json:"is_hosting"`
}

// Repository interface for fraud data storage
type Repository interface {
	SaveAssessment(ctx context.Context, assessment *RiskAssessment) error
	GetAssessment(ctx context.Context, orderID string) (*RiskAssessment, error)
	UpdateAssessment(ctx context.Context, assessment *RiskAssessment) error
	ListAssessments(ctx context.Context, tenantID string, filter *AssessmentFilter) ([]*RiskAssessment, int, error)

	AddToBlacklist(ctx context.Context, entry *BlacklistEntry) error
	RemoveFromBlacklist(ctx context.Context, id string) error
	IsBlacklisted(ctx context.Context, tenantID, entityType, value string) (bool, *BlacklistEntry, error)
	ListBlacklist(ctx context.Context, tenantID string) ([]*BlacklistEntry, error)

	SaveRule(ctx context.Context, rule *FraudRule) error
	GetRule(ctx context.Context, id string) (*FraudRule, error)
	DeleteRule(ctx context.Context, id string) error
	ListRules(ctx context.Context, tenantID string) ([]*FraudRule, error)
	IncrementRuleMatch(ctx context.Context, ruleID string) error

	GetOrderVelocity(ctx context.Context, check *VelocityCheck) (int, error)
	GetCustomerHistory(ctx context.Context, tenantID, customerID string) (*CustomerHistory, error)
}

// CustomerHistory for risk assessment
type CustomerHistory struct {
	CustomerID      string
	TotalOrders     int
	TotalSpent      float64
	ChargebackCount int
	ReturnCount     int
	FraudCount      int
	FirstOrderDate  time.Time
	LastOrderDate   time.Time
}

// AssessmentFilter for listing assessments
type AssessmentFilter struct {
	RiskLevel  RiskLevel
	Decision   string
	DateFrom   *time.Time
	DateTo     *time.Time
	NeedsReview bool
	Limit      int
	Offset     int
}

// GeoIPProvider interface for IP geolocation
type GeoIPProvider interface {
	Lookup(ctx context.Context, ip string) (*GeoIPInfo, error)
}

// Service handles fraud detection operations
type Service struct {
	repo       Repository
	geoIP      GeoIPProvider

	// Risk thresholds
	lowThreshold      float64
	mediumThreshold   float64
	highThreshold     float64
	criticalThreshold float64

	// High risk countries
	highRiskCountries map[string]bool

	// Default weights
	weights map[string]float64

	mu sync.RWMutex
}

// Config for fraud service
type Config struct {
	LowThreshold      float64
	MediumThreshold   float64
	HighThreshold     float64
	CriticalThreshold float64
	HighRiskCountries []string
}

// DefaultConfig returns default fraud detection configuration
func DefaultConfig() *Config {
	return &Config{
		LowThreshold:      20,
		MediumThreshold:   40,
		HighThreshold:     60,
		CriticalThreshold: 80,
		HighRiskCountries: []string{"NG", "GH", "KE", "PH", "ID"}, // Examples
	}
}

// NewService creates a new fraud detection service
func NewService(repo Repository, geoIP GeoIPProvider, config *Config) *Service {
	if config == nil {
		config = DefaultConfig()
	}

	highRiskCountries := make(map[string]bool)
	for _, c := range config.HighRiskCountries {
		highRiskCountries[strings.ToUpper(c)] = true
	}

	return &Service{
		repo:              repo,
		geoIP:             geoIP,
		lowThreshold:      config.LowThreshold,
		mediumThreshold:   config.MediumThreshold,
		highThreshold:     config.HighThreshold,
		criticalThreshold: config.CriticalThreshold,
		highRiskCountries: highRiskCountries,
		weights: map[string]float64{
			"velocity":       1.5,
			"geo_mismatch":   1.3,
			"proxy_vpn":      1.4,
			"new_customer":   1.0,
			"high_amount":    1.2,
			"email_pattern":  1.1,
			"blacklist":      2.0,
			"custom_rule":    1.0,
		},
	}
}

// SetGeoIPProvider sets the GeoIP provider
func (s *Service) SetGeoIPProvider(provider GeoIPProvider) {
	s.geoIP = provider
}

// AssessOrder performs fraud risk assessment on an order
func (s *Service) AssessOrder(ctx context.Context, order *OrderData) (*RiskAssessment, error) {
	var factors []RiskFactor
	var totalScore float64

	// 1. Check blacklists
	blacklistFactors, blacklistScore := s.checkBlacklists(ctx, order)
	factors = append(factors, blacklistFactors...)
	totalScore += blacklistScore

	// 2. Check velocity (multiple orders from same entity)
	velocityFactors, velocityScore := s.checkVelocity(ctx, order)
	factors = append(factors, velocityFactors...)
	totalScore += velocityScore

	// 3. Check geolocation
	if s.geoIP != nil && order.IP != "" {
		geoFactors, geoScore := s.checkGeolocation(ctx, order)
		factors = append(factors, geoFactors...)
		totalScore += geoScore
	}

	// 4. Check email patterns
	emailFactors, emailScore := s.checkEmailPatterns(order)
	factors = append(factors, emailFactors...)
	totalScore += emailScore

	// 5. Check amount anomalies
	amountFactors, amountScore := s.checkAmountAnomalies(ctx, order)
	factors = append(factors, amountFactors...)
	totalScore += amountScore

	// 6. Check new customer risk
	if order.IsNewCustomer {
		factor := RiskFactor{
			Name:        "new_customer",
			Description: "First-time customer",
			Score:       15,
			Weight:      s.weights["new_customer"],
		}
		factors = append(factors, factor)
		totalScore += factor.Score * factor.Weight
	}

	// 7. Check custom rules
	ruleFactors, ruleScore := s.checkCustomRules(ctx, order)
	factors = append(factors, ruleFactors...)
	totalScore += ruleScore

	// Determine risk level
	riskLevel := s.determineRiskLevel(totalScore)

	// Determine recommendation
	recommendation := "approve"
	if riskLevel == RiskCritical {
		recommendation = "reject"
	} else if riskLevel == RiskHigh || riskLevel == RiskMedium {
		recommendation = "review"
	}

	assessment := &RiskAssessment{
		ID:             generateID(),
		TenantID:       order.TenantID,
		OrderID:        order.OrderID,
		RiskLevel:      riskLevel,
		RiskScore:      totalScore,
		Factors:        factors,
		Recommendation: recommendation,
		CreatedAt:      time.Now(),
	}

	// Save assessment
	if err := s.repo.SaveAssessment(ctx, assessment); err != nil {
		return nil, err
	}

	return assessment, nil
}

// checkBlacklists checks if any order entity is blacklisted
func (s *Service) checkBlacklists(ctx context.Context, order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	checks := []struct {
		Type  string
		Value string
	}{
		{"email", order.CustomerEmail},
		{"phone", order.CustomerPhone},
		{"ip", order.IP},
		{"card_bin", order.CardBIN},
		{"device", order.DeviceID},
	}

	for _, check := range checks {
		if check.Value == "" {
			continue
		}

		blacklisted, entry, _ := s.repo.IsBlacklisted(ctx, order.TenantID, check.Type, check.Value)
		if blacklisted {
			factor := RiskFactor{
				Name:        fmt.Sprintf("blacklist_%s", check.Type),
				Description: fmt.Sprintf("%s is blacklisted: %s", check.Type, entry.Reason),
				Score:       50,
				Weight:      s.weights["blacklist"],
			}
			factors = append(factors, factor)
			score += factor.Score * factor.Weight
		}
	}

	return factors, score
}

// checkVelocity checks for unusual order velocity
func (s *Service) checkVelocity(ctx context.Context, order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	velocityChecks := []struct {
		Field       string
		Value       string
		Window      int
		Max         int
		Description string
	}{
		{"email", order.CustomerEmail, 1, 3, "Multiple orders from same email in 1 hour"},
		{"email", order.CustomerEmail, 24, 5, "Multiple orders from same email in 24 hours"},
		{"ip", order.IP, 1, 5, "Multiple orders from same IP in 1 hour"},
		{"card_bin", order.CardBIN, 1, 3, "Multiple orders with same card BIN in 1 hour"},
		{"phone", order.CustomerPhone, 24, 5, "Multiple orders with same phone in 24 hours"},
	}

	for _, vc := range velocityChecks {
		if vc.Value == "" {
			continue
		}

		count, _ := s.repo.GetOrderVelocity(ctx, &VelocityCheck{
			TenantID:    order.TenantID,
			Field:       vc.Field,
			Value:       vc.Value,
			WindowHours: vc.Window,
			MaxCount:    vc.Max,
		})

		if count >= vc.Max {
			factor := RiskFactor{
				Name:        fmt.Sprintf("velocity_%s_%dh", vc.Field, vc.Window),
				Description: fmt.Sprintf("%s (%d orders)", vc.Description, count),
				Score:       float64(20 + (count-vc.Max)*10),
				Weight:      s.weights["velocity"],
			}
			factors = append(factors, factor)
			score += factor.Score * factor.Weight
		}
	}

	return factors, score
}

// checkGeolocation checks for geographic anomalies
func (s *Service) checkGeolocation(ctx context.Context, order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	geoInfo, err := s.geoIP.Lookup(ctx, order.IP)
	if err != nil {
		return factors, score
	}

	// Check high risk country
	if s.highRiskCountries[strings.ToUpper(geoInfo.CountryCode)] {
		factor := RiskFactor{
			Name:        "high_risk_country",
			Description: fmt.Sprintf("Order from high-risk country: %s", geoInfo.Country),
			Score:       35,
			Weight:      s.weights["geo_mismatch"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	// Check country mismatch
	if order.ShippingCountry != "" && !strings.EqualFold(geoInfo.CountryCode, order.ShippingCountry) {
		factor := RiskFactor{
			Name:        "country_mismatch",
			Description: fmt.Sprintf("IP country (%s) differs from shipping country (%s)", geoInfo.Country, order.ShippingCountry),
			Score:       25,
			Weight:      s.weights["geo_mismatch"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	// Check proxy/VPN
	if geoInfo.IsProxy || geoInfo.IsVPN || geoInfo.IsTor {
		description := "Using "
		if geoInfo.IsProxy {
			description += "proxy"
		} else if geoInfo.IsVPN {
			description += "VPN"
		} else if geoInfo.IsTor {
			description += "Tor"
		}

		factor := RiskFactor{
			Name:        "proxy_vpn",
			Description: description,
			Score:       30,
			Weight:      s.weights["proxy_vpn"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	// Check datacenter/hosting
	if geoInfo.IsHosting {
		factor := RiskFactor{
			Name:        "datacenter_ip",
			Description: "Order from datacenter/hosting IP",
			Score:       25,
			Weight:      s.weights["proxy_vpn"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	return factors, score
}

// checkEmailPatterns checks for suspicious email patterns
func (s *Service) checkEmailPatterns(order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	email := strings.ToLower(order.CustomerEmail)

	// Check disposable email domains
	disposableDomains := []string{
		"tempmail", "guerrillamail", "10minutemail", "mailinator",
		"throwaway", "fakeinbox", "maildrop", "dispostable",
	}

	for _, domain := range disposableDomains {
		if strings.Contains(email, domain) {
			factor := RiskFactor{
				Name:        "disposable_email",
				Description: "Using disposable email provider",
				Score:       40,
				Weight:      s.weights["email_pattern"],
			}
			factors = append(factors, factor)
			score += factor.Score * factor.Weight
			break
		}
	}

	// Check for random-looking email
	localPart := strings.Split(email, "@")[0]
	if len(localPart) > 15 && hasRandomPattern(localPart) {
		factor := RiskFactor{
			Name:        "suspicious_email",
			Description: "Email address appears to be randomly generated",
			Score:       20,
			Weight:      s.weights["email_pattern"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	return factors, score
}

// checkAmountAnomalies checks for unusual order amounts
func (s *Service) checkAmountAnomalies(ctx context.Context, order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	// High value orders for new customers
	if order.IsNewCustomer && order.Amount > 10000 {
		factor := RiskFactor{
			Name:        "high_value_new_customer",
			Description: fmt.Sprintf("High value order (%.2f %s) from new customer", order.Amount, order.Currency),
			Score:       25,
			Weight:      s.weights["high_amount"],
		}
		factors = append(factors, factor)
		score += factor.Score * factor.Weight
	}

	// Check against customer's average
	if !order.IsNewCustomer && order.PreviousOrders > 0 {
		avgOrder := order.TotalSpent / float64(order.PreviousOrders)
		if order.Amount > avgOrder*3 {
			factor := RiskFactor{
				Name:        "unusual_amount",
				Description: fmt.Sprintf("Order amount (%.2f) is 3x higher than customer's average (%.2f)", order.Amount, avgOrder),
				Score:       20,
				Weight:      s.weights["high_amount"],
			}
			factors = append(factors, factor)
			score += factor.Score * factor.Weight
		}
	}

	return factors, score
}

// checkCustomRules checks custom fraud rules
func (s *Service) checkCustomRules(ctx context.Context, order *OrderData) ([]RiskFactor, float64) {
	var factors []RiskFactor
	var score float64

	rules, err := s.repo.ListRules(ctx, order.TenantID)
	if err != nil {
		return factors, score
	}

	for _, rule := range rules {
		if !rule.IsActive {
			continue
		}

		if s.matchesRule(order, rule) {
			factor := RiskFactor{
				Name:        fmt.Sprintf("custom_rule_%s", rule.ID),
				Description: rule.Name,
				Score:       rule.RiskScore,
				Weight:      s.weights["custom_rule"],
			}
			factors = append(factors, factor)
			score += factor.Score * factor.Weight

			// Increment match count
			s.repo.IncrementRuleMatch(ctx, rule.ID)
		}
	}

	return factors, score
}

// matchesRule checks if order matches a rule
func (s *Service) matchesRule(order *OrderData, rule *FraudRule) bool {
	orderMap := map[string]interface{}{
		"amount":           order.Amount,
		"customer_email":   order.CustomerEmail,
		"customer_phone":   order.CustomerPhone,
		"shipping_country": order.ShippingCountry,
		"shipping_city":    order.ShippingCity,
		"ip":               order.IP,
		"is_new_customer":  order.IsNewCustomer,
		"item_count":       order.ItemCount,
		"payment_method":   order.PaymentMethod,
		"promo_code":       order.PromoCode,
	}

	result := true
	for i, cond := range rule.Conditions {
		match := s.evaluateCondition(orderMap, cond)

		if i == 0 {
			result = match
		} else {
			prevCond := rule.Conditions[i-1]
			if prevCond.Logic == "or" {
				result = result || match
			} else {
				result = result && match
			}
		}
	}

	return result
}

// evaluateCondition evaluates a single condition
func (s *Service) evaluateCondition(data map[string]interface{}, cond RuleCondition) bool {
	value, ok := data[cond.Field]
	if !ok {
		return false
	}

	switch cond.Operator {
	case "eq":
		return fmt.Sprintf("%v", value) == fmt.Sprintf("%v", cond.Value)
	case "ne":
		return fmt.Sprintf("%v", value) != fmt.Sprintf("%v", cond.Value)
	case "gt":
		return toFloat(value) > toFloat(cond.Value)
	case "lt":
		return toFloat(value) < toFloat(cond.Value)
	case "gte":
		return toFloat(value) >= toFloat(cond.Value)
	case "lte":
		return toFloat(value) <= toFloat(cond.Value)
	case "contains":
		return strings.Contains(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(fmt.Sprintf("%v", cond.Value)))
	case "in":
		if arr, ok := cond.Value.([]interface{}); ok {
			for _, v := range arr {
				if fmt.Sprintf("%v", value) == fmt.Sprintf("%v", v) {
					return true
				}
			}
		}
		return false
	}

	return false
}

// determineRiskLevel determines risk level from score
func (s *Service) determineRiskLevel(score float64) RiskLevel {
	if score >= s.criticalThreshold {
		return RiskCritical
	}
	if score >= s.highThreshold {
		return RiskHigh
	}
	if score >= s.mediumThreshold {
		return RiskMedium
	}
	return RiskLow
}

// ReviewAssessment reviews a fraud assessment
func (s *Service) ReviewAssessment(ctx context.Context, orderID, reviewerID, decision, notes string) error {
	assessment, err := s.repo.GetAssessment(ctx, orderID)
	if err != nil {
		return err
	}

	now := time.Now()
	assessment.ReviewedBy = reviewerID
	assessment.ReviewedAt = &now
	assessment.ReviewNotes = notes
	assessment.Decision = decision

	return s.repo.UpdateAssessment(ctx, assessment)
}

// AddToBlacklist adds an entity to blacklist
func (s *Service) AddToBlacklist(ctx context.Context, tenantID, entityType, value, reason, createdBy string, expiresAt *time.Time) error {
	entry := &BlacklistEntry{
		ID:        generateID(),
		TenantID:  tenantID,
		Type:      entityType,
		Value:     value,
		Reason:    reason,
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
		ExpiresAt: expiresAt,
	}
	return s.repo.AddToBlacklist(ctx, entry)
}

// RemoveFromBlacklist removes entity from blacklist
func (s *Service) RemoveFromBlacklist(ctx context.Context, id string) error {
	return s.repo.RemoveFromBlacklist(ctx, id)
}

// GetBlacklist retrieves blacklist entries
func (s *Service) GetBlacklist(ctx context.Context, tenantID string) ([]*BlacklistEntry, error) {
	return s.repo.ListBlacklist(ctx, tenantID)
}

// CreateRule creates a custom fraud rule
func (s *Service) CreateRule(ctx context.Context, rule *FraudRule) error {
	rule.ID = generateID()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	return s.repo.SaveRule(ctx, rule)
}

// UpdateRule updates a fraud rule
func (s *Service) UpdateRule(ctx context.Context, rule *FraudRule) error {
	rule.UpdatedAt = time.Now()
	return s.repo.SaveRule(ctx, rule)
}

// DeleteRule deletes a fraud rule
func (s *Service) DeleteRule(ctx context.Context, id string) error {
	return s.repo.DeleteRule(ctx, id)
}

// GetRules retrieves fraud rules
func (s *Service) GetRules(ctx context.Context, tenantID string) ([]*FraudRule, error) {
	return s.repo.ListRules(ctx, tenantID)
}

// GetAssessments retrieves risk assessments
func (s *Service) GetAssessments(ctx context.Context, tenantID string, filter *AssessmentFilter) ([]*RiskAssessment, int, error) {
	return s.repo.ListAssessments(ctx, tenantID, filter)
}

// GetAssessment retrieves a single assessment
func (s *Service) GetAssessment(ctx context.Context, orderID string) (*RiskAssessment, error) {
	return s.repo.GetAssessment(ctx, orderID)
}

// GetFraudStats retrieves fraud statistics
func (s *Service) GetFraudStats(ctx context.Context, tenantID string, from, to time.Time) (*FraudStats, error) {
	// This would be implemented with proper queries
	return &FraudStats{
		TenantID: tenantID,
		Period:   fmt.Sprintf("%s - %s", from.Format("2006-01-02"), to.Format("2006-01-02")),
	}, nil
}

// FraudStats represents fraud statistics
type FraudStats struct {
	TenantID           string            `json:"tenant_id"`
	Period             string            `json:"period"`
	TotalAssessments   int               `json:"total_assessments"`
	HighRiskCount      int               `json:"high_risk_count"`
	BlockedOrders      int               `json:"blocked_orders"`
	FalsePositives     int               `json:"false_positives"`
	TruePositives      int               `json:"true_positives"`
	PreventedLoss      float64           `json:"prevented_loss"`
	ByRiskLevel        map[RiskLevel]int `json:"by_risk_level"`
	TopRiskFactors     []RiskFactorStat  `json:"top_risk_factors"`
	RulePerformance    []RuleStats       `json:"rule_performance"`
}

// RiskFactorStat for statistics
type RiskFactorStat struct {
	Name       string `json:"name"`
	Count      int    `json:"count"`
	AvgScore   float64 `json:"avg_score"`
}

// RuleStats for rule performance
type RuleStats struct {
	RuleID     string  `json:"rule_id"`
	RuleName   string  `json:"rule_name"`
	MatchCount int     `json:"match_count"`
	Precision  float64 `json:"precision"`
}

// Helper functions
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	}
	return 0
}

func hasRandomPattern(s string) bool {
	// Simple heuristic: high ratio of digits and low vowel count
	digits := 0
	vowels := 0
	for _, c := range strings.ToLower(s) {
		if c >= '0' && c <= '9' {
			digits++
		}
		if c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u' {
			vowels++
		}
	}
	return float64(digits)/float64(len(s)) > 0.3 || float64(vowels)/float64(len(s)) < 0.1
}

// IPAPIProvider implements GeoIPProvider using ip-api.com
type IPAPIProvider struct{}

// NewIPAPIProvider creates a new IP API provider
func NewIPAPIProvider() *IPAPIProvider {
	return &IPAPIProvider{}
}

// Lookup performs IP geolocation lookup
func (p *IPAPIProvider) Lookup(ctx context.Context, ip string) (*GeoIPInfo, error) {
	// Validate IP
	if net.ParseIP(ip) == nil {
		return nil, errors.New("invalid IP address")
	}

	// Skip private IPs
	if isPrivateIP(ip) {
		return &GeoIPInfo{IP: ip, Country: "Local", CountryCode: "XX"}, nil
	}

	// This would make an actual API call
	// For now, return a mock response
	return &GeoIPInfo{
		IP:          ip,
		Country:     "Ukraine",
		CountryCode: "UA",
		City:        "Kyiv",
	}, nil
}

func isPrivateIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	privateBlocks := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
	}

	for _, block := range privateBlocks {
		_, cidr, _ := net.ParseCIDR(block)
		if cidr.Contains(parsedIP) {
			return true
		}
	}
	return false
}

// PostgresRepository implements Repository
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// SaveAssessment saves a risk assessment
func (r *PostgresRepository) SaveAssessment(ctx context.Context, assessment *RiskAssessment) error {
	factors, _ := json.Marshal(assessment.Factors)

	query := `
		INSERT INTO fraud_assessments (id, tenant_id, order_id, risk_level, risk_score, factors, recommendation, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.ExecContext(ctx, query,
		assessment.ID, assessment.TenantID, assessment.OrderID,
		assessment.RiskLevel, assessment.RiskScore, factors,
		assessment.Recommendation, assessment.CreatedAt,
	)
	return err
}

// GetAssessment retrieves assessment by order ID
func (r *PostgresRepository) GetAssessment(ctx context.Context, orderID string) (*RiskAssessment, error) {
	query := `
		SELECT id, tenant_id, order_id, risk_level, risk_score, factors, recommendation,
			   reviewed_by, reviewed_at, review_notes, decision, created_at
		FROM fraud_assessments WHERE order_id = $1
	`

	var assessment RiskAssessment
	var factors []byte
	var reviewedBy, reviewNotes, decision sql.NullString
	var reviewedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, orderID).Scan(
		&assessment.ID, &assessment.TenantID, &assessment.OrderID,
		&assessment.RiskLevel, &assessment.RiskScore, &factors,
		&assessment.Recommendation, &reviewedBy, &reviewedAt,
		&reviewNotes, &decision, &assessment.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	json.Unmarshal(factors, &assessment.Factors)
	if reviewedBy.Valid {
		assessment.ReviewedBy = reviewedBy.String
	}
	if reviewedAt.Valid {
		assessment.ReviewedAt = &reviewedAt.Time
	}
	if reviewNotes.Valid {
		assessment.ReviewNotes = reviewNotes.String
	}
	if decision.Valid {
		assessment.Decision = decision.String
	}

	return &assessment, nil
}

// UpdateAssessment updates an assessment
func (r *PostgresRepository) UpdateAssessment(ctx context.Context, assessment *RiskAssessment) error {
	query := `
		UPDATE fraud_assessments SET
			reviewed_by = $2, reviewed_at = $3, review_notes = $4, decision = $5
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		assessment.ID, assessment.ReviewedBy, assessment.ReviewedAt,
		assessment.ReviewNotes, assessment.Decision,
	)
	return err
}

// ListAssessments lists assessments with filters
func (r *PostgresRepository) ListAssessments(ctx context.Context, tenantID string, filter *AssessmentFilter) ([]*RiskAssessment, int, error) {
	// Implementation would be similar to other list methods
	return nil, 0, nil
}

// AddToBlacklist adds to blacklist
func (r *PostgresRepository) AddToBlacklist(ctx context.Context, entry *BlacklistEntry) error {
	query := `
		INSERT INTO fraud_blacklist (id, tenant_id, type, value, reason, created_by, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.TenantID, entry.Type, entry.Value,
		entry.Reason, entry.CreatedBy, entry.CreatedAt, entry.ExpiresAt,
	)
	return err
}

// RemoveFromBlacklist removes from blacklist
func (r *PostgresRepository) RemoveFromBlacklist(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM fraud_blacklist WHERE id = $1", id)
	return err
}

// IsBlacklisted checks if entity is blacklisted
func (r *PostgresRepository) IsBlacklisted(ctx context.Context, tenantID, entityType, value string) (bool, *BlacklistEntry, error) {
	query := `
		SELECT id, tenant_id, type, value, reason, created_by, created_at, expires_at
		FROM fraud_blacklist
		WHERE tenant_id = $1 AND type = $2 AND value = $3
		AND (expires_at IS NULL OR expires_at > NOW())
	`

	var entry BlacklistEntry
	var expiresAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, tenantID, entityType, value).Scan(
		&entry.ID, &entry.TenantID, &entry.Type, &entry.Value,
		&entry.Reason, &entry.CreatedBy, &entry.CreatedAt, &expiresAt,
	)

	if err == sql.ErrNoRows {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}

	if expiresAt.Valid {
		entry.ExpiresAt = &expiresAt.Time
	}

	return true, &entry, nil
}

// ListBlacklist lists blacklist entries
func (r *PostgresRepository) ListBlacklist(ctx context.Context, tenantID string) ([]*BlacklistEntry, error) {
	query := `
		SELECT id, tenant_id, type, value, reason, created_by, created_at, expires_at
		FROM fraud_blacklist WHERE tenant_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*BlacklistEntry
	for rows.Next() {
		var entry BlacklistEntry
		var expiresAt sql.NullTime
		err := rows.Scan(&entry.ID, &entry.TenantID, &entry.Type, &entry.Value,
			&entry.Reason, &entry.CreatedBy, &entry.CreatedAt, &expiresAt)
		if err != nil {
			return nil, err
		}
		if expiresAt.Valid {
			entry.ExpiresAt = &expiresAt.Time
		}
		entries = append(entries, &entry)
	}

	return entries, nil
}

// SaveRule saves a fraud rule
func (r *PostgresRepository) SaveRule(ctx context.Context, rule *FraudRule) error {
	conditions, _ := json.Marshal(rule.Conditions)

	query := `
		INSERT INTO fraud_rules (id, tenant_id, name, description, conditions, action, risk_score, is_active, priority, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			name = $3, description = $4, conditions = $5, action = $6,
			risk_score = $7, is_active = $8, priority = $9, updated_at = $11
	`

	_, err := r.db.ExecContext(ctx, query,
		rule.ID, rule.TenantID, rule.Name, rule.Description,
		conditions, rule.Action, rule.RiskScore, rule.IsActive,
		rule.Priority, rule.CreatedAt, rule.UpdatedAt,
	)
	return err
}

// GetRule retrieves a rule by ID
func (r *PostgresRepository) GetRule(ctx context.Context, id string) (*FraudRule, error) {
	query := `
		SELECT id, tenant_id, name, description, conditions, action, risk_score, is_active, priority, match_count, created_at, updated_at
		FROM fraud_rules WHERE id = $1
	`

	var rule FraudRule
	var conditions []byte
	var description sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&rule.ID, &rule.TenantID, &rule.Name, &description,
		&conditions, &rule.Action, &rule.RiskScore, &rule.IsActive,
		&rule.Priority, &rule.MatchCount, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	json.Unmarshal(conditions, &rule.Conditions)
	if description.Valid {
		rule.Description = description.String
	}

	return &rule, nil
}

// DeleteRule deletes a rule
func (r *PostgresRepository) DeleteRule(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM fraud_rules WHERE id = $1", id)
	return err
}

// ListRules lists fraud rules
func (r *PostgresRepository) ListRules(ctx context.Context, tenantID string) ([]*FraudRule, error) {
	query := `
		SELECT id, tenant_id, name, description, conditions, action, risk_score, is_active, priority, match_count, created_at, updated_at
		FROM fraud_rules WHERE tenant_id = $1
		ORDER BY priority ASC
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []*FraudRule
	for rows.Next() {
		var rule FraudRule
		var conditions []byte
		var description sql.NullString

		err := rows.Scan(
			&rule.ID, &rule.TenantID, &rule.Name, &description,
			&conditions, &rule.Action, &rule.RiskScore, &rule.IsActive,
			&rule.Priority, &rule.MatchCount, &rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(conditions, &rule.Conditions)
		if description.Valid {
			rule.Description = description.String
		}
		rules = append(rules, &rule)
	}

	return rules, nil
}

// IncrementRuleMatch increments rule match count
func (r *PostgresRepository) IncrementRuleMatch(ctx context.Context, ruleID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE fraud_rules SET match_count = match_count + 1 WHERE id = $1", ruleID)
	return err
}

// GetOrderVelocity gets order velocity for a field/value
func (r *PostgresRepository) GetOrderVelocity(ctx context.Context, check *VelocityCheck) (int, error) {
	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM orders
		WHERE tenant_id = $1
		AND %s = $2
		AND created_at >= NOW() - INTERVAL '%d hours'
	`, check.Field, check.WindowHours)

	var count int
	err := r.db.QueryRowContext(ctx, query, check.TenantID, check.Value).Scan(&count)
	return count, err
}

// GetCustomerHistory retrieves customer history
func (r *PostgresRepository) GetCustomerHistory(ctx context.Context, tenantID, customerID string) (*CustomerHistory, error) {
	query := `
		SELECT customer_id, COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_spent,
			   MIN(created_at) as first_order, MAX(created_at) as last_order
		FROM orders
		WHERE tenant_id = $1 AND customer_id = $2
		GROUP BY customer_id
	`

	var history CustomerHistory
	err := r.db.QueryRowContext(ctx, query, tenantID, customerID).Scan(
		&history.CustomerID, &history.TotalOrders, &history.TotalSpent,
		&history.FirstOrderDate, &history.LastOrderDate,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &history, err
}
