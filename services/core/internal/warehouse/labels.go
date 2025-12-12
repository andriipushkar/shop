package warehouse

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/png"
	"time"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/code128"
	"github.com/boombuler/barcode/ean"
	"github.com/boombuler/barcode/qr"
)

// Label-related errors
var (
	ErrInvalidBarcodeType = errors.New("invalid barcode type")
	ErrBarcodeGeneration  = errors.New("failed to generate barcode")
	ErrInvalidLabelSize   = errors.New("invalid label size")
)

// BarcodeType represents barcode encoding type
type BarcodeType string

const (
	BarcodeEAN13   BarcodeType = "ean13"
	BarcodeEAN8    BarcodeType = "ean8"
	BarcodeCode128 BarcodeType = "code128"
	BarcodeQR      BarcodeType = "qr"
)

// LabelType represents label template type
type LabelType string

const (
	LabelProduct  LabelType = "product"   // Product label with barcode
	LabelShelf    LabelType = "shelf"     // Shelf/bin label
	LabelPrice    LabelType = "price"     // Price tag
	LabelShipping LabelType = "shipping"  // Shipping label
	LabelBatch    LabelType = "batch"     // Batch/lot label
	LabelPallet   LabelType = "pallet"    // Pallet label
	LabelSerial   LabelType = "serial"    // Serial number label
)

// LabelSize represents label dimensions
type LabelSize struct {
	Name   string  `json:"name"`
	Width  float64 `json:"width"`  // in mm
	Height float64 `json:"height"` // in mm
	DPI    int     `json:"dpi"`
}

// Common label sizes
var (
	LabelSize30x20 = LabelSize{Name: "30x20", Width: 30, Height: 20, DPI: 203}
	LabelSize40x30 = LabelSize{Name: "40x30", Width: 40, Height: 30, DPI: 203}
	LabelSize58x40 = LabelSize{Name: "58x40", Width: 58, Height: 40, DPI: 203}
	LabelSize100x50 = LabelSize{Name: "100x50", Width: 100, Height: 50, DPI: 203}
	LabelSize100x150 = LabelSize{Name: "100x150", Width: 100, Height: 150, DPI: 203}
)

// Label represents a printable label
type Label struct {
	ID          string            `json:"id"`
	Type        LabelType         `json:"type"`
	Size        LabelSize         `json:"size"`
	BarcodeType BarcodeType       `json:"barcode_type"`
	BarcodeData string            `json:"barcode_data"`
	Fields      map[string]string `json:"fields"`
	ImageBase64 string            `json:"image_base64,omitempty"`
	ZPLCode     string            `json:"zpl_code,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

// ProductLabelData contains product label info
type ProductLabelData struct {
	SKU         string  `json:"sku"`
	Barcode     string  `json:"barcode"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Currency    string  `json:"currency"`
	Location    string  `json:"location,omitempty"`
	BatchNumber string  `json:"batch_number,omitempty"`
}

// ShelfLabelData contains shelf label info
type ShelfLabelData struct {
	Location   string `json:"location"`
	Zone       string `json:"zone"`
	Row        string `json:"row"`
	Shelf      string `json:"shelf"`
	Bin        string `json:"bin"`
	Capacity   int    `json:"capacity,omitempty"`
	ProductSKU string `json:"product_sku,omitempty"`
}

// ShippingLabelData contains shipping label info
type ShippingLabelData struct {
	OrderID      string `json:"order_id"`
	TrackingNum  string `json:"tracking_number"`
	Carrier      string `json:"carrier"`
	FromName     string `json:"from_name"`
	FromAddress  string `json:"from_address"`
	FromCity     string `json:"from_city"`
	FromPostal   string `json:"from_postal"`
	ToName       string `json:"to_name"`
	ToAddress    string `json:"to_address"`
	ToCity       string `json:"to_city"`
	ToPostal     string `json:"to_postal"`
	Weight       float64 `json:"weight"`
	Dimensions   string `json:"dimensions,omitempty"`
}

// PrintJob represents a print job
type PrintJob struct {
	ID        string    `json:"id"`
	PrinterID string    `json:"printer_id"`
	Labels    []*Label  `json:"labels"`
	Copies    int       `json:"copies"`
	Status    string    `json:"status"` // pending, printing, completed, failed
	Error     string    `json:"error,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	PrintedAt *time.Time `json:"printed_at,omitempty"`
}

// Printer represents a label printer
type Printer struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"` // zebra, dymo, brother, generic
	Connection string `json:"connection"` // usb, network, bluetooth
	Address    string `json:"address,omitempty"`
	Port       int    `json:"port,omitempty"`
	IsDefault  bool   `json:"is_default"`
	IsOnline   bool   `json:"is_online"`
	SupportedSizes []LabelSize `json:"supported_sizes"`
}

// LabelRepository defines label data access
type LabelRepository interface {
	// Labels
	CreateLabel(ctx context.Context, label *Label) error
	GetLabel(ctx context.Context, id string) (*Label, error)
	ListLabels(ctx context.Context, labelType LabelType, limit int) ([]*Label, error)

	// Print Jobs
	CreatePrintJob(ctx context.Context, job *PrintJob) error
	UpdatePrintJob(ctx context.Context, job *PrintJob) error
	GetPrintJob(ctx context.Context, id string) (*PrintJob, error)
	ListPrintJobs(ctx context.Context, status string, limit int) ([]*PrintJob, error)

	// Printers
	CreatePrinter(ctx context.Context, printer *Printer) error
	UpdatePrinter(ctx context.Context, printer *Printer) error
	GetPrinter(ctx context.Context, id string) (*Printer, error)
	ListPrinters(ctx context.Context) ([]*Printer, error)
	GetDefaultPrinter(ctx context.Context) (*Printer, error)
}

// LabelService manages label generation and printing
type LabelService struct {
	repo LabelRepository
}

// NewLabelService creates label service
func NewLabelService(repo LabelRepository) *LabelService {
	return &LabelService{repo: repo}
}

// GenerateBarcode generates barcode image
func (s *LabelService) GenerateBarcode(data string, barcodeType BarcodeType, width, height int) (string, error) {
	var bc barcode.Barcode
	var err error

	switch barcodeType {
	case BarcodeEAN13:
		bc, err = ean.Encode(data)
	case BarcodeEAN8:
		bc, err = ean.Encode(data)
	case BarcodeCode128:
		bc, err = code128.Encode(data)
	case BarcodeQR:
		bc, err = qr.Encode(data, qr.M, qr.Auto)
	default:
		return "", ErrInvalidBarcodeType
	}

	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	// Scale barcode
	bc, err = barcode.Scale(bc, width, height)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	// Encode to PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, bc); err != nil {
		return "", fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	// Return base64 encoded
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// GenerateProductLabel generates product label
func (s *LabelService) GenerateProductLabel(ctx context.Context, data ProductLabelData, size LabelSize) (*Label, error) {
	// Generate barcode
	barcodeType := BarcodeCode128
	if len(data.Barcode) == 13 {
		barcodeType = BarcodeEAN13
	} else if len(data.Barcode) == 8 {
		barcodeType = BarcodeEAN8
	}

	barcodeWidth := int(size.Width * float64(size.DPI) / 25.4 * 0.8)
	barcodeHeight := int(size.Height * float64(size.DPI) / 25.4 * 0.3)

	barcodeImg, err := s.GenerateBarcode(data.Barcode, barcodeType, barcodeWidth, barcodeHeight)
	if err != nil {
		return nil, err
	}

	label := &Label{
		ID:          generateID(),
		Type:        LabelProduct,
		Size:        size,
		BarcodeType: barcodeType,
		BarcodeData: data.Barcode,
		Fields: map[string]string{
			"sku":          data.SKU,
			"name":         data.Name,
			"price":        fmt.Sprintf("%.2f %s", data.Price, data.Currency),
			"location":     data.Location,
			"batch_number": data.BatchNumber,
		},
		ImageBase64: barcodeImg,
		ZPLCode:     s.generateProductZPL(data, size),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLabel(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

// GenerateShelfLabel generates shelf/location label
func (s *LabelService) GenerateShelfLabel(ctx context.Context, data ShelfLabelData, size LabelSize) (*Label, error) {
	// Generate QR code for location
	locationCode := fmt.Sprintf("%s-%s-%s-%s", data.Zone, data.Row, data.Shelf, data.Bin)

	barcodeWidth := int(size.Width * float64(size.DPI) / 25.4 * 0.4)
	barcodeHeight := barcodeWidth

	barcodeImg, err := s.GenerateBarcode(locationCode, BarcodeQR, barcodeWidth, barcodeHeight)
	if err != nil {
		return nil, err
	}

	label := &Label{
		ID:          generateID(),
		Type:        LabelShelf,
		Size:        size,
		BarcodeType: BarcodeQR,
		BarcodeData: locationCode,
		Fields: map[string]string{
			"location":    data.Location,
			"zone":        data.Zone,
			"row":         data.Row,
			"shelf":       data.Shelf,
			"bin":         data.Bin,
			"capacity":    fmt.Sprintf("%d", data.Capacity),
			"product_sku": data.ProductSKU,
		},
		ImageBase64: barcodeImg,
		ZPLCode:     s.generateShelfZPL(data, size),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLabel(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

// GenerateShippingLabel generates shipping label
func (s *LabelService) GenerateShippingLabel(ctx context.Context, data ShippingLabelData, size LabelSize) (*Label, error) {
	// Generate barcode for tracking number
	barcodeWidth := int(size.Width * float64(size.DPI) / 25.4 * 0.9)
	barcodeHeight := int(size.Height * float64(size.DPI) / 25.4 * 0.2)

	barcodeImg, err := s.GenerateBarcode(data.TrackingNum, BarcodeCode128, barcodeWidth, barcodeHeight)
	if err != nil {
		return nil, err
	}

	label := &Label{
		ID:          generateID(),
		Type:        LabelShipping,
		Size:        size,
		BarcodeType: BarcodeCode128,
		BarcodeData: data.TrackingNum,
		Fields: map[string]string{
			"order_id":        data.OrderID,
			"tracking_number": data.TrackingNum,
			"carrier":         data.Carrier,
			"from_name":       data.FromName,
			"from_address":    data.FromAddress,
			"from_city":       data.FromCity,
			"from_postal":     data.FromPostal,
			"to_name":         data.ToName,
			"to_address":      data.ToAddress,
			"to_city":         data.ToCity,
			"to_postal":       data.ToPostal,
			"weight":          fmt.Sprintf("%.2f kg", data.Weight),
			"dimensions":      data.Dimensions,
		},
		ImageBase64: barcodeImg,
		ZPLCode:     s.generateShippingZPL(data, size),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLabel(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

// GenerateBatchLabel generates batch/lot label
func (s *LabelService) GenerateBatchLabel(ctx context.Context, batchNumber, productName, expiryDate string, quantity int, size LabelSize) (*Label, error) {
	barcodeWidth := int(size.Width * float64(size.DPI) / 25.4 * 0.8)
	barcodeHeight := int(size.Height * float64(size.DPI) / 25.4 * 0.3)

	barcodeImg, err := s.GenerateBarcode(batchNumber, BarcodeCode128, barcodeWidth, barcodeHeight)
	if err != nil {
		return nil, err
	}

	label := &Label{
		ID:          generateID(),
		Type:        LabelBatch,
		Size:        size,
		BarcodeType: BarcodeCode128,
		BarcodeData: batchNumber,
		Fields: map[string]string{
			"batch_number": batchNumber,
			"product_name": productName,
			"expiry_date":  expiryDate,
			"quantity":     fmt.Sprintf("%d", quantity),
		},
		ImageBase64: barcodeImg,
		ZPLCode:     s.generateBatchZPL(batchNumber, productName, expiryDate, quantity, size),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLabel(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

// GeneratePriceTag generates price tag
func (s *LabelService) GeneratePriceTag(ctx context.Context, sku, name string, price, oldPrice float64, currency string, size LabelSize) (*Label, error) {
	barcodeWidth := int(size.Width * float64(size.DPI) / 25.4 * 0.6)
	barcodeHeight := int(size.Height * float64(size.DPI) / 25.4 * 0.25)

	barcodeImg, err := s.GenerateBarcode(sku, BarcodeCode128, barcodeWidth, barcodeHeight)
	if err != nil {
		return nil, err
	}

	fields := map[string]string{
		"sku":      sku,
		"name":     name,
		"price":    fmt.Sprintf("%.2f %s", price, currency),
		"currency": currency,
	}

	if oldPrice > 0 && oldPrice > price {
		fields["old_price"] = fmt.Sprintf("%.2f %s", oldPrice, currency)
		discount := ((oldPrice - price) / oldPrice) * 100
		fields["discount"] = fmt.Sprintf("-%.0f%%", discount)
	}

	label := &Label{
		ID:          generateID(),
		Type:        LabelPrice,
		Size:        size,
		BarcodeType: BarcodeCode128,
		BarcodeData: sku,
		Fields:      fields,
		ImageBase64: barcodeImg,
		ZPLCode:     s.generatePriceZPL(sku, name, price, oldPrice, currency, size),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLabel(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

// PrintLabel sends label to printer
func (s *LabelService) PrintLabel(ctx context.Context, labelID, printerID string, copies int) (*PrintJob, error) {
	label, err := s.repo.GetLabel(ctx, labelID)
	if err != nil {
		return nil, err
	}

	printer, err := s.repo.GetPrinter(ctx, printerID)
	if err != nil {
		return nil, err
	}

	job := &PrintJob{
		ID:        generateID(),
		PrinterID: printer.ID,
		Labels:    []*Label{label},
		Copies:    copies,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreatePrintJob(ctx, job); err != nil {
		return nil, err
	}

	// Send to printer (implementation depends on printer type)
	go s.executePrintJob(ctx, job, printer)

	return job, nil
}

// PrintBatch prints multiple labels
func (s *LabelService) PrintBatch(ctx context.Context, labelIDs []string, printerID string, copies int) (*PrintJob, error) {
	labels := make([]*Label, 0, len(labelIDs))
	for _, id := range labelIDs {
		label, err := s.repo.GetLabel(ctx, id)
		if err != nil {
			return nil, err
		}
		labels = append(labels, label)
	}

	printer, err := s.repo.GetPrinter(ctx, printerID)
	if err != nil {
		return nil, err
	}

	job := &PrintJob{
		ID:        generateID(),
		PrinterID: printer.ID,
		Labels:    labels,
		Copies:    copies,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreatePrintJob(ctx, job); err != nil {
		return nil, err
	}

	go s.executePrintJob(ctx, job, printer)

	return job, nil
}

// GetPrintJobStatus returns print job status
func (s *LabelService) GetPrintJobStatus(ctx context.Context, jobID string) (*PrintJob, error) {
	return s.repo.GetPrintJob(ctx, jobID)
}

// ListPrinters returns available printers
func (s *LabelService) ListPrinters(ctx context.Context) ([]*Printer, error) {
	return s.repo.ListPrinters(ctx)
}

// executePrintJob sends job to printer
func (s *LabelService) executePrintJob(ctx context.Context, job *PrintJob, printer *Printer) {
	job.Status = "printing"
	s.repo.UpdatePrintJob(ctx, job)

	// Simulate printing (actual implementation would send to printer)
	// For network printers, use TCP connection
	// For USB printers, use system print commands

	now := time.Now()
	job.Status = "completed"
	job.PrintedAt = &now
	s.repo.UpdatePrintJob(ctx, job)
}

// ZPL generation for Zebra printers

func (s *LabelService) generateProductZPL(data ProductLabelData, size LabelSize) string {
	return fmt.Sprintf(`^XA
^FO50,30^A0N,30,30^FD%s^FS
^FO50,70^A0N,20,20^FD%s^FS
^FO50,100^BY2^BCN,80,Y,N,N^FD%s^FS
^FO50,200^A0N,40,40^FD%s^FS
^XZ`, data.Name, data.SKU, data.Barcode, fmt.Sprintf("%.2f", data.Price))
}

func (s *LabelService) generateShelfZPL(data ShelfLabelData, size LabelSize) string {
	return fmt.Sprintf(`^XA
^FO50,30^A0N,60,60^FD%s^FS
^FO50,100^A0N,30,30^FDZone: %s Row: %s^FS
^FO50,140^A0N,30,30^FDShelf: %s Bin: %s^FS
^FO50,180^BQN,2,5^FDQA,%s^FS
^XZ`, data.Location, data.Zone, data.Row, data.Shelf, data.Bin, data.Location)
}

func (s *LabelService) generateShippingZPL(data ShippingLabelData, size LabelSize) string {
	return fmt.Sprintf(`^XA
^FO50,30^A0N,25,25^FDFROM:^FS
^FO50,60^A0N,20,20^FD%s^FS
^FO50,85^A0N,20,20^FD%s^FS
^FO50,110^A0N,20,20^FD%s %s^FS
^FO50,150^A0N,25,25^FDTO:^FS
^FO50,180^A0N,30,30^FD%s^FS
^FO50,220^A0N,25,25^FD%s^FS
^FO50,250^A0N,25,25^FD%s %s^FS
^FO50,300^BY3^BCN,100,Y,N,N^FD%s^FS
^FO50,420^A0N,25,25^FDWeight: %s^FS
^XZ`,
		data.FromName, data.FromAddress, data.FromCity, data.FromPostal,
		data.ToName, data.ToAddress, data.ToCity, data.ToPostal,
		data.TrackingNum, fmt.Sprintf("%.2f kg", data.Weight))
}

func (s *LabelService) generateBatchZPL(batchNumber, productName, expiryDate string, quantity int, size LabelSize) string {
	return fmt.Sprintf(`^XA
^FO50,30^A0N,30,30^FDBatch: %s^FS
^FO50,70^A0N,25,25^FD%s^FS
^FO50,110^BY2^BCN,80,Y,N,N^FD%s^FS
^FO50,210^A0N,25,25^FDExpiry: %s^FS
^FO50,250^A0N,25,25^FDQty: %d^FS
^XZ`, batchNumber, productName, batchNumber, expiryDate, quantity)
}

func (s *LabelService) generatePriceZPL(sku, name string, price, oldPrice float64, currency string, size LabelSize) string {
	priceStr := fmt.Sprintf("%.2f %s", price, currency)
	zpl := fmt.Sprintf(`^XA
^FO50,30^A0N,25,25^FD%s^FS
^FO50,60^A0N,20,20^FD%s^FS
^FO50,100^BY2^BCN,60,Y,N,N^FD%s^FS
^FO50,180^A0N,50,50^FD%s^FS`, name, sku, sku, priceStr)

	if oldPrice > 0 && oldPrice > price {
		oldPriceStr := fmt.Sprintf("%.2f %s", oldPrice, currency)
		discount := ((oldPrice - price) / oldPrice) * 100
		zpl += fmt.Sprintf(`
^FO50,240^A0N,25,25^FO50,240^FR^A0N,25,25^FD%s^FS
^FO200,200^A0N,40,40^FD-%.0f%%^FS`, oldPriceStr, discount)
	}

	zpl += "\n^XZ"
	return zpl
}

// BarcodeImage is a helper for generating barcode images
type BarcodeImage struct {
	Image  image.Image
	Base64 string
	Width  int
	Height int
}

// GenerateBarcodeImage generates barcode as image
func (s *LabelService) GenerateBarcodeImage(data string, barcodeType BarcodeType, width, height int) (*BarcodeImage, error) {
	var bc barcode.Barcode
	var err error

	switch barcodeType {
	case BarcodeEAN13:
		bc, err = ean.Encode(data)
	case BarcodeEAN8:
		bc, err = ean.Encode(data)
	case BarcodeCode128:
		bc, err = code128.Encode(data)
	case BarcodeQR:
		bc, err = qr.Encode(data, qr.M, qr.Auto)
	default:
		return nil, ErrInvalidBarcodeType
	}

	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	bc, err = barcode.Scale(bc, width, height)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, bc); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBarcodeGeneration, err)
	}

	return &BarcodeImage{
		Image:  bc,
		Base64: base64.StdEncoding.EncodeToString(buf.Bytes()),
		Width:  width,
		Height: height,
	}, nil
}
