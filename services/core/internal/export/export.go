package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ExportFormat represents export format
type ExportFormat string

const (
	FormatCSV   ExportFormat = "csv"
	FormatExcel ExportFormat = "xlsx"
	FormatJSON  ExportFormat = "json"
)

// ExportConfig represents export configuration
type ExportConfig struct {
	Format      ExportFormat      `json:"format"`
	Columns     []ColumnConfig    `json:"columns,omitempty"`
	SheetName   string            `json:"sheet_name,omitempty"`
	IncludeHeader bool            `json:"include_header"`
	DateFormat  string            `json:"date_format,omitempty"`
	Encoding    string            `json:"encoding,omitempty"` // UTF-8, Windows-1251
	Delimiter   rune              `json:"delimiter,omitempty"` // CSV delimiter
	Filters     map[string]string `json:"filters,omitempty"`
}

// ColumnConfig represents column configuration
type ColumnConfig struct {
	Field  string `json:"field"`
	Header string `json:"header"`
	Width  int    `json:"width,omitempty"`
	Format string `json:"format,omitempty"` // number, currency, date, percent
}

// DefaultExportConfig returns default configuration
func DefaultExportConfig() ExportConfig {
	return ExportConfig{
		Format:        FormatExcel,
		IncludeHeader: true,
		DateFormat:    "02.01.2006",
		Encoding:      "UTF-8",
		Delimiter:     ',',
		SheetName:     "Data",
	}
}

// ExportResult represents export result
type ExportResult struct {
	Data        []byte `json:"data,omitempty"`
	ContentType string `json:"content_type"`
	Filename    string `json:"filename"`
	RecordCount int    `json:"record_count"`
}

// Exporter provides export functionality
type Exporter struct {
	config ExportConfig
}

// NewExporter creates exporter
func NewExporter(config ExportConfig) *Exporter {
	if config.DateFormat == "" {
		config.DateFormat = "02.01.2006"
	}
	if config.SheetName == "" {
		config.SheetName = "Data"
	}
	return &Exporter{config: config}
}

// Export exports data to specified format
func (e *Exporter) Export(ctx context.Context, data interface{}, filename string) (*ExportResult, error) {
	switch e.config.Format {
	case FormatCSV:
		return e.exportCSV(data, filename)
	case FormatExcel:
		return e.exportExcel(data, filename)
	case FormatJSON:
		return e.exportJSON(data, filename)
	default:
		return nil, fmt.Errorf("unsupported format: %s", e.config.Format)
	}
}

func (e *Exporter) exportCSV(data interface{}, filename string) (*ExportResult, error) {
	var buf bytes.Buffer

	// Add BOM for Excel UTF-8 compatibility
	if e.config.Encoding == "UTF-8" {
		buf.Write([]byte{0xEF, 0xBB, 0xBF})
	}

	writer := csv.NewWriter(&buf)
	writer.Comma = e.config.Delimiter
	if e.config.Delimiter == 0 {
		writer.Comma = ','
	}

	rows, headers := e.dataToRows(data)

	if e.config.IncludeHeader && len(headers) > 0 {
		if err := writer.Write(headers); err != nil {
			return nil, err
		}
	}

	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return &ExportResult{
		Data:        buf.Bytes(),
		ContentType: "text/csv; charset=utf-8",
		Filename:    filename + ".csv",
		RecordCount: len(rows),
	}, nil
}

func (e *Exporter) exportExcel(data interface{}, filename string) (*ExportResult, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := e.config.SheetName
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)

	rows, headers := e.dataToRows(data)

	// Write headers with styling
	if e.config.IncludeHeader && len(headers) > 0 {
		headerStyle, _ := f.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Size: 11, Color: "#FFFFFF"},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
			Border: []excelize.Border{
				{Type: "left", Color: "#000000", Style: 1},
				{Type: "right", Color: "#000000", Style: 1},
				{Type: "top", Color: "#000000", Style: 1},
				{Type: "bottom", Color: "#000000", Style: 1},
			},
		})

		for col, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(col+1, 1)
			f.SetCellValue(sheetName, cell, header)
			f.SetCellStyle(sheetName, cell, cell, headerStyle)

			// Set column width
			colName, _ := excelize.ColumnNumberToName(col + 1)
			width := e.getColumnWidth(col, header)
			f.SetColWidth(sheetName, colName, colName, float64(width))
		}
	}

	// Write data rows
	startRow := 1
	if e.config.IncludeHeader {
		startRow = 2
	}

	for rowIdx, row := range rows {
		for col, value := range row {
			cell, _ := excelize.CoordinatesToCellName(col+1, startRow+rowIdx)
			f.SetCellValue(sheetName, cell, e.formatCellValue(value, col))
		}
	}

	// Add autofilter
	if len(rows) > 0 && len(headers) > 0 {
		lastCol, _ := excelize.ColumnNumberToName(len(headers))
		lastRow := startRow + len(rows) - 1
		if e.config.IncludeHeader {
			f.AutoFilter(sheetName, fmt.Sprintf("A1:%s%d", lastCol, lastRow), nil)
		}
	}

	// Freeze header row
	if e.config.IncludeHeader {
		f.SetPanes(sheetName, &excelize.Panes{
			Freeze:      true,
			Split:       false,
			XSplit:      0,
			YSplit:      1,
			TopLeftCell: "A2",
			ActivePane:  "bottomLeft",
		})
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}

	return &ExportResult{
		Data:        buf.Bytes(),
		ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		Filename:    filename + ".xlsx",
		RecordCount: len(rows),
	}, nil
}

func (e *Exporter) exportJSON(data interface{}, filename string) (*ExportResult, error) {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return nil, err
	}

	// Count records
	recordCount := 0
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Slice {
		recordCount = v.Len()
	} else {
		recordCount = 1
	}

	return &ExportResult{
		Data:        jsonData,
		ContentType: "application/json; charset=utf-8",
		Filename:    filename + ".json",
		RecordCount: recordCount,
	}, nil
}

func (e *Exporter) dataToRows(data interface{}) ([][]string, []string) {
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Slice {
		return nil, nil
	}

	if v.Len() == 0 {
		return nil, nil
	}

	// Check if slice contains maps
	elem := v.Index(0)
	if elem.Kind() == reflect.Interface {
		elem = elem.Elem()
	}
	isMap := elem.Kind() == reflect.Map

	// Get headers from first element or config
	var headers []string
	var fields []string

	if len(e.config.Columns) > 0 {
		for _, col := range e.config.Columns {
			headers = append(headers, col.Header)
			fields = append(fields, col.Field)
		}
	} else if isMap {
		// Auto-detect from map keys
		for _, key := range elem.MapKeys() {
			keyStr := fmt.Sprintf("%v", key.Interface())
			headers = append(headers, keyStr)
			fields = append(fields, keyStr)
		}
	} else {
		// Auto-detect from struct
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}
		t := elem.Type()

		for i := 0; i < t.NumField(); i++ {
			field := t.Field(i)
			if field.PkgPath != "" { // Skip unexported fields
				continue
			}

			// Use JSON tag as header if available
			header := field.Name
			if jsonTag := field.Tag.Get("json"); jsonTag != "" {
				parts := strings.Split(jsonTag, ",")
				if parts[0] != "-" {
					header = parts[0]
				}
			}

			headers = append(headers, header)
			fields = append(fields, field.Name)
		}
	}

	// Convert data to rows
	rows := make([][]string, 0, v.Len())
	for i := 0; i < v.Len(); i++ {
		elem := v.Index(i)
		if elem.Kind() == reflect.Interface {
			elem = elem.Elem()
		}
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}

		row := make([]string, len(fields))
		if elem.Kind() == reflect.Map {
			// Handle map type
			for j, fieldName := range fields {
				mapVal := elem.MapIndex(reflect.ValueOf(fieldName))
				if mapVal.IsValid() {
					if mapVal.Kind() == reflect.Interface {
						mapVal = mapVal.Elem()
					}
					row[j] = e.formatValue(mapVal)
				}
			}
		} else {
			// Handle struct type
			for j, fieldName := range fields {
				field := elem.FieldByName(fieldName)
				if !field.IsValid() {
					// Try nested field (e.g., "Customer.Name")
					parts := strings.Split(fieldName, ".")
					field = elem
					for _, part := range parts {
						if field.Kind() == reflect.Ptr {
							field = field.Elem()
						}
						field = field.FieldByName(part)
						if !field.IsValid() {
							break
						}
					}
				}

				if field.IsValid() {
					row[j] = e.formatValue(field)
				}
			}
		}
		rows = append(rows, row)
	}

	return rows, headers
}

func (e *Exporter) formatValue(v reflect.Value) string {
	if !v.IsValid() {
		return ""
	}

	switch v.Kind() {
	case reflect.Ptr:
		if v.IsNil() {
			return ""
		}
		return e.formatValue(v.Elem())
	case reflect.String:
		return v.String()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(v.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return strconv.FormatUint(v.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		return strconv.FormatFloat(v.Float(), 'f', 2, 64)
	case reflect.Bool:
		if v.Bool() {
			return "Так"
		}
		return "Ні"
	case reflect.Struct:
		// Handle time.Time
		if t, ok := v.Interface().(time.Time); ok {
			if t.IsZero() {
				return ""
			}
			return t.Format(e.config.DateFormat)
		}
	case reflect.Slice:
		// Handle []string
		if v.Type().Elem().Kind() == reflect.String {
			strs := make([]string, v.Len())
			for i := 0; i < v.Len(); i++ {
				strs[i] = v.Index(i).String()
			}
			return strings.Join(strs, ", ")
		}
	}

	return fmt.Sprintf("%v", v.Interface())
}

func (e *Exporter) getColumnWidth(col int, header string) int {
	// Check configured width
	if col < len(e.config.Columns) && e.config.Columns[col].Width > 0 {
		return e.config.Columns[col].Width
	}

	// Calculate from header length
	width := len(header) + 4
	if width < 10 {
		width = 10
	}
	if width > 50 {
		width = 50
	}
	return width
}

func (e *Exporter) formatCellValue(value string, col int) interface{} {
	// Try to convert to number for Excel
	if f, err := strconv.ParseFloat(value, 64); err == nil {
		return f
	}
	return value
}

// Export helpers for common entities

// ExportProducts exports products to file
func ExportProducts(ctx context.Context, products interface{}, format ExportFormat) (*ExportResult, error) {
	config := DefaultExportConfig()
	config.Format = format
	config.Columns = []ColumnConfig{
		{Field: "SKU", Header: "Артикул", Width: 15},
		{Field: "Name", Header: "Назва", Width: 40},
		{Field: "Category", Header: "Категорія", Width: 20},
		{Field: "Price", Header: "Ціна", Width: 12, Format: "currency"},
		{Field: "Stock", Header: "Залишок", Width: 10},
		{Field: "IsActive", Header: "Активний", Width: 10},
	}

	exporter := NewExporter(config)
	return exporter.Export(ctx, products, "products_"+time.Now().Format("20060102"))
}

// ExportOrders exports orders to file
func ExportOrders(ctx context.Context, orders interface{}, format ExportFormat) (*ExportResult, error) {
	config := DefaultExportConfig()
	config.Format = format
	config.Columns = []ColumnConfig{
		{Field: "Number", Header: "Номер замовлення", Width: 18},
		{Field: "Date", Header: "Дата", Width: 12},
		{Field: "CustomerName", Header: "Клієнт", Width: 25},
		{Field: "CustomerPhone", Header: "Телефон", Width: 15},
		{Field: "Status", Header: "Статус", Width: 15},
		{Field: "Total", Header: "Сума", Width: 12, Format: "currency"},
		{Field: "PaymentStatus", Header: "Оплата", Width: 12},
		{Field: "ShippingMethod", Header: "Доставка", Width: 20},
	}

	exporter := NewExporter(config)
	return exporter.Export(ctx, orders, "orders_"+time.Now().Format("20060102"))
}

// ExportCustomers exports customers to file
func ExportCustomers(ctx context.Context, customers interface{}, format ExportFormat) (*ExportResult, error) {
	config := DefaultExportConfig()
	config.Format = format
	config.Columns = []ColumnConfig{
		{Field: "Name", Header: "Ім'я", Width: 25},
		{Field: "Email", Header: "Email", Width: 30},
		{Field: "Phone", Header: "Телефон", Width: 15},
		{Field: "OrderCount", Header: "Замовлень", Width: 12},
		{Field: "TotalSpent", Header: "Витрачено", Width: 15, Format: "currency"},
		{Field: "CreatedAt", Header: "Дата реєстрації", Width: 15},
	}

	exporter := NewExporter(config)
	return exporter.Export(ctx, customers, "customers_"+time.Now().Format("20060102"))
}

// ExportInventory exports inventory to file
func ExportInventory(ctx context.Context, inventory interface{}, format ExportFormat) (*ExportResult, error) {
	config := DefaultExportConfig()
	config.Format = format
	config.Columns = []ColumnConfig{
		{Field: "SKU", Header: "Артикул", Width: 15},
		{Field: "Name", Header: "Назва", Width: 40},
		{Field: "Warehouse", Header: "Склад", Width: 20},
		{Field: "Stock", Header: "Кількість", Width: 12},
		{Field: "Reserved", Header: "Резерв", Width: 10},
		{Field: "Available", Header: "Доступно", Width: 10},
		{Field: "Price", Header: "Ціна", Width: 12, Format: "currency"},
		{Field: "Value", Header: "Вартість", Width: 15, Format: "currency"},
	}

	exporter := NewExporter(config)
	return exporter.Export(ctx, inventory, "inventory_"+time.Now().Format("20060102"))
}

// StreamExporter provides streaming export for large datasets
type StreamExporter struct {
	writer  io.Writer
	config  ExportConfig
	headers []string
	rowNum  int
}

// NewStreamExporter creates streaming exporter
func NewStreamExporter(w io.Writer, config ExportConfig) *StreamExporter {
	return &StreamExporter{
		writer: w,
		config: config,
	}
}

// WriteHeader writes header row
func (e *StreamExporter) WriteHeader(headers []string) error {
	e.headers = headers

	if e.config.Format == FormatCSV {
		// Write BOM
		if e.config.Encoding == "UTF-8" {
			e.writer.Write([]byte{0xEF, 0xBB, 0xBF})
		}

		csvWriter := csv.NewWriter(e.writer)
		defer csvWriter.Flush()
		return csvWriter.Write(headers)
	}

	return nil
}

// WriteRow writes single data row
func (e *StreamExporter) WriteRow(row []string) error {
	e.rowNum++

	if e.config.Format == FormatCSV {
		csvWriter := csv.NewWriter(e.writer)
		defer csvWriter.Flush()
		return csvWriter.Write(row)
	}

	return nil
}

// Flush flushes any buffered data
func (e *StreamExporter) Flush() error {
	return nil
}
