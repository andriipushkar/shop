package http

import (
	"net/http"
	"strings"

	"core/internal/pim"
)

// Router handles HTTP routing for the API
type Router struct {
	productHandler   *Handler
	ordersHandler    *OrdersHandler
	paymentsHandler  *PaymentsHandler
	deliveryHandler  *DeliveryHandler
	feedHandler      *FeedHandler
	extendedHandlers *ExtendedHandlers
}

// NewRouter creates a new router with all handlers
func NewRouter(pimService *pim.Service) *Router {
	return &Router{
		productHandler:   NewHandler(pimService),
		ordersHandler:    NewOrdersHandler(pimService),
		paymentsHandler:  NewPaymentsHandler(),
		deliveryHandler:  NewDeliveryHandler(),
		feedHandler:      NewFeedHandler(pimService),
		extendedHandlers: NewExtendedHandlers(),
	}
}

// SetExtendedHandlers sets the extended handlers (for dependency injection)
func (rt *Router) SetExtendedHandlers(handlers *ExtendedHandlers) {
	rt.extendedHandlers = handlers
}

// GetExtendedHandlers returns the extended handlers for configuration
func (rt *Router) GetExtendedHandlers() *ExtendedHandlers {
	return rt.extendedHandlers
}

// ServeHTTP implements http.Handler
func (rt *Router) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	// Handle preflight requests
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := r.URL.Path

	// API versioning
	if strings.HasPrefix(path, "/api/v1") {
		path = strings.TrimPrefix(path, "/api/v1")
	} else if strings.HasPrefix(path, "/api") {
		path = strings.TrimPrefix(path, "/api")
	}

	// Route requests
	switch {
	// Products
	case path == "/products" && r.Method == http.MethodGet:
		rt.productHandler.ListProducts(w, r)
	case path == "/products" && r.Method == http.MethodPost:
		rt.productHandler.CreateProduct(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/stock"):
		rt.productHandler.UpdateStock(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/decrement"):
		rt.productHandler.DecrementStock(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/image"):
		rt.productHandler.UpdateImage(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/price-history"):
		rt.productHandler.GetPriceHistory(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/latest-price-change"):
		rt.productHandler.GetLatestPriceChange(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/reviews"):
		rt.productHandler.GetProductReviews(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/rating"):
		rt.productHandler.GetProductRating(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/similar"):
		rt.productHandler.GetSimilarProducts(w, r)
	case strings.HasPrefix(path, "/products/") && strings.HasSuffix(path, "/frequently-bought-together"):
		rt.productHandler.GetFrequentlyBoughtTogether(w, r)
	case strings.HasPrefix(path, "/products/") && r.Method == http.MethodGet:
		rt.productHandler.GetProduct(w, r)
	case strings.HasPrefix(path, "/products/") && r.Method == http.MethodPut:
		rt.productHandler.UpdateProduct(w, r)
	case strings.HasPrefix(path, "/products/") && r.Method == http.MethodDelete:
		rt.productHandler.DeleteProduct(w, r)

	// Categories
	case path == "/categories" && r.Method == http.MethodGet:
		rt.productHandler.ListCategories(w, r)
	case path == "/categories" && r.Method == http.MethodPost:
		rt.productHandler.CreateCategory(w, r)
	case strings.HasPrefix(path, "/categories/") && r.Method == http.MethodGet:
		rt.productHandler.GetCategory(w, r)
	case strings.HasPrefix(path, "/categories/") && r.Method == http.MethodDelete:
		rt.productHandler.DeleteCategory(w, r)

	// Cart
	case strings.HasPrefix(path, "/cart/") && strings.Contains(path, "/item/") && strings.HasSuffix(path, "/to-cart"):
		rt.productHandler.MoveWishlistToCart(w, r)
	case strings.HasPrefix(path, "/cart/") && strings.Contains(path, "/item/") && r.Method == http.MethodDelete:
		rt.productHandler.RemoveFromCart(w, r)
	case strings.HasPrefix(path, "/cart/") && strings.Contains(path, "/item/") && r.Method == http.MethodPatch:
		rt.productHandler.UpdateCartItemQuantity(w, r)
	case strings.HasPrefix(path, "/cart/") && r.Method == http.MethodPost:
		rt.productHandler.AddToCart(w, r)
	case strings.HasPrefix(path, "/cart/") && r.Method == http.MethodGet:
		rt.productHandler.GetCart(w, r)
	case strings.HasPrefix(path, "/cart/") && r.Method == http.MethodDelete:
		rt.productHandler.ClearCart(w, r)

	// Wishlist
	case strings.HasPrefix(path, "/wishlist/") && strings.Contains(path, "/item/") && strings.HasSuffix(path, "/to-cart"):
		rt.productHandler.MoveWishlistToCart(w, r)
	case strings.HasPrefix(path, "/wishlist/") && strings.Contains(path, "/item/") && r.Method == http.MethodDelete:
		rt.productHandler.RemoveFromWishlist(w, r)
	case strings.HasPrefix(path, "/wishlist/") && strings.Contains(path, "/item/") && r.Method == http.MethodGet:
		rt.productHandler.IsInWishlist(w, r)
	case strings.HasPrefix(path, "/wishlist/") && r.Method == http.MethodPost:
		rt.productHandler.AddToWishlist(w, r)
	case strings.HasPrefix(path, "/wishlist/") && r.Method == http.MethodGet:
		rt.productHandler.GetWishlist(w, r)
	case strings.HasPrefix(path, "/wishlist/") && r.Method == http.MethodDelete:
		rt.productHandler.ClearWishlist(w, r)

	// Reviews
	case path == "/reviews" && r.Method == http.MethodPost:
		rt.productHandler.CreateReview(w, r)
	case strings.HasPrefix(path, "/reviews/") && r.Method == http.MethodGet:
		rt.productHandler.GetReview(w, r)
	case strings.HasPrefix(path, "/reviews/") && r.Method == http.MethodDelete:
		rt.productHandler.DeleteReview(w, r)

	// Users
	case strings.HasPrefix(path, "/users/") && strings.HasSuffix(path, "/reviews"):
		rt.productHandler.GetUserReviews(w, r)
	case strings.HasPrefix(path, "/users/") && strings.HasSuffix(path, "/recommendations"):
		rt.productHandler.GetPersonalizedRecommendations(w, r)
	case strings.HasPrefix(path, "/users/") && strings.HasSuffix(path, "/orders"):
		rt.ordersHandler.GetUserOrders(w, r)

	// Orders
	case path == "/orders" && r.Method == http.MethodGet:
		rt.ordersHandler.ListOrders(w, r)
	case path == "/orders" && r.Method == http.MethodPost:
		rt.ordersHandler.CreateOrder(w, r)
	case path == "/orders/stats" && r.Method == http.MethodGet:
		rt.ordersHandler.GetOrderStats(w, r)
	case strings.HasPrefix(path, "/orders/") && strings.HasSuffix(path, "/status"):
		rt.ordersHandler.UpdateOrderStatus(w, r)
	case strings.HasPrefix(path, "/orders/") && strings.HasSuffix(path, "/cancel"):
		rt.ordersHandler.CancelOrder(w, r)
	case strings.HasPrefix(path, "/orders/") && strings.HasSuffix(path, "/payments"):
		rt.paymentsHandler.GetOrderPayments(w, r)
	case strings.HasPrefix(path, "/orders/") && r.Method == http.MethodGet:
		rt.ordersHandler.GetOrder(w, r)

	// Payments
	case path == "/payments" && r.Method == http.MethodPost:
		rt.paymentsHandler.InitiatePayment(w, r)
	case path == "/payments/methods" && r.Method == http.MethodGet:
		rt.paymentsHandler.GetPaymentMethods(w, r)
	case strings.HasPrefix(path, "/payments/") && strings.HasSuffix(path, "/refund"):
		rt.paymentsHandler.RefundPayment(w, r)
	case strings.HasPrefix(path, "/payments/") && r.Method == http.MethodGet:
		rt.paymentsHandler.GetPayment(w, r)

	// Payment Webhooks
	case strings.HasPrefix(path, "/webhooks/payments/"):
		rt.paymentsHandler.ProcessWebhook(w, r)

	// Delivery/Shipments
	case path == "/shipments" && r.Method == http.MethodPost:
		rt.deliveryHandler.CreateShipment(w, r)
	case path == "/shipments/track" && r.Method == http.MethodGet:
		rt.deliveryHandler.TrackShipment(w, r)
	case strings.HasPrefix(path, "/shipments/") && strings.HasSuffix(path, "/label"):
		rt.deliveryHandler.PrintLabel(w, r)
	case strings.HasPrefix(path, "/shipments/") && strings.HasSuffix(path, "/cancel"):
		rt.deliveryHandler.CancelShipment(w, r)
	case strings.HasPrefix(path, "/shipments/") && r.Method == http.MethodGet:
		rt.deliveryHandler.GetShipment(w, r)

	// Delivery Providers
	case path == "/delivery/providers" && r.Method == http.MethodGet:
		rt.deliveryHandler.GetDeliveryProviders(w, r)
	case path == "/delivery/calculate" && r.Method == http.MethodPost:
		rt.deliveryHandler.CalculateDeliveryCost(w, r)
	case path == "/delivery/cities" && r.Method == http.MethodGet:
		rt.deliveryHandler.SearchCities(w, r)
	case path == "/delivery/warehouses" && r.Method == http.MethodGet:
		rt.deliveryHandler.GetWarehouses(w, r)

	// Inventory
	case path == "/inventory/low-stock" && r.Method == http.MethodGet:
		rt.productHandler.GetLowStockProducts(w, r)
	case path == "/inventory/out-of-stock" && r.Method == http.MethodGet:
		rt.productHandler.GetOutOfStockProducts(w, r)
	case path == "/inventory/stats" && r.Method == http.MethodGet:
		rt.productHandler.GetInventoryStats(w, r)

	// Analytics
	case path == "/analytics/dashboard" && r.Method == http.MethodGet:
		rt.productHandler.GetAnalyticsDashboard(w, r)
	case path == "/analytics/top-selling" && r.Method == http.MethodGet:
		rt.productHandler.GetTopSellingProducts(w, r)
	case path == "/analytics/daily-sales" && r.Method == http.MethodGet:
		rt.productHandler.GetDailySalesReport(w, r)
	case path == "/analytics/sales-by-category" && r.Method == http.MethodGet:
		rt.productHandler.GetSalesByCategory(w, r)

	// Search
	case path == "/search" && r.Method == http.MethodGet:
		rt.productHandler.SearchProducts(w, r)
	case path == "/search/suggest" && r.Method == http.MethodGet:
		rt.productHandler.SearchSuggest(w, r)
	case path == "/search/reindex" && r.Method == http.MethodPost:
		rt.productHandler.ReindexProducts(w, r)

	// Recommendations
	case path == "/recommendations/popular" && r.Method == http.MethodGet:
		rt.productHandler.GetPopularProducts(w, r)

	// Feeds
	case path == "/feeds/yml" && r.Method == http.MethodGet:
		rt.feedHandler.GenerateYMLFeed(w, r)
	case path == "/feeds/google" && r.Method == http.MethodGet:
		rt.feedHandler.GenerateGoogleFeed(w, r)
	case path == "/feeds/facebook" && r.Method == http.MethodGet:
		rt.feedHandler.GenerateFacebookFeed(w, r)

	// ========== Extended Module Routes ==========

	// Auth
	case path == "/auth/login" && r.Method == http.MethodPost:
		rt.extendedHandlers.Login(w, r)
	case path == "/auth/register" && r.Method == http.MethodPost:
		rt.extendedHandlers.Register(w, r)

	// Loyalty
	case strings.HasPrefix(path, "/loyalty/users/") && strings.HasSuffix(path, "/balance"):
		rt.extendedHandlers.GetLoyaltyBalance(w, r)
	case strings.HasPrefix(path, "/loyalty/users/") && strings.HasSuffix(path, "/history"):
		rt.extendedHandlers.GetLoyaltyHistory(w, r)
	case path == "/loyalty/points" && r.Method == http.MethodPost:
		rt.extendedHandlers.AddLoyaltyPoints(w, r)
	case path == "/loyalty/redeem" && r.Method == http.MethodPost:
		rt.extendedHandlers.RedeemLoyaltyPoints(w, r)

	// Export
	case path == "/export/products" && r.Method == http.MethodGet:
		rt.extendedHandlers.ExportProducts(w, r)
	case path == "/export/orders" && r.Method == http.MethodGet:
		rt.extendedHandlers.ExportOrders(w, r)

	// Email
	case path == "/email/send" && r.Method == http.MethodPost:
		rt.extendedHandlers.SendEmail(w, r)

	// SMS
	case path == "/sms/send" && r.Method == http.MethodPost:
		rt.extendedHandlers.SendSMS(w, r)
	case path == "/sms/balance" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetSMSBalance(w, r)

	// Warehouses
	case path == "/warehouses" && r.Method == http.MethodGet:
		rt.extendedHandlers.ListWarehouses(w, r)
	case path == "/warehouses" && r.Method == http.MethodPost:
		rt.extendedHandlers.CreateWarehouse(w, r)
	case strings.HasPrefix(path, "/warehouses/") && strings.HasSuffix(path, "/stock"):
		rt.extendedHandlers.GetWarehouseStock(w, r)
	case strings.HasPrefix(path, "/warehouses/") && r.Method == http.MethodGet:
		rt.extendedHandlers.GetWarehouse(w, r)
	case path == "/warehouses/transfer" && r.Method == http.MethodPost:
		rt.extendedHandlers.TransferStock(w, r)

	// ERP
	case path == "/erp/sync/products" && r.Method == http.MethodPost:
		rt.extendedHandlers.SyncERPProducts(w, r)
	case path == "/erp/sync/orders" && r.Method == http.MethodPost:
		rt.extendedHandlers.SyncERPOrders(w, r)

	// Marketplace
	case path == "/marketplace" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetMarketplaces(w, r)
	case path == "/marketplace/sync" && r.Method == http.MethodPost:
		rt.extendedHandlers.SyncMarketplace(w, r)

	// Webhooks Management
	case path == "/webhooks" && r.Method == http.MethodGet:
		rt.extendedHandlers.ListWebhooks(w, r)
	case path == "/webhooks" && r.Method == http.MethodPost:
		rt.extendedHandlers.CreateWebhook(w, r)
	case strings.HasPrefix(path, "/webhooks/") && r.Method == http.MethodDelete:
		rt.extendedHandlers.DeleteWebhook(w, r)

	// Analytics Extended
	case path == "/analytics/abc-xyz" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetABCXYZAnalysis(w, r)
	case path == "/analytics/rfm" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetRFMAnalysis(w, r)

	// Storage
	case path == "/storage/upload" && r.Method == http.MethodPost:
		rt.extendedHandlers.UploadFile(w, r)
	case strings.HasPrefix(path, "/storage/") && r.Method == http.MethodDelete:
		rt.extendedHandlers.DeleteFile(w, r)

	// i18n
	case path == "/i18n/translate" && r.Method == http.MethodGet:
		rt.extendedHandlers.Translate(w, r)
	case path == "/i18n/languages" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetTranslations(w, r)

	// Logistics
	case path == "/logistics/providers" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetLogisticsProviders(w, r)

	// Alerts
	case path == "/alerts" && r.Method == http.MethodGet:
		rt.extendedHandlers.GetAlerts(w, r)

	// Health
	case path == "/health" || path == "/healthz":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))

	// Ready
	case path == "/ready" || path == "/readyz":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))

	default:
		http.Error(w, "Not Found", http.StatusNotFound)
	}
}

// RegisterRoutes registers all routes with the given mux
func RegisterRoutes(mux *http.ServeMux, pimService *pim.Service) {
	router := NewRouter(pimService)
	mux.Handle("/", router)
}
