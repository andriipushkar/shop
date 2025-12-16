# GDPR Compliance

Документація з відповідності вимогам GDPR (General Data Protection Regulation) та захисту персональних даних.

## Огляд

Shop Platform забезпечує відповідність GDPR через:
- Прозорість збору та обробки даних
- Права суб'єктів даних (доступ, виправлення, видалення)
- Захист даних (шифрування, псевдонімізація)
- Управління згодами
- Повідомлення про порушення безпеки

## Архітектура Privacy

```
                    ┌─────────────────────────────────────────┐
                    │          Privacy Dashboard              │
                    │  (Consent Management, Data Requests)    │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────────┐
                    │           Privacy Service               │
                    │                                         │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │   Consent   │  │  Data Subject   │  │
                    │  │   Manager   │  │    Requests     │  │
                    │  └─────────────┘  └─────────────────┘  │
                    │                                         │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │    Data     │  │   Audit Log     │  │
                    │  │  Retention  │  │                 │  │
                    │  └─────────────┘  └─────────────────┘  │
                    └──────────────────┬──────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
   ┌────┴────┐   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐   ┌────┴────┐
   │  Users  │   │ Orders  │    │Analytics│    │Marketing│   │  Logs   │
   │   DB    │   │   DB    │    │   DB    │    │   DB    │   │   DB    │
   └─────────┘   └─────────┘    └─────────┘    └─────────┘   └─────────┘
```

## Права суб'єктів даних

### Запит на доступ до даних (Right of Access)

```go
// internal/privacy/data_access.go
package privacy

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DataAccessRequest struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	Status      string    `json:"status"` // pending, processing, completed, failed
	RequestedAt time.Time `json:"requested_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	DataURL     string    `json:"data_url,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

type DataAccessService struct {
	db       *gorm.DB
	storage  StorageService
	notifier NotificationService
}

func (s *DataAccessService) CreateRequest(ctx context.Context, tenantID, userID, email string) (*DataAccessRequest, error) {
	request := &DataAccessRequest{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      userID,
		Email:       email,
		Status:      "pending",
		RequestedAt: time.Now(),
	}

	if err := s.db.Create(request).Error; err != nil {
		return nil, err
	}

	// Відправляємо підтвердження
	go s.notifier.SendDataRequestConfirmation(ctx, email, request.ID)

	// Запускаємо обробку асинхронно
	go s.processRequest(ctx, request)

	return request, nil
}

func (s *DataAccessService) processRequest(ctx context.Context, request *DataAccessRequest) {
	// Оновлюємо статус
	s.db.Model(request).Update("status", "processing")

	// Збираємо всі дані користувача
	userData, err := s.collectUserData(ctx, request.TenantID, request.UserID)
	if err != nil {
		s.db.Model(request).Update("status", "failed")
		return
	}

	// Конвертуємо в JSON
	data, _ := json.MarshalIndent(userData, "", "  ")

	// Зберігаємо файл
	filename := fmt.Sprintf("data-export-%s-%s.json", request.UserID, request.ID)
	url, err := s.storage.UploadPrivate(ctx, filename, data, "application/json")
	if err != nil {
		s.db.Model(request).Update("status", "failed")
		return
	}

	// Оновлюємо запис
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 днів
	completedAt := time.Now()
	s.db.Model(request).Updates(map[string]interface{}{
		"status":       "completed",
		"completed_at": completedAt,
		"data_url":     url,
		"expires_at":   expiresAt,
	})

	// Повідомляємо користувача
	s.notifier.SendDataExportReady(ctx, request.Email, url, expiresAt)
}

func (s *DataAccessService) collectUserData(ctx context.Context, tenantID, userID string) (*UserDataExport, error) {
	export := &UserDataExport{
		ExportDate: time.Now(),
		TenantID:   tenantID,
		UserID:     userID,
	}

	// Базова інформація користувача
	var user User
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, userID).First(&user).Error; err != nil {
		return nil, err
	}
	export.Profile = UserProfile{
		Email:           user.Email,
		FirstName:       user.FirstName,
		LastName:        user.LastName,
		Phone:           user.Phone,
		CreatedAt:       user.CreatedAt,
		LastLoginAt:     user.LastLoginAt,
		EmailVerifiedAt: user.EmailVerifiedAt,
	}

	// Адреси
	var addresses []Address
	s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Find(&addresses)
	export.Addresses = addresses

	// Замовлення
	var orders []Order
	s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Preload("Items").Find(&orders)
	export.Orders = s.sanitizeOrders(orders)

	// Wishlist
	var wishlists []Wishlist
	s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Preload("Items").Find(&wishlists)
	export.Wishlists = wishlists

	// Згоди
	var consents []Consent
	s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Find(&consents)
	export.Consents = consents

	// Активність (анонімізована)
	var activities []UserActivity
	s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Order("created_at DESC").
		Limit(1000).
		Find(&activities)
	export.Activities = s.sanitizeActivities(activities)

	return export, nil
}

type UserDataExport struct {
	ExportDate time.Time           `json:"export_date"`
	TenantID   string              `json:"tenant_id"`
	UserID     string              `json:"user_id"`
	Profile    UserProfile         `json:"profile"`
	Addresses  []Address           `json:"addresses"`
	Orders     []OrderExport       `json:"orders"`
	Wishlists  []Wishlist          `json:"wishlists"`
	Consents   []Consent           `json:"consents"`
	Activities []ActivityExport    `json:"activities"`
}
```

### Право на видалення (Right to Erasure)

```go
// internal/privacy/data_deletion.go
package privacy

import (
	"context"
	"time"
)

type DataDeletionRequest struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenant_id"`
	UserID      string     `json:"user_id"`
	Email       string     `json:"email"`
	Reason      string     `json:"reason"`
	Status      string     `json:"status"` // pending, confirmed, processing, completed
	RequestedAt time.Time  `json:"requested_at"`
	ConfirmedAt *time.Time `json:"confirmed_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	RetainedData []string  `json:"retained_data,omitempty"` // Дані, які не можуть бути видалені
}

type DataDeletionService struct {
	db       *gorm.DB
	notifier NotificationService
}

func (s *DataDeletionService) CreateRequest(ctx context.Context, tenantID, userID, email, reason string) (*DataDeletionRequest, error) {
	request := &DataDeletionRequest{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      userID,
		Email:       email,
		Reason:      reason,
		Status:      "pending",
		RequestedAt: time.Now(),
	}

	if err := s.db.Create(request).Error; err != nil {
		return nil, err
	}

	// Надсилаємо підтвердження з посиланням
	confirmURL := fmt.Sprintf("%s/privacy/confirm-deletion/%s", baseURL, request.ID)
	s.notifier.SendDeletionConfirmation(ctx, email, confirmURL)

	return request, nil
}

func (s *DataDeletionService) ConfirmDeletion(ctx context.Context, requestID string) error {
	var request DataDeletionRequest
	if err := s.db.First(&request, "id = ?", requestID).Error; err != nil {
		return err
	}

	if request.Status != "pending" {
		return fmt.Errorf("request already processed")
	}

	confirmedAt := time.Now()
	s.db.Model(&request).Updates(map[string]interface{}{
		"status":       "confirmed",
		"confirmed_at": confirmedAt,
	})

	// Запускаємо видалення асинхронно
	go s.processDeletion(ctx, &request)

	return nil
}

func (s *DataDeletionService) processDeletion(ctx context.Context, request *DataDeletionRequest) {
	s.db.Model(request).Update("status", "processing")

	retainedData := []string{}

	// 1. Перевіряємо наявність активних замовлень
	var activeOrders int64
	s.db.Model(&Order{}).
		Where("tenant_id = ? AND user_id = ? AND status IN ?",
			request.TenantID, request.UserID, []string{"pending", "processing", "shipped"}).
		Count(&activeOrders)

	if activeOrders > 0 {
		retainedData = append(retainedData, "Active orders will be retained until completion")
	}

	// 2. Перевіряємо юридичні вимоги (бухгалтерські документи)
	// Замовлення старші 3 років можуть бути видалені
	retentionDate := time.Now().AddDate(-3, 0, 0)
	var legalOrders int64
	s.db.Model(&Order{}).
		Where("tenant_id = ? AND user_id = ? AND created_at > ?",
			request.TenantID, request.UserID, retentionDate).
		Count(&legalOrders)

	if legalOrders > 0 {
		retainedData = append(retainedData,
			"Order history within 3 years retained for legal compliance")
	}

	tx := s.db.Begin()

	// 3. Видаляємо особисті дані користувача
	if err := tx.Model(&User{}).
		Where("tenant_id = ? AND id = ?", request.TenantID, request.UserID).
		Updates(map[string]interface{}{
			"email":      fmt.Sprintf("deleted_%s@anonymous.local", request.UserID),
			"first_name": "Deleted",
			"last_name":  "User",
			"phone":      nil,
			"password_hash": nil,
			"status":     "deleted",
			"deleted_at": time.Now(),
		}).Error; err != nil {
		tx.Rollback()
		s.db.Model(request).Update("status", "failed")
		return
	}

	// 4. Видаляємо адреси
	tx.Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Delete(&Address{})

	// 5. Видаляємо wishlist
	tx.Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Delete(&WishlistItem{})
	tx.Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Delete(&Wishlist{})

	// 6. Видаляємо згоди
	tx.Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Delete(&Consent{})

	// 7. Анонімізуємо замовлення (зберігаємо для звітності)
	tx.Model(&Order{}).
		Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Updates(map[string]interface{}{
			"email":            fmt.Sprintf("deleted_%s@anonymous.local", request.UserID),
			"phone":            nil,
			"billing_address":  nil,
			"shipping_address": s.anonymizeAddress(request.UserID),
		})

	// 8. Видаляємо активність та логи
	tx.Where("tenant_id = ? AND user_id = ?", request.TenantID, request.UserID).
		Delete(&UserActivity{})

	// 9. Видаляємо сесії
	tx.Where("user_id = ?", request.UserID).Delete(&Session{})

	if err := tx.Commit().Error; err != nil {
		s.db.Model(request).Update("status", "failed")
		return
	}

	// Оновлюємо статус
	completedAt := time.Now()
	s.db.Model(request).Updates(map[string]interface{}{
		"status":        "completed",
		"completed_at":  completedAt,
		"retained_data": retainedData,
	})

	// Повідомляємо користувача
	s.notifier.SendDeletionCompleted(ctx, request.Email, retainedData)
}
```

## Consent Management

```go
// internal/privacy/consent.go
package privacy

import (
	"context"
	"time"
)

type ConsentType string

const (
	ConsentMarketing     ConsentType = "marketing"
	ConsentAnalytics     ConsentType = "analytics"
	ConsentPersonalization ConsentType = "personalization"
	ConsentThirdParty    ConsentType = "third_party"
	ConsentNewsletter    ConsentType = "newsletter"
)

type Consent struct {
	ID        string      `gorm:"primaryKey" json:"id"`
	TenantID  string      `json:"tenant_id"`
	UserID    string      `json:"user_id"`
	Type      ConsentType `json:"type"`
	Granted   bool        `json:"granted"`
	Version   string      `json:"version"` // Версія policy
	IPAddress string      `json:"ip_address"`
	UserAgent string      `json:"user_agent"`
	GrantedAt *time.Time  `json:"granted_at,omitempty"`
	RevokedAt *time.Time  `json:"revoked_at,omitempty"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type ConsentService struct {
	db       *gorm.DB
	cache    CacheService
	notifier NotificationService
}

// GetConsents повертає всі згоди користувача
func (s *ConsentService) GetConsents(ctx context.Context, tenantID, userID string) ([]Consent, error) {
	var consents []Consent
	err := s.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Find(&consents).Error
	return consents, err
}

// UpdateConsent оновлює згоду користувача
func (s *ConsentService) UpdateConsent(ctx context.Context, tenantID, userID string, consentType ConsentType, granted bool, metadata ConsentMetadata) error {
	var consent Consent
	err := s.db.Where("tenant_id = ? AND user_id = ? AND type = ?", tenantID, userID, consentType).
		First(&consent).Error

	now := time.Now()

	if err == gorm.ErrRecordNotFound {
		// Створюємо нову згоду
		consent = Consent{
			ID:        uuid.New().String(),
			TenantID:  tenantID,
			UserID:    userID,
			Type:      consentType,
			Granted:   granted,
			Version:   metadata.PolicyVersion,
			IPAddress: metadata.IPAddress,
			UserAgent: metadata.UserAgent,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if granted {
			consent.GrantedAt = &now
		}
		return s.db.Create(&consent).Error
	}

	// Оновлюємо існуючу
	updates := map[string]interface{}{
		"granted":    granted,
		"version":    metadata.PolicyVersion,
		"ip_address": metadata.IPAddress,
		"user_agent": metadata.UserAgent,
		"updated_at": now,
	}

	if granted && !consent.Granted {
		updates["granted_at"] = now
		updates["revoked_at"] = nil
	} else if !granted && consent.Granted {
		updates["revoked_at"] = now
	}

	// Логуємо зміну
	s.logConsentChange(ctx, &consent, granted, metadata)

	return s.db.Model(&consent).Updates(updates).Error
}

// HasConsent перевіряє наявність активної згоди
func (s *ConsentService) HasConsent(ctx context.Context, tenantID, userID string, consentType ConsentType) bool {
	// Спочатку перевіряємо кеш
	cacheKey := fmt.Sprintf("consent:%s:%s:%s", tenantID, userID, consentType)
	if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
		return cached == "true"
	}

	var consent Consent
	err := s.db.Where("tenant_id = ? AND user_id = ? AND type = ? AND granted = ?",
		tenantID, userID, consentType, true).
		First(&consent).Error

	hasConsent := err == nil

	// Кешуємо результат на 5 хвилин
	s.cache.Set(ctx, cacheKey, fmt.Sprintf("%t", hasConsent), 5*time.Minute)

	return hasConsent
}

type ConsentMetadata struct {
	PolicyVersion string
	IPAddress     string
	UserAgent     string
	Source        string // web, mobile, api
}

func (s *ConsentService) logConsentChange(ctx context.Context, consent *Consent, newValue bool, metadata ConsentMetadata) {
	log := ConsentAuditLog{
		ID:            uuid.New().String(),
		TenantID:      consent.TenantID,
		UserID:        consent.UserID,
		ConsentType:   string(consent.Type),
		PreviousValue: consent.Granted,
		NewValue:      newValue,
		PolicyVersion: metadata.PolicyVersion,
		IPAddress:     metadata.IPAddress,
		UserAgent:     metadata.UserAgent,
		Source:        metadata.Source,
		CreatedAt:     time.Now(),
	}
	s.db.Create(&log)
}
```

## Data Retention

```go
// internal/privacy/retention.go
package privacy

import (
	"context"
	"time"

	"github.com/robfig/cron/v3"
)

type RetentionPolicy struct {
	DataType        string        `json:"data_type"`
	RetentionPeriod time.Duration `json:"retention_period"`
	DeleteAction    string        `json:"delete_action"` // delete, anonymize
}

var DefaultRetentionPolicies = []RetentionPolicy{
	{DataType: "user_sessions", RetentionPeriod: 30 * 24 * time.Hour, DeleteAction: "delete"},
	{DataType: "cart_abandoned", RetentionPeriod: 90 * 24 * time.Hour, DeleteAction: "delete"},
	{DataType: "user_activity", RetentionPeriod: 365 * 24 * time.Hour, DeleteAction: "delete"},
	{DataType: "access_logs", RetentionPeriod: 90 * 24 * time.Hour, DeleteAction: "delete"},
	{DataType: "error_logs", RetentionPeriod: 180 * 24 * time.Hour, DeleteAction: "delete"},
	{DataType: "orders", RetentionPeriod: 7 * 365 * 24 * time.Hour, DeleteAction: "anonymize"}, // 7 років
	{DataType: "invoices", RetentionPeriod: 7 * 365 * 24 * time.Hour, DeleteAction: "anonymize"},
}

type RetentionService struct {
	db     *gorm.DB
	cron   *cron.Cron
}

func NewRetentionService(db *gorm.DB) *RetentionService {
	s := &RetentionService{
		db:   db,
		cron: cron.New(),
	}

	// Запускаємо щодня о 3:00
	s.cron.AddFunc("0 3 * * *", func() {
		s.RunRetentionPolicies(context.Background())
	})
	s.cron.Start()

	return s
}

func (s *RetentionService) RunRetentionPolicies(ctx context.Context) error {
	for _, policy := range DefaultRetentionPolicies {
		if err := s.applyPolicy(ctx, policy); err != nil {
			log.Printf("Error applying retention policy for %s: %v", policy.DataType, err)
		}
	}
	return nil
}

func (s *RetentionService) applyPolicy(ctx context.Context, policy RetentionPolicy) error {
	cutoffDate := time.Now().Add(-policy.RetentionPeriod)

	switch policy.DataType {
	case "user_sessions":
		return s.db.Where("created_at < ?", cutoffDate).Delete(&Session{}).Error

	case "cart_abandoned":
		return s.db.Where("created_at < ? AND status = ?", cutoffDate, "abandoned").
			Delete(&Cart{}).Error

	case "user_activity":
		return s.db.Where("created_at < ?", cutoffDate).Delete(&UserActivity{}).Error

	case "access_logs":
		return s.db.Where("created_at < ?", cutoffDate).Delete(&AccessLog{}).Error

	case "orders":
		if policy.DeleteAction == "anonymize" {
			return s.anonymizeOldOrders(ctx, cutoffDate)
		}
		return s.db.Where("created_at < ?", cutoffDate).Delete(&Order{}).Error

	case "invoices":
		if policy.DeleteAction == "anonymize" {
			return s.anonymizeOldInvoices(ctx, cutoffDate)
		}
	}

	return nil
}

func (s *RetentionService) anonymizeOldOrders(ctx context.Context, cutoffDate time.Time) error {
	return s.db.Model(&Order{}).
		Where("created_at < ? AND email NOT LIKE ?", cutoffDate, "deleted_%").
		Updates(map[string]interface{}{
			"email":            gorm.Expr("CONCAT('archived_', id, '@anonymous.local')"),
			"phone":            nil,
			"customer_note":    nil,
			"billing_address":  nil,
			"shipping_address": nil,
		}).Error
}
```

## Cookie Management

```typescript
// src/lib/cookies/consent-banner.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { setCookie, getCookie } from '@/lib/cookies';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true, // Завжди true
  analytics: false,
  marketing: false,
  personalization: false,
};

export function CookieConsentBanner() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const consent = getCookie('cookie_consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const savePreferences = async (prefs: CookiePreferences) => {
    // Зберігаємо в cookie
    setCookie('cookie_consent', JSON.stringify(prefs), 365);

    // Зберігаємо на сервері для авторизованих користувачів
    try {
      await fetch('/api/privacy/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analytics: prefs.analytics,
          marketing: prefs.marketing,
          personalization: prefs.personalization,
        }),
      });
    } catch (error) {
      console.error('Failed to save consent preferences');
    }

    // Ініціалізуємо скрипти на основі згод
    if (prefs.analytics) {
      initializeAnalytics();
    }
    if (prefs.marketing) {
      initializeMarketing();
    }

    setShow(false);
  };

  const acceptAll = () => {
    savePreferences({
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
    });
  };

  const rejectAll = () => {
    savePreferences(defaultPreferences);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg p-4">
      <div className="container mx-auto max-w-4xl">
        {!showSettings ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">Ми використовуємо cookies</p>
              <p className="text-muted-foreground">
                Ми використовуємо cookies для покращення вашого досвіду.
                Ви можете налаштувати свої уподобання.{' '}
                <a href="/privacy-policy" className="underline">
                  Політика конфіденційності
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                Налаштування
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Тільки необхідні
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Прийняти всі
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-medium">Налаштування cookies</h3>

            <div className="space-y-3">
              <CookieOption
                title="Необхідні"
                description="Потрібні для роботи сайту"
                checked={true}
                disabled={true}
              />
              <CookieOption
                title="Аналітика"
                description="Допомагають нам покращувати сайт"
                checked={preferences.analytics}
                onChange={(v) => setPreferences({ ...preferences, analytics: v })}
              />
              <CookieOption
                title="Маркетинг"
                description="Використовуються для персоналізованої реклами"
                checked={preferences.marketing}
                onChange={(v) => setPreferences({ ...preferences, marketing: v })}
              />
              <CookieOption
                title="Персоналізація"
                description="Запам'ятовують ваші уподобання"
                checked={preferences.personalization}
                onChange={(v) => setPreferences({ ...preferences, personalization: v })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
                Назад
              </Button>
              <Button size="sm" onClick={() => savePreferences(preferences)}>
                Зберегти налаштування
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Privacy API

```go
// internal/api/handlers/privacy.go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type PrivacyHandler struct {
	dataAccess  *privacy.DataAccessService
	dataDeletion *privacy.DataDeletionService
	consent     *privacy.ConsentService
}

// RequestDataExport POST /api/v1/privacy/data-export
func (h *PrivacyHandler) RequestDataExport(c *gin.Context) {
	userID := c.GetString("user_id")
	tenantID := c.GetString("tenant_id")

	var user User
	// ... get user email

	request, err := h.dataAccess.CreateRequest(c.Request.Context(), tenantID, userID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Your data export request has been received. You will receive an email when it's ready.",
		"request_id": request.ID,
	})
}

// RequestAccountDeletion POST /api/v1/privacy/delete-account
func (h *PrivacyHandler) RequestAccountDeletion(c *gin.Context) {
	userID := c.GetString("user_id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Reason   string `json:"reason"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify password
	// ...

	var user User
	// ... get user

	request, err := h.dataDeletion.CreateRequest(c.Request.Context(), tenantID, userID, user.Email, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Please check your email to confirm account deletion.",
		"request_id": request.ID,
	})
}

// GetConsents GET /api/v1/privacy/consents
func (h *PrivacyHandler) GetConsents(c *gin.Context) {
	userID := c.GetString("user_id")
	tenantID := c.GetString("tenant_id")

	consents, err := h.consent.GetConsents(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, consents)
}

// UpdateConsent POST /api/v1/privacy/consent
func (h *PrivacyHandler) UpdateConsent(c *gin.Context) {
	userID := c.GetString("user_id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Analytics       *bool `json:"analytics"`
		Marketing       *bool `json:"marketing"`
		Personalization *bool `json:"personalization"`
		Newsletter      *bool `json:"newsletter"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metadata := privacy.ConsentMetadata{
		PolicyVersion: "2024.1",
		IPAddress:     c.ClientIP(),
		UserAgent:     c.GetHeader("User-Agent"),
		Source:        "web",
	}

	if req.Analytics != nil {
		h.consent.UpdateConsent(c.Request.Context(), tenantID, userID, privacy.ConsentAnalytics, *req.Analytics, metadata)
	}
	if req.Marketing != nil {
		h.consent.UpdateConsent(c.Request.Context(), tenantID, userID, privacy.ConsentMarketing, *req.Marketing, metadata)
	}
	if req.Personalization != nil {
		h.consent.UpdateConsent(c.Request.Context(), tenantID, userID, privacy.ConsentPersonalization, *req.Personalization, metadata)
	}
	if req.Newsletter != nil {
		h.consent.UpdateConsent(c.Request.Context(), tenantID, userID, privacy.ConsentNewsletter, *req.Newsletter, metadata)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Consent preferences updated"})
}
```

## Breach Notification

```go
// internal/privacy/breach.go
package privacy

import (
	"context"
	"time"
)

type DataBreach struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"` // empty for platform-wide
	DiscoveredAt     time.Time `json:"discovered_at"`
	OccurredAt       time.Time `json:"occurred_at"`
	Description      string    `json:"description"`
	DataTypes        []string  `json:"data_types"`
	AffectedUsers    int       `json:"affected_users"`
	RiskLevel        string    `json:"risk_level"` // low, medium, high, critical
	ContainmentSteps []string  `json:"containment_steps"`
	NotifiedDPA      bool      `json:"notified_dpa"` // Data Protection Authority
	NotifiedDPAAt    *time.Time `json:"notified_dpa_at"`
	NotifiedUsers    bool      `json:"notified_users"`
	NotifiedUsersAt  *time.Time `json:"notified_users_at"`
	Status           string    `json:"status"` // detected, contained, resolved
}

type BreachService struct {
	db       *gorm.DB
	notifier NotificationService
}

func (s *BreachService) ReportBreach(ctx context.Context, breach *DataBreach) error {
	breach.ID = uuid.New().String()
	breach.Status = "detected"

	if err := s.db.Create(breach).Error; err != nil {
		return err
	}

	// Негайне повідомлення команди безпеки
	s.notifier.SendSecurityAlert(ctx, breach)

	// Якщо high/critical - готуємо повідомлення DPA (72 години за GDPR)
	if breach.RiskLevel == "high" || breach.RiskLevel == "critical" {
		go s.prepareDPANotification(ctx, breach)
	}

	return nil
}

func (s *BreachService) NotifyAffectedUsers(ctx context.Context, breachID string) error {
	var breach DataBreach
	if err := s.db.First(&breach, "id = ?", breachID).Error; err != nil {
		return err
	}

	// Отримуємо список постраждалих користувачів
	affectedUsers := s.getAffectedUsers(ctx, breach.TenantID, breach.DataTypes)

	for _, user := range affectedUsers {
		s.notifier.SendBreachNotification(ctx, user.Email, breach.Description, breach.DataTypes)
	}

	now := time.Now()
	s.db.Model(&breach).Updates(map[string]interface{}{
		"notified_users":    true,
		"notified_users_at": now,
	})

	return nil
}
```

## Checklist GDPR

- [ ] Privacy Policy оновлена та доступна
- [ ] Cookie consent banner реалізований
- [ ] Механізм запиту на доступ до даних
- [ ] Механізм видалення даних
- [ ] Управління згодами
- [ ] Data retention policies налаштовані
- [ ] Breach notification процедура
- [ ] DPO (Data Protection Officer) призначений
- [ ] DPIA (Data Protection Impact Assessment) проведений
- [ ] Записи обробки даних ведуться
- [ ] Угоди з процесорами даних підписані

## Див. також

- [Security](../operations/SECURITY.md)
- [Authentication](../modules/AUTH.md)
- [API Reference](../api/README.md)
