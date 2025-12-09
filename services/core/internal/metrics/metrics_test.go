package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestHTTPMetrics_Initialization(t *testing.T) {
	// Metrics should be initialized via promauto
	if HTTPRequestsTotal == nil {
		t.Error("HTTPRequestsTotal should be initialized")
	}
	if HTTPRequestDuration == nil {
		t.Error("HTTPRequestDuration should be initialized")
	}
	if HTTPRequestsInFlight == nil {
		t.Error("HTTPRequestsInFlight should be initialized")
	}
}

func TestBusinessMetrics_Initialization(t *testing.T) {
	if ProductsTotal == nil {
		t.Error("ProductsTotal should be initialized")
	}
	if ProductsOutOfStock == nil {
		t.Error("ProductsOutOfStock should be initialized")
	}
	if CartItemsTotal == nil {
		t.Error("CartItemsTotal should be initialized")
	}
	if WishlistItemsTotal == nil {
		t.Error("WishlistItemsTotal should be initialized")
	}
}

func TestCacheMetrics_Initialization(t *testing.T) {
	if CacheHits == nil {
		t.Error("CacheHits should be initialized")
	}
	if CacheMisses == nil {
		t.Error("CacheMisses should be initialized")
	}
	if CacheOperationDuration == nil {
		t.Error("CacheOperationDuration should be initialized")
	}
}

func TestDBMetrics_Initialization(t *testing.T) {
	if DBQueriesTotal == nil {
		t.Error("DBQueriesTotal should be initialized")
	}
	if DBQueryDuration == nil {
		t.Error("DBQueryDuration should be initialized")
	}
	if DBConnectionsOpen == nil {
		t.Error("DBConnectionsOpen should be initialized")
	}
	if DBConnectionsInUse == nil {
		t.Error("DBConnectionsInUse should be initialized")
	}
}

func TestRecordHTTPRequest(t *testing.T) {
	// Record some requests
	RecordHTTPRequest("GET", "/products", "200", 0.1)
	RecordHTTPRequest("POST", "/products", "201", 0.2)
	RecordHTTPRequest("GET", "/products/{id}", "404", 0.05)

	// Verify counter was incremented
	count := testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("GET", "/products", "200"))
	if count < 1 {
		t.Errorf("expected at least 1 request recorded, got %f", count)
	}
}

func TestRecordCacheHit(t *testing.T) {
	initialCount := testutil.ToFloat64(CacheHits.WithLabelValues("redis"))

	RecordCacheHit("redis")
	RecordCacheHit("redis")

	newCount := testutil.ToFloat64(CacheHits.WithLabelValues("redis"))
	if newCount != initialCount+2 {
		t.Errorf("expected count to increase by 2, got %f -> %f", initialCount, newCount)
	}
}

func TestRecordCacheMiss(t *testing.T) {
	initialCount := testutil.ToFloat64(CacheMisses.WithLabelValues("redis"))

	RecordCacheMiss("redis")
	RecordCacheMiss("redis")
	RecordCacheMiss("redis")

	newCount := testutil.ToFloat64(CacheMisses.WithLabelValues("redis"))
	if newCount != initialCount+3 {
		t.Errorf("expected count to increase by 3, got %f -> %f", initialCount, newCount)
	}
}

func TestRecordDBQuery(t *testing.T) {
	initialCount := testutil.ToFloat64(DBQueriesTotal.WithLabelValues("SELECT"))

	RecordDBQuery("SELECT", 0.01)
	RecordDBQuery("SELECT", 0.02)

	newCount := testutil.ToFloat64(DBQueriesTotal.WithLabelValues("SELECT"))
	if newCount != initialCount+2 {
		t.Errorf("expected count to increase by 2, got %f -> %f", initialCount, newCount)
	}
}

func TestUpdateProductMetrics(t *testing.T) {
	UpdateProductMetrics(100, 5)

	total := testutil.ToFloat64(ProductsTotal)
	if total != 100 {
		t.Errorf("expected ProductsTotal 100, got %f", total)
	}

	outOfStock := testutil.ToFloat64(ProductsOutOfStock)
	if outOfStock != 5 {
		t.Errorf("expected ProductsOutOfStock 5, got %f", outOfStock)
	}
}

func TestRecordPriceChange(t *testing.T) {
	initialCount := testutil.ToFloat64(PriceChangesTotal)

	RecordPriceChange()
	RecordPriceChange()

	newCount := testutil.ToFloat64(PriceChangesTotal)
	if newCount != initialCount+2 {
		t.Errorf("expected count to increase by 2, got %f -> %f", initialCount, newCount)
	}
}

func TestHTTPRequestsInFlight(t *testing.T) {
	initialValue := testutil.ToFloat64(HTTPRequestsInFlight)

	HTTPRequestsInFlight.Inc()
	HTTPRequestsInFlight.Inc()

	currentValue := testutil.ToFloat64(HTTPRequestsInFlight)
	if currentValue != initialValue+2 {
		t.Errorf("expected in-flight to be %f, got %f", initialValue+2, currentValue)
	}

	HTTPRequestsInFlight.Dec()
	HTTPRequestsInFlight.Dec()

	finalValue := testutil.ToFloat64(HTTPRequestsInFlight)
	if finalValue != initialValue {
		t.Errorf("expected in-flight to return to %f, got %f", initialValue, finalValue)
	}
}

func TestDBConnectionMetrics(t *testing.T) {
	DBConnectionsOpen.Set(10)
	DBConnectionsInUse.Set(5)

	openValue := testutil.ToFloat64(DBConnectionsOpen)
	if openValue != 10 {
		t.Errorf("expected DBConnectionsOpen 10, got %f", openValue)
	}

	inUseValue := testutil.ToFloat64(DBConnectionsInUse)
	if inUseValue != 5 {
		t.Errorf("expected DBConnectionsInUse 5, got %f", inUseValue)
	}
}

func TestCartItemsTotal(t *testing.T) {
	CartItemsTotal.WithLabelValues("user123").Set(3)

	value := testutil.ToFloat64(CartItemsTotal.WithLabelValues("user123"))
	if value != 3 {
		t.Errorf("expected CartItemsTotal 3, got %f", value)
	}
}

func TestWishlistItemsTotal(t *testing.T) {
	WishlistItemsTotal.WithLabelValues("user456").Set(7)

	value := testutil.ToFloat64(WishlistItemsTotal.WithLabelValues("user456"))
	if value != 7 {
		t.Errorf("expected WishlistItemsTotal 7, got %f", value)
	}
}
