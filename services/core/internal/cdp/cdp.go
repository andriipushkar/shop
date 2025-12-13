package cdp

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrCustomerNotFound = errors.New("customer not found")
	ErrSegmentNotFound  = errors.New("segment not found")
	ErrCampaignNotFound = errors.New("campaign not found")
)

// EventType represents types of customer events
type EventType string

const (
	EventPageView         EventType = "page_view"
	EventProductView      EventType = "product_view"
	EventCategoryView     EventType = "category_view"
	EventSearch           EventType = "search"
	EventAddToCart        EventType = "add_to_cart"
	EventRemoveFromCart   EventType = "remove_from_cart"
	EventCartAbandoned    EventType = "cart_abandoned"
	EventCheckoutStarted  EventType = "checkout_started"
	EventPurchase         EventType = "purchase"
	EventWishlistAdd      EventType = "wishlist_add"
	EventWishlistRemove   EventType = "wishlist_remove"
	EventReview           EventType = "review"
	EventCouponApplied    EventType = "coupon_applied"
	EventEmailOpened      EventType = "email_opened"
	EventEmailClicked     EventType = "email_clicked"
	EventPushClicked      EventType = "push_clicked"
	EventLogin            EventType = "login"
	EventSignup           EventType = "signup"
	EventReturn           EventType = "return"
)

// Event represents a customer event
type Event struct {
	ID         string                 `json:"id"`
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id,omitempty"`
	SessionID  string                 `json:"session_id"`
	Type       EventType              `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Timestamp  time.Time              `json:"timestamp"`
	Source     string                 `json:"source"` // web, mobile, api
	UserAgent  string                 `json:"user_agent,omitempty"`
	IP         string                 `json:"ip,omitempty"`
	URL        string                 `json:"url,omitempty"`
	Referrer   string                 `json:"referrer,omitempty"`
}

// CustomerProfile represents unified customer profile
type CustomerProfile struct {
	ID                string                 `json:"id"`
	TenantID          string                 `json:"tenant_id"`
	Email             string                 `json:"email,omitempty"`
	Phone             string                 `json:"phone,omitempty"`
	FirstName         string                 `json:"first_name,omitempty"`
	LastName          string                 `json:"last_name,omitempty"`

	// Metrics
	TotalOrders       int                    `json:"total_orders"`
	TotalSpent        float64                `json:"total_spent"`
	AverageOrderValue float64                `json:"average_order_value"`
	LastOrderDate     *time.Time             `json:"last_order_date,omitempty"`
	DaysSinceOrder    int                    `json:"days_since_order"`

	// RFM Scores
	RecencyScore      int                    `json:"recency_score"`    // 1-5
	FrequencyScore    int                    `json:"frequency_score"`  // 1-5
	MonetaryScore     int                    `json:"monetary_score"`   // 1-5
	RFMScore          int                    `json:"rfm_score"`        // Combined
	RFMSegment        string                 `json:"rfm_segment"`      // Champion, Loyal, At Risk, etc.

	// Behavior
	ProductsViewed    int                    `json:"products_viewed"`
	SearchCount       int                    `json:"search_count"`
	CartAbandons      int                    `json:"cart_abandons"`
	WishlistItems     int                    `json:"wishlist_items"`
	ReviewsWritten    int                    `json:"reviews_written"`
	ReturnsCount      int                    `json:"returns_count"`

	// Preferences
	FavoriteCategories []string              `json:"favorite_categories"`
	FavoriteBrands     []string              `json:"favorite_brands"`
	PreferredChannel   string                `json:"preferred_channel"` // email, sms, push

	// Lifecycle
	LifecycleStage    string                 `json:"lifecycle_stage"` // new, active, at_risk, churned, reactivated
	CustomerSince     time.Time              `json:"customer_since"`
	LastActivityDate  time.Time              `json:"last_activity_date"`

	// Segments
	Segments          []string               `json:"segments"`
	Tags              []string               `json:"tags"`

	// Custom attributes
	CustomAttributes  map[string]interface{} `json:"custom_attributes,omitempty"`

	UpdatedAt         time.Time              `json:"updated_at"`
}

// RFMSegments defines RFM customer segments
var RFMSegments = map[string]RFMCriteria{
	"champions":         {RecencyMin: 4, FrequencyMin: 4, MonetaryMin: 4},
	"loyal_customers":   {RecencyMin: 3, FrequencyMin: 3, MonetaryMin: 3},
	"potential_loyal":   {RecencyMin: 3, FrequencyMin: 1, MonetaryMin: 1},
	"new_customers":     {RecencyMin: 4, FrequencyMax: 1, MonetaryMax: 2},
	"promising":         {RecencyMin: 3, FrequencyMax: 1, MonetaryMax: 1},
	"need_attention":    {RecencyMin: 2, RecencyMax: 3, FrequencyMin: 2, MonetaryMin: 2},
	"about_to_sleep":    {RecencyMin: 2, RecencyMax: 2, FrequencyMax: 2, MonetaryMax: 2},
	"at_risk":           {RecencyMax: 2, FrequencyMin: 2, MonetaryMin: 2},
	"cant_lose":         {RecencyMax: 2, FrequencyMin: 4, MonetaryMin: 4},
	"hibernating":       {RecencyMax: 2, FrequencyMax: 2, MonetaryMax: 2},
	"lost":              {RecencyMax: 1, FrequencyMax: 1, MonetaryMax: 1},
}

// RFMCriteria defines criteria for RFM segment
type RFMCriteria struct {
	RecencyMin   int
	RecencyMax   int
	FrequencyMin int
	FrequencyMax int
	MonetaryMin  int
	MonetaryMax  int
}

// Segment represents a customer segment
type Segment struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenant_id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Type        string         `json:"type"` // dynamic, static, rfm
	Criteria    SegmentCriteria `json:"criteria,omitempty"`
	MemberCount int            `json:"member_count"`
	IsActive    bool           `json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// SegmentCriteria defines rules for dynamic segments
type SegmentCriteria struct {
	Conditions []SegmentCondition `json:"conditions"`
	Logic      string             `json:"logic"` // and, or
}

// SegmentCondition represents a single condition
type SegmentCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, lt, gte, lte, contains, in
	Value    interface{} `json:"value"`
}

// AutomationTrigger types
type TriggerType string

const (
	TriggerCartAbandoned    TriggerType = "cart_abandoned"
	TriggerWelcome          TriggerType = "welcome"
	TriggerPurchase         TriggerType = "purchase"
	TriggerBirthday         TriggerType = "birthday"
	TriggerInactive         TriggerType = "inactive"
	TriggerPriceDropWishlist TriggerType = "price_drop_wishlist"
	TriggerBackInStock      TriggerType = "back_in_stock"
	TriggerReviewRequest    TriggerType = "review_request"
	TriggerWinback          TriggerType = "winback"
	TriggerLoyaltyPoints    TriggerType = "loyalty_points"
	TriggerSegmentEnter     TriggerType = "segment_enter"
	TriggerSegmentExit      TriggerType = "segment_exit"
)

// Automation represents an automated marketing flow
type Automation struct {
	ID          string          `json:"id"`
	TenantID    string          `json:"tenant_id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	TriggerType TriggerType     `json:"trigger_type"`
	Trigger     AutomationTrigger `json:"trigger"`
	Actions     []AutomationAction `json:"actions"`
	IsActive    bool            `json:"is_active"`
	Stats       AutomationStats `json:"stats"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// AutomationTrigger defines when automation fires
type AutomationTrigger struct {
	Type      TriggerType            `json:"type"`
	Delay     time.Duration          `json:"delay,omitempty"` // Delay before action
	Conditions map[string]interface{} `json:"conditions,omitempty"`
	SegmentID string                 `json:"segment_id,omitempty"`
}

// ActionType for automation actions
type ActionType string

const (
	ActionSendEmail    ActionType = "send_email"
	ActionSendSMS      ActionType = "send_sms"
	ActionSendPush     ActionType = "send_push"
	ActionSendTelegram ActionType = "send_telegram"
	ActionAddTag       ActionType = "add_tag"
	ActionRemoveTag    ActionType = "remove_tag"
	ActionAddToSegment ActionType = "add_to_segment"
	ActionUpdateField  ActionType = "update_field"
	ActionWebhook      ActionType = "webhook"
	ActionDelay        ActionType = "delay"
	ActionCondition    ActionType = "condition"
)

// AutomationAction represents an action in automation flow
type AutomationAction struct {
	ID       string                 `json:"id"`
	Type     ActionType             `json:"type"`
	Config   map[string]interface{} `json:"config"`
	Position int                    `json:"position"`
}

// AutomationStats tracks automation performance
type AutomationStats struct {
	TotalTriggered int     `json:"total_triggered"`
	TotalSent      int     `json:"total_sent"`
	TotalOpened    int     `json:"total_opened"`
	TotalClicked   int     `json:"total_clicked"`
	TotalConverted int     `json:"total_converted"`
	Revenue        float64 `json:"revenue"`
}

// Campaign represents a marketing campaign
type Campaign struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenant_id"`
	Name         string          `json:"name"`
	Type         string          `json:"type"` // email, sms, push
	Subject      string          `json:"subject,omitempty"`
	Content      string          `json:"content"`
	SegmentIDs   []string        `json:"segment_ids"`
	Status       string          `json:"status"` // draft, scheduled, sending, sent, cancelled
	ScheduledAt  *time.Time      `json:"scheduled_at,omitempty"`
	SentAt       *time.Time      `json:"sent_at,omitempty"`
	Stats        CampaignStats   `json:"stats"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// CampaignStats tracks campaign performance
type CampaignStats struct {
	TotalRecipients int     `json:"total_recipients"`
	TotalSent       int     `json:"total_sent"`
	TotalDelivered  int     `json:"total_delivered"`
	TotalOpened     int     `json:"total_opened"`
	TotalClicked    int     `json:"total_clicked"`
	TotalBounced    int     `json:"total_bounced"`
	TotalUnsubscribed int   `json:"total_unsubscribed"`
	OpenRate        float64 `json:"open_rate"`
	ClickRate       float64 `json:"click_rate"`
	Revenue         float64 `json:"revenue"`
}

// Repository interfaces
type EventRepository interface {
	Save(ctx context.Context, event *Event) error
	GetByCustomer(ctx context.Context, customerID string, limit int) ([]*Event, error)
	GetByType(ctx context.Context, tenantID string, eventType EventType, from, to time.Time) ([]*Event, error)
	GetAbandonedCarts(ctx context.Context, tenantID string, olderThan time.Duration) ([]*Event, error)
}

type CustomerRepository interface {
	Save(ctx context.Context, profile *CustomerProfile) error
	GetByID(ctx context.Context, id string) (*CustomerProfile, error)
	GetByEmail(ctx context.Context, tenantID, email string) (*CustomerProfile, error)
	Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]*CustomerProfile, int, error)
	GetBySegment(ctx context.Context, segmentID string, limit, offset int) ([]*CustomerProfile, int, error)
	UpdateRFM(ctx context.Context, tenantID string) error
}

type SegmentRepository interface {
	Save(ctx context.Context, segment *Segment) error
	GetByID(ctx context.Context, id string) (*Segment, error)
	List(ctx context.Context, tenantID string) ([]*Segment, error)
	Delete(ctx context.Context, id string) error
	AddMember(ctx context.Context, segmentID, customerID string) error
	RemoveMember(ctx context.Context, segmentID, customerID string) error
	RefreshDynamicSegment(ctx context.Context, segmentID string) error
}

type AutomationRepository interface {
	Save(ctx context.Context, automation *Automation) error
	GetByID(ctx context.Context, id string) (*Automation, error)
	List(ctx context.Context, tenantID string) ([]*Automation, error)
	Delete(ctx context.Context, id string) error
	GetByTrigger(ctx context.Context, tenantID string, triggerType TriggerType) ([]*Automation, error)
}

// Service handles CDP operations
type Service struct {
	eventRepo      EventRepository
	customerRepo   CustomerRepository
	segmentRepo    SegmentRepository
	automationRepo AutomationRepository

	// Channels for async processing
	eventChan      chan *Event
	automationChan chan *AutomationExecution

	// Message senders
	emailSender    MessageSender
	smsSender      MessageSender
	pushSender     MessageSender
	telegramSender MessageSender

	// Running automations
	runningAutomations map[string]bool
	mu                 sync.RWMutex
}

// MessageSender interface for sending messages
type MessageSender interface {
	Send(ctx context.Context, recipient, subject, content string, data map[string]interface{}) error
}

// AutomationExecution represents a triggered automation
type AutomationExecution struct {
	AutomationID string
	CustomerID   string
	TriggerData  map[string]interface{}
}

// NewService creates a new CDP service
func NewService(
	eventRepo EventRepository,
	customerRepo CustomerRepository,
	segmentRepo SegmentRepository,
	automationRepo AutomationRepository,
) *Service {
	s := &Service{
		eventRepo:          eventRepo,
		customerRepo:       customerRepo,
		segmentRepo:        segmentRepo,
		automationRepo:     automationRepo,
		eventChan:          make(chan *Event, 1000),
		automationChan:     make(chan *AutomationExecution, 100),
		runningAutomations: make(map[string]bool),
	}

	// Start background workers
	go s.eventProcessor()
	go s.automationProcessor()

	return s
}

// SetEmailSender sets email sender
func (s *Service) SetEmailSender(sender MessageSender) {
	s.emailSender = sender
}

// SetSMSSender sets SMS sender
func (s *Service) SetSMSSender(sender MessageSender) {
	s.smsSender = sender
}

// SetPushSender sets push notification sender
func (s *Service) SetPushSender(sender MessageSender) {
	s.pushSender = sender
}

// SetTelegramSender sets Telegram sender
func (s *Service) SetTelegramSender(sender MessageSender) {
	s.telegramSender = sender
}

// TrackEvent tracks a customer event
func (s *Service) TrackEvent(ctx context.Context, event *Event) error {
	event.ID = generateID()
	event.Timestamp = time.Now()

	// Save event
	if err := s.eventRepo.Save(ctx, event); err != nil {
		return err
	}

	// Send to async processor
	select {
	case s.eventChan <- event:
	default:
		// Channel full, process synchronously
		s.processEvent(ctx, event)
	}

	return nil
}

// eventProcessor processes events asynchronously
func (s *Service) eventProcessor() {
	for event := range s.eventChan {
		ctx := context.Background()
		s.processEvent(ctx, event)
	}
}

// processEvent handles event processing
func (s *Service) processEvent(ctx context.Context, event *Event) {
	// Update customer profile
	if event.CustomerID != "" {
		s.updateCustomerFromEvent(ctx, event)
	}

	// Check for automation triggers
	s.checkAutomationTriggers(ctx, event)
}

// updateCustomerFromEvent updates customer profile based on event
func (s *Service) updateCustomerFromEvent(ctx context.Context, event *Event) {
	profile, err := s.customerRepo.GetByID(ctx, event.CustomerID)
	if err != nil {
		return
	}

	profile.LastActivityDate = event.Timestamp
	profile.UpdatedAt = time.Now()

	switch event.Type {
	case EventProductView:
		profile.ProductsViewed++
		if categoryID, ok := event.Properties["category_id"].(string); ok {
			profile.FavoriteCategories = addToSlice(profile.FavoriteCategories, categoryID, 10)
		}
		if brandID, ok := event.Properties["brand_id"].(string); ok {
			profile.FavoriteBrands = addToSlice(profile.FavoriteBrands, brandID, 10)
		}
	case EventSearch:
		profile.SearchCount++
	case EventAddToCart:
		// Nothing specific
	case EventCartAbandoned:
		profile.CartAbandons++
	case EventPurchase:
		profile.TotalOrders++
		if amount, ok := event.Properties["amount"].(float64); ok {
			profile.TotalSpent += amount
		}
		now := event.Timestamp
		profile.LastOrderDate = &now
		profile.DaysSinceOrder = 0
		profile.AverageOrderValue = profile.TotalSpent / float64(profile.TotalOrders)
	case EventWishlistAdd:
		profile.WishlistItems++
	case EventWishlistRemove:
		if profile.WishlistItems > 0 {
			profile.WishlistItems--
		}
	case EventReview:
		profile.ReviewsWritten++
	case EventReturn:
		profile.ReturnsCount++
	}

	// Update RFM segment
	s.updateRFMSegment(profile)

	// Update lifecycle stage
	s.updateLifecycleStage(profile)

	s.customerRepo.Save(ctx, profile)
}

// updateRFMSegment calculates RFM scores and segment
func (s *Service) updateRFMSegment(profile *CustomerProfile) {
	// Recency score (1-5 based on days since last order)
	if profile.LastOrderDate != nil {
		daysSince := int(time.Since(*profile.LastOrderDate).Hours() / 24)
		profile.DaysSinceOrder = daysSince
		switch {
		case daysSince <= 7:
			profile.RecencyScore = 5
		case daysSince <= 30:
			profile.RecencyScore = 4
		case daysSince <= 90:
			profile.RecencyScore = 3
		case daysSince <= 180:
			profile.RecencyScore = 2
		default:
			profile.RecencyScore = 1
		}
	} else {
		profile.RecencyScore = 1
	}

	// Frequency score (1-5 based on order count)
	switch {
	case profile.TotalOrders >= 20:
		profile.FrequencyScore = 5
	case profile.TotalOrders >= 10:
		profile.FrequencyScore = 4
	case profile.TotalOrders >= 5:
		profile.FrequencyScore = 3
	case profile.TotalOrders >= 2:
		profile.FrequencyScore = 2
	default:
		profile.FrequencyScore = 1
	}

	// Monetary score (1-5 based on total spent)
	switch {
	case profile.TotalSpent >= 50000:
		profile.MonetaryScore = 5
	case profile.TotalSpent >= 20000:
		profile.MonetaryScore = 4
	case profile.TotalSpent >= 5000:
		profile.MonetaryScore = 3
	case profile.TotalSpent >= 1000:
		profile.MonetaryScore = 2
	default:
		profile.MonetaryScore = 1
	}

	// Combined RFM score
	profile.RFMScore = profile.RecencyScore*100 + profile.FrequencyScore*10 + profile.MonetaryScore

	// Determine segment
	profile.RFMSegment = s.determineRFMSegment(profile)
}

// determineRFMSegment determines the RFM segment name
func (s *Service) determineRFMSegment(profile *CustomerProfile) string {
	for segment, criteria := range RFMSegments {
		if s.matchesRFMCriteria(profile, criteria) {
			return segment
		}
	}
	return "other"
}

// matchesRFMCriteria checks if profile matches RFM criteria
func (s *Service) matchesRFMCriteria(profile *CustomerProfile, criteria RFMCriteria) bool {
	if criteria.RecencyMin > 0 && profile.RecencyScore < criteria.RecencyMin {
		return false
	}
	if criteria.RecencyMax > 0 && profile.RecencyScore > criteria.RecencyMax {
		return false
	}
	if criteria.FrequencyMin > 0 && profile.FrequencyScore < criteria.FrequencyMin {
		return false
	}
	if criteria.FrequencyMax > 0 && profile.FrequencyScore > criteria.FrequencyMax {
		return false
	}
	if criteria.MonetaryMin > 0 && profile.MonetaryScore < criteria.MonetaryMin {
		return false
	}
	if criteria.MonetaryMax > 0 && profile.MonetaryScore > criteria.MonetaryMax {
		return false
	}
	return true
}

// updateLifecycleStage updates customer lifecycle stage
func (s *Service) updateLifecycleStage(profile *CustomerProfile) {
	daysSinceActivity := int(time.Since(profile.LastActivityDate).Hours() / 24)

	if profile.TotalOrders == 0 {
		profile.LifecycleStage = "new"
	} else if daysSinceActivity > 180 {
		profile.LifecycleStage = "churned"
	} else if daysSinceActivity > 90 {
		profile.LifecycleStage = "at_risk"
	} else if profile.DaysSinceOrder > 90 && profile.DaysSinceOrder <= 180 {
		profile.LifecycleStage = "reactivated"
	} else {
		profile.LifecycleStage = "active"
	}
}

// checkAutomationTriggers checks for automation triggers
func (s *Service) checkAutomationTriggers(ctx context.Context, event *Event) {
	var triggerType TriggerType

	switch event.Type {
	case EventCartAbandoned:
		triggerType = TriggerCartAbandoned
	case EventSignup:
		triggerType = TriggerWelcome
	case EventPurchase:
		triggerType = TriggerPurchase
	default:
		return
	}

	automations, err := s.automationRepo.GetByTrigger(ctx, event.TenantID, triggerType)
	if err != nil {
		return
	}

	for _, automation := range automations {
		if !automation.IsActive {
			continue
		}

		exec := &AutomationExecution{
			AutomationID: automation.ID,
			CustomerID:   event.CustomerID,
			TriggerData:  event.Properties,
		}

		select {
		case s.automationChan <- exec:
		default:
			// Channel full, skip
		}
	}
}

// automationProcessor processes automation executions
func (s *Service) automationProcessor() {
	for exec := range s.automationChan {
		ctx := context.Background()
		s.executeAutomation(ctx, exec)
	}
}

// executeAutomation executes an automation
func (s *Service) executeAutomation(ctx context.Context, exec *AutomationExecution) {
	automation, err := s.automationRepo.GetByID(ctx, exec.AutomationID)
	if err != nil || !automation.IsActive {
		return
	}

	customer, err := s.customerRepo.GetByID(ctx, exec.CustomerID)
	if err != nil {
		return
	}

	// Execute actions in order
	for _, action := range automation.Actions {
		if err := s.executeAction(ctx, action, customer, exec.TriggerData); err != nil {
			// Log error but continue
			continue
		}
	}

	// Update stats
	automation.Stats.TotalTriggered++
}

// executeAction executes a single automation action
func (s *Service) executeAction(ctx context.Context, action AutomationAction, customer *CustomerProfile, data map[string]interface{}) error {
	switch action.Type {
	case ActionSendEmail:
		if s.emailSender == nil {
			return nil
		}
		subject, _ := action.Config["subject"].(string)
		content, _ := action.Config["content"].(string)
		return s.emailSender.Send(ctx, customer.Email, subject, content, data)

	case ActionSendSMS:
		if s.smsSender == nil {
			return nil
		}
		content, _ := action.Config["content"].(string)
		return s.smsSender.Send(ctx, customer.Phone, "", content, data)

	case ActionSendPush:
		if s.pushSender == nil {
			return nil
		}
		title, _ := action.Config["title"].(string)
		content, _ := action.Config["content"].(string)
		return s.pushSender.Send(ctx, customer.ID, title, content, data)

	case ActionSendTelegram:
		if s.telegramSender == nil {
			return nil
		}
		content, _ := action.Config["content"].(string)
		telegramID, _ := customer.CustomAttributes["telegram_id"].(string)
		if telegramID == "" {
			return nil
		}
		return s.telegramSender.Send(ctx, telegramID, "", content, data)

	case ActionDelay:
		duration, _ := action.Config["duration"].(float64)
		time.Sleep(time.Duration(duration) * time.Millisecond)
		return nil

	case ActionAddTag:
		tag, _ := action.Config["tag"].(string)
		customer.Tags = addToSlice(customer.Tags, tag, 100)
		return s.customerRepo.Save(ctx, customer)

	case ActionRemoveTag:
		tag, _ := action.Config["tag"].(string)
		customer.Tags = removeFromSlice(customer.Tags, tag)
		return s.customerRepo.Save(ctx, customer)

	case ActionAddToSegment:
		segmentID, _ := action.Config["segment_id"].(string)
		return s.segmentRepo.AddMember(ctx, segmentID, customer.ID)
	}

	return nil
}

// CreateSegment creates a new segment
func (s *Service) CreateSegment(ctx context.Context, segment *Segment) error {
	segment.ID = generateID()
	segment.CreatedAt = time.Now()
	segment.UpdatedAt = time.Now()
	return s.segmentRepo.Save(ctx, segment)
}

// GetSegment retrieves a segment by ID
func (s *Service) GetSegment(ctx context.Context, id string) (*Segment, error) {
	return s.segmentRepo.GetByID(ctx, id)
}

// ListSegments lists all segments for a tenant
func (s *Service) ListSegments(ctx context.Context, tenantID string) ([]*Segment, error) {
	return s.segmentRepo.List(ctx, tenantID)
}

// CreateAutomation creates a new automation
func (s *Service) CreateAutomation(ctx context.Context, automation *Automation) error {
	automation.ID = generateID()
	automation.CreatedAt = time.Now()
	automation.UpdatedAt = time.Now()
	return s.automationRepo.Save(ctx, automation)
}

// GetAutomation retrieves an automation by ID
func (s *Service) GetAutomation(ctx context.Context, id string) (*Automation, error) {
	return s.automationRepo.GetByID(ctx, id)
}

// ListAutomations lists all automations for a tenant
func (s *Service) ListAutomations(ctx context.Context, tenantID string) ([]*Automation, error) {
	return s.automationRepo.List(ctx, tenantID)
}

// GetCustomer retrieves customer profile
func (s *Service) GetCustomer(ctx context.Context, id string) (*CustomerProfile, error) {
	return s.customerRepo.GetByID(ctx, id)
}

// SearchCustomers searches customers
func (s *Service) SearchCustomers(ctx context.Context, tenantID, query string, limit, offset int) ([]*CustomerProfile, int, error) {
	return s.customerRepo.Search(ctx, tenantID, query, limit, offset)
}

// GetCustomerEvents retrieves customer events
func (s *Service) GetCustomerEvents(ctx context.Context, customerID string, limit int) ([]*Event, error) {
	return s.eventRepo.GetByCustomer(ctx, customerID, limit)
}

// StartCartAbandonmentChecker starts checking for abandoned carts
func (s *Service) StartCartAbandonmentChecker(ctx context.Context, tenantID string, checkInterval, abandonAfter time.Duration) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkAbandonedCarts(ctx, tenantID, abandonAfter)
		}
	}
}

// checkAbandonedCarts finds and processes abandoned carts
func (s *Service) checkAbandonedCarts(ctx context.Context, tenantID string, abandonAfter time.Duration) {
	events, err := s.eventRepo.GetAbandonedCarts(ctx, tenantID, abandonAfter)
	if err != nil {
		return
	}

	for _, event := range events {
		// Create cart abandoned event
		abandonedEvent := &Event{
			TenantID:   event.TenantID,
			CustomerID: event.CustomerID,
			SessionID:  event.SessionID,
			Type:       EventCartAbandoned,
			Properties: event.Properties,
			Timestamp:  time.Now(),
		}

		s.TrackEvent(ctx, abandonedEvent)
	}
}

// GetDashboardStats returns CDP dashboard statistics
func (s *Service) GetDashboardStats(ctx context.Context, tenantID string) (*DashboardStats, error) {
	// This would be implemented with proper queries
	return &DashboardStats{
		TenantID:          tenantID,
		TotalCustomers:    0,
		ActiveCustomers:   0,
		ChurnedCustomers:  0,
		NewCustomersToday: 0,
	}, nil
}

// DashboardStats represents CDP dashboard statistics
type DashboardStats struct {
	TenantID          string                `json:"tenant_id"`
	TotalCustomers    int                   `json:"total_customers"`
	ActiveCustomers   int                   `json:"active_customers"`
	ChurnedCustomers  int                   `json:"churned_customers"`
	AtRiskCustomers   int                   `json:"at_risk_customers"`
	NewCustomersToday int                   `json:"new_customers_today"`
	RFMDistribution   map[string]int        `json:"rfm_distribution"`
	LifecycleStages   map[string]int        `json:"lifecycle_stages"`
	TopSegments       []SegmentSummary      `json:"top_segments"`
	RecentEvents      []*Event              `json:"recent_events"`
}

// SegmentSummary for dashboard
type SegmentSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	MemberCount int    `json:"member_count"`
}

// Helper functions
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func addToSlice(slice []string, item string, maxLen int) []string {
	// Check if already exists
	for _, v := range slice {
		if v == item {
			return slice
		}
	}

	// Add to front
	slice = append([]string{item}, slice...)

	// Trim if too long
	if len(slice) > maxLen {
		slice = slice[:maxLen]
	}

	return slice
}

func removeFromSlice(slice []string, item string) []string {
	result := make([]string, 0, len(slice))
	for _, v := range slice {
		if v != item {
			result = append(result, v)
		}
	}
	return result
}

// PostgresEventRepository implements EventRepository
type PostgresEventRepository struct {
	db *sql.DB
}

// NewPostgresEventRepository creates a new PostgreSQL event repository
func NewPostgresEventRepository(db *sql.DB) *PostgresEventRepository {
	return &PostgresEventRepository{db: db}
}

// Save saves an event
func (r *PostgresEventRepository) Save(ctx context.Context, event *Event) error {
	properties, _ := json.Marshal(event.Properties)

	query := `
		INSERT INTO cdp_events (id, tenant_id, customer_id, session_id, type, properties, timestamp, source, user_agent, ip, url, referrer)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.db.ExecContext(ctx, query,
		event.ID, event.TenantID, event.CustomerID, event.SessionID,
		event.Type, properties, event.Timestamp, event.Source,
		event.UserAgent, event.IP, event.URL, event.Referrer,
	)
	return err
}

// GetByCustomer retrieves events by customer ID
func (r *PostgresEventRepository) GetByCustomer(ctx context.Context, customerID string, limit int) ([]*Event, error) {
	query := `
		SELECT id, tenant_id, customer_id, session_id, type, properties, timestamp, source, user_agent, ip, url, referrer
		FROM cdp_events WHERE customer_id = $1 ORDER BY timestamp DESC LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, customerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		var event Event
		var properties []byte
		var userAgent, ip, url, referrer sql.NullString

		err := rows.Scan(
			&event.ID, &event.TenantID, &event.CustomerID, &event.SessionID,
			&event.Type, &properties, &event.Timestamp, &event.Source,
			&userAgent, &ip, &url, &referrer,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(properties, &event.Properties)
		if userAgent.Valid {
			event.UserAgent = userAgent.String
		}
		if ip.Valid {
			event.IP = ip.String
		}
		if url.Valid {
			event.URL = url.String
		}
		if referrer.Valid {
			event.Referrer = referrer.String
		}

		events = append(events, &event)
	}

	return events, nil
}

// GetByType retrieves events by type
func (r *PostgresEventRepository) GetByType(ctx context.Context, tenantID string, eventType EventType, from, to time.Time) ([]*Event, error) {
	query := `
		SELECT id, tenant_id, customer_id, session_id, type, properties, timestamp, source
		FROM cdp_events
		WHERE tenant_id = $1 AND type = $2 AND timestamp BETWEEN $3 AND $4
		ORDER BY timestamp DESC
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, eventType, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		var event Event
		var properties []byte

		err := rows.Scan(
			&event.ID, &event.TenantID, &event.CustomerID, &event.SessionID,
			&event.Type, &properties, &event.Timestamp, &event.Source,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(properties, &event.Properties)
		events = append(events, &event)
	}

	return events, nil
}

// GetAbandonedCarts finds cart events without corresponding purchase
func (r *PostgresEventRepository) GetAbandonedCarts(ctx context.Context, tenantID string, olderThan time.Duration) ([]*Event, error) {
	cutoff := time.Now().Add(-olderThan)

	query := `
		SELECT e.id, e.tenant_id, e.customer_id, e.session_id, e.type, e.properties, e.timestamp, e.source
		FROM cdp_events e
		WHERE e.tenant_id = $1
		AND e.type = 'add_to_cart'
		AND e.timestamp < $2
		AND NOT EXISTS (
			SELECT 1 FROM cdp_events p
			WHERE p.session_id = e.session_id
			AND p.type = 'purchase'
			AND p.timestamp > e.timestamp
		)
		AND NOT EXISTS (
			SELECT 1 FROM cdp_events a
			WHERE a.session_id = e.session_id
			AND a.type = 'cart_abandoned'
		)
		LIMIT 100
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		var event Event
		var properties []byte

		err := rows.Scan(
			&event.ID, &event.TenantID, &event.CustomerID, &event.SessionID,
			&event.Type, &properties, &event.Timestamp, &event.Source,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal(properties, &event.Properties)
		events = append(events, &event)
	}

	return events, nil
}
