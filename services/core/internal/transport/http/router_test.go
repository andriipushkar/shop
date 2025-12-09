package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"core/internal/pim"
)

func setupRouter() *Router {
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := pim.NewService(repo, catRepo)
	return NewRouter(service)
}

func TestNewRouter(t *testing.T) {
	router := setupRouter()
	if router == nil {
		t.Fatal("expected router to be created")
	}
	if router.productHandler == nil {
		t.Error("expected productHandler to be set")
	}
	if router.ordersHandler == nil {
		t.Error("expected ordersHandler to be set")
	}
	if router.paymentsHandler == nil {
		t.Error("expected paymentsHandler to be set")
	}
	if router.deliveryHandler == nil {
		t.Error("expected deliveryHandler to be set")
	}
	if router.feedHandler == nil {
		t.Error("expected feedHandler to be set")
	}
}

func TestRouter_CORS(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("expected CORS origin header")
	}
	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("expected CORS methods header")
	}
	if w.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Error("expected CORS headers header")
	}
}

func TestRouter_Preflight(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/products", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d for OPTIONS, got %d", http.StatusOK, w.Code)
	}
}

func TestRouter_APIVersioning(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name string
		path string
	}{
		{"with /api/v1", "/api/v1/products"},
		{"with /api", "/api/products"},
		{"without prefix", "/products"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			// Should not return 404 for products endpoint
			if w.Code == http.StatusNotFound {
				t.Errorf("expected products endpoint to be found for %s", tt.path)
			}
		})
	}
}

func TestRouter_HealthEndpoints(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		expectedBody   string
	}{
		{"health", "/health", http.StatusOK, `{"status":"ok"}`},
		{"healthz", "/healthz", http.StatusOK, `{"status":"ok"}`},
		{"ready", "/ready", http.StatusOK, `{"status":"ready"}`},
		{"readyz", "/readyz", http.StatusOK, `{"status":"ready"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			if w.Body.String() != tt.expectedBody {
				t.Errorf("expected body %s, got %s", tt.expectedBody, w.Body.String())
			}
		})
	}
}

func TestRouter_ProductRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name         string
		method       string
		path         string
		expectNotFound bool // true if we expect "Not Found" for missing resource (but route exists)
	}{
		{"list products", http.MethodGet, "/api/v1/products", false},
		{"create product", http.MethodPost, "/api/v1/products", false},
		{"get product", http.MethodGet, "/api/v1/products/123", true}, // product not found, but route exists
		{"update product", http.MethodPut, "/api/v1/products/123", true},
		{"delete product", http.MethodDelete, "/api/v1/products/123", true},
		{"update stock", http.MethodPatch, "/api/v1/products/123/stock", false},
		{"update image", http.MethodPatch, "/api/v1/products/123/image", false},
		{"price history", http.MethodGet, "/api/v1/products/123/price-history", false},
		{"latest price change", http.MethodGet, "/api/v1/products/123/latest-price-change", false},
		{"product reviews", http.MethodGet, "/api/v1/products/123/reviews", false},
		{"product rating", http.MethodGet, "/api/v1/products/123/rating", false},
		{"similar products", http.MethodGet, "/api/v1/products/123/similar", false},
		{"frequently bought together", http.MethodGet, "/api/v1/products/123/frequently-bought-together", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			// If route returns "Not Found" text, check if it's expected
			if w.Code == http.StatusNotFound && !tt.expectNotFound {
				// If body contains "Not Found" (router default), route doesn't exist
				if w.Body.String() == "Not Found\n" {
					t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
				}
			}
		})
	}
}

func TestRouter_CategoryRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name         string
		method       string
		path         string
		expectNotFound bool
	}{
		{"list categories", http.MethodGet, "/api/v1/categories", false},
		{"create category", http.MethodPost, "/api/v1/categories", false},
		{"get category", http.MethodGet, "/api/v1/categories/123", true}, // category not found, but route exists
		{"delete category", http.MethodDelete, "/api/v1/categories/123", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && !tt.expectNotFound {
				if w.Body.String() == "Not Found\n" {
					t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
				}
			}
		})
	}
}

func TestRouter_CartRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"get cart", http.MethodGet, "/api/v1/cart/1"},
		{"add to cart", http.MethodPost, "/api/v1/cart/1"},
		{"clear cart", http.MethodDelete, "/api/v1/cart/1"},
		{"remove from cart", http.MethodDelete, "/api/v1/cart/1/item/prod-1"},
		{"update cart item", http.MethodPatch, "/api/v1/cart/1/item/prod-1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_WishlistRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"get wishlist", http.MethodGet, "/api/v1/wishlist/1"},
		{"add to wishlist", http.MethodPost, "/api/v1/wishlist/1"},
		{"clear wishlist", http.MethodDelete, "/api/v1/wishlist/1"},
		{"remove from wishlist", http.MethodDelete, "/api/v1/wishlist/1/item/prod-1"},
		{"is in wishlist", http.MethodGet, "/api/v1/wishlist/1/item/prod-1"},
		{"move to cart", http.MethodPost, "/api/v1/wishlist/1/item/prod-1/to-cart"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_OrderRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"list orders", http.MethodGet, "/api/v1/orders"},
		{"create order", http.MethodPost, "/api/v1/orders"},
		{"get order", http.MethodGet, "/api/v1/orders/123"},
		{"order stats", http.MethodGet, "/api/v1/orders/stats"},
		{"update order status", http.MethodPatch, "/api/v1/orders/123/status"},
		{"cancel order", http.MethodPost, "/api/v1/orders/123/cancel"},
		{"order payments", http.MethodGet, "/api/v1/orders/123/payments"},
		{"user orders", http.MethodGet, "/api/v1/users/1/orders"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_PaymentRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"initiate payment", http.MethodPost, "/api/v1/payments"},
		{"payment methods", http.MethodGet, "/api/v1/payments/methods"},
		{"get payment", http.MethodGet, "/api/v1/payments/123"},
		{"refund payment", http.MethodPost, "/api/v1/payments/123/refund"},
		{"liqpay webhook", http.MethodPost, "/api/v1/webhooks/payments/liqpay"},
		{"monobank webhook", http.MethodPost, "/api/v1/webhooks/payments/monobank"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_DeliveryRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"create shipment", http.MethodPost, "/api/v1/shipments"},
		{"track shipment", http.MethodGet, "/api/v1/shipments/track"},
		{"get shipment", http.MethodGet, "/api/v1/shipments/123"},
		{"print label", http.MethodGet, "/api/v1/shipments/123/label"},
		{"cancel shipment", http.MethodPost, "/api/v1/shipments/123/cancel"},
		{"delivery providers", http.MethodGet, "/api/v1/delivery/providers"},
		{"calculate delivery", http.MethodPost, "/api/v1/delivery/calculate"},
		{"search cities", http.MethodGet, "/api/v1/delivery/cities"},
		{"get warehouses", http.MethodGet, "/api/v1/delivery/warehouses"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_InventoryRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"low stock", http.MethodGet, "/api/v1/inventory/low-stock"},
		{"out of stock", http.MethodGet, "/api/v1/inventory/out-of-stock"},
		{"inventory stats", http.MethodGet, "/api/v1/inventory/stats"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_AnalyticsRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"dashboard", http.MethodGet, "/api/v1/analytics/dashboard"},
		{"top selling", http.MethodGet, "/api/v1/analytics/top-selling"},
		{"daily sales", http.MethodGet, "/api/v1/analytics/daily-sales"},
		{"sales by category", http.MethodGet, "/api/v1/analytics/sales-by-category"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_SearchRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"search products", http.MethodGet, "/api/v1/search"},
		{"search suggest", http.MethodGet, "/api/v1/search/suggest"},
		{"reindex products", http.MethodPost, "/api/v1/search/reindex"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_FeedRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"yml feed", http.MethodGet, "/api/v1/feeds/yml"},
		{"google feed", http.MethodGet, "/api/v1/feeds/google"},
		{"facebook feed", http.MethodGet, "/api/v1/feeds/facebook"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_RecommendationRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"popular products", http.MethodGet, "/api/v1/recommendations/popular"},
		{"user recommendations", http.MethodGet, "/api/v1/users/1/recommendations"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_ReviewRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name         string
		method       string
		path         string
		expectNotFound bool
	}{
		{"create review", http.MethodPost, "/api/v1/reviews", false},
		{"get review", http.MethodGet, "/api/v1/reviews/123", true}, // review not found, but route exists
		{"delete review", http.MethodDelete, "/api/v1/reviews/123", true},
		{"user reviews", http.MethodGet, "/api/v1/users/1/reviews", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && !tt.expectNotFound {
				if w.Body.String() == "Not Found\n" {
					t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
				}
			}
		})
	}
}

func TestRouter_NotFound(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/nonexistent", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d for unknown route, got %d", http.StatusNotFound, w.Code)
	}
}

// ========== Extended Handlers Tests ==========

func TestRouter_ExtendedHandlers(t *testing.T) {
	router := setupRouter()

	if router.extendedHandlers == nil {
		t.Error("expected extendedHandlers to be set")
	}
}

func TestRouter_SetExtendedHandlers(t *testing.T) {
	router := setupRouter()
	newHandlers := NewExtendedHandlers()

	router.SetExtendedHandlers(newHandlers)

	if router.extendedHandlers != newHandlers {
		t.Error("expected extendedHandlers to be updated")
	}
}

func TestRouter_GetExtendedHandlers(t *testing.T) {
	router := setupRouter()

	handlers := router.GetExtendedHandlers()

	if handlers == nil {
		t.Error("expected GetExtendedHandlers to return non-nil")
	}
}

func TestRouter_AuthRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"login", http.MethodPost, "/api/v1/auth/login"},
		{"register", http.MethodPost, "/api/v1/auth/register"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			// Route should exist (might return 503 if service not configured)
			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_LoyaltyRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"get balance", http.MethodGet, "/api/v1/loyalty/users/123/balance"},
		{"get history", http.MethodGet, "/api/v1/loyalty/users/123/history"},
		{"add points", http.MethodPost, "/api/v1/loyalty/points"},
		{"redeem points", http.MethodPost, "/api/v1/loyalty/redeem"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_ExportRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"export products", http.MethodGet, "/api/v1/export/products"},
		{"export orders", http.MethodGet, "/api/v1/export/orders"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_EmailRoutes(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/email/send", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
		t.Error("expected email/send route to be found")
	}
}

func TestRouter_SMSRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"send sms", http.MethodPost, "/api/v1/sms/send"},
		{"sms balance", http.MethodGet, "/api/v1/sms/balance"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_WarehouseRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"list warehouses", http.MethodGet, "/api/v1/warehouses"},
		{"create warehouse", http.MethodPost, "/api/v1/warehouses"},
		{"get warehouse", http.MethodGet, "/api/v1/warehouses/123"},
		{"warehouse stock", http.MethodGet, "/api/v1/warehouses/123/stock"},
		{"transfer stock", http.MethodPost, "/api/v1/warehouses/transfer"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_ERPRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"sync products", http.MethodPost, "/api/v1/erp/sync/products"},
		{"sync orders", http.MethodPost, "/api/v1/erp/sync/orders"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_MarketplaceRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"list marketplaces", http.MethodGet, "/api/v1/marketplace"},
		{"sync marketplace", http.MethodPost, "/api/v1/marketplace/sync"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_WebhookManagementRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"list webhooks", http.MethodGet, "/api/v1/webhooks"},
		{"create webhook", http.MethodPost, "/api/v1/webhooks"},
		{"delete webhook", http.MethodDelete, "/api/v1/webhooks/123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_ExtendedAnalyticsRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"abc-xyz analysis", http.MethodGet, "/api/v1/analytics/abc-xyz"},
		{"rfm analysis", http.MethodGet, "/api/v1/analytics/rfm"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_StorageRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"upload file", http.MethodPost, "/api/v1/storage/upload"},
		{"delete file", http.MethodDelete, "/api/v1/storage/test.jpg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_I18nRoutes(t *testing.T) {
	router := setupRouter()

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"translate", http.MethodGet, "/api/v1/i18n/translate"},
		{"languages", http.MethodGet, "/api/v1/i18n/languages"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
				t.Errorf("expected route to be found: %s %s", tt.method, tt.path)
			}
		})
	}
}

func TestRouter_LogisticsRoutes(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/logistics/providers", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
		t.Error("expected logistics/providers route to be found")
	}
}

func TestRouter_AlertsRoutes(t *testing.T) {
	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code == http.StatusNotFound && w.Body.String() == "Not Found\n" {
		t.Error("expected alerts route to be found")
	}
}

func TestRegisterRoutes(t *testing.T) {
	mux := http.NewServeMux()
	repo := NewMockRepository()
	catRepo := NewMockCategoryRepository()
	service := pim.NewService(repo, catRepo)

	RegisterRoutes(mux, service)

	// Test that routes are registered
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}
