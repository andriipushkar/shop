package inbox

import (
	"context"
	"testing"
	"time"
)

// MockConversationRepository for testing
type MockConversationRepository struct {
	conversations map[string]*Conversation
	messages      map[string][]*Message
}

func NewMockConversationRepository() *MockConversationRepository {
	return &MockConversationRepository{
		conversations: make(map[string]*Conversation),
		messages:      make(map[string][]*Message),
	}
}

func (m *MockConversationRepository) Create(ctx context.Context, conv *Conversation) error {
	m.conversations[conv.ID] = conv
	return nil
}

func (m *MockConversationRepository) GetByID(ctx context.Context, id string) (*Conversation, error) {
	if c, ok := m.conversations[id]; ok {
		return c, nil
	}
	return nil, ErrConversationNotFound
}

func (m *MockConversationRepository) GetByChannelID(ctx context.Context, tenantID string, channel Channel, channelID string) (*Conversation, error) {
	for _, c := range m.conversations {
		if c.TenantID == tenantID && c.Channel == channel && c.ChannelID == channelID {
			return c, nil
		}
	}
	return nil, ErrConversationNotFound
}

func (m *MockConversationRepository) Update(ctx context.Context, conv *Conversation) error {
	m.conversations[conv.ID] = conv
	return nil
}

func (m *MockConversationRepository) List(ctx context.Context, filter ConversationFilter) ([]*Conversation, int, error) {
	var result []*Conversation
	for _, c := range m.conversations {
		if filter.TenantID != "" && c.TenantID != filter.TenantID {
			continue
		}
		if filter.Status != "" && c.Status != ConversationStatus(filter.Status) {
			continue
		}
		if filter.Channel != "" && c.Channel != Channel(filter.Channel) {
			continue
		}
		if filter.AssignedTo != "" && c.AssignedTo != filter.AssignedTo {
			continue
		}
		result = append(result, c)
	}
	return result, len(result), nil
}

func (m *MockConversationRepository) AddMessage(ctx context.Context, msg *Message) error {
	m.messages[msg.ConversationID] = append(m.messages[msg.ConversationID], msg)
	return nil
}

func (m *MockConversationRepository) GetMessages(ctx context.Context, conversationID string, limit, offset int) ([]*Message, int, error) {
	msgs := m.messages[conversationID]
	return msgs, len(msgs), nil
}

func (m *MockConversationRepository) UpdateMessage(ctx context.Context, msg *Message) error {
	msgs := m.messages[msg.ConversationID]
	for i, message := range msgs {
		if message.ID == msg.ID {
			msgs[i] = msg
			break
		}
	}
	return nil
}

func (m *MockConversationRepository) GetQuickReplies(ctx context.Context, tenantID string) ([]*QuickReply, error) {
	return []*QuickReply{
		{ID: "qr-1", TenantID: tenantID, Title: "Thanks", Content: "Thank you for contacting us!"},
	}, nil
}

func (m *MockConversationRepository) SaveQuickReply(ctx context.Context, reply *QuickReply) error {
	return nil
}

func (m *MockConversationRepository) DeleteQuickReply(ctx context.Context, id string) error {
	return nil
}

// MockChannelProvider for testing
type MockChannelProvider struct {
	sentMessages []SendMessageInput
}

func NewMockChannelProvider() *MockChannelProvider {
	return &MockChannelProvider{
		sentMessages: make([]SendMessageInput, 0),
	}
}

func (m *MockChannelProvider) SendMessage(ctx context.Context, channelID string, input SendMessageInput) (string, error) {
	m.sentMessages = append(m.sentMessages, input)
	return "external-msg-" + input.Content[:10], nil
}

func (m *MockChannelProvider) GetChannelInfo(ctx context.Context, channelID string) (*ChannelInfo, error) {
	return &ChannelInfo{
		ID:   channelID,
		Name: "Test Channel",
	}, nil
}

// MockCustomerService for testing
type MockCustomerService struct {
	customers map[string]*CustomerContext
}

func NewMockCustomerService() *MockCustomerService {
	return &MockCustomerService{
		customers: make(map[string]*CustomerContext),
	}
}

func (m *MockCustomerService) GetCustomerContext(ctx context.Context, tenantID, customerID string) (*CustomerContext, error) {
	key := tenantID + ":" + customerID
	if c, ok := m.customers[key]; ok {
		return c, nil
	}
	return &CustomerContext{
		CustomerID:  customerID,
		TotalOrders: 0,
		TotalSpent:  0,
	}, nil
}

func TestInboxService_CreateConversation(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	input := CreateConversationInput{
		TenantID:      "tenant-1",
		Channel:       ChannelTelegram,
		ChannelID:     "tg-123",
		CustomerName:  "John Doe",
		CustomerEmail: "john@example.com",
		Subject:       "Order inquiry",
	}

	conv, err := service.CreateConversation(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if conv.Channel != ChannelTelegram {
		t.Errorf("expected channel %s, got %s", ChannelTelegram, conv.Channel)
	}

	if conv.Status != StatusOpen {
		t.Errorf("expected status %s, got %s", StatusOpen, conv.Status)
	}

	if conv.CustomerName != "John Doe" {
		t.Errorf("expected customer name John Doe, got %s", conv.CustomerName)
	}
}

func TestInboxService_AddMessage(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	// Create conversation first
	conv := &Conversation{
		ID:           "conv-1",
		TenantID:     "tenant-1",
		Channel:      ChannelTelegram,
		ChannelID:    "tg-123",
		Status:       StatusOpen,
		MessageCount: 0,
		UnreadCount:  0,
	}
	repo.conversations[conv.ID] = conv

	input := AddMessageInput{
		ConversationID: "conv-1",
		Direction:      DirectionIncoming,
		SenderID:       "customer-1",
		SenderName:     "John",
		SenderType:     SenderCustomer,
		ContentType:    ContentText,
		Content:        "Hello, I have a question about my order",
	}

	msg, err := service.AddMessage(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if msg.Direction != DirectionIncoming {
		t.Errorf("expected direction %s, got %s", DirectionIncoming, msg.Direction)
	}

	if msg.Content != input.Content {
		t.Errorf("expected content %s, got %s", input.Content, msg.Content)
	}

	// Check conversation was updated
	updated := repo.conversations["conv-1"]
	if updated.MessageCount != 1 {
		t.Errorf("expected message count 1, got %d", updated.MessageCount)
	}
	if updated.UnreadCount != 1 {
		t.Errorf("expected unread count 1, got %d", updated.UnreadCount)
	}
}

func TestInboxService_AssignConversation(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	conv := &Conversation{
		ID:       "conv-1",
		TenantID: "tenant-1",
		Status:   StatusOpen,
	}
	repo.conversations[conv.ID] = conv

	err := service.AssignConversation(context.Background(), "conv-1", "agent-1", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.conversations["conv-1"]
	if updated.AssignedTo != "agent-1" {
		t.Errorf("expected assigned_to agent-1, got %s", updated.AssignedTo)
	}
	if updated.AssignedAt == nil {
		t.Error("expected assigned_at to be set")
	}
}

func TestInboxService_UpdateStatus(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	conv := &Conversation{
		ID:       "conv-1",
		TenantID: "tenant-1",
		Status:   StatusOpen,
	}
	repo.conversations[conv.ID] = conv

	err := service.UpdateStatus(context.Background(), "conv-1", StatusResolved)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.conversations["conv-1"]
	if updated.Status != StatusResolved {
		t.Errorf("expected status %s, got %s", StatusResolved, updated.Status)
	}
	if updated.ResolvedAt == nil {
		t.Error("expected resolved_at to be set")
	}
}

func TestInboxService_SnoozeConversation(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	conv := &Conversation{
		ID:       "conv-1",
		TenantID: "tenant-1",
		Status:   StatusOpen,
	}
	repo.conversations[conv.ID] = conv

	snoozeUntil := time.Now().Add(2 * time.Hour)
	err := service.SnoozeConversation(context.Background(), "conv-1", snoozeUntil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.conversations["conv-1"]
	if updated.Status != StatusSnoozed {
		t.Errorf("expected status %s, got %s", StatusSnoozed, updated.Status)
	}
	if updated.SnoozedUntil == nil {
		t.Error("expected snoozed_until to be set")
	}
}

func TestInboxService_MarkAsRead(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	conv := &Conversation{
		ID:          "conv-1",
		TenantID:    "tenant-1",
		UnreadCount: 5,
	}
	repo.conversations[conv.ID] = conv

	// Add some messages
	for i := 0; i < 5; i++ {
		msg := &Message{
			ID:             "msg-" + string(rune(i)),
			ConversationID: "conv-1",
			Direction:      DirectionIncoming,
		}
		repo.messages["conv-1"] = append(repo.messages["conv-1"], msg)
	}

	err := service.MarkAsRead(context.Background(), "conv-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.conversations["conv-1"]
	if updated.UnreadCount != 0 {
		t.Errorf("expected unread count 0, got %d", updated.UnreadCount)
	}
}

func TestInboxService_ListConversations(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	// Create multiple conversations
	conv1 := &Conversation{
		ID:       "conv-1",
		TenantID: "tenant-1",
		Status:   StatusOpen,
		Channel:  ChannelTelegram,
	}
	conv2 := &Conversation{
		ID:       "conv-2",
		TenantID: "tenant-1",
		Status:   StatusResolved,
		Channel:  ChannelEmail,
	}
	conv3 := &Conversation{
		ID:       "conv-3",
		TenantID: "tenant-2",
		Status:   StatusOpen,
		Channel:  ChannelTelegram,
	}
	repo.conversations[conv1.ID] = conv1
	repo.conversations[conv2.ID] = conv2
	repo.conversations[conv3.ID] = conv3

	// Filter by tenant and status
	filter := ConversationFilter{
		TenantID: "tenant-1",
		Status:   "open",
	}

	result, total, err := service.ListConversations(context.Background(), filter)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if total != 1 {
		t.Errorf("expected 1 result, got %d", total)
	}

	if len(result) != 1 || result[0].ID != "conv-1" {
		t.Error("expected conv-1 in results")
	}
}

func TestInboxService_SendReply(t *testing.T) {
	repo := NewMockConversationRepository()
	channelProvider := NewMockChannelProvider()
	service := NewInboxService(repo)
	service.RegisterChannel(ChannelTelegram, channelProvider)

	conv := &Conversation{
		ID:           "conv-1",
		TenantID:     "tenant-1",
		Channel:      ChannelTelegram,
		ChannelID:    "tg-123",
		Status:       StatusOpen,
		MessageCount: 1,
	}
	repo.conversations[conv.ID] = conv

	input := SendReplyInput{
		ConversationID: "conv-1",
		AgentID:        "agent-1",
		AgentName:      "Support Agent",
		Content:        "Hello! How can I help you today?",
	}

	msg, err := service.SendReply(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if msg.Direction != DirectionOutgoing {
		t.Errorf("expected direction %s, got %s", DirectionOutgoing, msg.Direction)
	}

	if msg.SenderType != SenderAgent {
		t.Errorf("expected sender type %s, got %s", SenderAgent, msg.SenderType)
	}

	// Check message was sent via channel provider
	if len(channelProvider.sentMessages) != 1 {
		t.Error("expected message to be sent via channel provider")
	}

	// Check first response time was set
	updated := repo.conversations["conv-1"]
	if updated.FirstResponseAt == nil {
		t.Error("expected first_response_at to be set")
	}
}

func TestInboxService_QuickReplies(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	replies, err := service.GetQuickReplies(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(replies) != 1 {
		t.Errorf("expected 1 quick reply, got %d", len(replies))
	}

	if replies[0].Title != "Thanks" {
		t.Errorf("expected title Thanks, got %s", replies[0].Title)
	}
}

func TestChannelTypes(t *testing.T) {
	channels := []Channel{
		ChannelTelegram,
		ChannelViber,
		ChannelInstagram,
		ChannelFacebook,
		ChannelWhatsApp,
		ChannelEmail,
		ChannelWebChat,
		ChannelSMS,
	}

	for _, ch := range channels {
		if ch == "" {
			t.Error("channel should not be empty")
		}
	}
}

func TestConversationStatuses(t *testing.T) {
	statuses := []ConversationStatus{
		StatusOpen,
		StatusPending,
		StatusSnoozed,
		StatusResolved,
		StatusClosed,
	}

	for _, s := range statuses {
		if s == "" {
			t.Error("status should not be empty")
		}
	}
}

func TestPriorityLevels(t *testing.T) {
	tests := []struct {
		priority int
		name     string
	}{
		{1, "Urgent"},
		{2, "High"},
		{3, "Normal"},
		{4, "Low"},
	}

	for _, tt := range tests {
		if tt.priority < 1 || tt.priority > 4 {
			t.Errorf("priority %d should be between 1 and 4", tt.priority)
		}
	}
}

func TestInboxService_GetOrCreateConversation(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	// First call should create
	input := CreateConversationInput{
		TenantID:  "tenant-1",
		Channel:   ChannelTelegram,
		ChannelID: "tg-123",
	}

	conv1, err := service.GetOrCreateConversation(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Second call should return existing
	conv2, err := service.GetOrCreateConversation(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if conv1.ID != conv2.ID {
		t.Error("expected same conversation to be returned")
	}
}

func TestInboxService_AddTags(t *testing.T) {
	repo := NewMockConversationRepository()
	service := NewInboxService(repo)

	conv := &Conversation{
		ID:       "conv-1",
		TenantID: "tenant-1",
		Tags:     []string{"urgent"},
	}
	repo.conversations[conv.ID] = conv

	err := service.AddTags(context.Background(), "conv-1", []string{"vip", "priority"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated := repo.conversations["conv-1"]
	if len(updated.Tags) != 3 {
		t.Errorf("expected 3 tags, got %d", len(updated.Tags))
	}
}

func TestMessageContentTypes(t *testing.T) {
	types := []ContentType{
		ContentText,
		ContentImage,
		ContentFile,
		ContentAudio,
		ContentVideo,
		ContentLocation,
		ContentContact,
		ContentSticker,
	}

	for _, ct := range types {
		if ct == "" {
			t.Error("content type should not be empty")
		}
	}
}
