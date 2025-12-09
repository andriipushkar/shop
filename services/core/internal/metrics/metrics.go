package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"method", "path"},
	)

	HTTPRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)

	// Business metrics
	ProductsTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "products_total",
			Help: "Total number of products in catalog",
		},
	)

	ProductsOutOfStock = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "products_out_of_stock",
			Help: "Number of products with zero stock",
		},
	)

	CartItemsTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cart_items_total",
			Help: "Total number of items in carts",
		},
		[]string{"user_id"},
	)

	WishlistItemsTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "wishlist_items_total",
			Help: "Total number of items in wishlists",
		},
		[]string{"user_id"},
	)

	// Cache metrics
	CacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_type"},
	)

	CacheMisses = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_type"},
	)

	CacheOperationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "cache_operation_duration_seconds",
			Help:    "Cache operation latency in seconds",
			Buckets: []float64{.0001, .0005, .001, .005, .01, .025, .05, .1},
		},
		[]string{"operation", "cache_type"},
	)

	// Database metrics
	DBQueriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "db_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"query_type"},
	)

	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query latency in seconds",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5},
		},
		[]string{"query_type"},
	)

	DBConnectionsOpen = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_connections_open",
			Help: "Number of open database connections",
		},
	)

	DBConnectionsInUse = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_connections_in_use",
			Help: "Number of database connections in use",
		},
	)

	// Price changes
	PriceChangesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "price_changes_total",
			Help: "Total number of product price changes",
		},
	)
)

// RecordHTTPRequest records HTTP request metrics
func RecordHTTPRequest(method, path, status string, duration float64) {
	HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
	HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
}

// RecordCacheHit records a cache hit
func RecordCacheHit(cacheType string) {
	CacheHits.WithLabelValues(cacheType).Inc()
}

// RecordCacheMiss records a cache miss
func RecordCacheMiss(cacheType string) {
	CacheMisses.WithLabelValues(cacheType).Inc()
}

// RecordDBQuery records database query metrics
func RecordDBQuery(queryType string, duration float64) {
	DBQueriesTotal.WithLabelValues(queryType).Inc()
	DBQueryDuration.WithLabelValues(queryType).Observe(duration)
}

// UpdateProductMetrics updates product-related metrics
func UpdateProductMetrics(total, outOfStock int) {
	ProductsTotal.Set(float64(total))
	ProductsOutOfStock.Set(float64(outOfStock))
}

// RecordPriceChange records a price change event
func RecordPriceChange() {
	PriceChangesTotal.Inc()
}
