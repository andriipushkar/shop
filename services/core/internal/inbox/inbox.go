package inbox

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
	ErrConversationNotFound = errors.New("conversation not found")
	ErrMessageNotFound      = errors.New("message not found")
	ErrChannelNotSupported  = errors.New("channel not supported")
)

// Channel represents communication channel
type Channel string

const (
	ChannelTelegram  Channel = "telegram"
	ChannelViber     Channel = "viber"
	ChannelInstagram Channel = "instagram"
	ChannelFacebook  Channel = "facebook"
	ChannelWhatsApp  Channel = "whatsapp"
	ChannelEmail     Channel = "email"
	ChannelWebChat   Channel = "web_chat"
	ChannelSMS       Channel = "sms"
)

// ConversationStatus represents conversation status
type ConversationStatus string

const (
	StatusOpen       ConversationStatus = "open"
	StatusPending    ConversationStatus = "pending"
	StatusResolved   ConversationStatus = "resolved"
	StatusClosed     ConversationStatus = "closed"
	StatusSnoozed    ConversationStatus = "snoozed"
)

// MessageDirection represents message direction
type MessageDirection string

const (
	DirectionIncoming MessageDirection = "incoming"
	DirectionOutgoing MessageDirection = "outgoing"
)

// MessageStatus represents message delivery status
type MessageStatus string

const (
	MessageSent      MessageStatus = "sent"
	MessageDelivered MessageStatus = "delivered"
	MessageRead      MessageStatus = "read"
	MessageFailed    MessageStatus = "failed"
)

// Conversation represents a unified conversation
type Conversation struct {
	ID              string             `json:"id"`
	TenantID        string             `json:"tenant_id"`
	CustomerID      string             `json:"customer_id,omitempty"`
	Channel         Channel            `json:"channel"`
	ChannelID       string             `json:"channel_id"` // External ID (chat_id, thread_id, etc.)
	Status          ConversationStatus `json:"status"`
	Priority        int                `json:"priority"` // 1-5

	// Customer info
	CustomerName    string             `json:"customer_name"`
	CustomerEmail   string             `json:"customer_email,omitempty"`
	CustomerPhone   string             `json:"customer_phone,omitempty"`
	CustomerAvatar  string             `json:"customer_avatar,omitempty"`

	// Assignment
	AssignedTo      string             `json:"assigned_to,omitempty"`
	AssignedAt      *time.Time         `json:"assigned_at,omitempty"`
	TeamID          string             `json:"team_id,omitempty"`

	// Context
	Subject         string             `json:"subject,omitempty"`
	Tags            []string           `json:"tags,omitempty"`
	CustomFields    map[string]string  `json:"custom_fields,omitempty"`

	// Stats
	MessageCount    int                `json:"message_count"`
	UnreadCount     int                `json:"unread_count"`
	FirstResponseAt *time.Time         `json:"first_response_at,omitempty"`
	ResolvedAt      *time.Time         `json:"resolved_at,omitempty"`

	// Dates
	LastMessageAt   time.Time          `json:"last_message_at"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	SnoozedUntil    *time.Time         `json:"snoozed_until,omitempty"`
}

// Message represents a message in conversation
type Message struct {
	ID             string           `json:"id"`
	ConversationID string           `json:"conversation_id"`
	TenantID       string           `json:"tenant_id"`
	Direction      MessageDirection `json:"direction"`
	Channel        Channel          `json:"channel"`
	ExternalID     string           `json:"external_id,omitempty"` // Channel message ID

	// Sender
	SenderID       string           `json:"sender_id"`
	SenderName     string           `json:"sender_name"`
	SenderType     string           `json:"sender_type"` // customer, agent, bot

	// Content
	ContentType    string           `json:"content_type"` // text, image, file, location, etc.
	Content        string           `json:"content"`
	Attachments    []Attachment     `json:"attachments,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`

	// Status
	Status         MessageStatus    `json:"status"`
	ReadAt         *time.Time       `json:"read_at,omitempty"`
	DeliveredAt    *time.Time       `json:"delivered_at,omitempty"`

	// Reply
	ReplyToID      string           `json:"reply_to_id,omitempty"`

	// Dates
	CreatedAt      time.Time        `json:"created_at"`
}

// Attachment represents a message attachment
type Attachment struct {
	ID        string `json:"id"`
	Type      string `json:"type"` // image, file, video, audio, location
	URL       string `json:"url"`
	Name      string `json:"name,omitempty"`
	Size      int64  `json:"size,omitempty"`
	MimeType  string `json:"mime_type,omitempty"`
	Thumbnail string `json:"thumbnail,omitempty"`
}

// CustomerContext represents customer context for agent
type CustomerContext struct {
	CustomerID      string         `json:"customer_id"`
	Name            string         `json:"name"`
	Email           string         `json:"email,omitempty"`
	Phone           string         `json:"phone,omitempty"`
	Avatar          string         `json:"avatar,omitempty"`

	// Order info
	TotalOrders     int            `json:"total_orders"`
	TotalSpent      float64        `json:"total_spent"`
	LastOrderDate   *time.Time     `json:"last_order_date,omitempty"`
	PendingOrders   int            `json:"pending_orders"`

	// Current order
	CurrentOrderID  string         `json:"current_order_id,omitempty"`
	CurrentOrderStatus string      `json:"current_order_status,omitempty"`
	CurrentOrderTotal float64      `json:"current_order_total,omitempty"`

	// Loyalty
	LoyaltyTier     string         `json:"loyalty_tier,omitempty"`
	LoyaltyPoints   int            `json:"loyalty_points"`

	// Tags and notes
	Tags            []string       `json:"tags,omitempty"`
	Notes           string         `json:"notes,omitempty"`

	// Recent activity
	RecentOrders    []OrderSummary `json:"recent_orders,omitempty"`
	RecentReturns   []ReturnSummary `json:"recent_returns,omitempty"`
}

// OrderSummary for customer context
type OrderSummary struct {
	ID          string    `json:"id"`
	OrderNumber string    `json:"order_number"`
	Status      string    `json:"status"`
	Total       float64   `json:"total"`
	CreatedAt   time.Time `json:"created_at"`
}

// ReturnSummary for customer context
type ReturnSummary struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	Status    string    `json:"status"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}

// QuickReply represents a canned response
type QuickReply struct {
	ID       string   `json:"id"`
	TenantID string   `json:"tenant_id"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Tags     []string `json:"tags,omitempty"`
	Category string   `json:"category,omitempty"`
	UsageCount int    `json:"usage_count"`
}

// Repository interfaces
type ConversationRepository interface {
	Create(ctx context.Context, conv *Conversation) error
	GetByID(ctx context.Context, id string) (*Conversation, error)
	GetByChannelID(ctx context.Context, tenantID string, channel Channel, channelID string) (*Conversation, error)
	List(ctx context.Context, tenantID string, filter *ConversationFilter) ([]*Conversation, int, error)
	Update(ctx context.Context, conv *Conversation) error
	UpdateStatus(ctx context.Context, id string, status ConversationStatus) error
	Assign(ctx context.Context, id, agentID string) error
	IncrementUnread(ctx context.Context, id string) error
	MarkAsRead(ctx context.Context, id string) error
}

type MessageRepository interface {
	Create(ctx context.Context, msg *Message) error
	GetByID(ctx context.Context, id string) (*Message, error)
	GetByConversation(ctx context.Context, conversationID string, limit, offset int) ([]*Message, int, error)
	MarkAsRead(ctx context.Context, conversationID string) error
	UpdateStatus(ctx context.Context, id string, status MessageStatus) error
}

// ConversationFilter for listing conversations
type ConversationFilter struct {
	Status     ConversationStatus `json:"status,omitempty"`
	Channel    Channel            `json:"channel,omitempty"`
	AssignedTo string             `json:"assigned_to,omitempty"`
	Unassigned bool               `json:"unassigned,omitempty"`
	Search     string             `json:"search,omitempty"`
	Tags       []string           `json:"tags,omitempty"`
	Priority   int                `json:"priority,omitempty"`
	SortBy     string             `json:"sort_by"`
	Limit      int                `json:"limit"`
	Offset     int                `json:"offset"`
}

// ChannelProvider interface for channel adapters
type ChannelProvider interface {
	Channel() Channel
	SendMessage(ctx context.Context, channelID, content string, attachments []Attachment) (string, error)
	SendTyping(ctx context.Context, channelID string) error
	GetProfile(ctx context.Context, channelID string) (*ChannelProfile, error)
}

// ChannelProfile from external channel
type ChannelProfile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Username string `json:"username,omitempty"`
	Avatar   string `json:"avatar,omitempty"`
	Email    string `json:"email,omitempty"`
	Phone    string `json:"phone,omitempty"`
}

// IncomingMessage from channel webhook
type IncomingMessage struct {
	Channel    Channel
	ChannelID  string // Chat/thread ID
	SenderID   string
	SenderName string
	MessageID  string
	Content    string
	ContentType string
	Attachments []Attachment
	Metadata    map[string]interface{}
	Timestamp   time.Time
}

// CustomerService interface for getting customer context
type CustomerService interface {
	GetContext(ctx context.Context, tenantID, customerID string) (*CustomerContext, error)
	LinkCustomer(ctx context.Context, tenantID, conversationID, customerID string) error
}

// Service handles unified inbox operations
type Service struct {
	convRepo    ConversationRepository
	msgRepo     MessageRepository
	providers   map[Channel]ChannelProvider
	customerSvc CustomerService

	// Event handlers
	onMessage   func(*Message)
	onStatusChange func(*Conversation, ConversationStatus)

	// Real-time
	subscribers map[string][]chan *Message
	mu          sync.RWMutex
}

// NewService creates a new inbox service
func NewService(convRepo ConversationRepository, msgRepo MessageRepository) *Service {
	return &Service{
		convRepo:    convRepo,
		msgRepo:     msgRepo,
		providers:   make(map[Channel]ChannelProvider),
		subscribers: make(map[string][]chan *Message),
	}
}

// RegisterProvider registers a channel provider
func (s *Service) RegisterProvider(provider ChannelProvider) {
	s.providers[provider.Channel()] = provider
}

// SetCustomerService sets customer service
func (s *Service) SetCustomerService(svc CustomerService) {
	s.customerSvc = svc
}

// OnMessage sets message handler
func (s *Service) OnMessage(handler func(*Message)) {
	s.onMessage = handler
}

// OnStatusChange sets status change handler
func (s *Service) OnStatusChange(handler func(*Conversation, ConversationStatus)) {
	s.onStatusChange = handler
}

// HandleIncomingMessage processes incoming message from channel
func (s *Service) HandleIncomingMessage(ctx context.Context, tenantID string, incoming *IncomingMessage) (*Message, error) {
	// Find or create conversation
	conv, err := s.convRepo.GetByChannelID(ctx, tenantID, incoming.Channel, incoming.ChannelID)
	if err != nil {
		// Create new conversation
		conv = &Conversation{
			ID:           generateID(),
			TenantID:     tenantID,
			Channel:      incoming.Channel,
			ChannelID:    incoming.ChannelID,
			Status:       StatusOpen,
			Priority:     3,
			CustomerName: incoming.SenderName,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
			LastMessageAt: time.Now(),
		}

		// Try to get profile from channel
		if provider, ok := s.providers[incoming.Channel]; ok {
			if profile, err := provider.GetProfile(ctx, incoming.SenderID); err == nil {
				conv.CustomerName = profile.Name
				conv.CustomerEmail = profile.Email
				conv.CustomerPhone = profile.Phone
				conv.CustomerAvatar = profile.Avatar
			}
		}

		if err := s.convRepo.Create(ctx, conv); err != nil {
			return nil, err
		}
	}

	// Create message
	msg := &Message{
		ID:             generateID(),
		ConversationID: conv.ID,
		TenantID:       tenantID,
		Direction:      DirectionIncoming,
		Channel:        incoming.Channel,
		ExternalID:     incoming.MessageID,
		SenderID:       incoming.SenderID,
		SenderName:     incoming.SenderName,
		SenderType:     "customer",
		ContentType:    incoming.ContentType,
		Content:        incoming.Content,
		Attachments:    incoming.Attachments,
		Metadata:       incoming.Metadata,
		Status:         MessageDelivered,
		CreatedAt:      incoming.Timestamp,
	}

	if err := s.msgRepo.Create(ctx, msg); err != nil {
		return nil, err
	}

	// Update conversation
	conv.MessageCount++
	conv.UnreadCount++
	conv.LastMessageAt = time.Now()
	conv.UpdatedAt = time.Now()
	if conv.Status == StatusResolved || conv.Status == StatusClosed {
		conv.Status = StatusOpen
	}
	s.convRepo.Update(ctx, conv)

	// Notify subscribers
	s.notifySubscribers(conv.ID, msg)

	// Call handler
	if s.onMessage != nil {
		s.onMessage(msg)
	}

	return msg, nil
}

// SendMessage sends a message to customer
func (s *Service) SendMessage(ctx context.Context, conversationID, agentID, content string, attachments []Attachment) (*Message, error) {
	conv, err := s.convRepo.GetByID(ctx, conversationID)
	if err != nil {
		return nil, ErrConversationNotFound
	}

	provider, ok := s.providers[conv.Channel]
	if !ok {
		return nil, ErrChannelNotSupported
	}

	// Send via channel provider
	externalID, err := provider.SendMessage(ctx, conv.ChannelID, content, attachments)
	if err != nil {
		return nil, err
	}

	// Create message
	msg := &Message{
		ID:             generateID(),
		ConversationID: conv.ID,
		TenantID:       conv.TenantID,
		Direction:      DirectionOutgoing,
		Channel:        conv.Channel,
		ExternalID:     externalID,
		SenderID:       agentID,
		SenderType:     "agent",
		ContentType:    "text",
		Content:        content,
		Attachments:    attachments,
		Status:         MessageSent,
		CreatedAt:      time.Now(),
	}

	if err := s.msgRepo.Create(ctx, msg); err != nil {
		return nil, err
	}

	// Update conversation
	conv.MessageCount++
	conv.LastMessageAt = time.Now()
	conv.UpdatedAt = time.Now()
	if conv.FirstResponseAt == nil {
		now := time.Now()
		conv.FirstResponseAt = &now
	}
	s.convRepo.Update(ctx, conv)

	// Notify subscribers
	s.notifySubscribers(conv.ID, msg)

	return msg, nil
}

// GetConversation retrieves a conversation
func (s *Service) GetConversation(ctx context.Context, id string) (*Conversation, error) {
	return s.convRepo.GetByID(ctx, id)
}

// GetConversationWithContext retrieves conversation with customer context
func (s *Service) GetConversationWithContext(ctx context.Context, id string) (*Conversation, *CustomerContext, error) {
	conv, err := s.convRepo.GetByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	var customerCtx *CustomerContext
	if conv.CustomerID != "" && s.customerSvc != nil {
		customerCtx, _ = s.customerSvc.GetContext(ctx, conv.TenantID, conv.CustomerID)
	}

	return conv, customerCtx, nil
}

// ListConversations lists conversations
func (s *Service) ListConversations(ctx context.Context, tenantID string, filter *ConversationFilter) ([]*Conversation, int, error) {
	return s.convRepo.List(ctx, tenantID, filter)
}

// GetMessages retrieves messages for conversation
func (s *Service) GetMessages(ctx context.Context, conversationID string, limit, offset int) ([]*Message, int, error) {
	return s.msgRepo.GetByConversation(ctx, conversationID, limit, offset)
}

// AssignConversation assigns conversation to agent
func (s *Service) AssignConversation(ctx context.Context, id, agentID string) error {
	return s.convRepo.Assign(ctx, id, agentID)
}

// UpdateStatus updates conversation status
func (s *Service) UpdateStatus(ctx context.Context, id string, status ConversationStatus) error {
	conv, err := s.convRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	oldStatus := conv.Status

	if err := s.convRepo.UpdateStatus(ctx, id, status); err != nil {
		return err
	}

	if s.onStatusChange != nil {
		conv.Status = status
		s.onStatusChange(conv, oldStatus)
	}

	return nil
}

// MarkAsRead marks conversation as read
func (s *Service) MarkAsRead(ctx context.Context, id string) error {
	if err := s.convRepo.MarkAsRead(ctx, id); err != nil {
		return err
	}
	return s.msgRepo.MarkAsRead(ctx, id)
}

// AddTag adds tag to conversation
func (s *Service) AddTag(ctx context.Context, id, tag string) error {
	conv, err := s.convRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	for _, t := range conv.Tags {
		if t == tag {
			return nil
		}
	}

	conv.Tags = append(conv.Tags, tag)
	conv.UpdatedAt = time.Now()
	return s.convRepo.Update(ctx, conv)
}

// RemoveTag removes tag from conversation
func (s *Service) RemoveTag(ctx context.Context, id, tag string) error {
	conv, err := s.convRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	newTags := make([]string, 0, len(conv.Tags))
	for _, t := range conv.Tags {
		if t != tag {
			newTags = append(newTags, t)
		}
	}

	conv.Tags = newTags
	conv.UpdatedAt = time.Now()
	return s.convRepo.Update(ctx, conv)
}

// SnoozeConversation snoozes conversation until specified time
func (s *Service) SnoozeConversation(ctx context.Context, id string, until time.Time) error {
	conv, err := s.convRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	conv.Status = StatusSnoozed
	conv.SnoozedUntil = &until
	conv.UpdatedAt = time.Now()
	return s.convRepo.Update(ctx, conv)
}

// LinkCustomer links conversation to customer
func (s *Service) LinkCustomer(ctx context.Context, conversationID, customerID string) error {
	conv, err := s.convRepo.GetByID(ctx, conversationID)
	if err != nil {
		return err
	}

	conv.CustomerID = customerID
	conv.UpdatedAt = time.Now()

	if s.customerSvc != nil {
		s.customerSvc.LinkCustomer(ctx, conv.TenantID, conversationID, customerID)
	}

	return s.convRepo.Update(ctx, conv)
}

// Subscribe subscribes to conversation messages
func (s *Service) Subscribe(conversationID string) chan *Message {
	s.mu.Lock()
	defer s.mu.Unlock()

	ch := make(chan *Message, 100)
	s.subscribers[conversationID] = append(s.subscribers[conversationID], ch)
	return ch
}

// Unsubscribe unsubscribes from conversation
func (s *Service) Unsubscribe(conversationID string, ch chan *Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	subs := s.subscribers[conversationID]
	for i, sub := range subs {
		if sub == ch {
			s.subscribers[conversationID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			break
		}
	}
}

// notifySubscribers notifies all subscribers about new message
func (s *Service) notifySubscribers(conversationID string, msg *Message) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, ch := range s.subscribers[conversationID] {
		select {
		case ch <- msg:
		default:
			// Channel full, skip
		}
	}
}

// GetInboxStats returns inbox statistics
func (s *Service) GetInboxStats(ctx context.Context, tenantID string) (*InboxStats, error) {
	// This would be implemented with proper queries
	return &InboxStats{
		TenantID: tenantID,
	}, nil
}

// InboxStats represents inbox statistics
type InboxStats struct {
	TenantID          string            `json:"tenant_id"`
	TotalConversations int              `json:"total_conversations"`
	OpenConversations int               `json:"open_conversations"`
	PendingConversations int            `json:"pending_conversations"`
	UnassignedCount   int               `json:"unassigned_count"`
	ByChannel         map[Channel]int   `json:"by_channel"`
	ByAgent           map[string]int    `json:"by_agent"`
	AvgFirstResponse  float64           `json:"avg_first_response_minutes"`
	AvgResolutionTime float64           `json:"avg_resolution_time_minutes"`
}

// Helper function
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// PostgresConversationRepository implements ConversationRepository
type PostgresConversationRepository struct {
	db *sql.DB
}

// NewPostgresConversationRepository creates a new repository
func NewPostgresConversationRepository(db *sql.DB) *PostgresConversationRepository {
	return &PostgresConversationRepository{db: db}
}

// Create creates a conversation
func (r *PostgresConversationRepository) Create(ctx context.Context, conv *Conversation) error {
	tags, _ := json.Marshal(conv.Tags)
	customFields, _ := json.Marshal(conv.CustomFields)

	query := `
		INSERT INTO inbox_conversations (
			id, tenant_id, customer_id, channel, channel_id, status, priority,
			customer_name, customer_email, customer_phone, customer_avatar,
			assigned_to, team_id, subject, tags, custom_fields,
			message_count, unread_count, last_message_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`

	_, err := r.db.ExecContext(ctx, query,
		conv.ID, conv.TenantID, conv.CustomerID, conv.Channel, conv.ChannelID,
		conv.Status, conv.Priority, conv.CustomerName, conv.CustomerEmail,
		conv.CustomerPhone, conv.CustomerAvatar, conv.AssignedTo, conv.TeamID,
		conv.Subject, tags, customFields, conv.MessageCount, conv.UnreadCount,
		conv.LastMessageAt, conv.CreatedAt, conv.UpdatedAt,
	)
	return err
}

// GetByID retrieves conversation by ID
func (r *PostgresConversationRepository) GetByID(ctx context.Context, id string) (*Conversation, error) {
	query := `
		SELECT id, tenant_id, customer_id, channel, channel_id, status, priority,
			   customer_name, customer_email, customer_phone, customer_avatar,
			   assigned_to, assigned_at, team_id, subject, tags, custom_fields,
			   message_count, unread_count, first_response_at, resolved_at,
			   last_message_at, created_at, updated_at, snoozed_until
		FROM inbox_conversations WHERE id = $1
	`

	var conv Conversation
	var customerID, email, phone, avatar, assignedTo, teamID, subject sql.NullString
	var assignedAt, firstResponseAt, resolvedAt, snoozedUntil sql.NullTime
	var tags, customFields []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&conv.ID, &conv.TenantID, &customerID, &conv.Channel, &conv.ChannelID,
		&conv.Status, &conv.Priority, &conv.CustomerName, &email, &phone, &avatar,
		&assignedTo, &assignedAt, &teamID, &subject, &tags, &customFields,
		&conv.MessageCount, &conv.UnreadCount, &firstResponseAt, &resolvedAt,
		&conv.LastMessageAt, &conv.CreatedAt, &conv.UpdatedAt, &snoozedUntil,
	)

	if err == sql.ErrNoRows {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, err
	}

	if customerID.Valid {
		conv.CustomerID = customerID.String
	}
	if email.Valid {
		conv.CustomerEmail = email.String
	}
	if phone.Valid {
		conv.CustomerPhone = phone.String
	}
	if avatar.Valid {
		conv.CustomerAvatar = avatar.String
	}
	if assignedTo.Valid {
		conv.AssignedTo = assignedTo.String
	}
	if assignedAt.Valid {
		conv.AssignedAt = &assignedAt.Time
	}
	if teamID.Valid {
		conv.TeamID = teamID.String
	}
	if subject.Valid {
		conv.Subject = subject.String
	}
	if firstResponseAt.Valid {
		conv.FirstResponseAt = &firstResponseAt.Time
	}
	if resolvedAt.Valid {
		conv.ResolvedAt = &resolvedAt.Time
	}
	if snoozedUntil.Valid {
		conv.SnoozedUntil = &snoozedUntil.Time
	}

	json.Unmarshal(tags, &conv.Tags)
	json.Unmarshal(customFields, &conv.CustomFields)

	return &conv, nil
}

// GetByChannelID retrieves conversation by channel ID
func (r *PostgresConversationRepository) GetByChannelID(ctx context.Context, tenantID string, channel Channel, channelID string) (*Conversation, error) {
	query := `SELECT id FROM inbox_conversations WHERE tenant_id = $1 AND channel = $2 AND channel_id = $3`
	var id string
	err := r.db.QueryRowContext(ctx, query, tenantID, channel, channelID).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// List lists conversations
func (r *PostgresConversationRepository) List(ctx context.Context, tenantID string, filter *ConversationFilter) ([]*Conversation, int, error) {
	baseQuery := `FROM inbox_conversations WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIndex := 2

	if filter.Status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.Channel != "" {
		baseQuery += fmt.Sprintf(" AND channel = $%d", argIndex)
		args = append(args, filter.Channel)
		argIndex++
	}

	if filter.AssignedTo != "" {
		baseQuery += fmt.Sprintf(" AND assigned_to = $%d", argIndex)
		args = append(args, filter.AssignedTo)
		argIndex++
	}

	if filter.Unassigned {
		baseQuery += " AND (assigned_to IS NULL OR assigned_to = '')"
	}

	if filter.Search != "" {
		baseQuery += fmt.Sprintf(" AND (customer_name ILIKE $%d OR customer_email ILIKE $%d)", argIndex, argIndex)
		args = append(args, "%"+filter.Search+"%")
		argIndex++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get IDs
	orderBy := "last_message_at DESC"
	if filter.SortBy != "" {
		orderBy = filter.SortBy
	}

	listQuery := "SELECT id " + baseQuery + " ORDER BY " + orderBy
	if filter.Limit > 0 {
		listQuery += fmt.Sprintf(" LIMIT %d", filter.Limit)
	}
	if filter.Offset > 0 {
		listQuery += fmt.Sprintf(" OFFSET %d", filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var conversations []*Conversation
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, 0, err
		}
		conv, err := r.GetByID(ctx, id)
		if err != nil {
			return nil, 0, err
		}
		conversations = append(conversations, conv)
	}

	return conversations, total, nil
}

// Update updates a conversation
func (r *PostgresConversationRepository) Update(ctx context.Context, conv *Conversation) error {
	tags, _ := json.Marshal(conv.Tags)
	customFields, _ := json.Marshal(conv.CustomFields)

	query := `
		UPDATE inbox_conversations SET
			customer_id = $2, status = $3, priority = $4,
			customer_name = $5, customer_email = $6, customer_phone = $7, customer_avatar = $8,
			assigned_to = $9, assigned_at = $10, team_id = $11, subject = $12,
			tags = $13, custom_fields = $14, message_count = $15, unread_count = $16,
			first_response_at = $17, resolved_at = $18, last_message_at = $19,
			updated_at = $20, snoozed_until = $21
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		conv.ID, conv.CustomerID, conv.Status, conv.Priority,
		conv.CustomerName, conv.CustomerEmail, conv.CustomerPhone, conv.CustomerAvatar,
		conv.AssignedTo, conv.AssignedAt, conv.TeamID, conv.Subject,
		tags, customFields, conv.MessageCount, conv.UnreadCount,
		conv.FirstResponseAt, conv.ResolvedAt, conv.LastMessageAt,
		conv.UpdatedAt, conv.SnoozedUntil,
	)
	return err
}

// UpdateStatus updates conversation status
func (r *PostgresConversationRepository) UpdateStatus(ctx context.Context, id string, status ConversationStatus) error {
	query := `UPDATE inbox_conversations SET status = $2, updated_at = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status, time.Now())
	return err
}

// Assign assigns conversation to agent
func (r *PostgresConversationRepository) Assign(ctx context.Context, id, agentID string) error {
	query := `UPDATE inbox_conversations SET assigned_to = $2, assigned_at = $3, updated_at = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, agentID, time.Now())
	return err
}

// IncrementUnread increments unread count
func (r *PostgresConversationRepository) IncrementUnread(ctx context.Context, id string) error {
	query := `UPDATE inbox_conversations SET unread_count = unread_count + 1 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// MarkAsRead marks conversation as read
func (r *PostgresConversationRepository) MarkAsRead(ctx context.Context, id string) error {
	query := `UPDATE inbox_conversations SET unread_count = 0, updated_at = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, time.Now())
	return err
}

// PostgresMessageRepository implements MessageRepository
type PostgresMessageRepository struct {
	db *sql.DB
}

// NewPostgresMessageRepository creates a new repository
func NewPostgresMessageRepository(db *sql.DB) *PostgresMessageRepository {
	return &PostgresMessageRepository{db: db}
}

// Create creates a message
func (r *PostgresMessageRepository) Create(ctx context.Context, msg *Message) error {
	attachments, _ := json.Marshal(msg.Attachments)
	metadata, _ := json.Marshal(msg.Metadata)

	query := `
		INSERT INTO inbox_messages (
			id, conversation_id, tenant_id, direction, channel, external_id,
			sender_id, sender_name, sender_type, content_type, content,
			attachments, metadata, status, reply_to_id, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err := r.db.ExecContext(ctx, query,
		msg.ID, msg.ConversationID, msg.TenantID, msg.Direction, msg.Channel,
		msg.ExternalID, msg.SenderID, msg.SenderName, msg.SenderType,
		msg.ContentType, msg.Content, attachments, metadata, msg.Status,
		msg.ReplyToID, msg.CreatedAt,
	)
	return err
}

// GetByID retrieves message by ID
func (r *PostgresMessageRepository) GetByID(ctx context.Context, id string) (*Message, error) {
	query := `
		SELECT id, conversation_id, tenant_id, direction, channel, external_id,
			   sender_id, sender_name, sender_type, content_type, content,
			   attachments, metadata, status, read_at, delivered_at, reply_to_id, created_at
		FROM inbox_messages WHERE id = $1
	`

	var msg Message
	var externalID, replyToID sql.NullString
	var readAt, deliveredAt sql.NullTime
	var attachments, metadata []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&msg.ID, &msg.ConversationID, &msg.TenantID, &msg.Direction, &msg.Channel,
		&externalID, &msg.SenderID, &msg.SenderName, &msg.SenderType,
		&msg.ContentType, &msg.Content, &attachments, &metadata, &msg.Status,
		&readAt, &deliveredAt, &replyToID, &msg.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrMessageNotFound
	}
	if err != nil {
		return nil, err
	}

	if externalID.Valid {
		msg.ExternalID = externalID.String
	}
	if replyToID.Valid {
		msg.ReplyToID = replyToID.String
	}
	if readAt.Valid {
		msg.ReadAt = &readAt.Time
	}
	if deliveredAt.Valid {
		msg.DeliveredAt = &deliveredAt.Time
	}

	json.Unmarshal(attachments, &msg.Attachments)
	json.Unmarshal(metadata, &msg.Metadata)

	return &msg, nil
}

// GetByConversation retrieves messages for conversation
func (r *PostgresMessageRepository) GetByConversation(ctx context.Context, conversationID string, limit, offset int) ([]*Message, int, error) {
	// Count total
	var total int
	countQuery := `SELECT COUNT(*) FROM inbox_messages WHERE conversation_id = $1`
	if err := r.db.QueryRowContext(ctx, countQuery, conversationID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id FROM inbox_messages WHERE conversation_id = $1
		ORDER BY created_at ASC LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, conversationID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, 0, err
		}
		msg, err := r.GetByID(ctx, id)
		if err != nil {
			return nil, 0, err
		}
		messages = append(messages, msg)
	}

	return messages, total, nil
}

// MarkAsRead marks messages as read
func (r *PostgresMessageRepository) MarkAsRead(ctx context.Context, conversationID string) error {
	query := `UPDATE inbox_messages SET status = 'read', read_at = $2 WHERE conversation_id = $1 AND direction = 'incoming' AND status != 'read'`
	_, err := r.db.ExecContext(ctx, query, conversationID, time.Now())
	return err
}

// UpdateStatus updates message status
func (r *PostgresMessageRepository) UpdateStatus(ctx context.Context, id string, status MessageStatus) error {
	query := `UPDATE inbox_messages SET status = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status)
	return err
}
