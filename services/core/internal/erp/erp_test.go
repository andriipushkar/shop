package erp

import (
	"context"
	"errors"
	"testing"
	"time"
)

// MockERPProvider is a mock implementation of ERPProvider
type MockERPProvider struct {
	name     string
	products []Product
	orders   []Order
	customers []Customer
	stock    []ProductStock
	warehouses []Warehouse
	err      error
}

func NewMockERPProvider(name string) *MockERPProvider {
	return &MockERPProvider{
		name:       name,
		products:   make([]Product, 0),
		orders:     make([]Order, 0),
		customers:  make([]Customer, 0),
		stock:      make([]ProductStock, 0),
		warehouses: make([]Warehouse, 0),
	}
}

func (m *MockERPProvider) Name() string {
	return m.name
}

func (m *MockERPProvider) GetProducts(ctx context.Context, updatedSince *time.Time) ([]Product, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.products, nil
}

func (m *MockERPProvider) GetProduct(ctx context.Context, id string) (*Product, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, p := range m.products {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MockERPProvider) CreateProduct(ctx context.Context, product *Product) (*Product, error) {
	if m.err != nil {
		return nil, m.err
	}
	m.products = append(m.products, *product)
	return product, nil
}

func (m *MockERPProvider) UpdateProduct(ctx context.Context, product *Product) error {
	if m.err != nil {
		return m.err
	}
	for i, p := range m.products {
		if p.ID == product.ID {
			m.products[i] = *product
			return nil
		}
	}
	return ErrNotFound
}

func (m *MockERPProvider) UpdateStock(ctx context.Context, productID string, warehouseID string, quantity int) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *MockERPProvider) GetOrders(ctx context.Context, updatedSince *time.Time) ([]Order, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.orders, nil
}

func (m *MockERPProvider) GetOrder(ctx context.Context, id string) (*Order, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, o := range m.orders {
		if o.ID == id {
			return &o, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MockERPProvider) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
	if m.err != nil {
		return nil, m.err
	}
	m.orders = append(m.orders, *order)
	return order, nil
}

func (m *MockERPProvider) UpdateOrderStatus(ctx context.Context, orderID string, status string) error {
	if m.err != nil {
		return m.err
	}
	for i, o := range m.orders {
		if o.ID == orderID {
			m.orders[i].Status = status
			return nil
		}
	}
	return ErrNotFound
}

func (m *MockERPProvider) GetCustomers(ctx context.Context, updatedSince *time.Time) ([]Customer, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.customers, nil
}

func (m *MockERPProvider) GetCustomer(ctx context.Context, id string) (*Customer, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, c := range m.customers {
		if c.ID == id {
			return &c, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MockERPProvider) CreateCustomer(ctx context.Context, customer *Customer) (*Customer, error) {
	if m.err != nil {
		return nil, m.err
	}
	m.customers = append(m.customers, *customer)
	return customer, nil
}

func (m *MockERPProvider) UpdateCustomer(ctx context.Context, customer *Customer) error {
	if m.err != nil {
		return m.err
	}
	for i, c := range m.customers {
		if c.ID == customer.ID {
			m.customers[i] = *customer
			return nil
		}
	}
	return ErrNotFound
}

func (m *MockERPProvider) GetStock(ctx context.Context, warehouseID string) ([]ProductStock, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.stock, nil
}

func (m *MockERPProvider) GetWarehouses(ctx context.Context) ([]Warehouse, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.warehouses, nil
}

func (m *MockERPProvider) AddProduct(p Product) {
	m.products = append(m.products, p)
}

func (m *MockERPProvider) AddOrder(o Order) {
	m.orders = append(m.orders, o)
}

func (m *MockERPProvider) SetError(err error) {
	m.err = err
}

// Tests

func TestErrors(t *testing.T) {
	if ErrNotFound == nil {
		t.Error("ErrNotFound should not be nil")
	}
	if ErrInvalidData == nil {
		t.Error("ErrInvalidData should not be nil")
	}
	if ErrConnectionFailed == nil {
		t.Error("ErrConnectionFailed should not be nil")
	}
	if ErrSyncFailed == nil {
		t.Error("ErrSyncFailed should not be nil")
	}

	if ErrNotFound.Error() != "entity not found" {
		t.Errorf("unexpected error message: %s", ErrNotFound.Error())
	}
}

func TestProduct(t *testing.T) {
	p := Product{
		ID:          "prod-1",
		ExternalID:  "ext-1",
		SKU:         "SKU001",
		Name:        "Test Product",
		Description: "Test Description",
		Category:    "Electronics",
		Brand:       "TestBrand",
		Unit:        "шт",
		Barcode:     "1234567890123",
		Price:       100.00,
		CostPrice:   70.00,
		Currency:    "UAH",
		VATRate:     20.0,
		Stock:       50,
		Reserved:    5,
		MinStock:    10,
		Weight:      0.5,
		Dimensions: &Dimensions{
			Length: 10.0,
			Width:  5.0,
			Height: 2.0,
		},
		Attributes: map[string]string{"color": "red"},
		Images:     []string{"image1.jpg", "image2.jpg"},
		IsActive:   true,
	}

	if p.ID != "prod-1" {
		t.Errorf("expected ID 'prod-1', got %s", p.ID)
	}
	if p.SKU != "SKU001" {
		t.Errorf("expected SKU 'SKU001', got %s", p.SKU)
	}
	if p.Price != 100.00 {
		t.Errorf("expected Price 100.00, got %f", p.Price)
	}
	if p.Dimensions.Length != 10.0 {
		t.Errorf("expected Length 10.0, got %f", p.Dimensions.Length)
	}
	if p.Attributes["color"] != "red" {
		t.Errorf("expected color 'red', got %s", p.Attributes["color"])
	}
}

func TestDimensions(t *testing.T) {
	d := &Dimensions{
		Length: 100.0,
		Width:  50.0,
		Height: 25.0,
	}

	if d.Length != 100.0 {
		t.Errorf("expected Length 100.0, got %f", d.Length)
	}
	if d.Width != 50.0 {
		t.Errorf("expected Width 50.0, got %f", d.Width)
	}
	if d.Height != 25.0 {
		t.Errorf("expected Height 25.0, got %f", d.Height)
	}
}

func TestOrder(t *testing.T) {
	now := time.Now()
	o := Order{
		ID:            "order-1",
		ExternalID:    "ext-order-1",
		Number:        "ORD-001",
		Date:          now,
		Status:        "pending",
		Customer:      &Customer{ID: "cust-1", Name: "Test Customer"},
		Items:         []OrderItem{{ProductID: "prod-1", Quantity: 2, Price: 100.00, Total: 200.00}},
		Subtotal:      200.00,
		Discount:      10.00,
		ShippingCost:  50.00,
		Total:         240.00,
		VATAmount:     40.00,
		Currency:      "UAH",
		PaymentMethod: "card",
		PaymentStatus: "paid",
	}

	if o.ID != "order-1" {
		t.Errorf("expected ID 'order-1', got %s", o.ID)
	}
	if o.Total != 240.00 {
		t.Errorf("expected Total 240.00, got %f", o.Total)
	}
	if len(o.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(o.Items))
	}
}

func TestOrderItem(t *testing.T) {
	item := OrderItem{
		ProductID: "prod-1",
		SKU:       "SKU001",
		Name:      "Test Product",
		Quantity:  3,
		Price:     50.00,
		Discount:  5.00,
		Total:     145.00,
		VATRate:   20.0,
		VATAmount: 24.17,
		Unit:      "шт",
	}

	if item.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", item.ProductID)
	}
	if item.Quantity != 3 {
		t.Errorf("expected Quantity 3, got %d", item.Quantity)
	}
	if item.Total != 145.00 {
		t.Errorf("expected Total 145.00, got %f", item.Total)
	}
}

func TestCustomer(t *testing.T) {
	c := Customer{
		ID:          "cust-1",
		ExternalID:  "ext-cust-1",
		Type:        "individual",
		Name:        "Іван Петренко",
		FirstName:   "Іван",
		LastName:    "Петренко",
		Email:       "ivan@example.com",
		Phone:       "+380501234567",
		CompanyName: "",
		EDRPOU:      "",
		IPN:         "1234567890",
		IsVATPayer:  false,
		Address:     &Address{City: "Київ"},
	}

	if c.ID != "cust-1" {
		t.Errorf("expected ID 'cust-1', got %s", c.ID)
	}
	if c.Type != "individual" {
		t.Errorf("expected Type 'individual', got %s", c.Type)
	}
	if c.Phone != "+380501234567" {
		t.Errorf("expected Phone '+380501234567', got %s", c.Phone)
	}
}

func TestAddress(t *testing.T) {
	addr := &Address{
		Country:     "Україна",
		Region:      "Київська",
		City:        "Київ",
		District:    "Шевченківський",
		Street:      "вул. Хрещатик",
		Building:    "1",
		Apartment:   "10",
		PostalCode:  "01001",
		FullAddress: "Україна, м. Київ, вул. Хрещатик, 1, кв. 10",
	}

	if addr.City != "Київ" {
		t.Errorf("expected City 'Київ', got %s", addr.City)
	}
	if addr.PostalCode != "01001" {
		t.Errorf("expected PostalCode '01001', got %s", addr.PostalCode)
	}
}

func TestInvoice(t *testing.T) {
	now := time.Now()
	dueDate := now.Add(14 * 24 * time.Hour)

	inv := Invoice{
		ID:         "inv-1",
		ExternalID: "ext-inv-1",
		Number:     "INV-001",
		Date:       now,
		OrderID:    "order-1",
		CustomerID: "cust-1",
		Items:      []OrderItem{{ProductID: "prod-1", Quantity: 1, Price: 100.00, Total: 100.00}},
		Subtotal:   100.00,
		VATAmount:  20.00,
		Total:      120.00,
		Currency:   "UAH",
		Status:     "issued",
		DueDate:    &dueDate,
	}

	if inv.ID != "inv-1" {
		t.Errorf("expected ID 'inv-1', got %s", inv.ID)
	}
	if inv.Total != 120.00 {
		t.Errorf("expected Total 120.00, got %f", inv.Total)
	}
	if inv.Status != "issued" {
		t.Errorf("expected Status 'issued', got %s", inv.Status)
	}
}

func TestStockMovement(t *testing.T) {
	sm := StockMovement{
		ID:            "sm-1",
		Type:          "income",
		Date:          time.Now(),
		ProductID:     "prod-1",
		SKU:           "SKU001",
		Quantity:      100,
		WarehouseTo:   "wh-1",
		DocumentType:  "purchase",
		DocumentID:    "po-1",
	}

	if sm.Type != "income" {
		t.Errorf("expected Type 'income', got %s", sm.Type)
	}
	if sm.Quantity != 100 {
		t.Errorf("expected Quantity 100, got %d", sm.Quantity)
	}
}

func TestWarehouse(t *testing.T) {
	wh := Warehouse{
		ID:         "wh-1",
		ExternalID: "ext-wh-1",
		Name:       "Main Warehouse",
		Code:       "MAIN",
		Address:    &Address{City: "Київ"},
		IsActive:   true,
		IsDefault:  true,
	}

	if wh.ID != "wh-1" {
		t.Errorf("expected ID 'wh-1', got %s", wh.ID)
	}
	if wh.Name != "Main Warehouse" {
		t.Errorf("expected Name 'Main Warehouse', got %s", wh.Name)
	}
	if !wh.IsDefault {
		t.Error("expected IsDefault to be true")
	}
}

func TestSyncResult(t *testing.T) {
	now := time.Now()
	result := SyncResult{
		EntityType:  "products",
		Created:     10,
		Updated:     5,
		Deleted:     2,
		Errors:      1,
		ErrorList:   []string{"failed to sync product X"},
		StartedAt:   now,
		CompletedAt: now.Add(5 * time.Second),
	}

	if result.EntityType != "products" {
		t.Errorf("expected EntityType 'products', got %s", result.EntityType)
	}
	if result.Created != 10 {
		t.Errorf("expected Created 10, got %d", result.Created)
	}
	if result.Errors != 1 {
		t.Errorf("expected Errors 1, got %d", result.Errors)
	}
}

func TestProductStock(t *testing.T) {
	ps := ProductStock{
		ProductID:   "prod-1",
		SKU:         "SKU001",
		WarehouseID: "wh-1",
		Quantity:    100,
		Reserved:    10,
		Available:   90,
	}

	if ps.ProductID != "prod-1" {
		t.Errorf("expected ProductID 'prod-1', got %s", ps.ProductID)
	}
	if ps.Available != 90 {
		t.Errorf("expected Available 90, got %d", ps.Available)
	}
}

func TestNewERPService(t *testing.T) {
	service := NewERPService()

	if service == nil {
		t.Fatal("expected service to be created")
	}
	if service.providers == nil {
		t.Error("expected providers map to be initialized")
	}
}

func TestERPService_RegisterProvider(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")

	service.RegisterProvider(provider)

	_, err := service.GetProvider("test-provider")
	if err != nil {
		t.Errorf("expected provider to be registered, got error: %v", err)
	}
}

func TestERPService_SetDefaultProvider(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	service.RegisterProvider(provider)
	service.SetDefaultProvider("test-provider")

	// Get with empty name should return default provider
	p, err := service.GetProvider("")
	if err != nil {
		t.Errorf("expected default provider, got error: %v", err)
	}
	if p.Name() != "test-provider" {
		t.Errorf("expected 'test-provider', got %s", p.Name())
	}
}

func TestERPService_GetProvider_NotFound(t *testing.T) {
	service := NewERPService()

	_, err := service.GetProvider("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestERPService_SyncProducts(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	provider.AddProduct(Product{ID: "prod-1", Name: "Test"})
	provider.AddProduct(Product{ID: "prod-2", Name: "Test 2"})
	service.RegisterProvider(provider)

	ctx := context.Background()
	result, err := service.SyncProducts(ctx, "test-provider", nil)

	if err != nil {
		t.Fatalf("SyncProducts error: %v", err)
	}
	if result.EntityType != "products" {
		t.Errorf("expected EntityType 'products', got %s", result.EntityType)
	}
	if result.Updated != 2 {
		t.Errorf("expected 2 updated, got %d", result.Updated)
	}
}

func TestERPService_SyncProducts_ProviderError(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	provider.SetError(errors.New("provider error"))
	service.RegisterProvider(provider)

	ctx := context.Background()
	_, err := service.SyncProducts(ctx, "test-provider", nil)

	if err == nil {
		t.Error("expected error from provider")
	}
}

func TestERPService_SyncProducts_ProviderNotFound(t *testing.T) {
	service := NewERPService()

	ctx := context.Background()
	_, err := service.SyncProducts(ctx, "nonexistent", nil)

	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestERPService_SyncOrders(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	provider.AddOrder(Order{ID: "order-1", Number: "ORD-001"})
	service.RegisterProvider(provider)

	ctx := context.Background()
	result, err := service.SyncOrders(ctx, "test-provider", nil)

	if err != nil {
		t.Fatalf("SyncOrders error: %v", err)
	}
	if result.EntityType != "orders" {
		t.Errorf("expected EntityType 'orders', got %s", result.EntityType)
	}
	if result.Updated != 1 {
		t.Errorf("expected 1 updated, got %d", result.Updated)
	}
}

func TestERPService_SyncOrders_ProviderNotFound(t *testing.T) {
	service := NewERPService()

	ctx := context.Background()
	_, err := service.SyncOrders(ctx, "nonexistent", nil)

	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestERPService_SyncOrders_ProviderError(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	provider.SetError(errors.New("provider error"))
	service.RegisterProvider(provider)

	ctx := context.Background()
	_, err := service.SyncOrders(ctx, "test-provider", nil)

	if err == nil {
		t.Error("expected error from provider")
	}
}

func TestERPService_ExportOrder(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	service.RegisterProvider(provider)

	ctx := context.Background()
	order := &Order{
		ID:     "order-1",
		Number: "ORD-001",
		Total:  100.00,
	}

	result, err := service.ExportOrder(ctx, "test-provider", order)

	if err != nil {
		t.Fatalf("ExportOrder error: %v", err)
	}
	if result.ID != "order-1" {
		t.Errorf("expected order ID 'order-1', got %s", result.ID)
	}
}

func TestERPService_ExportOrder_ProviderNotFound(t *testing.T) {
	service := NewERPService()

	ctx := context.Background()
	order := &Order{ID: "order-1"}

	_, err := service.ExportOrder(ctx, "nonexistent", order)

	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestERPService_SyncStock(t *testing.T) {
	service := NewERPService()
	provider := NewMockERPProvider("test-provider")
	provider.stock = []ProductStock{
		{ProductID: "prod-1", Quantity: 100, Available: 90},
		{ProductID: "prod-2", Quantity: 50, Available: 50},
	}
	service.RegisterProvider(provider)

	ctx := context.Background()
	stock, err := service.SyncStock(ctx, "test-provider", "wh-1")

	if err != nil {
		t.Fatalf("SyncStock error: %v", err)
	}
	if len(stock) != 2 {
		t.Errorf("expected 2 stock items, got %d", len(stock))
	}
}

func TestERPService_SyncStock_ProviderNotFound(t *testing.T) {
	service := NewERPService()

	ctx := context.Background()
	_, err := service.SyncStock(ctx, "nonexistent", "wh-1")

	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestMockERPProvider(t *testing.T) {
	provider := NewMockERPProvider("test")
	ctx := context.Background()

	// Test Name
	if provider.Name() != "test" {
		t.Errorf("expected name 'test', got %s", provider.Name())
	}

	// Test GetProducts - empty
	products, err := provider.GetProducts(ctx, nil)
	if err != nil {
		t.Errorf("GetProducts error: %v", err)
	}
	if len(products) != 0 {
		t.Errorf("expected 0 products, got %d", len(products))
	}

	// Test CreateProduct
	newProduct := &Product{ID: "prod-1", Name: "Test"}
	created, err := provider.CreateProduct(ctx, newProduct)
	if err != nil {
		t.Errorf("CreateProduct error: %v", err)
	}
	if created.ID != "prod-1" {
		t.Errorf("expected ID 'prod-1', got %s", created.ID)
	}

	// Test GetProduct
	found, err := provider.GetProduct(ctx, "prod-1")
	if err != nil {
		t.Errorf("GetProduct error: %v", err)
	}
	if found.ID != "prod-1" {
		t.Errorf("expected ID 'prod-1', got %s", found.ID)
	}

	// Test GetProduct - not found
	_, err = provider.GetProduct(ctx, "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test UpdateProduct
	newProduct.Name = "Updated"
	err = provider.UpdateProduct(ctx, newProduct)
	if err != nil {
		t.Errorf("UpdateProduct error: %v", err)
	}

	// Test UpdateProduct - not found
	err = provider.UpdateProduct(ctx, &Product{ID: "nonexistent"})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test UpdateStock
	err = provider.UpdateStock(ctx, "prod-1", "wh-1", 100)
	if err != nil {
		t.Errorf("UpdateStock error: %v", err)
	}

	// Test GetWarehouses
	warehouses, err := provider.GetWarehouses(ctx)
	if err != nil {
		t.Errorf("GetWarehouses error: %v", err)
	}
	if warehouses == nil {
		t.Error("expected non-nil warehouses")
	}
}

func TestMockERPProvider_Orders(t *testing.T) {
	provider := NewMockERPProvider("test")
	ctx := context.Background()

	// Test CreateOrder
	order := &Order{ID: "order-1", Number: "ORD-001", Status: "new"}
	created, err := provider.CreateOrder(ctx, order)
	if err != nil {
		t.Errorf("CreateOrder error: %v", err)
	}
	if created.ID != "order-1" {
		t.Errorf("expected ID 'order-1', got %s", created.ID)
	}

	// Test GetOrder
	found, err := provider.GetOrder(ctx, "order-1")
	if err != nil {
		t.Errorf("GetOrder error: %v", err)
	}
	if found.Number != "ORD-001" {
		t.Errorf("expected Number 'ORD-001', got %s", found.Number)
	}

	// Test GetOrder - not found
	_, err = provider.GetOrder(ctx, "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test UpdateOrderStatus
	err = provider.UpdateOrderStatus(ctx, "order-1", "processing")
	if err != nil {
		t.Errorf("UpdateOrderStatus error: %v", err)
	}

	// Test UpdateOrderStatus - not found
	err = provider.UpdateOrderStatus(ctx, "nonexistent", "processing")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test GetOrders
	orders, err := provider.GetOrders(ctx, nil)
	if err != nil {
		t.Errorf("GetOrders error: %v", err)
	}
	if len(orders) != 1 {
		t.Errorf("expected 1 order, got %d", len(orders))
	}
}

func TestMockERPProvider_Customers(t *testing.T) {
	provider := NewMockERPProvider("test")
	ctx := context.Background()

	// Test CreateCustomer
	customer := &Customer{ID: "cust-1", Name: "Test Customer"}
	created, err := provider.CreateCustomer(ctx, customer)
	if err != nil {
		t.Errorf("CreateCustomer error: %v", err)
	}
	if created.ID != "cust-1" {
		t.Errorf("expected ID 'cust-1', got %s", created.ID)
	}

	// Test GetCustomer
	found, err := provider.GetCustomer(ctx, "cust-1")
	if err != nil {
		t.Errorf("GetCustomer error: %v", err)
	}
	if found.Name != "Test Customer" {
		t.Errorf("expected Name 'Test Customer', got %s", found.Name)
	}

	// Test GetCustomer - not found
	_, err = provider.GetCustomer(ctx, "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test UpdateCustomer
	customer.Name = "Updated Customer"
	err = provider.UpdateCustomer(ctx, customer)
	if err != nil {
		t.Errorf("UpdateCustomer error: %v", err)
	}

	// Test UpdateCustomer - not found
	err = provider.UpdateCustomer(ctx, &Customer{ID: "nonexistent"})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}

	// Test GetCustomers
	customers, err := provider.GetCustomers(ctx, nil)
	if err != nil {
		t.Errorf("GetCustomers error: %v", err)
	}
	if len(customers) != 1 {
		t.Errorf("expected 1 customer, got %d", len(customers))
	}
}

func TestMockERPProvider_WithError(t *testing.T) {
	provider := NewMockERPProvider("test")
	provider.SetError(errors.New("mock error"))
	ctx := context.Background()

	_, err := provider.GetProducts(ctx, nil)
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetProduct(ctx, "id")
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.CreateProduct(ctx, &Product{})
	if err == nil {
		t.Error("expected error")
	}

	err = provider.UpdateProduct(ctx, &Product{ID: "id"})
	if err == nil {
		t.Error("expected error")
	}

	err = provider.UpdateStock(ctx, "id", "wh", 1)
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetOrders(ctx, nil)
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetOrder(ctx, "id")
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.CreateOrder(ctx, &Order{})
	if err == nil {
		t.Error("expected error")
	}

	err = provider.UpdateOrderStatus(ctx, "id", "status")
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetCustomers(ctx, nil)
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetCustomer(ctx, "id")
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.CreateCustomer(ctx, &Customer{})
	if err == nil {
		t.Error("expected error")
	}

	err = provider.UpdateCustomer(ctx, &Customer{ID: "id"})
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetStock(ctx, "wh")
	if err == nil {
		t.Error("expected error")
	}

	_, err = provider.GetWarehouses(ctx)
	if err == nil {
		t.Error("expected error")
	}
}
