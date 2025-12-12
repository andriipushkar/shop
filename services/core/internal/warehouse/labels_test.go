package warehouse

import (
	"context"
	"testing"
)

// MockLabelRepository implements LabelRepository for testing
type mockLabelRepository struct {
	labels    map[string]*Label
	printJobs map[string]*PrintJob
	printers  map[string]*Printer
}

func newMockLabelRepository() *mockLabelRepository {
	return &mockLabelRepository{
		labels:    make(map[string]*Label),
		printJobs: make(map[string]*PrintJob),
		printers:  make(map[string]*Printer),
	}
}

func (m *mockLabelRepository) CreateLabel(ctx context.Context, label *Label) error {
	m.labels[label.ID] = label
	return nil
}

func (m *mockLabelRepository) GetLabel(ctx context.Context, id string) (*Label, error) {
	if l, ok := m.labels[id]; ok {
		return l, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockLabelRepository) ListLabels(ctx context.Context, labelType LabelType, limit int) ([]*Label, error) {
	result := make([]*Label, 0)
	for _, l := range m.labels {
		if labelType == "" || l.Type == labelType {
			result = append(result, l)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockLabelRepository) CreatePrintJob(ctx context.Context, job *PrintJob) error {
	m.printJobs[job.ID] = job
	return nil
}

func (m *mockLabelRepository) UpdatePrintJob(ctx context.Context, job *PrintJob) error {
	m.printJobs[job.ID] = job
	return nil
}

func (m *mockLabelRepository) GetPrintJob(ctx context.Context, id string) (*PrintJob, error) {
	if j, ok := m.printJobs[id]; ok {
		return j, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockLabelRepository) ListPrintJobs(ctx context.Context, status string, limit int) ([]*PrintJob, error) {
	result := make([]*PrintJob, 0)
	for _, j := range m.printJobs {
		if status == "" || j.Status == status {
			result = append(result, j)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockLabelRepository) CreatePrinter(ctx context.Context, printer *Printer) error {
	m.printers[printer.ID] = printer
	return nil
}

func (m *mockLabelRepository) UpdatePrinter(ctx context.Context, printer *Printer) error {
	m.printers[printer.ID] = printer
	return nil
}

func (m *mockLabelRepository) GetPrinter(ctx context.Context, id string) (*Printer, error) {
	if p, ok := m.printers[id]; ok {
		return p, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockLabelRepository) ListPrinters(ctx context.Context) ([]*Printer, error) {
	result := make([]*Printer, 0, len(m.printers))
	for _, p := range m.printers {
		result = append(result, p)
	}
	return result, nil
}

func (m *mockLabelRepository) GetDefaultPrinter(ctx context.Context) (*Printer, error) {
	for _, p := range m.printers {
		if p.IsDefault {
			return p, nil
		}
	}
	return nil, ErrProductNotFound
}

// Tests

func TestLabelService_GenerateBarcode(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	// Test Code128
	base64, err := service.GenerateBarcode("TEST123456", BarcodeCode128, 200, 100)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if base64 == "" {
		t.Error("Expected base64 encoded barcode")
	}

	// Test QR
	base64QR, err := service.GenerateBarcode("https://example.com", BarcodeQR, 200, 200)
	if err != nil {
		t.Fatalf("Expected no error for QR, got %v", err)
	}
	if base64QR == "" {
		t.Error("Expected base64 encoded QR code")
	}
}

func TestLabelService_GenerateBarcode_InvalidType(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	_, err := service.GenerateBarcode("TEST", BarcodeType("invalid"), 100, 50)
	if err != ErrInvalidBarcodeType {
		t.Errorf("Expected ErrInvalidBarcodeType, got %v", err)
	}
}

func TestLabelService_GenerateProductLabel(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ProductLabelData{
		SKU:      "SKU001",
		Barcode:  "1234567890128", // 13 digits for EAN13 with valid checksum
		Name:     "Test Product",
		Price:    99.99,
		Currency: "UAH",
		Location: "A1-01",
	}

	label, err := service.GenerateProductLabel(ctx, data, LabelSize40x30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Type != LabelProduct {
		t.Errorf("Expected type 'product', got %s", label.Type)
	}
	if label.Fields["sku"] != "SKU001" {
		t.Errorf("Expected SKU 'SKU001', got %s", label.Fields["sku"])
	}
	if label.ZPLCode == "" {
		t.Error("Expected ZPL code to be generated")
	}
}

func TestLabelService_GenerateShelfLabel(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ShelfLabelData{
		Location: "A1-01-03-02",
		Zone:     "A",
		Row:      "1",
		Shelf:    "03",
		Bin:      "02",
		Capacity: 100,
	}

	label, err := service.GenerateShelfLabel(ctx, data, LabelSize58x40)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Type != LabelShelf {
		t.Errorf("Expected type 'shelf', got %s", label.Type)
	}
	if label.BarcodeType != BarcodeQR {
		t.Errorf("Expected QR barcode, got %s", label.BarcodeType)
	}
}

func TestLabelService_GenerateShippingLabel(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ShippingLabelData{
		OrderID:     "ORD001",
		TrackingNum: "1Z999AA10123456784",
		Carrier:     "UPS",
		FromName:    "Warehouse",
		FromAddress: "123 Storage St",
		FromCity:    "Kyiv",
		FromPostal:  "01001",
		ToName:      "John Doe",
		ToAddress:   "456 Customer Ave",
		ToCity:      "Lviv",
		ToPostal:    "79000",
		Weight:      2.5,
	}

	label, err := service.GenerateShippingLabel(ctx, data, LabelSize100x150)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Type != LabelShipping {
		t.Errorf("Expected type 'shipping', got %s", label.Type)
	}
	if label.Fields["tracking_number"] != "1Z999AA10123456784" {
		t.Errorf("Expected tracking number, got %s", label.Fields["tracking_number"])
	}
}

func TestLabelService_GenerateBatchLabel(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	label, err := service.GenerateBatchLabel(ctx, "BATCH001", "Test Product", "2025-12-31", 100, LabelSize40x30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Type != LabelBatch {
		t.Errorf("Expected type 'batch', got %s", label.Type)
	}
	if label.Fields["batch_number"] != "BATCH001" {
		t.Errorf("Expected batch number 'BATCH001', got %s", label.Fields["batch_number"])
	}
}

func TestLabelService_GeneratePriceTag(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	// Without discount
	label, err := service.GeneratePriceTag(ctx, "SKU001", "Test Product", 100.00, 0, "UAH", LabelSize30x20)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Type != LabelPrice {
		t.Errorf("Expected type 'price', got %s", label.Type)
	}
	if label.Fields["discount"] != "" {
		t.Errorf("Expected no discount, got %s", label.Fields["discount"])
	}

	// With discount
	labelDiscount, err := service.GeneratePriceTag(ctx, "SKU002", "Discounted Product", 80.00, 100.00, "UAH", LabelSize30x20)
	if err != nil {
		t.Fatalf("Expected no error for discounted price, got %v", err)
	}

	if labelDiscount.Fields["discount"] == "" {
		t.Error("Expected discount to be set")
	}
	if labelDiscount.Fields["old_price"] == "" {
		t.Error("Expected old price to be set")
	}
}

func TestLabelService_PrintLabel(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	// Setup
	repo.labels["label1"] = &Label{ID: "label1", Type: LabelProduct}
	repo.printers["printer1"] = &Printer{ID: "printer1", Name: "Test Printer", IsOnline: true}

	job, err := service.PrintLabel(ctx, "label1", "printer1", 2)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if job.PrinterID != "printer1" {
		t.Errorf("Expected printer 'printer1', got %s", job.PrinterID)
	}
	if job.Copies != 2 {
		t.Errorf("Expected 2 copies, got %d", job.Copies)
	}
}

func TestLabelService_PrintBatch(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	// Setup
	repo.labels["label1"] = &Label{ID: "label1"}
	repo.labels["label2"] = &Label{ID: "label2"}
	repo.printers["printer1"] = &Printer{ID: "printer1"}

	job, err := service.PrintBatch(ctx, []string{"label1", "label2"}, "printer1", 1)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(job.Labels) != 2 {
		t.Errorf("Expected 2 labels, got %d", len(job.Labels))
	}
}

func TestLabelService_GetPrintJobStatus(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.printJobs["job1"] = &PrintJob{ID: "job1", Status: "completed"}

	job, err := service.GetPrintJobStatus(ctx, "job1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if job.Status != "completed" {
		t.Errorf("Expected status 'completed', got %s", job.Status)
	}
}

func TestLabelService_ListPrinters(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.printers["p1"] = &Printer{ID: "p1", Name: "Printer 1"}
	repo.printers["p2"] = &Printer{ID: "p2", Name: "Printer 2"}

	printers, err := service.ListPrinters(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(printers) != 2 {
		t.Errorf("Expected 2 printers, got %d", len(printers))
	}
}

func TestLabelService_GenerateBarcodeImage(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	img, err := service.GenerateBarcodeImage("TEST123", BarcodeCode128, 200, 100)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if img.Image == nil {
		t.Error("Expected image to be generated")
	}
	if img.Base64 == "" {
		t.Error("Expected base64 to be set")
	}
	if img.Width != 200 {
		t.Errorf("Expected width 200, got %d", img.Width)
	}
}

// Edge case tests for increased coverage

func TestLabelService_GenerateBarcode_EAN13(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	// Valid EAN13
	base64, err := service.GenerateBarcode("1234567890128", BarcodeEAN13, 200, 100)
	if err != nil {
		t.Fatalf("Expected no error for EAN13, got %v", err)
	}
	if base64 == "" {
		t.Error("Expected base64 encoded barcode")
	}
}

func TestLabelService_GenerateBarcode_EAN8(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	// Valid EAN8
	base64, err := service.GenerateBarcode("12345670", BarcodeEAN8, 150, 80)
	if err != nil {
		t.Fatalf("Expected no error for EAN8, got %v", err)
	}
	if base64 == "" {
		t.Error("Expected base64 encoded barcode")
	}
}

func TestLabelService_GenerateBarcode_InvalidEAN(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	// Invalid EAN (wrong length)
	_, err := service.GenerateBarcode("123", BarcodeEAN13, 200, 100)
	if err == nil {
		t.Error("Expected error for invalid EAN13")
	}
}

func TestLabelService_GenerateBarcodeImage_EAN13(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	img, err := service.GenerateBarcodeImage("1234567890128", BarcodeEAN13, 200, 100)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if img == nil {
		t.Fatal("Expected image to be generated")
	}
}

func TestLabelService_GenerateBarcodeImage_EAN8(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	img, err := service.GenerateBarcodeImage("12345670", BarcodeEAN8, 150, 80)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if img == nil {
		t.Fatal("Expected image to be generated")
	}
}

func TestLabelService_GenerateBarcodeImage_QR(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	img, err := service.GenerateBarcodeImage("https://example.com", BarcodeQR, 200, 200)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if img == nil {
		t.Fatal("Expected QR code to be generated")
	}
}

func TestLabelService_GenerateBarcodeImage_InvalidType(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)

	_, err := service.GenerateBarcodeImage("TEST", BarcodeType("invalid"), 100, 50)
	if err != ErrInvalidBarcodeType {
		t.Errorf("Expected ErrInvalidBarcodeType, got %v", err)
	}
}

func TestLabelService_GenerateProductLabel_EAN8(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ProductLabelData{
		SKU:      "SKU002",
		Barcode:  "12345670", // 8 digits for EAN8
		Name:     "Test Product 2",
		Price:    49.99,
		Currency: "UAH",
	}

	label, err := service.GenerateProductLabel(ctx, data, LabelSize30x20)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.BarcodeType != BarcodeEAN8 {
		t.Errorf("Expected EAN8 barcode type, got %s", label.BarcodeType)
	}
}

func TestLabelService_GenerateProductLabel_Code128Fallback(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ProductLabelData{
		SKU:      "SKU003",
		Barcode:  "ABC-123-XYZ", // Non-numeric, will use Code128
		Name:     "Test Product 3",
		Price:    29.99,
		Currency: "UAH",
	}

	label, err := service.GenerateProductLabel(ctx, data, LabelSize40x30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.BarcodeType != BarcodeCode128 {
		t.Errorf("Expected Code128 barcode type, got %s", label.BarcodeType)
	}
}

func TestLabelService_GenerateShelfLabel_WithProductSKU(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ShelfLabelData{
		Location:   "A1-01-03-02",
		Zone:       "A",
		Row:        "1",
		Shelf:      "03",
		Bin:        "02",
		Capacity:   100,
		ProductSKU: "SKU001",
	}

	label, err := service.GenerateShelfLabel(ctx, data, LabelSize58x40)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Fields["product_sku"] != "SKU001" {
		t.Errorf("Expected product_sku 'SKU001', got %s", label.Fields["product_sku"])
	}
}

func TestLabelService_GenerateShippingLabel_WithDimensions(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	data := ShippingLabelData{
		OrderID:     "ORD002",
		TrackingNum: "TRACK123456",
		Carrier:     "FedEx",
		FromName:    "Sender",
		FromAddress: "123 From St",
		FromCity:    "Kyiv",
		FromPostal:  "01001",
		ToName:      "Recipient",
		ToAddress:   "456 To Ave",
		ToCity:      "Lviv",
		ToPostal:    "79000",
		Weight:      5.0,
		Dimensions:  "30x20x10 cm",
	}

	label, err := service.GenerateShippingLabel(ctx, data, LabelSize100x150)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Fields["dimensions"] != "30x20x10 cm" {
		t.Errorf("Expected dimensions, got %s", label.Fields["dimensions"])
	}
}

func TestLabelService_GenerateBatchLabel_AllFields(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	label, err := service.GenerateBatchLabel(ctx, "BATCH002", "Product XYZ", "2025-12-31", 500, LabelSize40x30)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Fields["quantity"] != "500" {
		t.Errorf("Expected quantity '500', got %s", label.Fields["quantity"])
	}
	if label.Fields["expiry_date"] != "2025-12-31" {
		t.Errorf("Expected expiry_date '2025-12-31', got %s", label.Fields["expiry_date"])
	}
}

func TestLabelService_GeneratePriceTag_NoDiscount(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	label, err := service.GeneratePriceTag(ctx, "SKU003", "Regular Product", 50.00, 0, "UAH", LabelSize30x20)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Fields["old_price"] != "" {
		t.Error("Expected no old_price for non-discounted item")
	}
	if label.Fields["discount"] != "" {
		t.Error("Expected no discount for non-discounted item")
	}
}

func TestLabelService_GeneratePriceTag_WithLowerOldPrice(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	// Old price lower than current price - should not show discount
	label, err := service.GeneratePriceTag(ctx, "SKU004", "Price Increased", 100.00, 80.00, "UAH", LabelSize30x20)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if label.Fields["discount"] != "" {
		t.Error("Expected no discount when old price is lower")
	}
}

func TestLabelService_PrintLabel_LabelNotFound(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.printers["printer1"] = &Printer{ID: "printer1", Name: "Test Printer"}

	_, err := service.PrintLabel(ctx, "nonexistent", "printer1", 1)
	if err == nil {
		t.Error("Expected error for nonexistent label")
	}
}

func TestLabelService_PrintLabel_PrinterNotFound(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.labels["label1"] = &Label{ID: "label1", Type: LabelProduct}

	_, err := service.PrintLabel(ctx, "label1", "nonexistent", 1)
	if err == nil {
		t.Error("Expected error for nonexistent printer")
	}
}

func TestLabelService_PrintBatch_LabelNotFound(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.labels["label1"] = &Label{ID: "label1"}
	repo.printers["printer1"] = &Printer{ID: "printer1"}

	_, err := service.PrintBatch(ctx, []string{"label1", "nonexistent"}, "printer1", 1)
	if err == nil {
		t.Error("Expected error for nonexistent label in batch")
	}
}

func TestLabelService_PrintBatch_PrinterNotFound(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	repo.labels["label1"] = &Label{ID: "label1"}
	repo.labels["label2"] = &Label{ID: "label2"}

	_, err := service.PrintBatch(ctx, []string{"label1", "label2"}, "nonexistent", 1)
	if err == nil {
		t.Error("Expected error for nonexistent printer")
	}
}

func TestLabelService_GetPrintJobStatus_NotFound(t *testing.T) {
	repo := newMockLabelRepository()
	service := NewLabelService(repo)
	ctx := context.Background()

	_, err := service.GetPrintJobStatus(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent print job")
	}
}
