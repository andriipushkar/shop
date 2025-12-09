package http

import (
	"encoding/json"
	"fmt"
	"net/http"

	"core/internal/pim"
)

type Handler struct {
	service *pim.Service
}

func NewHandler(service *pim.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p pim.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.CreateProduct(r.Context(), &p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	query := r.URL.Query()
	filter := pim.ProductFilter{
		Search:     query.Get("search"),
		CategoryID: query.Get("category_id"),
	}

	if minPrice := query.Get("min_price"); minPrice != "" {
		var price float64
		if _, err := fmt.Sscanf(minPrice, "%f", &price); err == nil {
			filter.MinPrice = &price
		}
	}

	if maxPrice := query.Get("max_price"); maxPrice != "" {
		var price float64
		if _, err := fmt.Sscanf(maxPrice, "%f", &price); err == nil {
			filter.MaxPrice = &price
		}
	}

	var products []*pim.Product
	var err error

	// Use filter if any parameter is set
	if filter.Search != "" || filter.MinPrice != nil || filter.MaxPrice != nil || filter.CategoryID != "" {
		products, err = h.service.ListWithFilter(r.Context(), filter)
	} else {
		products, err = h.service.List(r.Context())
	}

	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return empty array instead of null
	if products == nil {
		products = []*pim.Product{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}
	id := r.URL.Path[len("/products/"):]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	var p pim.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	p.ID = id

	if err := h.service.UpdateProduct(r.Context(), &p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}
	id := r.URL.Path[len("/products/"):]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteProduct(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}
	id := r.URL.Path[len("/products/"):]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	product, err := h.service.GetProduct(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(product)
}

type StockRequest struct {
	Stock    int `json:"stock"`
	Quantity int `json:"quantity"`
}

func (h *Handler) UpdateStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}/stock
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/stock")]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	var req StockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateStock(r.Context(), id, req.Stock); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) DecrementStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}/decrement
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/decrement")]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	var req StockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.DecrementStock(r.Context(), id, req.Quantity); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type ImageRequest struct {
	ImageURL string `json:"image_url"`
}

func (h *Handler) UpdateImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /products/{id}/image
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/image")]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	var req ImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateImage(r.Context(), id, req.ImageURL); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Category handlers

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var c pim.Category
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.CreateCategory(r.Context(), &c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	categories, err := h.service.ListCategories(r.Context())
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return empty array instead of null
	if categories == nil {
		categories = []*pim.Category{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

func (h *Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Path[len("/categories/"):]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	category, err := h.service.GetCategory(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Path[len("/categories/"):]
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteCategory(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Cart handlers

type AddToCartRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

func (h *Handler) AddToCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /cart/{user_id}
	userIDStr := r.URL.Path[len("/cart/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req AddToCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Quantity == 0 {
		req.Quantity = 1
	}

	if err := h.service.AddToCart(r.Context(), userID, req.ProductID, req.Quantity); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) GetCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /cart/{user_id}
	userIDStr := r.URL.Path[len("/cart/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	items, err := h.service.GetCart(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if items == nil {
		items = []*pim.CartItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) ClearCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /cart/{user_id}
	userIDStr := r.URL.Path[len("/cart/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	if err := h.service.ClearCart(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) RemoveFromCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract from path: /cart/{user_id}/item/{product_id}
	path := r.URL.Path[len("/cart/"):]
	parts := splitPath(path)
	if len(parts) < 3 || parts[1] != "item" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(parts[0], "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	productID := parts[2]

	if err := h.service.RemoveFromCart(r.Context(), userID, productID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type UpdateQuantityRequest struct {
	Quantity int `json:"quantity"`
}

func (h *Handler) UpdateCartItemQuantity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract from path: /cart/{user_id}/item/{product_id}
	path := r.URL.Path[len("/cart/"):]
	parts := splitPath(path)
	if len(parts) < 3 || parts[1] != "item" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(parts[0], "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	productID := parts[2]

	var req UpdateQuantityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCartItemQuantity(r.Context(), userID, productID, req.Quantity); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func splitPath(path string) []string {
	var parts []string
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// Wishlist handlers

type AddToWishlistRequest struct {
	ProductID string `json:"product_id"`
}

func (h *Handler) AddToWishlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /wishlist/{user_id}
	userIDStr := r.URL.Path[len("/wishlist/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req AddToWishlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.AddToWishlist(r.Context(), userID, req.ProductID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) GetWishlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /wishlist/{user_id}
	userIDStr := r.URL.Path[len("/wishlist/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	items, err := h.service.GetWishlist(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if items == nil {
		items = []*pim.WishlistItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) ClearWishlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /wishlist/{user_id}
	userIDStr := r.URL.Path[len("/wishlist/"):]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	if err := h.service.ClearWishlist(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) RemoveFromWishlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract from path: /wishlist/{user_id}/item/{product_id}
	path := r.URL.Path[len("/wishlist/"):]
	parts := splitPath(path)
	if len(parts) < 3 || parts[1] != "item" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(parts[0], "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	productID := parts[2]

	if err := h.service.RemoveFromWishlist(r.Context(), userID, productID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) IsInWishlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract from path: /wishlist/{user_id}/item/{product_id}
	path := r.URL.Path[len("/wishlist/"):]
	parts := splitPath(path)
	if len(parts) < 3 || parts[1] != "item" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(parts[0], "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	productID := parts[2]

	exists, err := h.service.IsInWishlist(r.Context(), userID, productID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"in_wishlist": exists})
}

func (h *Handler) MoveWishlistToCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract from path: /wishlist/{user_id}/item/{product_id}/to-cart
	path := r.URL.Path[len("/wishlist/"):]
	parts := splitPath(path)
	if len(parts) < 4 || parts[1] != "item" || parts[3] != "to-cart" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(parts[0], "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	productID := parts[2]

	if err := h.service.MoveWishlistToCart(r.Context(), userID, productID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Price history handlers

func (h *Handler) GetPriceHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/price-history
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/price-history")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	history, err := h.service.GetPriceHistory(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if history == nil {
		history = []*pim.PriceHistory{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func (h *Handler) GetLatestPriceChange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/latest-price-change
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/latest-price-change")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	record, err := h.service.GetLatestPriceChange(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(record)
}

// Review handlers

func (h *Handler) CreateReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var review pim.Review
	if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.CreateReview(r.Context(), &review); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(review)
}

func (h *Handler) GetProductReviews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/reviews
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/reviews")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	reviews, err := h.service.GetProductReviews(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if reviews == nil {
		reviews = []*pim.Review{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

func (h *Handler) GetProductRating(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/rating
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/rating")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	rating, err := h.service.GetProductRating(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rating)
}

func (h *Handler) GetReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract review ID from path: /reviews/{id}
	id := r.URL.Path[len("/reviews/"):]
	if id == "" {
		http.Error(w, "Review ID is required", http.StatusBadRequest)
		return
	}

	review, err := h.service.GetReview(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(review)
}

func (h *Handler) DeleteReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract review ID from path: /reviews/{id}
	id := r.URL.Path[len("/reviews/"):]
	if id == "" {
		http.Error(w, "Review ID is required", http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteReview(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetUserReviews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /users/{id}/reviews
	path := r.URL.Path[len("/users/"):]
	userIDStr := path[:len(path)-len("/reviews")]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	reviews, err := h.service.GetUserReviews(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if reviews == nil {
		reviews = []*pim.Review{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

// Recommendation handlers

func (h *Handler) GetSimilarProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/similar
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/similar")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	recommendations, err := h.service.GetSimilarProducts(r.Context(), id, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if recommendations == nil {
		recommendations = []*pim.Recommendation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

func (h *Handler) GetFrequentlyBoughtTogether(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from path: /products/{id}/frequently-bought-together
	path := r.URL.Path[len("/products/"):]
	id := path[:len(path)-len("/frequently-bought-together")]
	if id == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	limit := 5
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	recommendations, err := h.service.GetFrequentlyBoughtTogether(r.Context(), id, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if recommendations == nil {
		recommendations = []*pim.Recommendation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

func (h *Handler) GetPopularProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	recommendations, err := h.service.GetPopularProducts(r.Context(), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if recommendations == nil {
		recommendations = []*pim.Recommendation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

func (h *Handler) GetPersonalizedRecommendations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from path: /users/{id}/recommendations
	path := r.URL.Path[len("/users/"):]
	userIDStr := path[:len(path)-len("/recommendations")]
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	recommendations, err := h.service.GetPersonalizedRecommendations(r.Context(), userID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if recommendations == nil {
		recommendations = []*pim.Recommendation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

// Inventory handlers

func (h *Handler) GetLowStockProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	threshold := 10
	if t := r.URL.Query().Get("threshold"); t != "" {
		fmt.Sscanf(t, "%d", &threshold)
	}

	products, err := h.service.GetLowStockProducts(r.Context(), threshold)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if products == nil {
		products = []*pim.LowStockProduct{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *Handler) GetOutOfStockProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	products, err := h.service.GetOutOfStockProducts(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if products == nil {
		products = []*pim.Product{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *Handler) GetInventoryStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := h.service.GetInventoryStats(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Analytics handlers

func (h *Handler) GetAnalyticsDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dashboard, err := h.service.GetAnalyticsDashboard(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dashboard)
}

func (h *Handler) GetTopSellingProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	products, err := h.service.GetTopSellingProducts(r.Context(), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if products == nil {
		products = []*pim.ProductSalesStats{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *Handler) GetDailySalesReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		fmt.Sscanf(d, "%d", &days)
	}

	sales, err := h.service.GetDailySalesReport(r.Context(), days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if sales == nil {
		sales = []*pim.DailySales{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sales)
}

func (h *Handler) GetSalesByCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sales, err := h.service.GetSalesByCategory(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if sales == nil {
		sales = []*pim.CategorySales{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sales)
}

// Search handlers

func (h *Handler) SearchProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := &pim.SearchQuery{
		Query:      r.URL.Query().Get("q"),
		CategoryID: r.URL.Query().Get("category_id"),
		SortBy:     r.URL.Query().Get("sort"),
		Page:       1,
		PageSize:   20,
	}

	if page := r.URL.Query().Get("page"); page != "" {
		fmt.Sscanf(page, "%d", &query.Page)
	}
	if pageSize := r.URL.Query().Get("page_size"); pageSize != "" {
		fmt.Sscanf(pageSize, "%d", &query.PageSize)
	}
	if minPrice := r.URL.Query().Get("min_price"); minPrice != "" {
		var price float64
		if _, err := fmt.Sscanf(minPrice, "%f", &price); err == nil {
			query.MinPrice = &price
		}
	}
	if maxPrice := r.URL.Query().Get("max_price"); maxPrice != "" {
		var price float64
		if _, err := fmt.Sscanf(maxPrice, "%f", &price); err == nil {
			query.MaxPrice = &price
		}
	}
	if inStock := r.URL.Query().Get("in_stock"); inStock == "true" {
		inStockBool := true
		query.InStock = &inStockBool
	}

	result, err := h.service.SearchProducts(r.Context(), query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) SearchSuggest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	prefix := r.URL.Query().Get("q")
	if prefix == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	suggestions, err := h.service.SearchSuggest(r.Context(), prefix, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if suggestions == nil {
		suggestions = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"suggestions": suggestions,
	})
}

func (h *Handler) ReindexProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.service.ReindexAllProducts(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Reindex started"})
}
