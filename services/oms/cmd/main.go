package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"github.com/streadway/amqp"
)

// Validation patterns
var (
	phoneRegex = regexp.MustCompile(`^(\+?38)?0\d{9}$`)
)

// Rate limiter
type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.RWMutex
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
	// Cleanup old entries periodically
	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			rl.cleanup()
		}
	}()
	return rl
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Filter old requests
	var recent []time.Time
	for _, t := range rl.requests[key] {
		if t.After(windowStart) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= rl.limit {
		rl.requests[key] = recent
		return false
	}

	rl.requests[key] = append(recent, now)
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	for key, times := range rl.requests {
		var recent []time.Time
		for _, t := range times {
			if t.After(windowStart) {
				recent = append(recent, t)
			}
		}
		if len(recent) == 0 {
			delete(rl.requests, key)
		} else {
			rl.requests[key] = recent
		}
	}
}

// Validation functions
func validatePhone(phone string) error {
	if phone == "" {
		return fmt.Errorf("phone is required")
	}
	// Remove spaces and dashes
	cleaned := strings.ReplaceAll(phone, " ", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")

	if !phoneRegex.MatchString(cleaned) {
		return fmt.Errorf("invalid phone format, use Ukrainian format: +380XXXXXXXXX or 0XXXXXXXXX")
	}
	return nil
}

func validateAddress(address string) error {
	if address == "" {
		return fmt.Errorf("address is required")
	}
	if len(address) < 10 {
		return fmt.Errorf("address too short, minimum 10 characters")
	}
	if len(address) > 500 {
		return fmt.Errorf("address too long, maximum 500 characters")
	}
	return nil
}

func sanitizeInput(input string) string {
	// Remove potential XSS characters
	input = strings.ReplaceAll(input, "<", "&lt;")
	input = strings.ReplaceAll(input, ">", "&gt;")
	input = strings.ReplaceAll(input, "\"", "&quot;")
	input = strings.TrimSpace(input)
	return input
}

var coreServiceURL string

type Order struct {
	ID             string    `json:"id"`
	ProductID      string    `json:"product_id"`
	ProductName    string    `json:"product_name,omitempty"`
	Quantity       int       `json:"quantity"`
	TotalAmount    float64   `json:"total_amount,omitempty"`
	Status         string    `json:"status"`
	PaymentStatus  string    `json:"payment_status,omitempty"`
	PaymentURL     string    `json:"payment_url,omitempty"`
	UserID         int64     `json:"user_id"`
	Phone          string    `json:"phone,omitempty"`
	Address        string    `json:"address,omitempty"`
	PromoCode      string    `json:"promo_code,omitempty"`
	Discount       float64   `json:"discount,omitempty"`
	TrackingNum    string    `json:"tracking_num,omitempty"`
	DeliveryNote   string    `json:"delivery_note,omitempty"`
	IdempotencyKey string    `json:"idempotency_key,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type PromoCode struct {
	Code       string  `json:"code"`
	Discount   float64 `json:"discount"` // percentage 0-100
	MaxUses    int     `json:"max_uses"`
	UsedCount  int     `json:"used_count"`
	Active     bool    `json:"active"`
}

func main() {
	log.Println("Starting OMS Service...")

	coreServiceURL = os.Getenv("CORE_SERVICE_URL")
	if coreServiceURL == "" {
		coreServiceURL = "http://core:8080"
	}
	log.Printf("Core service URL: %s", coreServiceURL)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	var db *sql.DB
	var err error

	// Retry connection
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", dbURL)
		if err == nil {
			if err = db.Ping(); err == nil {
				break
			}
		}
		log.Printf("Waiting for database... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Init DB
	if err := initDB(db); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	// Connect to RabbitMQ
	rabbitURL := os.Getenv("RABBITMQ_URL")
	var rabbitConn *amqp.Connection
	var rabbitCh *amqp.Channel
	
	if rabbitURL != "" {
		for i := 0; i < 10; i++ {
			rabbitConn, err = amqp.Dial(rabbitURL)
			if err == nil {
				break
			}
			log.Printf("Waiting for RabbitMQ... (%d/10)", i+1)
			time.Sleep(2 * time.Second)
		}
		if err != nil {
			log.Printf("Warning: Failed to connect to RabbitMQ: %v", err)
		} else {
			rabbitCh, err = rabbitConn.Channel()
			if err != nil {
				log.Printf("Warning: Failed to open channel: %v", err)
			} else {
				_, err = rabbitCh.QueueDeclare("order.created", true, false, false, false, nil)
				if err != nil {
					log.Printf("Warning: Failed to declare queue: %v", err)
				}
				_, err = rabbitCh.QueueDeclare("order.status.updated", true, false, false, false, nil)
				if err != nil {
					log.Printf("Warning: Failed to declare status queue: %v", err)
				} else {
					log.Println("Connected to RabbitMQ")
				}
			}
		}
	}

	// Initialize rate limiters
	orderLimiter := NewRateLimiter(10, time.Minute)    // 10 orders per minute per user
	promoLimiter := NewRateLimiter(20, time.Minute)    // 20 promo checks per minute per IP

	http.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			// Rate limit by user_id or IP
			clientKey := r.RemoteAddr
			if !orderLimiter.Allow(clientKey) {
				http.Error(w, "Too many requests, please try again later", http.StatusTooManyRequests)
				return
			}
			createOrder(w, r, db, rabbitCh)
		case http.MethodGet:
			listOrders(w, r, db)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/orders/", func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/user/") {
			if r.Method == http.MethodGet {
				listUserOrders(w, r, db)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(r.URL.Path, "/tracking") {
			if r.Method == http.MethodPatch {
				updateOrderTracking(w, r, db, rabbitCh)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(r.URL.Path, "/cancel") {
			if r.Method == http.MethodPost {
				cancelOrder(w, r, db, rabbitCh)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if r.Method == http.MethodPatch {
			updateOrderStatus(w, r, db, rabbitCh)
		} else if r.Method == http.MethodGet {
			getOrder(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getStats(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/promo", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			createPromoCode(w, r, db)
		case http.MethodGet:
			listPromoCodes(w, r, db)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/promo/validate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodGet {
			// Rate limit promo validation to prevent brute force
			clientKey := r.RemoteAddr
			if !promoLimiter.Allow(clientKey) {
				http.Error(w, "Too many requests, please try again later", http.StatusTooManyRequests)
				return
			}
			validatePromoCode(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/promo/use", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			usePromoCodeHandler(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Payment endpoints
	http.HandleFunc("/payments/create", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			createPayment(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/payments/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handlePaymentWebhook(w, r, db, rabbitCh)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/payments/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getPaymentStatus(w, r, db)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Nova Poshta endpoints
	http.HandleFunc("/np/cities", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			searchCities(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/np/warehouses", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			searchWarehouses(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/np/track", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			trackParcel(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("OMS listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initDB(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS orders (
		id TEXT PRIMARY KEY,
		product_id TEXT NOT NULL,
		product_name TEXT,
		quantity INT NOT NULL,
		status TEXT NOT NULL,
		user_id BIGINT,
		phone TEXT,
		address TEXT,
		promo_code TEXT,
		discount DECIMAL DEFAULT 0,
		created_at TIMESTAMP NOT NULL
	);`
	_, err := db.Exec(query)
	if err != nil {
		return err
	}
	// Add new columns if they don't exist (for existing databases)
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL DEFAULT 0")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_num TEXT")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT")

	// Promo codes table
	promoQuery := `
	CREATE TABLE IF NOT EXISTS promo_codes (
		code TEXT PRIMARY KEY,
		discount DECIMAL NOT NULL,
		max_uses INT DEFAULT 0,
		used_count INT DEFAULT 0,
		active BOOLEAN DEFAULT true
	);`
	db.Exec(promoQuery)

	// Idempotency keys table (for preventing duplicate orders)
	idempotencyQuery := `
	CREATE TABLE IF NOT EXISTS idempotency_keys (
		key TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL
	);`
	db.Exec(idempotencyQuery)

	// Clean up old idempotency keys (older than 24 hours)
	db.Exec("DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'")

	// Payments table
	paymentQuery := `
	CREATE TABLE IF NOT EXISTS payments (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		invoice_id TEXT UNIQUE,
		amount BIGINT NOT NULL,
		status TEXT NOT NULL DEFAULT 'created',
		payment_url TEXT,
		failure_reason TEXT,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);`
	db.Exec(paymentQuery)

	// Add payment columns to orders if not exist
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL DEFAULT 0")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'")
	db.Exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url TEXT")

	return nil
}

type Product struct {
	ID    string  `json:"id"`
	Stock int     `json:"stock"`
	Price float64 `json:"price"`
	Name  string  `json:"name"`
}

func checkStock(productID string, quantity int) (*Product, error) {
	resp, err := http.Get(fmt.Sprintf("%s/products/%s", coreServiceURL, productID))
	if err != nil {
		return nil, fmt.Errorf("failed to check stock: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("product not found")
	}

	var product Product
	if err := json.NewDecoder(resp.Body).Decode(&product); err != nil {
		return nil, fmt.Errorf("failed to decode product: %v", err)
	}

	if product.Stock < quantity {
		return nil, fmt.Errorf("insufficient stock: available %d, requested %d", product.Stock, quantity)
	}

	return &product, nil
}

func decrementStock(productID string, quantity int) error {
	body, _ := json.Marshal(map[string]int{"quantity": quantity})
	resp, err := http.Post(
		fmt.Sprintf("%s/products/%s/decrement", coreServiceURL, productID),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("failed to decrement stock: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to decrement stock: status %d", resp.StatusCode)
	}

	return nil
}

func incrementStock(productID string, quantity int) error {
	body, _ := json.Marshal(map[string]int{"stock": quantity})
	req, err := http.NewRequest(
		http.MethodPatch,
		fmt.Sprintf("%s/products/%s/stock", coreServiceURL, productID),
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Get current stock and add quantity back
	product, err := checkStock(productID, 0)
	if err != nil {
		return fmt.Errorf("failed to get product: %v", err)
	}

	newStock := product.Stock + quantity
	body, _ = json.Marshal(map[string]int{"stock": newStock})
	req, _ = http.NewRequest(
		http.MethodPatch,
		fmt.Sprintf("%s/products/%s/stock", coreServiceURL, productID),
		bytes.NewReader(body),
	)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to increment stock: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to increment stock: status %d", resp.StatusCode)
	}

	return nil
}

func createOrder(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	var o Order
	if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// Validate and sanitize inputs
	if err := validatePhone(o.Phone); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateAddress(o.Address); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Sanitize inputs
	o.Phone = sanitizeInput(o.Phone)
	o.Address = sanitizeInput(o.Address)

	// Validate product and quantity
	if o.ProductID == "" {
		http.Error(w, "product_id is required", http.StatusBadRequest)
		return
	}
	if o.Quantity <= 0 {
		http.Error(w, "quantity must be positive", http.StatusBadRequest)
		return
	}

	// Check idempotency key to prevent duplicate orders
	if o.IdempotencyKey != "" {
		var existingOrderID string
		err := db.QueryRow("SELECT order_id FROM idempotency_keys WHERE key = $1", o.IdempotencyKey).Scan(&existingOrderID)
		if err == nil {
			// Key exists - return existing order
			var existingOrder Order
			err = db.QueryRow("SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id, COALESCE(phone, ''), COALESCE(address, ''), COALESCE(promo_code, ''), discount, created_at FROM orders WHERE id = $1", existingOrderID).
				Scan(&existingOrder.ID, &existingOrder.ProductID, &existingOrder.ProductName, &existingOrder.Quantity, &existingOrder.Status, &existingOrder.UserID, &existingOrder.Phone, &existingOrder.Address, &existingOrder.PromoCode, &existingOrder.Discount, &existingOrder.CreatedAt)
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK) // Return 200 for idempotent request
				json.NewEncoder(w).Encode(existingOrder)
				return
			}
		}
	}

	// Check stock availability and get product info
	product, err := checkStock(o.ProductID, o.Quantity)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Decrement stock
	if err := decrementStock(o.ProductID, o.Quantity); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	o.ID = fmt.Sprintf("ORD-%d", time.Now().UnixNano())
	o.Status = "NEW"
	o.ProductName = product.Name
	o.CreatedAt = time.Now()

	query := `INSERT INTO orders (id, product_id, product_name, quantity, status, user_id, phone, address, promo_code, discount, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err = db.Exec(query, o.ID, o.ProductID, o.ProductName, o.Quantity, o.Status, o.UserID, o.Phone, o.Address, o.PromoCode, o.Discount, o.CreatedAt)
	if err != nil {
		// Rollback stock decrement on failure
		if rollbackErr := incrementStock(o.ProductID, o.Quantity); rollbackErr != nil {
			log.Printf("CRITICAL: Failed to rollback stock for product %s: %v", o.ProductID, rollbackErr)
		}
		http.Error(w, "Failed to save order: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Store idempotency key
	if o.IdempotencyKey != "" {
		db.Exec("INSERT INTO idempotency_keys (key, order_id, created_at) VALUES ($1, $2, $3)", o.IdempotencyKey, o.ID, time.Now())
	}

	// Publish event to RabbitMQ
	if rabbitCh != nil {
		eventData, _ := json.Marshal(o)
		err := rabbitCh.Publish("", "order.created", false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		})
		if err != nil {
			log.Printf("Failed to publish event: %v", err)
		} else {
			log.Printf("Published order.created event for %s", o.ID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(o)
}

func listOrders(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	rows, err := db.Query("SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id, COALESCE(phone, ''), COALESCE(address, ''), created_at FROM orders ORDER BY created_at DESC LIMIT 20")
	if err != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID, &o.Phone, &o.Address, &o.CreatedAt); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

type StatusUpdateRequest struct {
	Status string `json:"status"`
}

func updateOrderStatus(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	// Extract order ID from path: /orders/{id}/status
	path := strings.TrimPrefix(r.URL.Path, "/orders/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 {
		http.Error(w, "Order ID required", http.StatusBadRequest)
		return
	}
	orderID := parts[0]

	var req StatusUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := map[string]bool{"NEW": true, "PROCESSING": true, "DELIVERED": true, "CANCELLED": true}
	if !validStatuses[req.Status] {
		http.Error(w, "Invalid status. Use: NEW, PROCESSING, DELIVERED, CANCELLED", http.StatusBadRequest)
		return
	}

	// Update in database
	result, err := db.Exec("UPDATE orders SET status = $1 WHERE id = $2", req.Status, orderID)
	if err != nil {
		http.Error(w, "Failed to update order", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Get updated order for event
	var o Order
	err = db.QueryRow("SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id, COALESCE(phone, ''), COALESCE(address, ''), created_at FROM orders WHERE id = $1", orderID).
		Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID, &o.Phone, &o.Address, &o.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to fetch updated order", http.StatusInternalServerError)
		return
	}

	// Publish status update event
	if rabbitCh != nil {
		eventData, _ := json.Marshal(o)
		err := rabbitCh.Publish("", "order.status.updated", false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		})
		if err != nil {
			log.Printf("Failed to publish status event: %v", err)
		} else {
			log.Printf("Published order.status.updated event for %s -> %s", o.ID, o.Status)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

func listUserOrders(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	// Extract user ID from path: /orders/user/{userID}
	path := strings.TrimPrefix(r.URL.Path, "/orders/user/")
	userID := path

	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	rows, err := db.Query("SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id, COALESCE(phone, ''), COALESCE(address, ''), created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10", userID)
	if err != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID, &o.Phone, &o.Address, &o.CreatedAt); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

type Stats struct {
	TotalOrders      int            `json:"total_orders"`
	TotalRevenue     float64        `json:"total_revenue"`
	OrdersByStatus   map[string]int `json:"orders_by_status"`
	TopProducts      []ProductStat  `json:"top_products"`
	OrdersToday      int            `json:"orders_today"`
	OrdersThisWeek   int            `json:"orders_this_week"`
	OrdersThisMonth  int            `json:"orders_this_month"`
}

type ProductStat struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	TotalSold   int    `json:"total_sold"`
}

func getStats(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	stats := Stats{
		OrdersByStatus: make(map[string]int),
	}

	// Total orders
	db.QueryRow("SELECT COUNT(*) FROM orders").Scan(&stats.TotalOrders)

	// Orders by status
	rows, err := db.Query("SELECT status, COUNT(*) FROM orders GROUP BY status")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			if rows.Scan(&status, &count) == nil {
				stats.OrdersByStatus[status] = count
			}
		}
	}

	// Top products
	rows, err = db.Query(`
		SELECT product_id, COALESCE(product_name, product_id), SUM(quantity) as total
		FROM orders
		GROUP BY product_id, product_name
		ORDER BY total DESC
		LIMIT 5
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ps ProductStat
			if rows.Scan(&ps.ProductID, &ps.ProductName, &ps.TotalSold) == nil {
				stats.TopProducts = append(stats.TopProducts, ps)
			}
		}
	}

	// Orders today
	db.QueryRow("SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE").Scan(&stats.OrdersToday)

	// Orders this week
	db.QueryRow("SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'").Scan(&stats.OrdersThisWeek)

	// Orders this month
	db.QueryRow("SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'").Scan(&stats.OrdersThisMonth)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Promo code handlers

func createPromoCode(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	var promo PromoCode
	if err := json.NewDecoder(r.Body).Decode(&promo); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if promo.Code == "" || promo.Discount <= 0 || promo.Discount > 100 {
		http.Error(w, "Invalid promo code: code required, discount must be 1-100", http.StatusBadRequest)
		return
	}

	promo.Code = strings.ToUpper(promo.Code)
	promo.Active = true

	_, err := db.Exec("INSERT INTO promo_codes (code, discount, max_uses, used_count, active) VALUES ($1, $2, $3, 0, true)",
		promo.Code, promo.Discount, promo.MaxUses)
	if err != nil {
		http.Error(w, "Failed to create promo code (may already exist)", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(promo)
}

func listPromoCodes(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	rows, err := db.Query("SELECT code, discount, max_uses, used_count, active FROM promo_codes ORDER BY code")
	if err != nil {
		http.Error(w, "Failed to fetch promo codes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var promos []PromoCode
	for rows.Next() {
		var p PromoCode
		if rows.Scan(&p.Code, &p.Discount, &p.MaxUses, &p.UsedCount, &p.Active) == nil {
			promos = append(promos, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(promos)
}

func validatePromoCode(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	var code string
	if r.Method == http.MethodPost {
		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}
		code = strings.ToUpper(req.Code)
	} else {
		code = strings.ToUpper(r.URL.Query().Get("code"))
	}
	if code == "" {
		http.Error(w, "Code parameter required", http.StatusBadRequest)
		return
	}

	var promo PromoCode
	err := db.QueryRow("SELECT code, discount, max_uses, used_count, active FROM promo_codes WHERE code = $1", code).
		Scan(&promo.Code, &promo.Discount, &promo.MaxUses, &promo.UsedCount, &promo.Active)
	if err != nil {
		http.Error(w, "Promo code not found", http.StatusNotFound)
		return
	}

	if !promo.Active {
		http.Error(w, "Promo code is inactive", http.StatusBadRequest)
		return
	}

	if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
		http.Error(w, "Promo code usage limit reached", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(promo)
}

func usePromoCode(db *sql.DB, code string) {
	db.Exec("UPDATE promo_codes SET used_count = used_count + 1 WHERE code = $1", strings.ToUpper(code))
}

func usePromoCodeHandler(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		http.Error(w, "Code required", http.StatusBadRequest)
		return
	}
	usePromoCode(db, req.Code)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type TrackingUpdateRequest struct {
	TrackingNum  string `json:"tracking_num"`
	DeliveryNote string `json:"delivery_note"`
}

func updateOrderTracking(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	// Extract order ID from path: /orders/{id}/tracking
	path := strings.TrimPrefix(r.URL.Path, "/orders/")
	path = strings.TrimSuffix(path, "/tracking")
	orderID := path

	var req TrackingUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// Update tracking info
	result, err := db.Exec("UPDATE orders SET tracking_num = $1, delivery_note = $2 WHERE id = $3",
		req.TrackingNum, req.DeliveryNote, orderID)
	if err != nil {
		http.Error(w, "Failed to update order", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Get order for notification
	var o Order
	db.QueryRow("SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id, COALESCE(tracking_num, ''), COALESCE(delivery_note, '') FROM orders WHERE id = $1", orderID).
		Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID, &o.TrackingNum, &o.DeliveryNote)

	// Publish tracking update event
	if rabbitCh != nil {
		eventData, _ := json.Marshal(map[string]interface{}{
			"type":          "tracking_updated",
			"order_id":      o.ID,
			"product_name":  o.ProductName,
			"tracking_num":  o.TrackingNum,
			"delivery_note": o.DeliveryNote,
			"user_id":       o.UserID,
		})
		rabbitCh.Publish("", "order.status.updated", false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// getOrder returns a single order by ID
func getOrder(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	// Extract order ID from path: /orders/{id}
	path := strings.TrimPrefix(r.URL.Path, "/orders/")
	orderID := path

	if orderID == "" {
		http.Error(w, "Order ID required", http.StatusBadRequest)
		return
	}

	var o Order
	err := db.QueryRow(`
		SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id,
		       COALESCE(phone, ''), COALESCE(address, ''), COALESCE(promo_code, ''),
		       discount, COALESCE(tracking_num, ''), COALESCE(delivery_note, ''), created_at
		FROM orders WHERE id = $1`, orderID).
		Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID,
			&o.Phone, &o.Address, &o.PromoCode, &o.Discount, &o.TrackingNum, &o.DeliveryNote, &o.CreatedAt)
	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

// cancelOrder cancels an order and restores stock
func cancelOrder(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	// Extract order ID from path: /orders/{id}/cancel
	path := strings.TrimPrefix(r.URL.Path, "/orders/")
	path = strings.TrimSuffix(path, "/cancel")
	orderID := path

	if orderID == "" {
		http.Error(w, "Order ID required", http.StatusBadRequest)
		return
	}

	// Get current order
	var o Order
	err := db.QueryRow(`
		SELECT id, product_id, COALESCE(product_name, ''), quantity, status, user_id,
		       COALESCE(phone, ''), COALESCE(address, '')
		FROM orders WHERE id = $1`, orderID).
		Scan(&o.ID, &o.ProductID, &o.ProductName, &o.Quantity, &o.Status, &o.UserID, &o.Phone, &o.Address)
	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Check if order can be cancelled
	if o.Status == "CANCELLED" {
		http.Error(w, "Order is already cancelled", http.StatusBadRequest)
		return
	}
	if o.Status == "DELIVERED" {
		http.Error(w, "Cannot cancel delivered order", http.StatusBadRequest)
		return
	}

	// Update order status to CANCELLED
	_, err = db.Exec("UPDATE orders SET status = 'CANCELLED' WHERE id = $1", orderID)
	if err != nil {
		http.Error(w, "Failed to cancel order", http.StatusInternalServerError)
		return
	}

	// Restore stock
	if err := incrementStock(o.ProductID, o.Quantity); err != nil {
		log.Printf("Warning: Failed to restore stock for cancelled order %s: %v", orderID, err)
		// Don't fail the request - order is already cancelled
	}

	o.Status = "CANCELLED"

	// Publish cancellation event
	if rabbitCh != nil {
		eventData, _ := json.Marshal(map[string]interface{}{
			"type":         "order_cancelled",
			"order_id":     o.ID,
			"product_id":   o.ProductID,
			"product_name": o.ProductName,
			"quantity":     o.Quantity,
			"user_id":      o.UserID,
		})
		rabbitCh.Publish("", "order.status.updated", false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		})
		log.Printf("Published order.cancelled event for %s", o.ID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

// Payment handlers

type CreatePaymentRequest struct {
	OrderID     string `json:"order_id"`
	RedirectURL string `json:"redirect_url,omitempty"`
}

type PaymentResponse struct {
	PaymentID  string `json:"payment_id"`
	OrderID    string `json:"order_id"`
	Amount     int64  `json:"amount"`
	Status     string `json:"status"`
	PaymentURL string `json:"payment_url"`
}

func createPayment(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	var req CreatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if req.OrderID == "" {
		http.Error(w, "order_id is required", http.StatusBadRequest)
		return
	}

	// Get order details
	var order Order
	err := db.QueryRow(`
		SELECT id, product_id, COALESCE(product_name, ''), quantity, COALESCE(total_amount, 0),
		       status, COALESCE(payment_status, 'pending'), user_id, discount
		FROM orders WHERE id = $1`, req.OrderID).
		Scan(&order.ID, &order.ProductID, &order.ProductName, &order.Quantity,
			&order.TotalAmount, &order.Status, &order.PaymentStatus, &order.UserID, &order.Discount)
	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Check if payment already exists
	var existingPaymentURL string
	err = db.QueryRow("SELECT payment_url FROM payments WHERE order_id = $1 AND status NOT IN ('failure', 'expired')", req.OrderID).
		Scan(&existingPaymentURL)
	if err == nil && existingPaymentURL != "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"payment_url": existingPaymentURL,
			"message":     "Payment already exists",
		})
		return
	}

	// Get product price if total_amount is 0
	if order.TotalAmount == 0 {
		product, err := checkStock(order.ProductID, 0)
		if err == nil {
			order.TotalAmount = product.Price * float64(order.Quantity)
			if order.Discount > 0 {
				order.TotalAmount = order.TotalAmount * (1 - order.Discount/100)
			}
		}
	}

	amountKopecks := int64(order.TotalAmount * 100)

	monoToken := os.Getenv("MONO_TOKEN")
	if monoToken == "" {
		// Mock response for development
		mockPaymentID := fmt.Sprintf("PAY-%d", time.Now().UnixNano())
		mockPaymentURL := fmt.Sprintf("https://pay.example.com/invoice/%s", mockPaymentID)

		db.Exec(`
			INSERT INTO payments (id, order_id, invoice_id, amount, status, payment_url, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'created', $5, $6, $6)`,
			mockPaymentID, req.OrderID, mockPaymentID, amountKopecks, mockPaymentURL, time.Now())

		db.Exec("UPDATE orders SET payment_url = $1, total_amount = $2 WHERE id = $3",
			mockPaymentURL, order.TotalAmount, req.OrderID)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(PaymentResponse{
			PaymentID:  mockPaymentID,
			OrderID:    req.OrderID,
			Amount:     amountKopecks,
			Status:     "created",
			PaymentURL: mockPaymentURL,
		})
		return
	}

	// Real Mono API call
	webhookURL := os.Getenv("PAYMENT_WEBHOOK_URL")
	redirectURL := req.RedirectURL
	if redirectURL == "" {
		redirectURL = os.Getenv("PAYMENT_REDIRECT_URL")
	}

	invoiceBody, _ := json.Marshal(map[string]interface{}{
		"amount":      amountKopecks,
		"ccy":         980,
		"reference":   req.OrderID,
		"destination": order.ProductName,
		"comment":     fmt.Sprintf("Оплата замовлення %s", req.OrderID),
		"redirectUrl": redirectURL,
		"webHookUrl":  webhookURL,
		"validity":    3600,
	})

	httpReq, _ := http.NewRequest(http.MethodPost, "https://api.monobank.ua/api/merchant/invoice/create", bytes.NewReader(invoiceBody))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Token", monoToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("Mono API error: %v", err)
		http.Error(w, "Payment service unavailable", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	var monoResp struct {
		InvoiceID string `json:"invoiceId"`
		PageURL   string `json:"pageUrl"`
		ErrCode   string `json:"errCode"`
		ErrText   string `json:"errText"`
	}
	json.NewDecoder(resp.Body).Decode(&monoResp)

	if monoResp.ErrCode != "" {
		http.Error(w, "Payment creation failed: "+monoResp.ErrText, http.StatusBadRequest)
		return
	}

	paymentID := fmt.Sprintf("PAY-%d", time.Now().UnixNano())

	db.Exec(`
		INSERT INTO payments (id, order_id, invoice_id, amount, status, payment_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'created', $5, $6, $6)`,
		paymentID, req.OrderID, monoResp.InvoiceID, amountKopecks, monoResp.PageURL, time.Now())

	db.Exec("UPDATE orders SET payment_url = $1, total_amount = $2 WHERE id = $3",
		monoResp.PageURL, order.TotalAmount, req.OrderID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(PaymentResponse{
		PaymentID:  paymentID,
		OrderID:    req.OrderID,
		Amount:     amountKopecks,
		Status:     "created",
		PaymentURL: monoResp.PageURL,
	})
}

type MonoWebhookPayload struct {
	InvoiceID     string `json:"invoiceId"`
	Status        string `json:"status"`
	FailureReason string `json:"failureReason,omitempty"`
	Amount        int64  `json:"amount"`
	Reference     string `json:"reference"`
}

func handlePaymentWebhook(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}

	var payload MonoWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	log.Printf("Payment webhook: invoice=%s status=%s order=%s", payload.InvoiceID, payload.Status, payload.Reference)

	db.Exec(`UPDATE payments SET status = $1, failure_reason = $2, updated_at = $3 WHERE invoice_id = $4`,
		payload.Status, payload.FailureReason, time.Now(), payload.InvoiceID)

	orderID := payload.Reference
	var orderPaymentStatus string
	switch payload.Status {
	case "success":
		orderPaymentStatus = "paid"
	case "failure", "reversed", "expired":
		orderPaymentStatus = "failed"
	default:
		orderPaymentStatus = "pending"
	}

	db.Exec("UPDATE orders SET payment_status = $1 WHERE id = $2", orderPaymentStatus, orderID)

	if payload.Status == "success" {
		db.Exec("UPDATE orders SET status = 'PROCESSING' WHERE id = $1 AND status = 'NEW'", orderID)

		if rabbitCh != nil {
			eventData, _ := json.Marshal(map[string]interface{}{
				"type":       "payment_success",
				"order_id":   orderID,
				"invoice_id": payload.InvoiceID,
				"amount":     payload.Amount,
			})
			rabbitCh.Publish("", "order.status.updated", false, false, amqp.Publishing{
				ContentType: "application/json",
				Body:        eventData,
			})
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func getPaymentStatus(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	path := strings.TrimPrefix(r.URL.Path, "/payments/")
	orderID := path

	if orderID == "" {
		http.Error(w, "Order ID required", http.StatusBadRequest)
		return
	}

	var payment struct {
		ID            string    `json:"id"`
		OrderID       string    `json:"order_id"`
		InvoiceID     string    `json:"invoice_id"`
		Amount        int64     `json:"amount"`
		Status        string    `json:"status"`
		PaymentURL    string    `json:"payment_url"`
		FailureReason string    `json:"failure_reason,omitempty"`
		CreatedAt     time.Time `json:"created_at"`
	}

	err := db.QueryRow(`
		SELECT id, order_id, COALESCE(invoice_id, ''), amount, status, COALESCE(payment_url, ''),
		       COALESCE(failure_reason, ''), created_at
		FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, orderID).
		Scan(&payment.ID, &payment.OrderID, &payment.InvoiceID, &payment.Amount,
			&payment.Status, &payment.PaymentURL, &payment.FailureReason, &payment.CreatedAt)
	if err != nil {
		http.Error(w, "Payment not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payment)
}

// Nova Poshta handlers

func searchCities(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	npAPIKey := os.Getenv("NOVA_POSHTA_API_KEY")
	if npAPIKey == "" {
		// Return mock data for development
		mockCities := []map[string]string{
			{"ref": "city-1", "name": "Київ", "area": "Київська область"},
			{"ref": "city-2", "name": "Київ-Святошинський район", "area": "Київська область"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockCities)
		return
	}

	// Real API call
	reqBody, _ := json.Marshal(map[string]interface{}{
		"apiKey":       npAPIKey,
		"modelName":    "Address",
		"calledMethod": "searchSettlements",
		"methodProperties": map[string]interface{}{
			"CityName": query,
			"Limit":    20,
		},
	})

	resp, err := http.Post("https://api.novaposhta.ua/v2.0/json/", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		http.Error(w, "Nova Poshta API error", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	var npResp struct {
		Success bool `json:"success"`
		Data    []struct {
			Addresses []struct {
				Ref             string `json:"Ref"`
				Present         string `json:"Present"`
				MainDescription string `json:"MainDescription"`
				Area            string `json:"Area"`
			} `json:"Addresses"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&npResp)

	var cities []map[string]string
	if npResp.Success && len(npResp.Data) > 0 {
		for _, addr := range npResp.Data[0].Addresses {
			cities = append(cities, map[string]string{
				"ref":  addr.Ref,
				"name": addr.MainDescription,
				"area": addr.Area,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cities)
}

func searchWarehouses(w http.ResponseWriter, r *http.Request) {
	cityRef := r.URL.Query().Get("city_ref")
	cityName := r.URL.Query().Get("city")
	query := r.URL.Query().Get("q")

	if cityRef == "" && cityName == "" {
		http.Error(w, "Either 'city_ref' or 'city' parameter is required", http.StatusBadRequest)
		return
	}

	npAPIKey := os.Getenv("NOVA_POSHTA_API_KEY")
	if npAPIKey == "" {
		// Return mock data for development
		mockWarehouses := []map[string]interface{}{
			{"ref": "wh-1", "number": "1", "description": "Відділення №1: вул. Хрещатик, 1", "city": "Київ"},
			{"ref": "wh-2", "number": "2", "description": "Відділення №2: вул. Велика Васильківська, 100", "city": "Київ"},
			{"ref": "wh-3", "number": "3", "description": "Поштомат №3: ТЦ Глобус", "city": "Київ"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockWarehouses)
		return
	}

	// Real API call
	props := map[string]interface{}{
		"Limit": 50,
	}
	if cityRef != "" {
		props["CityRef"] = cityRef
	} else {
		props["CityName"] = cityName
	}
	if query != "" {
		props["FindByString"] = query
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"apiKey":           npAPIKey,
		"modelName":        "Address",
		"calledMethod":     "getWarehouses",
		"methodProperties": props,
	})

	resp, err := http.Post("https://api.novaposhta.ua/v2.0/json/", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		http.Error(w, "Nova Poshta API error", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	var npResp struct {
		Success bool `json:"success"`
		Data    []struct {
			Ref             string `json:"Ref"`
			Number          string `json:"Number"`
			Description     string `json:"Description"`
			ShortAddress    string `json:"ShortAddress"`
			CityDescription string `json:"CityDescription"`
			TypeOfWarehouse string `json:"TypeOfWarehouse"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&npResp)

	var warehouses []map[string]interface{}
	if npResp.Success {
		for _, wh := range npResp.Data {
			warehouses = append(warehouses, map[string]interface{}{
				"ref":         wh.Ref,
				"number":      wh.Number,
				"description": wh.Description,
				"address":     wh.ShortAddress,
				"city":        wh.CityDescription,
				"type":        wh.TypeOfWarehouse,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(warehouses)
}

func trackParcel(w http.ResponseWriter, r *http.Request) {
	trackingNum := r.URL.Query().Get("number")
	if trackingNum == "" {
		http.Error(w, "Query parameter 'number' is required", http.StatusBadRequest)
		return
	}

	npAPIKey := os.Getenv("NOVA_POSHTA_API_KEY")
	if npAPIKey == "" {
		// Return mock data for development
		mockTracking := map[string]interface{}{
			"number":         trackingNum,
			"status":         "Відправлення прибуло на відділення",
			"status_code":    "8",
			"city_sender":    "Київ",
			"city_recipient": "Одеса",
			"warehouse":      "Відділення №5",
			"weight":         "1.5",
			"scheduled_date": "2025-12-15",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockTracking)
		return
	}

	// Real API call
	reqBody, _ := json.Marshal(map[string]interface{}{
		"apiKey":       npAPIKey,
		"modelName":    "TrackingDocument",
		"calledMethod": "getStatusDocuments",
		"methodProperties": map[string]interface{}{
			"Documents": []map[string]string{
				{"DocumentNumber": trackingNum},
			},
		},
	})

	resp, err := http.Post("https://api.novaposhta.ua/v2.0/json/", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		http.Error(w, "Nova Poshta API error", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	var npResp struct {
		Success bool `json:"success"`
		Data    []struct {
			Number                string `json:"Number"`
			StatusCode            string `json:"StatusCode"`
			Status                string `json:"Status"`
			CitySender            string `json:"CitySender"`
			CityRecipient         string `json:"CityRecipient"`
			WarehouseRecipient    string `json:"WarehouseRecipient"`
			DocumentWeight        string `json:"DocumentWeight"`
			ScheduledDeliveryDate string `json:"ScheduledDeliveryDate"`
			ActualDeliveryDate    string `json:"ActualDeliveryDate"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&npResp)

	if !npResp.Success || len(npResp.Data) == 0 {
		http.Error(w, "Tracking not found", http.StatusNotFound)
		return
	}

	tracking := npResp.Data[0]
	result := map[string]interface{}{
		"number":         tracking.Number,
		"status":         tracking.Status,
		"status_code":    tracking.StatusCode,
		"city_sender":    tracking.CitySender,
		"city_recipient": tracking.CityRecipient,
		"warehouse":      tracking.WarehouseRecipient,
		"weight":         tracking.DocumentWeight,
		"scheduled_date": tracking.ScheduledDeliveryDate,
		"actual_date":    tracking.ActualDeliveryDate,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
