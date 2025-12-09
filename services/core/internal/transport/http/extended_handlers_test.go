package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"core/internal/alerts"
	"core/internal/analytics"
	"core/internal/auth"
	"core/internal/email"
	"core/internal/erp"
	"core/internal/i18n"
	"core/internal/loyalty"
	"core/internal/marketplace"
	"core/internal/sms"
	"core/internal/warehouse"
	"core/internal/webhooks"
)

func TestNewExtendedHandlers(t *testing.T) {
	handlers := NewExtendedHandlers()

	if handlers == nil {
		t.Fatal("expected handlers to be created")
	}
}

func TestExtendedHandlers_SetAuthService(t *testing.T) {
	handlers := NewExtendedHandlers()

	jwtManager := auth.NewJWTManager(&auth.Config{
		SecretKey: "test-secret",
	})
	authService := auth.NewService(nil, nil, jwtManager, nil)

	handlers.SetAuthService(authService)

	if handlers.authService != authService {
		t.Error("expected authService to be set")
	}
}

func TestExtendedHandlers_SetLoyaltyService(t *testing.T) {
	handlers := NewExtendedHandlers()
	loyaltyService := loyalty.NewService(nil)

	handlers.SetLoyaltyService(loyaltyService)

	if handlers.loyaltyService != loyaltyService {
		t.Error("expected loyaltyService to be set")
	}
}

func TestExtendedHandlers_SetEmailService(t *testing.T) {
	handlers := NewExtendedHandlers()
	emailService := email.NewEmailService()

	handlers.SetEmailService(emailService)

	if handlers.emailService != emailService {
		t.Error("expected emailService to be set")
	}
}

func TestExtendedHandlers_SetSMSService(t *testing.T) {
	handlers := NewExtendedHandlers()
	smsService := sms.NewSMSService()

	handlers.SetSMSService(smsService)

	if handlers.smsService != smsService {
		t.Error("expected smsService to be set")
	}
}

func TestExtendedHandlers_SetWarehouseService(t *testing.T) {
	handlers := NewExtendedHandlers()
	warehouseService := warehouse.NewWarehouseService(nil)

	handlers.SetWarehouseService(warehouseService)

	if handlers.warehouseService != warehouseService {
		t.Error("expected warehouseService to be set")
	}
}

func TestExtendedHandlers_SetERPService(t *testing.T) {
	handlers := NewExtendedHandlers()
	erpService := erp.NewERPService()

	handlers.SetERPService(erpService)

	if handlers.erpService != erpService {
		t.Error("expected erpService to be set")
	}
}

func TestExtendedHandlers_SetWebhookService(t *testing.T) {
	handlers := NewExtendedHandlers()
	webhookService := webhooks.NewWebhookService(nil, 1)

	handlers.SetWebhookService(webhookService)

	if handlers.webhookService != webhookService {
		t.Error("expected webhookService to be set")
	}
}

func TestExtendedHandlers_SetAnalyticsService(t *testing.T) {
	handlers := NewExtendedHandlers()
	analyticsService := analytics.NewAnalyticsService(nil)

	handlers.SetAnalyticsService(analyticsService)

	if handlers.analyticsService != analyticsService {
		t.Error("expected analyticsService to be set")
	}
}

func TestExtendedHandlers_SetTranslator(t *testing.T) {
	handlers := NewExtendedHandlers()
	translator, _ := i18n.New()

	handlers.SetTranslator(translator)

	if handlers.translator != translator {
		t.Error("expected translator to be set")
	}
}

func TestExtendedHandlers_SetMarketplaceManager(t *testing.T) {
	handlers := NewExtendedHandlers()
	manager := marketplace.NewManager(nil)

	handlers.SetMarketplaceManager(manager)

	if handlers.marketplaceManager != manager {
		t.Error("expected marketplaceManager to be set")
	}
}

func TestExtendedHandlers_SetAlertMonitor(t *testing.T) {
	handlers := NewExtendedHandlers()
	config := alerts.DefaultConfig()
	publisher := alerts.NewLogPublisher()
	monitor := alerts.NewInventoryMonitor(config, publisher)

	handlers.SetAlertMonitor(monitor)

	if handlers.alertMonitor != monitor {
		t.Error("expected alertMonitor to be set")
	}
}

// ========== Auth Handlers Tests ==========

func TestExtendedHandlers_Login_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"email":"test@example.com","password":"password123"}`)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.Login(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_Login_InvalidMethod(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/auth/login", nil)
	w := httptest.NewRecorder()

	handlers.Login(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestExtendedHandlers_Login_InvalidJSON(t *testing.T) {
	handlers := NewExtendedHandlers()
	jwtManager := auth.NewJWTManager(&auth.Config{SecretKey: "test"})
	handlers.SetAuthService(auth.NewService(nil, nil, jwtManager, nil))

	body := bytes.NewBufferString(`{invalid json}`)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestExtendedHandlers_Register_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"email":"test@example.com","password":"password123"}`)
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.Register(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_Register_InvalidMethod(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/auth/register", nil)
	w := httptest.NewRecorder()

	handlers.Register(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

// ========== Loyalty Handlers Tests ==========

func TestExtendedHandlers_GetLoyaltyBalance_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/loyalty/users/123/balance", nil)
	w := httptest.NewRecorder()

	handlers.GetLoyaltyBalance(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_GetLoyaltyBalance_InvalidMethod(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodPost, "/loyalty/users/123/balance", nil)
	w := httptest.NewRecorder()

	handlers.GetLoyaltyBalance(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestExtendedHandlers_AddLoyaltyPoints_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"user_id":"123","order_id":"order-1","amount":100}`)
	req := httptest.NewRequest(http.MethodPost, "/loyalty/points", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.AddLoyaltyPoints(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_RedeemLoyaltyPoints_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"user_id":"123","reward_id":"reward-1"}`)
	req := httptest.NewRequest(http.MethodPost, "/loyalty/redeem", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.RedeemLoyaltyPoints(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Email Handlers Tests ==========

func TestExtendedHandlers_SendEmail_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"to":"test@example.com","subject":"Test","html":"<p>Hello</p>"}`)
	req := httptest.NewRequest(http.MethodPost, "/email/send", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.SendEmail(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_SendEmail_InvalidMethod(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/email/send", nil)
	w := httptest.NewRecorder()

	handlers.SendEmail(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

// ========== SMS Handlers Tests ==========

func TestExtendedHandlers_SendSMS_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"phone":"+380501234567","text":"Test message"}`)
	req := httptest.NewRequest(http.MethodPost, "/sms/send", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.SendSMS(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_GetSMSBalance_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/sms/balance", nil)
	w := httptest.NewRecorder()

	handlers.GetSMSBalance(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Warehouse Handlers Tests ==========

func TestExtendedHandlers_ListWarehouses_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/warehouses", nil)
	w := httptest.NewRecorder()

	handlers.ListWarehouses(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_GetWarehouse_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/warehouses/123", nil)
	w := httptest.NewRecorder()

	handlers.GetWarehouse(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_CreateWarehouse_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"name":"Test Warehouse","code":"WH-01"}`)
	req := httptest.NewRequest(http.MethodPost, "/warehouses", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.CreateWarehouse(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_TransferStock_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"from_warehouse_id":"wh-1","to_warehouse_id":"wh-2","product_id":"prod-1","quantity":10}`)
	req := httptest.NewRequest(http.MethodPost, "/warehouses/transfer", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.TransferStock(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== ERP Handlers Tests ==========

func TestExtendedHandlers_SyncERPProducts_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodPost, "/erp/sync/products", nil)
	w := httptest.NewRecorder()

	handlers.SyncERPProducts(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_SyncERPOrders_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodPost, "/erp/sync/orders", nil)
	w := httptest.NewRecorder()

	handlers.SyncERPOrders(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Marketplace Handlers Tests ==========

func TestExtendedHandlers_GetMarketplaces(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/marketplace", nil)
	w := httptest.NewRecorder()

	handlers.GetMarketplaces(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var marketplaces []map[string]string
	if err := json.NewDecoder(w.Body).Decode(&marketplaces); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(marketplaces) == 0 {
		t.Error("expected marketplaces list to not be empty")
	}

	// Check for expected marketplaces
	foundProm := false
	foundRozetka := false
	for _, m := range marketplaces {
		if m["id"] == "prom" {
			foundProm = true
		}
		if m["id"] == "rozetka" {
			foundRozetka = true
		}
	}
	if !foundProm {
		t.Error("expected prom marketplace in list")
	}
	if !foundRozetka {
		t.Error("expected rozetka marketplace in list")
	}
}

func TestExtendedHandlers_SyncMarketplace_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodPost, "/marketplace/sync", nil)
	w := httptest.NewRecorder()

	handlers.SyncMarketplace(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Webhooks Handlers Tests ==========

func TestExtendedHandlers_ListWebhooks_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/webhooks", nil)
	w := httptest.NewRecorder()

	handlers.ListWebhooks(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_CreateWebhook_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	body := bytes.NewBufferString(`{"url":"https://example.com/webhook","events":["order.created"]}`)
	req := httptest.NewRequest(http.MethodPost, "/webhooks", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handlers.CreateWebhook(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_DeleteWebhook_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodDelete, "/webhooks/123", nil)
	w := httptest.NewRecorder()

	handlers.DeleteWebhook(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Analytics Extended Handlers Tests ==========

func TestExtendedHandlers_GetABCXYZAnalysis_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/analytics/abc-xyz", nil)
	w := httptest.NewRecorder()

	handlers.GetABCXYZAnalysis(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_GetRFMAnalysis_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/analytics/rfm", nil)
	w := httptest.NewRecorder()

	handlers.GetRFMAnalysis(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== Storage Handlers Tests ==========

func TestExtendedHandlers_UploadFile_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodPost, "/storage/upload", nil)
	w := httptest.NewRecorder()

	handlers.UploadFile(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_DeleteFile_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodDelete, "/storage/file?key=test.jpg", nil)
	w := httptest.NewRecorder()

	handlers.DeleteFile(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

// ========== i18n Handlers Tests ==========

func TestExtendedHandlers_Translate_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/i18n/translate?key=hello&lang=uk", nil)
	w := httptest.NewRecorder()

	handlers.Translate(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestExtendedHandlers_Translate_Configured(t *testing.T) {
	handlers := NewExtendedHandlers()
	translator, err := i18n.New()
	if err != nil {
		t.Skipf("i18n not available: %v", err)
	}
	handlers.SetTranslator(translator)

	req := httptest.NewRequest(http.MethodGet, "/i18n/translate?key=test&lang=uk", nil)
	w := httptest.NewRecorder()

	handlers.Translate(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]string
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response["key"] != "test" {
		t.Errorf("expected key 'test', got %s", response["key"])
	}
	if response["language"] != "uk" {
		t.Errorf("expected language 'uk', got %s", response["language"])
	}
}

func TestExtendedHandlers_GetTranslations(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/i18n/languages", nil)
	w := httptest.NewRecorder()

	handlers.GetTranslations(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var languages []map[string]string
	if err := json.NewDecoder(w.Body).Decode(&languages); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(languages) != 3 {
		t.Errorf("expected 3 languages, got %d", len(languages))
	}

	// Check for Ukrainian
	foundUk := false
	for _, lang := range languages {
		if lang["code"] == "uk" {
			foundUk = true
			if lang["name"] != "Українська" {
				t.Errorf("expected name 'Українська', got %s", lang["name"])
			}
		}
	}
	if !foundUk {
		t.Error("expected Ukrainian language in list")
	}
}

// ========== Logistics Handlers Tests ==========

func TestExtendedHandlers_GetLogisticsProviders(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/logistics/providers", nil)
	w := httptest.NewRecorder()

	handlers.GetLogisticsProviders(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var providers []map[string]string
	if err := json.NewDecoder(w.Body).Decode(&providers); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(providers) == 0 {
		t.Error("expected providers list to not be empty")
	}

	// Check for Nova Poshta
	foundNovaPoshta := false
	for _, p := range providers {
		if p["id"] == "novaposhta" {
			foundNovaPoshta = true
			if p["name"] != "Нова Пошта" {
				t.Errorf("expected name 'Нова Пошта', got %s", p["name"])
			}
		}
	}
	if !foundNovaPoshta {
		t.Error("expected Nova Poshta in providers list")
	}
}

// ========== Alerts Handlers Tests ==========

func TestExtendedHandlers_GetAlerts_NotConfigured(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/alerts", nil)
	w := httptest.NewRecorder()

	handlers.GetAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var status map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if status["configured"] != false {
		t.Error("expected configured to be false")
	}
}

func TestExtendedHandlers_GetAlerts_Configured(t *testing.T) {
	handlers := NewExtendedHandlers()
	config := alerts.DefaultConfig()
	publisher := alerts.NewLogPublisher()
	monitor := alerts.NewInventoryMonitor(config, publisher)
	handlers.SetAlertMonitor(monitor)

	req := httptest.NewRequest(http.MethodGet, "/alerts", nil)
	w := httptest.NewRecorder()

	handlers.GetAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var status map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if status["configured"] != true {
		t.Error("expected configured to be true")
	}
}

// ========== Export Handlers Tests ==========

func TestExtendedHandlers_ExportProducts(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/export/products?format=excel", nil)
	w := httptest.NewRecorder()

	handlers.ExportProducts(w, req)

	// Should return not implemented since no data source
	if w.Code != http.StatusNotImplemented {
		t.Errorf("expected status %d, got %d", http.StatusNotImplemented, w.Code)
	}
}

func TestExtendedHandlers_ExportOrders(t *testing.T) {
	handlers := NewExtendedHandlers()

	req := httptest.NewRequest(http.MethodGet, "/export/orders?format=csv", nil)
	w := httptest.NewRecorder()

	handlers.ExportOrders(w, req)

	// Should return not implemented since no data source
	if w.Code != http.StatusNotImplemented {
		t.Errorf("expected status %d, got %d", http.StatusNotImplemented, w.Code)
	}
}
