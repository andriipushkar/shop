package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"core/internal/alerts"
	"core/internal/analytics"
	"core/internal/auth"
	"core/internal/email"
	"core/internal/erp"
	"core/internal/export"
	"core/internal/i18n"
	"core/internal/loyalty"
	"core/internal/marketplace"
	"core/internal/sms"
	"core/internal/storage"
	"core/internal/warehouse"
	"core/internal/webhooks"
)

// ExtendedHandlers contains handlers for all extended modules
type ExtendedHandlers struct {
	// Alerts
	alertMonitor *alerts.InventoryMonitor

	// Analytics
	analyticsService *analytics.AnalyticsService

	// Auth
	authService *auth.Service

	// Email
	emailService *email.EmailService

	// ERP
	erpService *erp.ERPService

	// Export
	exportConfig export.ExportConfig

	// i18n
	translator *i18n.Translator

	// Loyalty
	loyaltyService *loyalty.Service

	// Marketplace
	marketplaceManager *marketplace.Manager

	// SMS
	smsService *sms.SMSService

	// Storage
	storage *storage.S3Storage

	// Warehouse
	warehouseService *warehouse.WarehouseService

	// Webhooks
	webhookService *webhooks.WebhookService
}

// NewExtendedHandlers creates extended handlers with default configuration
func NewExtendedHandlers() *ExtendedHandlers {
	return &ExtendedHandlers{
		exportConfig: export.DefaultExportConfig(),
	}
}

// SetAlertMonitor sets alerts monitor
func (h *ExtendedHandlers) SetAlertMonitor(monitor *alerts.InventoryMonitor) {
	h.alertMonitor = monitor
}

// SetAnalyticsService sets analytics service
func (h *ExtendedHandlers) SetAnalyticsService(service *analytics.AnalyticsService) {
	h.analyticsService = service
}

// SetAuthService sets auth service
func (h *ExtendedHandlers) SetAuthService(service *auth.Service) {
	h.authService = service
}

// SetEmailService sets email service
func (h *ExtendedHandlers) SetEmailService(service *email.EmailService) {
	h.emailService = service
}

// SetERPService sets ERP service
func (h *ExtendedHandlers) SetERPService(service *erp.ERPService) {
	h.erpService = service
}

// SetTranslator sets i18n translator
func (h *ExtendedHandlers) SetTranslator(translator *i18n.Translator) {
	h.translator = translator
}

// SetLoyaltyService sets loyalty service
func (h *ExtendedHandlers) SetLoyaltyService(service *loyalty.Service) {
	h.loyaltyService = service
}

// SetMarketplaceManager sets marketplace manager
func (h *ExtendedHandlers) SetMarketplaceManager(manager *marketplace.Manager) {
	h.marketplaceManager = manager
}

// SetSMSService sets SMS service
func (h *ExtendedHandlers) SetSMSService(service *sms.SMSService) {
	h.smsService = service
}

// SetStorage sets S3 storage
func (h *ExtendedHandlers) SetStorage(s *storage.S3Storage) {
	h.storage = s
}

// SetWarehouseService sets warehouse service
func (h *ExtendedHandlers) SetWarehouseService(service *warehouse.WarehouseService) {
	h.warehouseService = service
}

// SetWebhookService sets webhook service
func (h *ExtendedHandlers) SetWebhookService(service *webhooks.WebhookService) {
	h.webhookService = service
}

// ========== Auth Handlers ==========

// Login handles user login
func (h *ExtendedHandlers) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req auth.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.authService == nil {
		http.Error(w, "Auth service not configured", http.StatusServiceUnavailable)
		return
	}

	user, tokens, err := h.authService.Login(r.Context(), &req)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user":          user,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
	})
}

// Register handles user registration
func (h *ExtendedHandlers) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req auth.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.authService == nil {
		http.Error(w, "Auth service not configured", http.StatusServiceUnavailable)
		return
	}

	user, tokens, err := h.authService.Register(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user":          user,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
	})
}

// ========== Loyalty Handlers ==========

// GetLoyaltyBalance returns user's loyalty balance
func (h *ExtendedHandlers) GetLoyaltyBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /loyalty/users/{id}/balance
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	if h.loyaltyService == nil {
		http.Error(w, "Loyalty service not configured", http.StatusServiceUnavailable)
		return
	}

	account, err := h.loyaltyService.GetOrCreateAccount(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(account)
}

// AddLoyaltyPoints adds loyalty points (earns points for order)
func (h *ExtendedHandlers) AddLoyaltyPoints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID  string  `json:"user_id"`
		OrderID string  `json:"order_id"`
		Amount  float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.loyaltyService == nil {
		http.Error(w, "Loyalty service not configured", http.StatusServiceUnavailable)
		return
	}

	tx, err := h.loyaltyService.EarnPoints(r.Context(), req.UserID, req.OrderID, req.Amount)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tx)
}

// RedeemLoyaltyPoints redeems loyalty points for a reward
func (h *ExtendedHandlers) RedeemLoyaltyPoints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID   string `json:"user_id"`
		RewardID string `json:"reward_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.loyaltyService == nil {
		http.Error(w, "Loyalty service not configured", http.StatusServiceUnavailable)
		return
	}

	redemption, err := h.loyaltyService.RedeemPoints(r.Context(), req.UserID, req.RewardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(redemption)
}

// GetLoyaltyHistory returns loyalty points history
func (h *ExtendedHandlers) GetLoyaltyHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	if h.loyaltyService == nil {
		http.Error(w, "Loyalty service not configured", http.StatusServiceUnavailable)
		return
	}

	history, _, err := h.loyaltyService.GetHistory(r.Context(), userID, 50, 0)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

// ========== Export Handlers ==========

// ExportProducts exports products to CSV/Excel
func (h *ExtendedHandlers) ExportProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	format := export.ExportFormat(r.URL.Query().Get("format"))
	if format == "" {
		format = export.FormatExcel
	}

	// This would need products data from service
	// For now, return error if no data source
	http.Error(w, "Products data source required", http.StatusNotImplemented)
}

// ExportOrders exports orders to CSV/Excel
func (h *ExtendedHandlers) ExportOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	format := export.ExportFormat(r.URL.Query().Get("format"))
	if format == "" {
		format = export.FormatExcel
	}

	http.Error(w, "Orders data source required", http.StatusNotImplemented)
}

// ========== Email Handlers ==========

// SendEmail sends an email
func (h *ExtendedHandlers) SendEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		To         string                 `json:"to"`
		Subject    string                 `json:"subject"`
		HTML       string                 `json:"html"`
		Text       string                 `json:"text"`
		TemplateID string                 `json:"template_id"`
		Variables  map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.emailService == nil {
		http.Error(w, "Email service not configured", http.StatusServiceUnavailable)
		return
	}

	msg := &email.Email{
		To:         []string{req.To},
		Subject:    req.Subject,
		HTML:       req.HTML,
		Text:       req.Text,
		TemplateID: req.TemplateID,
		Variables:  req.Variables,
	}

	result, err := h.emailService.SendEmail(r.Context(), "", msg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ========== SMS Handlers ==========

// SendSMS sends an SMS
func (h *ExtendedHandlers) SendSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Phone  string `json:"phone"`
		Text   string `json:"text"`
		Sender string `json:"sender"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.smsService == nil {
		http.Error(w, "SMS service not configured", http.StatusServiceUnavailable)
		return
	}

	msg := &sms.Message{
		Phone:  req.Phone,
		Text:   req.Text,
		Sender: req.Sender,
	}

	result, err := h.smsService.Send(r.Context(), "", msg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetSMSBalance returns SMS account balance
func (h *ExtendedHandlers) GetSMSBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.smsService == nil {
		http.Error(w, "SMS service not configured", http.StatusServiceUnavailable)
		return
	}

	balance, err := h.smsService.GetBalance(r.Context(), "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balance)
}

// ========== Warehouse Handlers ==========

// ListWarehouses returns list of warehouses
func (h *ExtendedHandlers) ListWarehouses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.warehouseService == nil {
		http.Error(w, "Warehouse service not configured", http.StatusServiceUnavailable)
		return
	}

	warehouses, err := h.warehouseService.ListWarehouses(r.Context(), true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(warehouses)
}

// GetWarehouse returns warehouse by ID
func (h *ExtendedHandlers) GetWarehouse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /warehouses/{id}
	id := strings.TrimPrefix(r.URL.Path, "/warehouses/")
	if id == "" {
		http.Error(w, "Warehouse ID required", http.StatusBadRequest)
		return
	}

	if h.warehouseService == nil {
		http.Error(w, "Warehouse service not configured", http.StatusServiceUnavailable)
		return
	}

	wh, err := h.warehouseService.GetWarehouse(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wh)
}

// CreateWarehouse creates a new warehouse
func (h *ExtendedHandlers) CreateWarehouse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req warehouse.Warehouse
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.warehouseService == nil {
		http.Error(w, "Warehouse service not configured", http.StatusServiceUnavailable)
		return
	}

	err := h.warehouseService.CreateWarehouse(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// GetWarehouseStock returns stock for a warehouse and product
func (h *ExtendedHandlers) GetWarehouseStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /warehouses/{id}/stock?product_id=xxx
	path := strings.TrimSuffix(r.URL.Path, "/stock")
	warehouseID := strings.TrimPrefix(path, "/warehouses/")
	productID := r.URL.Query().Get("product_id")

	if warehouseID == "" {
		http.Error(w, "Warehouse ID required", http.StatusBadRequest)
		return
	}

	if h.warehouseService == nil {
		http.Error(w, "Warehouse service not configured", http.StatusServiceUnavailable)
		return
	}

	if productID != "" {
		stock, err := h.warehouseService.GetStock(r.Context(), warehouseID, productID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stock)
	} else {
		// Return all products in warehouse - would need GetStockByWarehouse
		http.Error(w, "product_id query parameter required", http.StatusBadRequest)
	}
}

// TransferStock transfers stock between warehouses
func (h *ExtendedHandlers) TransferStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FromWarehouseID string `json:"from_warehouse_id"`
		ToWarehouseID   string `json:"to_warehouse_id"`
		ProductID       string `json:"product_id"`
		SKU             string `json:"sku"`
		Quantity        int    `json:"quantity"`
		Notes           string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.warehouseService == nil {
		http.Error(w, "Warehouse service not configured", http.StatusServiceUnavailable)
		return
	}

	err := h.warehouseService.TransferStock(r.Context(), req.FromWarehouseID, req.ToWarehouseID, req.ProductID, req.SKU, req.Quantity, req.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ========== ERP Handlers ==========

// SyncERPProducts syncs products with ERP
func (h *ExtendedHandlers) SyncERPProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	provider := r.URL.Query().Get("provider")

	if h.erpService == nil {
		http.Error(w, "ERP service not configured", http.StatusServiceUnavailable)
		return
	}

	result, err := h.erpService.SyncProducts(r.Context(), provider, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// SyncERPOrders syncs orders with ERP
func (h *ExtendedHandlers) SyncERPOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	provider := r.URL.Query().Get("provider")

	if h.erpService == nil {
		http.Error(w, "ERP service not configured", http.StatusServiceUnavailable)
		return
	}

	result, err := h.erpService.SyncOrders(r.Context(), provider, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ========== Marketplace Handlers ==========

// GetMarketplaces returns list of available marketplaces
func (h *ExtendedHandlers) GetMarketplaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return list of supported Ukrainian marketplaces
	marketplaces := []map[string]string{
		{"id": "prom", "name": "Prom.ua"},
		{"id": "rozetka", "name": "Rozetka"},
		{"id": "olx", "name": "OLX"},
		{"id": "hotline", "name": "Hotline"},
		{"id": "kasta", "name": "Kasta"},
		{"id": "epicentr", "name": "Епіцентр"},
		{"id": "facebook", "name": "Facebook Marketplace"},
		{"id": "google", "name": "Google Shopping"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(marketplaces)
}

// SyncMarketplace syncs all products with all marketplaces
func (h *ExtendedHandlers) SyncMarketplace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.marketplaceManager == nil {
		http.Error(w, "Marketplace manager not configured", http.StatusServiceUnavailable)
		return
	}

	results := h.marketplaceManager.SyncAll(r.Context())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// ========== Webhooks Handlers ==========

// ListWebhooks returns registered webhooks
func (h *ExtendedHandlers) ListWebhooks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.webhookService == nil {
		http.Error(w, "Webhook service not configured", http.StatusServiceUnavailable)
		return
	}

	hooks, err := h.webhookService.ListWebhooks(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hooks)
}

// CreateWebhook creates a new webhook
func (h *ExtendedHandlers) CreateWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req webhooks.Webhook
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if h.webhookService == nil {
		http.Error(w, "Webhook service not configured", http.StatusServiceUnavailable)
		return
	}

	err := h.webhookService.CreateWebhook(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// DeleteWebhook deletes a webhook
func (h *ExtendedHandlers) DeleteWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/webhooks/")
	if id == "" {
		http.Error(w, "Webhook ID required", http.StatusBadRequest)
		return
	}

	if h.webhookService == nil {
		http.Error(w, "Webhook service not configured", http.StatusServiceUnavailable)
		return
	}

	err := h.webhookService.DeleteWebhook(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Analytics Extended Handlers ==========

// GetABCXYZAnalysis returns ABC-XYZ analysis
func (h *ExtendedHandlers) GetABCXYZAnalysis(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.analyticsService == nil {
		http.Error(w, "Analytics service not configured", http.StatusServiceUnavailable)
		return
	}

	// Use default period (last 30 days)
	period := analytics.Last30Days()
	config := analytics.DefaultABCXYZConfig()

	analysis, err := h.analyticsService.PerformABCXYZAnalysis(r.Context(), period, config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// GetRFMAnalysis returns RFM analysis
func (h *ExtendedHandlers) GetRFMAnalysis(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.analyticsService == nil {
		http.Error(w, "Analytics service not configured", http.StatusServiceUnavailable)
		return
	}

	// Use default period (last 365 days)
	period := analytics.Last365Days()
	config := analytics.DefaultRFMConfig()

	analysis, err := h.analyticsService.PerformRFMAnalysis(r.Context(), period, config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// ========== Storage Handlers ==========

// UploadFile handles file uploads
func (h *ExtendedHandlers) UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.storage == nil {
		http.Error(w, "Storage not configured", http.StatusServiceUnavailable)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(storage.MaxImageSize())
	if err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	folder := r.FormValue("folder")
	if folder == "" {
		folder = "uploads"
	}

	contentType := header.Header.Get("Content-Type")
	if err := storage.ValidateImageUpload(contentType, header.Size); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.storage.UploadFile(r.Context(), folder, header.Filename, file, header.Size, contentType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(result)
}

// DeleteFile handles file deletion
func (h *ExtendedHandlers) DeleteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.storage == nil {
		http.Error(w, "Storage not configured", http.StatusServiceUnavailable)
		return
	}

	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "File key required", http.StatusBadRequest)
		return
	}

	err := h.storage.DeleteFile(r.Context(), key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== i18n Handler ==========

// Translate handles translation requests
func (h *ExtendedHandlers) Translate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.translator == nil {
		http.Error(w, "Translator not configured", http.StatusServiceUnavailable)
		return
	}

	key := r.URL.Query().Get("key")
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "uk"
	}

	translated := h.translator.T(lang, key)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"key":         key,
		"translation": translated,
		"language":    lang,
	})
}

// GetTranslations returns supported languages
func (h *ExtendedHandlers) GetTranslations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return list of supported languages
	languages := []map[string]string{
		{"code": "uk", "name": "Українська"},
		{"code": "en", "name": "English"},
		{"code": "ru", "name": "Русский"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(languages)
}

// ========== Logistics Handlers ==========

// GetLogisticsProviders returns available logistics providers
func (h *ExtendedHandlers) GetLogisticsProviders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return list of available Ukrainian logistics providers
	providers := []map[string]string{
		{"id": "novaposhta", "name": "Нова Пошта"},
		{"id": "ukrposhta", "name": "Укрпошта"},
		{"id": "meest", "name": "Meest Express"},
		{"id": "justin", "name": "Justin"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}

// ========== Alerts Handlers ==========

// GetAlerts returns alerts status
func (h *ExtendedHandlers) GetAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return alerts status
	// In production, this would query a database for stored alerts
	status := map[string]interface{}{
		"configured": h.alertMonitor != nil,
		"types": []string{
			"low_stock",
			"out_of_stock",
			"price_change",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
