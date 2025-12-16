# Inbox & Notifications

Система внутрішніх повідомлень та нотифікацій для комунікації між системою та користувачами.

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Notification System                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Events     │  │   Triggers   │  │   Templates  │          │
│  │   Source     │  │   Engine     │  │   Manager    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                 Notification Router                          │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  │ In-App  │  │  Email  │  │   SMS   │  │  Push   │        │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│  └─────────────────────────────────────────────────────────────┤
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Inbox      │  │   Delivery   │  │   Analytics  │          │
│  │   Storage    │  │   Service    │  │   Tracker    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

### Notification

```go
// internal/inbox/models.go
package inbox

import (
    "time"
)

type NotificationType string

const (
    NotificationInfo    NotificationType = "info"
    NotificationWarning NotificationType = "warning"
    NotificationError   NotificationType = "error"
    NotificationSuccess NotificationType = "success"
)

type NotificationPriority string

const (
    PriorityLow    NotificationPriority = "low"
    PriorityNormal NotificationPriority = "normal"
    PriorityHigh   NotificationPriority = "high"
    PriorityUrgent NotificationPriority = "urgent"
)

type Notification struct {
    ID          string               `json:"id" gorm:"primaryKey"`
    TenantID    string               `json:"tenant_id" gorm:"index"`
    UserID      string               `json:"user_id" gorm:"index"`

    // Content
    Title       string               `json:"title"`
    Body        string               `json:"body"`
    Type        NotificationType     `json:"type"`
    Priority    NotificationPriority `json:"priority"`
    Category    string               `json:"category"` // orders, payments, system, etc.

    // Link/Action
    ActionURL   string               `json:"action_url,omitempty"`
    ActionLabel string               `json:"action_label,omitempty"`

    // Metadata
    Data        map[string]any       `json:"data,omitempty" gorm:"serializer:json"`
    Icon        string               `json:"icon,omitempty"`
    ImageURL    string               `json:"image_url,omitempty"`

    // State
    IsRead      bool                 `json:"is_read" gorm:"default:false"`
    ReadAt      *time.Time           `json:"read_at,omitempty"`
    IsArchived  bool                 `json:"is_archived" gorm:"default:false"`
    ArchivedAt  *time.Time           `json:"archived_at,omitempty"`

    // Delivery
    Channels    []string             `json:"channels" gorm:"serializer:json"` // inbox, email, sms, push
    DeliveredAt map[string]time.Time `json:"delivered_at" gorm:"serializer:json"`

    // Source
    SourceType  string               `json:"source_type"` // system, user, webhook
    SourceID    string               `json:"source_id"`

    // Timestamps
    CreatedAt   time.Time            `json:"created_at"`
    ExpiresAt   *time.Time           `json:"expires_at,omitempty"`
}

// NotificationTemplate defines reusable notification templates
type NotificationTemplate struct {
    ID          string            `json:"id" gorm:"primaryKey"`
    TenantID    string            `json:"tenant_id" gorm:"index"`
    Name        string            `json:"name" gorm:"uniqueIndex:idx_template_name"`
    Slug        string            `json:"slug" gorm:"uniqueIndex:idx_template_name"`

    // Content templates
    TitleTemplate string          `json:"title_template"`
    BodyTemplate  string          `json:"body_template"`
    EmailSubject  string          `json:"email_subject,omitempty"`
    EmailBody     string          `json:"email_body,omitempty"`
    SMSBody       string          `json:"sms_body,omitempty"`

    // Defaults
    Type          NotificationType     `json:"type"`
    Priority      NotificationPriority `json:"priority"`
    Category      string               `json:"category"`
    DefaultChannels []string           `json:"default_channels" gorm:"serializer:json"`

    // Variables
    Variables     []string          `json:"variables" gorm:"serializer:json"`

    IsActive      bool              `json:"is_active"`
    CreatedAt     time.Time         `json:"created_at"`
    UpdatedAt     time.Time         `json:"updated_at"`
}

// NotificationPreference stores user notification preferences
type NotificationPreference struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    TenantID  string    `json:"tenant_id" gorm:"index"`
    UserID    string    `json:"user_id" gorm:"uniqueIndex:idx_user_category"`
    Category  string    `json:"category" gorm:"uniqueIndex:idx_user_category"` // * for all

    // Channel preferences
    InboxEnabled  bool   `json:"inbox_enabled" gorm:"default:true"`
    EmailEnabled  bool   `json:"email_enabled" gorm:"default:true"`
    SMSEnabled    bool   `json:"sms_enabled" gorm:"default:false"`
    PushEnabled   bool   `json:"push_enabled" gorm:"default:true"`

    // Digest settings
    DigestEnabled bool   `json:"digest_enabled" gorm:"default:false"`
    DigestFrequency string `json:"digest_frequency"` // daily, weekly

    // Quiet hours
    QuietHoursEnabled bool   `json:"quiet_hours_enabled"`
    QuietHoursStart   string `json:"quiet_hours_start"` // HH:MM
    QuietHoursEnd     string `json:"quiet_hours_end"`   // HH:MM
    Timezone          string `json:"timezone"`

    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// NotificationTrigger defines automatic notification triggers
type NotificationTrigger struct {
    ID           string          `json:"id" gorm:"primaryKey"`
    TenantID     string          `json:"tenant_id" gorm:"index"`
    Name         string          `json:"name"`
    Description  string          `json:"description"`

    // Event matching
    EventType    string          `json:"event_type"` // order.created, payment.failed, etc.
    Conditions   []TriggerCondition `json:"conditions" gorm:"serializer:json"`

    // Action
    TemplateID   string          `json:"template_id"`
    Recipients   []RecipientRule `json:"recipients" gorm:"serializer:json"`
    Delay        int             `json:"delay"` // seconds

    IsActive     bool            `json:"is_active"`
    CreatedAt    time.Time       `json:"created_at"`
    UpdatedAt    time.Time       `json:"updated_at"`
}

type TriggerCondition struct {
    Field    string `json:"field"`
    Operator string `json:"operator"` // eq, ne, gt, lt, contains, in
    Value    any    `json:"value"`
}

type RecipientRule struct {
    Type  string `json:"type"`  // user, role, email, dynamic
    Value string `json:"value"` // user_id, role_name, email, or field path
}
```

## Notification Service

```go
// internal/inbox/service.go
package inbox

import (
    "bytes"
    "context"
    "fmt"
    "text/template"
    "time"
)

type NotificationService struct {
    repo         NotificationRepository
    templates    TemplateRepository
    preferences  PreferenceRepository
    triggers     TriggerRepository
    delivery     *DeliveryService
    events       EventSubscriber
}

func NewNotificationService(
    repo NotificationRepository,
    templates TemplateRepository,
    preferences PreferenceRepository,
    triggers TriggerRepository,
    delivery *DeliveryService,
    events EventSubscriber,
) *NotificationService {
    service := &NotificationService{
        repo:        repo,
        templates:   templates,
        preferences: preferences,
        triggers:    triggers,
        delivery:    delivery,
        events:      events,
    }

    // Subscribe to events
    service.subscribeToEvents()

    return service
}

// Send sends a notification to a user
func (s *NotificationService) Send(ctx context.Context, req *SendNotificationRequest) (*Notification, error) {
    // Get user preferences
    prefs, _ := s.preferences.GetByUserAndCategory(ctx, req.TenantID, req.UserID, req.Category)
    if prefs == nil {
        prefs = s.getDefaultPreferences()
    }

    // Determine channels
    channels := s.determineChannels(req.Channels, prefs)
    if len(channels) == 0 {
        return nil, nil // User has disabled all channels for this category
    }

    // Create notification
    notification := &Notification{
        ID:         generateID("notif"),
        TenantID:   req.TenantID,
        UserID:     req.UserID,
        Title:      req.Title,
        Body:       req.Body,
        Type:       req.Type,
        Priority:   req.Priority,
        Category:   req.Category,
        ActionURL:  req.ActionURL,
        ActionLabel: req.ActionLabel,
        Data:       req.Data,
        Icon:       req.Icon,
        ImageURL:   req.ImageURL,
        Channels:   channels,
        SourceType: req.SourceType,
        SourceID:   req.SourceID,
        CreatedAt:  time.Now(),
        ExpiresAt:  req.ExpiresAt,
        DeliveredAt: make(map[string]time.Time),
    }

    // Save to inbox
    if contains(channels, "inbox") {
        if err := s.repo.Create(ctx, notification); err != nil {
            return nil, err
        }
        notification.DeliveredAt["inbox"] = time.Now()
    }

    // Deliver to other channels
    go s.delivery.Deliver(context.Background(), notification, channels, prefs)

    return notification, nil
}

// SendFromTemplate sends a notification using a template
func (s *NotificationService) SendFromTemplate(ctx context.Context, req *SendTemplateRequest) (*Notification, error) {
    // Get template
    tmpl, err := s.templates.GetBySlug(ctx, req.TenantID, req.TemplateSlug)
    if err != nil {
        return nil, fmt.Errorf("template not found: %s", req.TemplateSlug)
    }

    if !tmpl.IsActive {
        return nil, fmt.Errorf("template is not active: %s", req.TemplateSlug)
    }

    // Render template
    title, err := s.renderTemplate(tmpl.TitleTemplate, req.Variables)
    if err != nil {
        return nil, fmt.Errorf("failed to render title: %w", err)
    }

    body, err := s.renderTemplate(tmpl.BodyTemplate, req.Variables)
    if err != nil {
        return nil, fmt.Errorf("failed to render body: %w", err)
    }

    // Send notification
    return s.Send(ctx, &SendNotificationRequest{
        TenantID:    req.TenantID,
        UserID:      req.UserID,
        Title:       title,
        Body:        body,
        Type:        tmpl.Type,
        Priority:    tmpl.Priority,
        Category:    tmpl.Category,
        Channels:    tmpl.DefaultChannels,
        ActionURL:   req.ActionURL,
        ActionLabel: req.ActionLabel,
        Data:        req.Variables,
        SourceType:  "template",
        SourceID:    tmpl.ID,
    })
}

// SendBulk sends notifications to multiple users
func (s *NotificationService) SendBulk(ctx context.Context, req *BulkNotificationRequest) (int, error) {
    sent := 0

    for _, userID := range req.UserIDs {
        notifReq := &SendNotificationRequest{
            TenantID:    req.TenantID,
            UserID:      userID,
            Title:       req.Title,
            Body:        req.Body,
            Type:        req.Type,
            Priority:    req.Priority,
            Category:    req.Category,
            Channels:    req.Channels,
            ActionURL:   req.ActionURL,
            Data:        req.Data,
            SourceType:  "bulk",
            SourceID:    req.BulkID,
        }

        if _, err := s.Send(ctx, notifReq); err == nil {
            sent++
        }
    }

    return sent, nil
}

// MarkAsRead marks a notification as read
func (s *NotificationService) MarkAsRead(ctx context.Context, tenantID, userID, notificationID string) error {
    notification, err := s.repo.GetByID(ctx, notificationID)
    if err != nil {
        return err
    }

    if notification.TenantID != tenantID || notification.UserID != userID {
        return fmt.Errorf("notification not found")
    }

    now := time.Now()
    notification.IsRead = true
    notification.ReadAt = &now

    return s.repo.Update(ctx, notification)
}

// MarkAllAsRead marks all notifications as read for a user
func (s *NotificationService) MarkAllAsRead(ctx context.Context, tenantID, userID string) error {
    return s.repo.MarkAllAsRead(ctx, tenantID, userID)
}

// Archive archives a notification
func (s *NotificationService) Archive(ctx context.Context, tenantID, userID, notificationID string) error {
    notification, err := s.repo.GetByID(ctx, notificationID)
    if err != nil {
        return err
    }

    if notification.TenantID != tenantID || notification.UserID != userID {
        return fmt.Errorf("notification not found")
    }

    now := time.Now()
    notification.IsArchived = true
    notification.ArchivedAt = &now

    return s.repo.Update(ctx, notification)
}

// GetUnreadCount returns the number of unread notifications
func (s *NotificationService) GetUnreadCount(ctx context.Context, tenantID, userID string) (int64, error) {
    return s.repo.CountUnread(ctx, tenantID, userID)
}

// List lists notifications for a user
func (s *NotificationService) List(ctx context.Context, req *ListNotificationsRequest) (*NotificationList, error) {
    return s.repo.List(ctx, req)
}

// Subscribe to system events for automatic notifications
func (s *NotificationService) subscribeToEvents() {
    s.events.Subscribe("*", func(event Event) {
        ctx := context.Background()
        s.processEvent(ctx, event)
    })
}

func (s *NotificationService) processEvent(ctx context.Context, event Event) {
    // Find matching triggers
    triggers, err := s.triggers.FindByEventType(ctx, event.TenantID, event.Type)
    if err != nil {
        return
    }

    for _, trigger := range triggers {
        if !trigger.IsActive {
            continue
        }

        // Check conditions
        if !s.evaluateConditions(event.Data, trigger.Conditions) {
            continue
        }

        // Resolve recipients
        recipients := s.resolveRecipients(ctx, event, trigger.Recipients)

        // Schedule notification
        for _, recipient := range recipients {
            go func(userID string, delay int) {
                if delay > 0 {
                    time.Sleep(time.Duration(delay) * time.Second)
                }

                s.SendFromTemplate(ctx, &SendTemplateRequest{
                    TenantID:     event.TenantID,
                    UserID:       userID,
                    TemplateSlug: trigger.TemplateID,
                    Variables:    event.Data,
                })
            }(recipient, trigger.Delay)
        }
    }
}

func (s *NotificationService) evaluateConditions(data map[string]any, conditions []TriggerCondition) bool {
    for _, cond := range conditions {
        value, ok := data[cond.Field]
        if !ok {
            return false
        }

        if !s.evaluateCondition(value, cond.Operator, cond.Value) {
            return false
        }
    }
    return true
}

func (s *NotificationService) evaluateCondition(actual any, operator string, expected any) bool {
    switch operator {
    case "eq":
        return actual == expected
    case "ne":
        return actual != expected
    case "gt":
        return compareNumeric(actual, expected) > 0
    case "lt":
        return compareNumeric(actual, expected) < 0
    case "contains":
        str, ok := actual.(string)
        exp, ok2 := expected.(string)
        return ok && ok2 && strings.Contains(str, exp)
    case "in":
        arr, ok := expected.([]any)
        if !ok {
            return false
        }
        for _, v := range arr {
            if actual == v {
                return true
            }
        }
        return false
    }
    return false
}

func (s *NotificationService) resolveRecipients(ctx context.Context, event Event, rules []RecipientRule) []string {
    recipients := make([]string, 0)

    for _, rule := range rules {
        switch rule.Type {
        case "user":
            recipients = append(recipients, rule.Value)
        case "role":
            users, _ := s.getUsersByRole(ctx, event.TenantID, rule.Value)
            recipients = append(recipients, users...)
        case "dynamic":
            if userID, ok := event.Data[rule.Value].(string); ok {
                recipients = append(recipients, userID)
            }
        }
    }

    return unique(recipients)
}

func (s *NotificationService) renderTemplate(tmplStr string, data map[string]any) (string, error) {
    tmpl, err := template.New("notification").Parse(tmplStr)
    if err != nil {
        return "", err
    }

    var buf bytes.Buffer
    if err := tmpl.Execute(&buf, data); err != nil {
        return "", err
    }

    return buf.String(), nil
}

func (s *NotificationService) determineChannels(requested []string, prefs *NotificationPreference) []string {
    channels := make([]string, 0)

    checkChannel := func(channel string, enabled bool) {
        if enabled && (len(requested) == 0 || contains(requested, channel)) {
            channels = append(channels, channel)
        }
    }

    checkChannel("inbox", prefs.InboxEnabled)
    checkChannel("email", prefs.EmailEnabled)
    checkChannel("sms", prefs.SMSEnabled)
    checkChannel("push", prefs.PushEnabled)

    return channels
}

func (s *NotificationService) getDefaultPreferences() *NotificationPreference {
    return &NotificationPreference{
        InboxEnabled: true,
        EmailEnabled: true,
        PushEnabled:  true,
        SMSEnabled:   false,
    }
}

func (s *NotificationService) getUsersByRole(ctx context.Context, tenantID, role string) ([]string, error) {
    // Implementation
    return nil, nil
}

// Request types
type SendNotificationRequest struct {
    TenantID    string
    UserID      string
    Title       string
    Body        string
    Type        NotificationType
    Priority    NotificationPriority
    Category    string
    Channels    []string
    ActionURL   string
    ActionLabel string
    Data        map[string]any
    Icon        string
    ImageURL    string
    SourceType  string
    SourceID    string
    ExpiresAt   *time.Time
}

type SendTemplateRequest struct {
    TenantID     string
    UserID       string
    TemplateSlug string
    Variables    map[string]any
    ActionURL    string
    ActionLabel  string
}

type BulkNotificationRequest struct {
    TenantID    string
    UserIDs     []string
    BulkID      string
    Title       string
    Body        string
    Type        NotificationType
    Priority    NotificationPriority
    Category    string
    Channels    []string
    ActionURL   string
    Data        map[string]any
}

type ListNotificationsRequest struct {
    TenantID   string
    UserID     string
    Category   string
    IsRead     *bool
    IsArchived *bool
    Limit      int
    Offset     int
}

type NotificationList struct {
    Items       []*Notification `json:"items"`
    Total       int64           `json:"total"`
    UnreadCount int64           `json:"unread_count"`
}
```

## Delivery Service

```go
// internal/inbox/delivery.go
package inbox

import (
    "context"
    "log"
    "time"
)

type DeliveryService struct {
    email EmailSender
    sms   SMSSender
    push  PushSender
    repo  NotificationRepository
}

func NewDeliveryService(
    email EmailSender,
    sms SMSSender,
    push PushSender,
    repo NotificationRepository,
) *DeliveryService {
    return &DeliveryService{
        email: email,
        sms:   sms,
        push:  push,
        repo:  repo,
    }
}

// Deliver delivers a notification to specified channels
func (d *DeliveryService) Deliver(ctx context.Context, notification *Notification, channels []string, prefs *NotificationPreference) {
    // Check quiet hours
    if prefs.QuietHoursEnabled && d.isQuietHours(prefs) {
        // Queue for later
        d.queueForQuietHours(ctx, notification, channels, prefs)
        return
    }

    for _, channel := range channels {
        if channel == "inbox" {
            continue // Already saved
        }

        var err error
        switch channel {
        case "email":
            err = d.deliverEmail(ctx, notification)
        case "sms":
            err = d.deliverSMS(ctx, notification)
        case "push":
            err = d.deliverPush(ctx, notification)
        }

        if err != nil {
            log.Printf("Failed to deliver notification %s via %s: %v", notification.ID, channel, err)
        } else {
            notification.DeliveredAt[channel] = time.Now()
        }
    }

    // Update delivery status
    d.repo.Update(ctx, notification)
}

func (d *DeliveryService) deliverEmail(ctx context.Context, notification *Notification) error {
    // Get user email
    user, err := d.getUser(ctx, notification.TenantID, notification.UserID)
    if err != nil {
        return err
    }

    return d.email.Send(ctx, &EmailMessage{
        To:       user.Email,
        Subject:  notification.Title,
        Body:     notification.Body,
        HTMLBody: d.buildEmailHTML(notification),
        Metadata: map[string]string{
            "notification_id": notification.ID,
        },
    })
}

func (d *DeliveryService) deliverSMS(ctx context.Context, notification *Notification) error {
    user, err := d.getUser(ctx, notification.TenantID, notification.UserID)
    if err != nil {
        return err
    }

    if user.Phone == "" {
        return fmt.Errorf("user has no phone number")
    }

    // Truncate body for SMS
    body := notification.Body
    if len(body) > 160 {
        body = body[:157] + "..."
    }

    return d.sms.Send(ctx, &SMSMessage{
        To:   user.Phone,
        Body: body,
    })
}

func (d *DeliveryService) deliverPush(ctx context.Context, notification *Notification) error {
    // Get user push tokens
    tokens, err := d.getPushTokens(ctx, notification.TenantID, notification.UserID)
    if err != nil || len(tokens) == 0 {
        return fmt.Errorf("no push tokens found")
    }

    return d.push.Send(ctx, &PushMessage{
        Tokens:      tokens,
        Title:       notification.Title,
        Body:        notification.Body,
        Icon:        notification.Icon,
        ImageURL:    notification.ImageURL,
        ActionURL:   notification.ActionURL,
        Priority:    string(notification.Priority),
        Data: map[string]string{
            "notification_id": notification.ID,
            "category":        notification.Category,
        },
    })
}

func (d *DeliveryService) isQuietHours(prefs *NotificationPreference) bool {
    loc, err := time.LoadLocation(prefs.Timezone)
    if err != nil {
        return false
    }

    now := time.Now().In(loc)
    currentTime := now.Format("15:04")

    start := prefs.QuietHoursStart
    end := prefs.QuietHoursEnd

    if start <= end {
        return currentTime >= start && currentTime < end
    }
    // Overnight quiet hours (e.g., 22:00 - 08:00)
    return currentTime >= start || currentTime < end
}

func (d *DeliveryService) queueForQuietHours(ctx context.Context, notification *Notification, channels []string, prefs *NotificationPreference) {
    // Calculate when quiet hours end
    loc, _ := time.LoadLocation(prefs.Timezone)
    now := time.Now().In(loc)

    endHour, _ := time.Parse("15:04", prefs.QuietHoursEnd)
    deliverAt := time.Date(now.Year(), now.Month(), now.Day(), endHour.Hour(), endHour.Minute(), 0, 0, loc)

    if deliverAt.Before(now) {
        deliverAt = deliverAt.Add(24 * time.Hour)
    }

    // Schedule delivery
    go func() {
        time.Sleep(time.Until(deliverAt))
        d.Deliver(context.Background(), notification, channels, &NotificationPreference{
            QuietHoursEnabled: false, // Disable to prevent loop
            EmailEnabled:      prefs.EmailEnabled,
            SMSEnabled:        prefs.SMSEnabled,
            PushEnabled:       prefs.PushEnabled,
        })
    }()
}

func (d *DeliveryService) buildEmailHTML(notification *Notification) string {
    // Build HTML email template
    return fmt.Sprintf(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .button { display: inline-block; padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>%s</h1>
                </div>
                <div class="content">
                    <p>%s</p>
                    %s
                </div>
            </div>
        </body>
        </html>
    `, notification.Title, notification.Body, d.buildActionButton(notification))
}

func (d *DeliveryService) buildActionButton(notification *Notification) string {
    if notification.ActionURL == "" {
        return ""
    }
    label := notification.ActionLabel
    if label == "" {
        label = "View Details"
    }
    return fmt.Sprintf(`<p><a href="%s" class="button">%s</a></p>`, notification.ActionURL, label)
}

func (d *DeliveryService) getUser(ctx context.Context, tenantID, userID string) (*User, error) {
    // Implementation
    return nil, nil
}

func (d *DeliveryService) getPushTokens(ctx context.Context, tenantID, userID string) ([]string, error) {
    // Implementation
    return nil, nil
}

// Interface types
type EmailSender interface {
    Send(ctx context.Context, msg *EmailMessage) error
}

type SMSSender interface {
    Send(ctx context.Context, msg *SMSMessage) error
}

type PushSender interface {
    Send(ctx context.Context, msg *PushMessage) error
}

type EmailMessage struct {
    To       string
    Subject  string
    Body     string
    HTMLBody string
    Metadata map[string]string
}

type SMSMessage struct {
    To   string
    Body string
}

type PushMessage struct {
    Tokens    []string
    Title     string
    Body      string
    Icon      string
    ImageURL  string
    ActionURL string
    Priority  string
    Data      map[string]string
}
```

## Real-time Updates (WebSocket)

```go
// internal/inbox/websocket.go
package inbox

import (
    "context"
    "encoding/json"
    "log"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

type WebSocketHub struct {
    connections map[string]map[string]*websocket.Conn // tenantID -> userID -> conn
    mu          sync.RWMutex
    broadcast   chan *BroadcastMessage
}

type BroadcastMessage struct {
    TenantID string
    UserID   string
    Event    string
    Data     any
}

func NewWebSocketHub() *WebSocketHub {
    hub := &WebSocketHub{
        connections: make(map[string]map[string]*websocket.Conn),
        broadcast:   make(chan *BroadcastMessage, 100),
    }
    go hub.run()
    return hub
}

func (h *WebSocketHub) run() {
    for msg := range h.broadcast {
        h.sendToUser(msg.TenantID, msg.UserID, msg.Event, msg.Data)
    }
}

// Register registers a new WebSocket connection
func (h *WebSocketHub) Register(tenantID, userID string, conn *websocket.Conn) {
    h.mu.Lock()
    defer h.mu.Unlock()

    if h.connections[tenantID] == nil {
        h.connections[tenantID] = make(map[string]*websocket.Conn)
    }

    // Close existing connection if any
    if existing := h.connections[tenantID][userID]; existing != nil {
        existing.Close()
    }

    h.connections[tenantID][userID] = conn
}

// Unregister removes a WebSocket connection
func (h *WebSocketHub) Unregister(tenantID, userID string) {
    h.mu.Lock()
    defer h.mu.Unlock()

    if h.connections[tenantID] != nil {
        if conn := h.connections[tenantID][userID]; conn != nil {
            conn.Close()
            delete(h.connections[tenantID], userID)
        }
    }
}

// SendToUser sends a message to a specific user
func (h *WebSocketHub) SendToUser(tenantID, userID, event string, data any) {
    h.broadcast <- &BroadcastMessage{
        TenantID: tenantID,
        UserID:   userID,
        Event:    event,
        Data:     data,
    }
}

func (h *WebSocketHub) sendToUser(tenantID, userID, event string, data any) {
    h.mu.RLock()
    conn := h.connections[tenantID][userID]
    h.mu.RUnlock()

    if conn == nil {
        return
    }

    message := map[string]any{
        "event":     event,
        "data":      data,
        "timestamp": time.Now().Unix(),
    }

    msgBytes, _ := json.Marshal(message)

    if err := conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
        log.Printf("WebSocket write error: %v", err)
        h.Unregister(tenantID, userID)
    }
}

// NotifyNewNotification notifies user about new notification
func (h *WebSocketHub) NotifyNewNotification(notification *Notification) {
    h.SendToUser(notification.TenantID, notification.UserID, "notification.new", notification)
}

// NotifyUnreadCount notifies user about unread count change
func (h *WebSocketHub) NotifyUnreadCount(tenantID, userID string, count int64) {
    h.SendToUser(tenantID, userID, "notification.unread_count", map[string]int64{
        "count": count,
    })
}
```

## API Handlers

```go
// internal/inbox/handlers.go
package inbox

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
)

type InboxHandler struct {
    service *NotificationService
    hub     *WebSocketHub
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // Configure properly in production
    },
}

func NewInboxHandler(service *NotificationService, hub *WebSocketHub) *InboxHandler {
    return &InboxHandler{
        service: service,
        hub:     hub,
    }
}

func (h *InboxHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Notifications
    r.GET("/notifications", h.ListNotifications)
    r.GET("/notifications/count", h.GetUnreadCount)
    r.POST("/notifications/:id/read", h.MarkAsRead)
    r.POST("/notifications/read-all", h.MarkAllAsRead)
    r.POST("/notifications/:id/archive", h.Archive)
    r.DELETE("/notifications/:id", h.Delete)

    // Preferences
    r.GET("/notifications/preferences", h.GetPreferences)
    r.PUT("/notifications/preferences", h.UpdatePreferences)
    r.PUT("/notifications/preferences/:category", h.UpdateCategoryPreference)

    // Push tokens
    r.POST("/notifications/push-tokens", h.RegisterPushToken)
    r.DELETE("/notifications/push-tokens/:token", h.UnregisterPushToken)

    // WebSocket
    r.GET("/notifications/ws", h.WebSocket)

    // Admin routes
    admin := r.Group("/admin/notifications")
    {
        admin.GET("/templates", h.ListTemplates)
        admin.POST("/templates", h.CreateTemplate)
        admin.PUT("/templates/:id", h.UpdateTemplate)
        admin.DELETE("/templates/:id", h.DeleteTemplate)

        admin.GET("/triggers", h.ListTriggers)
        admin.POST("/triggers", h.CreateTrigger)
        admin.PUT("/triggers/:id", h.UpdateTrigger)
        admin.DELETE("/triggers/:id", h.DeleteTrigger)

        admin.POST("/send", h.SendNotification)
        admin.POST("/send-bulk", h.SendBulkNotification)
    }
}

// ListNotifications lists user's notifications
func (h *InboxHandler) ListNotifications(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    var req ListNotificationsRequest
    req.TenantID = tenantID
    req.UserID = userID
    req.Category = c.Query("category")
    req.Limit = 20
    req.Offset = 0

    if isRead := c.Query("is_read"); isRead != "" {
        val := isRead == "true"
        req.IsRead = &val
    }

    if isArchived := c.Query("is_archived"); isArchived != "" {
        val := isArchived == "true"
        req.IsArchived = &val
    }

    if limit := c.Query("limit"); limit != "" {
        fmt.Sscanf(limit, "%d", &req.Limit)
    }
    if offset := c.Query("offset"); offset != "" {
        fmt.Sscanf(offset, "%d", &req.Offset)
    }

    result, err := h.service.List(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, result)
}

// GetUnreadCount returns unread notification count
func (h *InboxHandler) GetUnreadCount(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    count, err := h.service.GetUnreadCount(c.Request.Context(), tenantID, userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"count": count})
}

// MarkAsRead marks a notification as read
func (h *InboxHandler) MarkAsRead(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")
    notificationID := c.Param("id")

    if err := h.service.MarkAsRead(c.Request.Context(), tenantID, userID, notificationID); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Notify via WebSocket
    count, _ := h.service.GetUnreadCount(c.Request.Context(), tenantID, userID)
    h.hub.NotifyUnreadCount(tenantID, userID, count)

    c.JSON(http.StatusOK, gin.H{"success": true})
}

// MarkAllAsRead marks all notifications as read
func (h *InboxHandler) MarkAllAsRead(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    if err := h.service.MarkAllAsRead(c.Request.Context(), tenantID, userID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    h.hub.NotifyUnreadCount(tenantID, userID, 0)

    c.JSON(http.StatusOK, gin.H{"success": true})
}

// WebSocket handles WebSocket connections
func (h *InboxHandler) WebSocket(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }

    h.hub.Register(tenantID, userID, conn)

    // Send initial unread count
    count, _ := h.service.GetUnreadCount(c.Request.Context(), tenantID, userID)
    h.hub.NotifyUnreadCount(tenantID, userID, count)

    // Handle incoming messages
    go func() {
        defer h.hub.Unregister(tenantID, userID)
        for {
            _, _, err := conn.ReadMessage()
            if err != nil {
                break
            }
        }
    }()
}

// GetPreferences returns user's notification preferences
func (h *InboxHandler) GetPreferences(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    prefs, err := h.service.preferences.GetByUser(c.Request.Context(), tenantID, userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, prefs)
}

// UpdatePreferences updates user's notification preferences
func (h *InboxHandler) UpdatePreferences(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.GetString("user_id")

    var prefs NotificationPreference
    if err := c.ShouldBindJSON(&prefs); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    prefs.TenantID = tenantID
    prefs.UserID = userID

    if err := h.service.preferences.Upsert(c.Request.Context(), &prefs); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, prefs)
}

// SendNotification sends a notification (admin)
func (h *InboxHandler) SendNotification(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    var req struct {
        UserID       string               `json:"user_id" binding:"required"`
        TemplateSlug string               `json:"template_slug"`
        Title        string               `json:"title"`
        Body         string               `json:"body"`
        Type         NotificationType     `json:"type"`
        Priority     NotificationPriority `json:"priority"`
        Category     string               `json:"category"`
        ActionURL    string               `json:"action_url"`
        Variables    map[string]any       `json:"variables"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var notification *Notification
    var err error

    if req.TemplateSlug != "" {
        notification, err = h.service.SendFromTemplate(c.Request.Context(), &SendTemplateRequest{
            TenantID:     tenantID,
            UserID:       req.UserID,
            TemplateSlug: req.TemplateSlug,
            Variables:    req.Variables,
            ActionURL:    req.ActionURL,
        })
    } else {
        notification, err = h.service.Send(c.Request.Context(), &SendNotificationRequest{
            TenantID:   tenantID,
            UserID:     req.UserID,
            Title:      req.Title,
            Body:       req.Body,
            Type:       req.Type,
            Priority:   req.Priority,
            Category:   req.Category,
            ActionURL:  req.ActionURL,
            SourceType: "admin",
        })
    }

    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Notify via WebSocket
    if notification != nil {
        h.hub.NotifyNewNotification(notification)
    }

    c.JSON(http.StatusCreated, notification)
}
```

## Frontend Components

### Notification Bell

```tsx
// components/notifications/NotificationBell.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationList } from './NotificationList';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <NotificationList
            notifications={notifications}
            onMarkAsRead={markAsRead}
            maxHeight="400px"
          />

          <div className="p-3 border-t text-center">
            <a href="/notifications" className="text-sm text-blue-600 hover:underline">
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Notification List

```tsx
// components/notifications/NotificationList.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: string;
  action_url?: string;
  action_label?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  maxHeight?: string;
}

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
};

const typeColors = {
  info: 'text-blue-500 bg-blue-50',
  warning: 'text-yellow-500 bg-yellow-50',
  error: 'text-red-500 bg-red-50',
  success: 'text-green-500 bg-green-50',
};

export function NotificationList({ notifications, onMarkAsRead, maxHeight }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No notifications</p>
      </div>
    );
  }

  return (
    <div
      className="divide-y overflow-y-auto"
      style={{ maxHeight: maxHeight || 'auto' }}
    >
      {notifications.map((notification) => {
        const Icon = typeIcons[notification.type] || Info;

        return (
          <div
            key={notification.id}
            className={`p-4 hover:bg-gray-50 cursor-pointer ${
              !notification.is_read ? 'bg-blue-50/50' : ''
            }`}
            onClick={() => {
              if (!notification.is_read) {
                onMarkAsRead(notification.id);
              }
              if (notification.action_url) {
                window.location.href = notification.action_url;
              }
            }}
          >
            <div className="flex gap-3">
              <div className={`p-2 rounded-full ${typeColors[notification.type]}`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notification.title}
                  </h4>
                  {!notification.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>

                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {notification.body}
                </p>

                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: uk,
                    })}
                  </span>

                  {notification.action_url && (
                    <a
                      href={notification.action_url}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {notification.action_label || 'View'}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### useNotifications Hook

```tsx
// hooks/useNotifications.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications?limit=10').then(r => r.json()),
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => fetch('/api/notifications/count').then(r => r.json()),
  });

  useEffect(() => {
    if (countData?.count !== undefined) {
      setUnreadCount(countData.count);
    }
  }, [countData]);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.event) {
        case 'notification.new':
          // Add new notification to the list
          queryClient.setQueryData(['notifications'], (old: any) => ({
            ...old,
            items: [message.data, ...(old?.items || [])],
          }));
          // Show browser notification
          showBrowserNotification(message.data);
          break;

        case 'notification.unread_count':
          setUnreadCount(message.data.count);
          break;
      }
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => {
        // Trigger re-render to reconnect
      }, 5000);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () =>
      fetch('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setUnreadCount(0);
    },
  });

  const markAsRead = useCallback((id: string) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  return {
    notifications: notificationsData?.items || [],
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading: !notificationsData,
  };
}

function showBrowserNotification(notification: Notification) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.body,
      icon: '/notification-icon.png',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/notification-icon.png',
        });
      }
    });
  }
}
```

### Notification Preferences

```tsx
// components/notifications/NotificationPreferences.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';

interface Preference {
  category: string;
  inbox_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
}

const categories = [
  { id: 'orders', label: 'Orders', description: 'New orders, status updates, cancellations' },
  { id: 'payments', label: 'Payments', description: 'Payment confirmations, refunds, failures' },
  { id: 'inventory', label: 'Inventory', description: 'Low stock alerts, restocking' },
  { id: 'customers', label: 'Customers', description: 'New reviews, messages' },
  { id: 'system', label: 'System', description: 'Updates, maintenance, security alerts' },
];

export function NotificationPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<Preference[]>({
    queryKey: ['notification-preferences'],
    queryFn: () => fetch('/api/notifications/preferences').then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (pref: Preference) =>
      fetch(`/api/notifications/preferences/${pref.category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pref),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const getPreference = (category: string): Preference => {
    return preferences?.find(p => p.category === category) || {
      category,
      inbox_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
    };
  };

  const toggleChannel = (category: string, channel: keyof Preference) => {
    const pref = getPreference(category);
    updateMutation.mutate({
      ...pref,
      [channel]: !pref[channel],
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <p className="text-sm text-gray-600 mt-1">
          Choose how you want to receive notifications
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-4">Category</th>
              <th className="p-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Bell className="w-5 h-5" />
                  <span className="text-xs">In-App</span>
                </div>
              </th>
              <th className="p-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Mail className="w-5 h-5" />
                  <span className="text-xs">Email</span>
                </div>
              </th>
              <th className="p-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-xs">SMS</span>
                </div>
              </th>
              <th className="p-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">Push</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((cat) => {
              const pref = getPreference(cat.id);
              return (
                <tr key={cat.id}>
                  <td className="p-4">
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-sm text-gray-500">{cat.description}</div>
                  </td>
                  <td className="p-4 text-center">
                    <Toggle
                      enabled={pref.inbox_enabled}
                      onChange={() => toggleChannel(cat.id, 'inbox_enabled')}
                    />
                  </td>
                  <td className="p-4 text-center">
                    <Toggle
                      enabled={pref.email_enabled}
                      onChange={() => toggleChannel(cat.id, 'email_enabled')}
                    />
                  </td>
                  <td className="p-4 text-center">
                    <Toggle
                      enabled={pref.sms_enabled}
                      onChange={() => toggleChannel(cat.id, 'sms_enabled')}
                    />
                  </td>
                  <td className="p-4 text-center">
                    <Toggle
                      enabled={pref.push_enabled}
                      onChange={() => toggleChannel(cat.id, 'push_enabled')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
```

## Predefined Templates

```yaml
# config/notification_templates.yaml
templates:
  - slug: order_created
    name: "New Order"
    title_template: "New order #{{.order_number}}"
    body_template: "You have a new order from {{.customer_name}} for {{.total}} {{.currency}}"
    type: info
    priority: high
    category: orders
    default_channels: [inbox, email, push]

  - slug: order_shipped
    name: "Order Shipped"
    title_template: "Order #{{.order_number}} shipped"
    body_template: "Order has been shipped via {{.carrier}}. Tracking: {{.tracking_number}}"
    type: info
    priority: normal
    category: orders
    default_channels: [inbox, email]

  - slug: payment_received
    name: "Payment Received"
    title_template: "Payment received for order #{{.order_number}}"
    body_template: "Payment of {{.amount}} {{.currency}} has been successfully processed"
    type: success
    priority: normal
    category: payments
    default_channels: [inbox, email]

  - slug: payment_failed
    name: "Payment Failed"
    title_template: "Payment failed for order #{{.order_number}}"
    body_template: "Payment of {{.amount}} {{.currency}} failed. Reason: {{.reason}}"
    type: error
    priority: high
    category: payments
    default_channels: [inbox, email, push]

  - slug: low_stock_alert
    name: "Low Stock Alert"
    title_template: "Low stock: {{.product_name}}"
    body_template: "Product {{.product_name}} (SKU: {{.sku}}) has only {{.quantity}} units left"
    type: warning
    priority: high
    category: inventory
    default_channels: [inbox, email]

  - slug: new_review
    name: "New Review"
    title_template: "New {{.rating}}-star review for {{.product_name}}"
    body_template: "{{.customer_name}} left a review: \"{{.comment}}\""
    type: info
    priority: low
    category: customers
    default_channels: [inbox]

  - slug: subscription_expiring
    name: "Subscription Expiring"
    title_template: "Your subscription expires in {{.days}} days"
    body_template: "Your {{.plan_name}} plan will expire on {{.expiry_date}}. Renew now to avoid service interruption."
    type: warning
    priority: high
    category: system
    default_channels: [inbox, email]
```

## Тестування

```go
// internal/inbox/service_test.go
package inbox

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestNotificationService_Send(t *testing.T) {
    repo := new(MockNotificationRepository)
    templates := new(MockTemplateRepository)
    preferences := new(MockPreferenceRepository)
    triggers := new(MockTriggerRepository)
    delivery := new(MockDeliveryService)
    events := new(MockEventSubscriber)

    service := &NotificationService{
        repo:        repo,
        templates:   templates,
        preferences: preferences,
        triggers:    triggers,
        delivery:    delivery,
    }

    pref := &NotificationPreference{
        InboxEnabled: true,
        EmailEnabled: true,
        PushEnabled:  false,
    }

    preferences.On("GetByUserAndCategory", mock.Anything, "tenant_1", "user_1", "orders").Return(pref, nil)
    repo.On("Create", mock.Anything, mock.AnythingOfType("*inbox.Notification")).Return(nil)

    req := &SendNotificationRequest{
        TenantID: "tenant_1",
        UserID:   "user_1",
        Title:    "Test notification",
        Body:     "This is a test",
        Type:     NotificationInfo,
        Priority: PriorityNormal,
        Category: "orders",
    }

    notification, err := service.Send(context.Background(), req)

    assert.NoError(t, err)
    assert.NotNil(t, notification)
    assert.Equal(t, "Test notification", notification.Title)
    assert.Contains(t, notification.Channels, "inbox")
    assert.Contains(t, notification.Channels, "email")
    assert.NotContains(t, notification.Channels, "push")
}

func TestNotificationService_EvaluateConditions(t *testing.T) {
    service := &NotificationService{}

    tests := []struct {
        name       string
        data       map[string]any
        conditions []TriggerCondition
        expected   bool
    }{
        {
            name: "eq operator - match",
            data: map[string]any{"status": "paid"},
            conditions: []TriggerCondition{
                {Field: "status", Operator: "eq", Value: "paid"},
            },
            expected: true,
        },
        {
            name: "eq operator - no match",
            data: map[string]any{"status": "pending"},
            conditions: []TriggerCondition{
                {Field: "status", Operator: "eq", Value: "paid"},
            },
            expected: false,
        },
        {
            name: "gt operator",
            data: map[string]any{"amount": 100.0},
            conditions: []TriggerCondition{
                {Field: "amount", Operator: "gt", Value: 50.0},
            },
            expected: true,
        },
        {
            name: "multiple conditions",
            data: map[string]any{"status": "paid", "amount": 100.0},
            conditions: []TriggerCondition{
                {Field: "status", Operator: "eq", Value: "paid"},
                {Field: "amount", Operator: "gt", Value: 50.0},
            },
            expected: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := service.evaluateConditions(tt.data, tt.conditions)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

## Див. також

- [Email Integration](../integrations/EMAIL.md)
- [WebSocket API](../api/WEBSOCKET.md)
- [Push Notifications](./PUSH_NOTIFICATIONS.md)
