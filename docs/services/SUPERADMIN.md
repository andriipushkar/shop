# SuperAdmin Service

Сервіс для управління платформою Shop Platform на рівні SaaS провайдера.

## Огляд

SuperAdmin - це адміністративний сервіс для:
- Управління тенантами (магазинами)
- Моніторингу системи
- Управління тарифними планами
- Біллінгу та підписок
- Підтримки клієнтів

## Архітектура

```
services/superadmin/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── api/
│   │   ├── handlers/
│   │   │   ├── tenants.go
│   │   │   ├── users.go
│   │   │   ├── billing.go
│   │   │   ├── support.go
│   │   │   └── system.go
│   │   ├── middleware/
│   │   │   └── auth.go
│   │   └── routes.go
│   ├── services/
│   │   ├── tenant_service.go
│   │   ├── billing_service.go
│   │   ├── support_service.go
│   │   └── analytics_service.go
│   └── models/
│       └── models.go
├── web/
│   └── (Next.js admin panel)
└── Dockerfile
```

## API Endpoints

### Tenant Management

```go
// internal/api/handlers/tenants.go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shop-platform/superadmin/internal/services"
)

type TenantHandler struct {
	service *services.TenantService
}

func NewTenantHandler(s *services.TenantService) *TenantHandler {
	return &TenantHandler{service: s}
}

// ListTenants GET /api/v1/tenants
func (h *TenantHandler) ListTenants(c *gin.Context) {
	var params services.TenantListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenants, total, err := h.service.List(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  tenants,
		"total": total,
		"page":  params.Page,
		"limit": params.Limit,
	})
}

// GetTenant GET /api/v1/tenants/:id
func (h *TenantHandler) GetTenant(c *gin.Context) {
	id := c.Param("id")

	tenant, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	// Get additional stats
	stats, _ := h.service.GetStats(c.Request.Context(), id)

	c.JSON(http.StatusOK, gin.H{
		"tenant": tenant,
		"stats":  stats,
	})
}

// CreateTenant POST /api/v1/tenants
func (h *TenantHandler) CreateTenant(c *gin.Context) {
	var req services.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenant, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tenant)
}

// UpdateTenant PUT /api/v1/tenants/:id
func (h *TenantHandler) UpdateTenant(c *gin.Context) {
	id := c.Param("id")
	var req services.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenant, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tenant)
}

// SuspendTenant POST /api/v1/tenants/:id/suspend
func (h *TenantHandler) SuspendTenant(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.Suspend(c.Request.Context(), id, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tenant suspended"})
}

// ActivateTenant POST /api/v1/tenants/:id/activate
func (h *TenantHandler) ActivateTenant(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Activate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tenant activated"})
}

// DeleteTenant DELETE /api/v1/tenants/:id
func (h *TenantHandler) DeleteTenant(c *gin.Context) {
	id := c.Param("id")

	// Soft delete with grace period
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tenant marked for deletion"})
}

// ImpersonateTenant POST /api/v1/tenants/:id/impersonate
func (h *TenantHandler) ImpersonateTenant(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetString("admin_id")

	token, err := h.service.CreateImpersonationToken(c.Request.Context(), id, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"admin_url": h.service.GetAdminURL(id),
	})
}
```

### Tenant Service

```go
// internal/services/tenant_service.go
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TenantService struct {
	db       *gorm.DB
	cache    CacheService
	billing  *BillingService
	notifier NotificationService
}

type TenantListParams struct {
	Page      int    `form:"page" binding:"min=1"`
	Limit     int    `form:"limit" binding:"min=1,max=100"`
	Status    string `form:"status"`
	PlanID    string `form:"plan_id"`
	Search    string `form:"search"`
	SortBy    string `form:"sort_by"`
	SortOrder string `form:"sort_order"`
}

type CreateTenantRequest struct {
	Name        string            `json:"name" binding:"required"`
	Slug        string            `json:"slug" binding:"required"`
	Domain      string            `json:"domain"`
	OwnerEmail  string            `json:"owner_email" binding:"required,email"`
	OwnerName   string            `json:"owner_name" binding:"required"`
	PlanID      string            `json:"plan_id" binding:"required"`
	TrialDays   int               `json:"trial_days"`
	Settings    map[string]any    `json:"settings"`
}

type UpdateTenantRequest struct {
	Name     string         `json:"name"`
	Domain   string         `json:"domain"`
	Settings map[string]any `json:"settings"`
	PlanID   string         `json:"plan_id"`
}

type TenantStats struct {
	ProductCount    int64          `json:"product_count"`
	OrderCount      int64          `json:"order_count"`
	UserCount       int64          `json:"user_count"`
	Revenue         float64        `json:"revenue"`
	StorageUsedGB   float64        `json:"storage_used_gb"`
	APICallsMonth   int64          `json:"api_calls_month"`
	LastActivityAt  *time.Time     `json:"last_activity_at"`
}

func (s *TenantService) List(ctx context.Context, params TenantListParams) ([]Tenant, int64, error) {
	var tenants []Tenant
	var total int64

	query := s.db.WithContext(ctx).Model(&Tenant{})

	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.PlanID != "" {
		query = query.Where("plan_id = ?", params.PlanID)
	}
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR slug ILIKE ? OR domain ILIKE ?", search, search, search)
	}

	query.Count(&total)

	// Sorting
	sortBy := "created_at"
	if params.SortBy != "" {
		sortBy = params.SortBy
	}
	sortOrder := "DESC"
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Pagination
	offset := (params.Page - 1) * params.Limit
	query = query.Offset(offset).Limit(params.Limit)

	if err := query.Preload("Plan").Find(&tenants).Error; err != nil {
		return nil, 0, err
	}

	return tenants, total, nil
}

func (s *TenantService) Create(ctx context.Context, req CreateTenantRequest) (*Tenant, error) {
	// Check slug uniqueness
	var count int64
	s.db.Model(&Tenant{}).Where("slug = ?", req.Slug).Count(&count)
	if count > 0 {
		return nil, fmt.Errorf("slug already exists")
	}

	tenant := &Tenant{
		ID:       uuid.New().String(),
		Name:     req.Name,
		Slug:     req.Slug,
		Domain:   req.Domain,
		PlanID:   req.PlanID,
		Status:   "active",
		Settings: req.Settings,
	}

	tx := s.db.Begin()

	// Create tenant
	if err := tx.Create(tenant).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Create owner user
	owner := &User{
		ID:       uuid.New().String(),
		TenantID: tenant.ID,
		Email:    req.OwnerEmail,
		Name:     req.OwnerName,
		Role:     "owner",
		Status:   "active",
	}
	if err := tx.Create(owner).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Create subscription with trial
	trialDays := req.TrialDays
	if trialDays == 0 {
		trialDays = 14
	}

	subscription := &Subscription{
		ID:                 uuid.New().String(),
		TenantID:           tenant.ID,
		PlanID:             req.PlanID,
		Status:             "trialing",
		TrialEndsAt:        time.Now().AddDate(0, 0, trialDays),
		CurrentPeriodStart: time.Now(),
		CurrentPeriodEnd:   time.Now().AddDate(0, 1, 0),
	}
	if err := tx.Create(subscription).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// Send welcome email
	go s.notifier.SendWelcomeEmail(ctx, owner.Email, tenant.Name)

	return tenant, nil
}

func (s *TenantService) GetStats(ctx context.Context, tenantID string) (*TenantStats, error) {
	stats := &TenantStats{}

	// Get counts from database
	s.db.Model(&Product{}).Where("tenant_id = ?", tenantID).Count(&stats.ProductCount)
	s.db.Model(&Order{}).Where("tenant_id = ?", tenantID).Count(&stats.OrderCount)
	s.db.Model(&User{}).Where("tenant_id = ?", tenantID).Count(&stats.UserCount)

	// Get revenue
	s.db.Model(&Order{}).
		Where("tenant_id = ? AND status = ?", tenantID, "completed").
		Select("COALESCE(SUM(total), 0)").
		Scan(&stats.Revenue)

	// Get storage usage
	stats.StorageUsedGB = s.getStorageUsage(ctx, tenantID)

	// Get API calls from metrics
	stats.APICallsMonth = s.getAPICallsThisMonth(ctx, tenantID)

	// Get last activity
	var lastOrder Order
	if err := s.db.Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		First(&lastOrder).Error; err == nil {
		stats.LastActivityAt = &lastOrder.CreatedAt
	}

	return stats, nil
}

func (s *TenantService) Suspend(ctx context.Context, tenantID, reason string) error {
	tx := s.db.Begin()

	// Update tenant status
	if err := tx.Model(&Tenant{}).
		Where("id = ?", tenantID).
		Updates(map[string]interface{}{
			"status":       "suspended",
			"suspended_at": time.Now(),
			"suspend_reason": reason,
		}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Log action
	if err := tx.Create(&AuditLog{
		TenantID:  tenantID,
		Action:    "tenant_suspended",
		Details:   map[string]any{"reason": reason},
		CreatedAt: time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// Notify tenant owner
	go s.notifier.SendSuspensionNotice(ctx, tenantID, reason)

	return nil
}

func (s *TenantService) CreateImpersonationToken(ctx context.Context, tenantID, adminID string) (string, error) {
	// Log impersonation for audit
	if err := s.db.Create(&AuditLog{
		TenantID:  tenantID,
		AdminID:   adminID,
		Action:    "impersonation_started",
		CreatedAt: time.Now(),
	}).Error; err != nil {
		return "", err
	}

	// Generate short-lived token
	token, err := s.generateImpersonationJWT(tenantID, adminID, time.Hour)
	if err != nil {
		return "", err
	}

	return token, nil
}
```

### Billing Management

```go
// internal/api/handlers/billing.go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shop-platform/superadmin/internal/services"
)

type BillingHandler struct {
	service *services.BillingService
}

// ListPlans GET /api/v1/plans
func (h *BillingHandler) ListPlans(c *gin.Context) {
	plans, err := h.service.ListPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, plans)
}

// CreatePlan POST /api/v1/plans
func (h *BillingHandler) CreatePlan(c *gin.Context) {
	var req services.CreatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan, err := h.service.CreatePlan(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

// ListSubscriptions GET /api/v1/subscriptions
func (h *BillingHandler) ListSubscriptions(c *gin.Context) {
	var params services.SubscriptionListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	subs, total, err := h.service.ListSubscriptions(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  subs,
		"total": total,
	})
}

// GetSubscription GET /api/v1/subscriptions/:id
func (h *BillingHandler) GetSubscription(c *gin.Context) {
	id := c.Param("id")

	sub, err := h.service.GetSubscription(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	c.JSON(http.StatusOK, sub)
}

// UpdateSubscription PUT /api/v1/subscriptions/:id
func (h *BillingHandler) UpdateSubscription(c *gin.Context) {
	id := c.Param("id")
	var req services.UpdateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sub, err := h.service.UpdateSubscription(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sub)
}

// ListInvoices GET /api/v1/invoices
func (h *BillingHandler) ListInvoices(c *gin.Context) {
	var params services.InvoiceListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invoices, total, err := h.service.ListInvoices(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  invoices,
		"total": total,
	})
}

// CreateManualInvoice POST /api/v1/invoices
func (h *BillingHandler) CreateManualInvoice(c *gin.Context) {
	var req services.CreateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invoice, err := h.service.CreateManualInvoice(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoice)
}

// RefundInvoice POST /api/v1/invoices/:id/refund
func (h *BillingHandler) RefundInvoice(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Amount float64 `json:"amount"`
		Reason string  `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	refund, err := h.service.RefundInvoice(c.Request.Context(), id, req.Amount, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, refund)
}

// GetRevenueReport GET /api/v1/reports/revenue
func (h *BillingHandler) GetRevenueReport(c *gin.Context) {
	var params services.RevenueReportParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.service.GetRevenueReport(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
```

### System Management

```go
// internal/api/handlers/system.go
package handlers

import (
	"net/http"
	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/shop-platform/superadmin/internal/services"
)

type SystemHandler struct {
	analytics *services.AnalyticsService
}

// GetDashboard GET /api/v1/dashboard
func (h *SystemHandler) GetDashboard(c *gin.Context) {
	ctx := c.Request.Context()

	dashboard := map[string]any{
		"tenants":       h.analytics.GetTenantMetrics(ctx),
		"subscriptions": h.analytics.GetSubscriptionMetrics(ctx),
		"revenue":       h.analytics.GetRevenueMetrics(ctx),
		"system":        h.getSystemMetrics(),
	}

	c.JSON(http.StatusOK, dashboard)
}

// GetTenantMetrics GET /api/v1/metrics/tenants
func (h *SystemHandler) GetTenantMetrics(c *gin.Context) {
	metrics := h.analytics.GetTenantMetrics(c.Request.Context())
	c.JSON(http.StatusOK, metrics)
}

// GetSystemHealth GET /api/v1/health
func (h *SystemHandler) GetSystemHealth(c *gin.Context) {
	health := h.analytics.CheckSystemHealth(c.Request.Context())

	status := http.StatusOK
	if health.Status != "healthy" {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, health)
}

// GetAuditLogs GET /api/v1/audit-logs
func (h *SystemHandler) GetAuditLogs(c *gin.Context) {
	var params services.AuditLogParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logs, total, err := h.analytics.GetAuditLogs(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
	})
}

// TriggerMaintenance POST /api/v1/maintenance
func (h *SystemHandler) TriggerMaintenance(c *gin.Context) {
	var req struct {
		Type     string `json:"type" binding:"required"` // backup, cleanup, reindex
		TenantID string `json:"tenant_id"`               // optional, for specific tenant
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	jobID, err := h.analytics.TriggerMaintenanceJob(c.Request.Context(), req.Type, req.TenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"job_id":  jobID,
		"message": "maintenance job started",
	})
}

func (h *SystemHandler) getSystemMetrics() map[string]any {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return map[string]any{
		"goroutines":   runtime.NumGoroutine(),
		"memory_alloc": m.Alloc / 1024 / 1024, // MB
		"memory_sys":   m.Sys / 1024 / 1024,   // MB
		"gc_cycles":    m.NumGC,
	}
}
```

### Support Tickets

```go
// internal/api/handlers/support.go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shop-platform/superadmin/internal/services"
)

type SupportHandler struct {
	service *services.SupportService
}

// ListTickets GET /api/v1/tickets
func (h *SupportHandler) ListTickets(c *gin.Context) {
	var params services.TicketListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tickets, total, err := h.service.ListTickets(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  tickets,
		"total": total,
	})
}

// GetTicket GET /api/v1/tickets/:id
func (h *SupportHandler) GetTicket(c *gin.Context) {
	id := c.Param("id")

	ticket, err := h.service.GetTicket(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}

	c.JSON(http.StatusOK, ticket)
}

// UpdateTicket PUT /api/v1/tickets/:id
func (h *SupportHandler) UpdateTicket(c *gin.Context) {
	id := c.Param("id")
	var req services.UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.service.UpdateTicket(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ticket)
}

// ReplyToTicket POST /api/v1/tickets/:id/reply
func (h *SupportHandler) ReplyToTicket(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetString("admin_id")

	var req struct {
		Message string `json:"message" binding:"required"`
		Internal bool   `json:"internal"` // Internal note vs customer reply
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reply, err := h.service.AddReply(c.Request.Context(), id, adminID, req.Message, req.Internal)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, reply)
}

// AssignTicket POST /api/v1/tickets/:id/assign
func (h *SupportHandler) AssignTicket(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		AdminID string `json:"admin_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AssignTicket(c.Request.Context(), id, req.AdminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ticket assigned"})
}

// CloseTicket POST /api/v1/tickets/:id/close
func (h *SupportHandler) CloseTicket(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Resolution string `json:"resolution" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CloseTicket(c.Request.Context(), id, req.Resolution); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ticket closed"})
}
```

## Frontend (Next.js)

### Dashboard Page

```typescript
// web/app/dashboard/page.tsx
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTenantMetrics, getRevenueMetrics } from '@/lib/api';

export default async function DashboardPage() {
  const [tenants, revenue] = await Promise.all([
    getTenantMetrics(),
    getRevenueMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.total}</div>
            <p className="text-xs text-muted-foreground">
              +{tenants.newThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {tenants.trialSubscriptions} in trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₴{revenue.mrr.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +{revenue.mrrGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue.churnRate}%</div>
            <p className="text-xs text-muted-foreground">
              {revenue.churnedThisMonth} cancelled
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<div>Loading chart...</div>}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<div>Loading chart...</div>}>
          <TenantGrowthChart />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecentTenants />
        <OpenTickets />
      </div>
    </div>
  );
}
```

### Tenant Management

```typescript
// web/app/tenants/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Search, Plus } from 'lucide-react';
import { getTenants, suspendTenant, activateTenant } from '@/lib/api';
import { CreateTenantDialog } from '@/components/tenants/create-dialog';
import { TenantDetailsSheet } from '@/components/tenants/details-sheet';

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenants', search, status, page],
    queryFn: () => getTenants({ search, status, page, limit: 20 }),
  });

  const handleSuspend = async (id: string, reason: string) => {
    await suspendTenant(id, reason);
    refetch();
  };

  const handleActivate = async (id: string) => {
    await activateTenant(id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-md px-3"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data.map((tenant) => (
            <TableRow
              key={tenant.id}
              className="cursor-pointer"
              onClick={() => setSelectedTenant(tenant.id)}
            >
              <TableCell className="font-medium">{tenant.name}</TableCell>
              <TableCell>{tenant.slug}</TableCell>
              <TableCell>{tenant.plan?.name}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    tenant.status === 'active' ? 'default' :
                    tenant.status === 'suspended' ? 'destructive' : 'secondary'
                  }
                >
                  {tenant.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(tenant.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedTenant(tenant.id)}>
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>Impersonate</DropdownMenuItem>
                    {tenant.status === 'active' ? (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleSuspend(tenant.id, 'Manual suspension')}
                      >
                        Suspend
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleActivate(tenant.id)}>
                        Activate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateTenantDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => refetch()}
      />

      <TenantDetailsSheet
        tenantId={selectedTenant}
        onClose={() => setSelectedTenant(null)}
      />
    </div>
  );
}
```

## Конфігурація

```yaml
# config/superadmin.yaml
server:
  port: 8090
  host: 0.0.0.0
  cors_origins:
    - "https://superadmin.shop-platform.com"

database:
  url: "${DATABASE_URL}"
  max_connections: 50

redis:
  url: "${REDIS_URL}"

auth:
  jwt_secret: "${JWT_SECRET}"
  session_duration: 8h
  mfa_required: true

features:
  impersonation: true
  audit_logging: true
  maintenance_mode: false

notifications:
  slack_webhook: "${SLACK_WEBHOOK_URL}"
  email_from: "noreply@shop-platform.com"
```

## Див. також

- [Multi-tenancy](../architecture/MULTI_TENANCY.md)
- [Billing](../modules/BILLING.md)
- [API Reference](../api/README.md)
