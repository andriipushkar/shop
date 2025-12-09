package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// Common import errors
var (
	ErrInvalidFormat     = errors.New("invalid file format")
	ErrEmptyFile         = errors.New("file is empty")
	ErrMissingColumns    = errors.New("missing required columns")
	ErrInvalidData       = errors.New("invalid data")
	ErrDuplicateEntry    = errors.New("duplicate entry")
)

// ImportConfig represents import configuration
type ImportConfig struct {
	Format       ExportFormat           `json:"format"`
	ColumnMap    map[string]string      `json:"column_map"`      // file column -> struct field
	RequiredCols []string               `json:"required_cols"`
	SheetName    string                 `json:"sheet_name"`
	SkipRows     int                    `json:"skip_rows"`
	DateFormats  []string               `json:"date_formats"`
	Encoding     string                 `json:"encoding"`
	Delimiter    rune                   `json:"delimiter"`
	Validators   map[string]ValidatorFunc `json:"-"`
}

// ValidatorFunc validates field value
type ValidatorFunc func(value string) error

// ImportResult represents import result
type ImportResult struct {
	TotalRows    int           `json:"total_rows"`
	ImportedRows int           `json:"imported_rows"`
	SkippedRows  int           `json:"skipped_rows"`
	ErrorRows    int           `json:"error_rows"`
	Errors       []ImportError `json:"errors,omitempty"`
	Data         interface{}   `json:"-"`
}

// ImportError represents import error
type ImportError struct {
	Row     int    `json:"row"`
	Column  string `json:"column,omitempty"`
	Value   string `json:"value,omitempty"`
	Message string `json:"message"`
}

// Importer provides import functionality
type Importer struct {
	config ImportConfig
}

// NewImporter creates importer
func NewImporter(config ImportConfig) *Importer {
	if len(config.DateFormats) == 0 {
		config.DateFormats = []string{
			"02.01.2006",
			"2006-01-02",
			"02/01/2006",
			"01.02.2006",
			"02-01-2006",
			"2006-01-02T15:04:05",
		}
	}
	return &Importer{config: config}
}

// Import imports data from file
func (i *Importer) Import(ctx context.Context, reader io.Reader, target interface{}) (*ImportResult, error) {
	// Read all data
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, ErrEmptyFile
	}

	switch i.config.Format {
	case FormatCSV:
		return i.importCSV(data, target)
	case FormatExcel:
		return i.importExcel(data, target)
	case FormatJSON:
		return i.importJSON(data, target)
	default:
		return nil, ErrInvalidFormat
	}
}

func (i *Importer) importCSV(data []byte, target interface{}) (*ImportResult, error) {
	// Remove BOM if present
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		data = data[3:]
	}

	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = i.config.Delimiter
	if i.config.Delimiter == 0 {
		reader.Comma = ','
	}
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	return i.processRecords(records, target)
}

func (i *Importer) importExcel(data []byte, target interface{}) (*ImportResult, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sheetName := i.config.SheetName
	if sheetName == "" {
		sheetName = f.GetSheetName(0)
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, err
	}

	return i.processRecords(rows, target)
}

func (i *Importer) importJSON(data []byte, target interface{}) (*ImportResult, error) {
	if err := json.Unmarshal(data, target); err != nil {
		return nil, err
	}

	v := reflect.ValueOf(target).Elem()
	count := 0
	if v.Kind() == reflect.Slice {
		count = v.Len()
	}

	return &ImportResult{
		TotalRows:    count,
		ImportedRows: count,
		Data:         target,
	}, nil
}

func (i *Importer) processRecords(records [][]string, target interface{}) (*ImportResult, error) {
	if len(records) == 0 {
		return nil, ErrEmptyFile
	}

	result := &ImportResult{
		TotalRows: len(records) - i.config.SkipRows - 1, // Exclude header
		Errors:    make([]ImportError, 0),
	}

	// Get target slice type
	targetVal := reflect.ValueOf(target)
	if targetVal.Kind() != reflect.Ptr || targetVal.Elem().Kind() != reflect.Slice {
		return nil, errors.New("target must be a pointer to slice")
	}

	sliceVal := targetVal.Elem()
	elemType := sliceVal.Type().Elem()
	if elemType.Kind() == reflect.Ptr {
		elemType = elemType.Elem()
	}

	// Skip initial rows
	startRow := i.config.SkipRows
	if startRow >= len(records) {
		return nil, ErrEmptyFile
	}

	// Map headers to column indices
	headers := records[startRow]
	headerMap := i.mapHeaders(headers, elemType)

	// Check required columns
	for _, col := range i.config.RequiredCols {
		if _, ok := headerMap[col]; !ok {
			return nil, fmt.Errorf("%w: %s", ErrMissingColumns, col)
		}
	}

	// Process data rows
	for rowIdx := startRow + 1; rowIdx < len(records); rowIdx++ {
		row := records[rowIdx]

		// Skip empty rows
		if isEmptyRow(row) {
			result.SkippedRows++
			continue
		}

		// Create new element
		newElem := reflect.New(elemType).Elem()

		hasError := false
		for fieldName, colIdx := range headerMap {
			if colIdx >= len(row) {
				continue
			}

			value := strings.TrimSpace(row[colIdx])

			// Validate if validator exists
			if validator, ok := i.config.Validators[fieldName]; ok {
				if err := validator(value); err != nil {
					result.Errors = append(result.Errors, ImportError{
						Row:     rowIdx + 1,
						Column:  fieldName,
						Value:   value,
						Message: err.Error(),
					})
					hasError = true
					continue
				}
			}

			// Set field value
			field := newElem.FieldByName(fieldName)
			if field.IsValid() && field.CanSet() {
				if err := i.setFieldValue(field, value); err != nil {
					result.Errors = append(result.Errors, ImportError{
						Row:     rowIdx + 1,
						Column:  fieldName,
						Value:   value,
						Message: err.Error(),
					})
					hasError = true
				}
			}
		}

		if hasError {
			result.ErrorRows++
		} else {
			sliceVal.Set(reflect.Append(sliceVal, newElem))
			result.ImportedRows++
		}
	}

	result.Data = target
	return result, nil
}

func (i *Importer) mapHeaders(headers []string, elemType reflect.Type) map[string]int {
	headerMap := make(map[string]int)

	for colIdx, header := range headers {
		header = strings.TrimSpace(header)
		header = strings.ToLower(header)

		// Check column map first
		for mapHeader, fieldName := range i.config.ColumnMap {
			if strings.ToLower(mapHeader) == header {
				headerMap[fieldName] = colIdx
				break
			}
		}

		// Try to match with struct fields
		for j := 0; j < elemType.NumField(); j++ {
			field := elemType.Field(j)

			// Check JSON tag
			if jsonTag := field.Tag.Get("json"); jsonTag != "" {
				parts := strings.Split(jsonTag, ",")
				if strings.ToLower(parts[0]) == header {
					headerMap[field.Name] = colIdx
					break
				}
			}

			// Check field name
			if strings.ToLower(field.Name) == header {
				headerMap[field.Name] = colIdx
				break
			}
		}
	}

	return headerMap
}

func (i *Importer) setFieldValue(field reflect.Value, value string) error {
	if value == "" {
		return nil
	}

	switch field.Kind() {
	case reflect.String:
		field.SetString(value)

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		// Remove spaces and currency symbols
		value = cleanNumber(value)
		if v, err := strconv.ParseInt(value, 10, 64); err == nil {
			field.SetInt(v)
		} else {
			return fmt.Errorf("invalid integer: %s", value)
		}

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		value = cleanNumber(value)
		if v, err := strconv.ParseUint(value, 10, 64); err == nil {
			field.SetUint(v)
		} else {
			return fmt.Errorf("invalid unsigned integer: %s", value)
		}

	case reflect.Float32, reflect.Float64:
		value = cleanNumber(value)
		// Replace comma with dot
		value = strings.Replace(value, ",", ".", 1)
		if v, err := strconv.ParseFloat(value, 64); err == nil {
			field.SetFloat(v)
		} else {
			return fmt.Errorf("invalid float: %s", value)
		}

	case reflect.Bool:
		value = strings.ToLower(value)
		switch value {
		case "1", "true", "yes", "так", "да", "y", "т":
			field.SetBool(true)
		case "0", "false", "no", "ні", "нет", "n", "н":
			field.SetBool(false)
		default:
			return fmt.Errorf("invalid boolean: %s", value)
		}

	case reflect.Struct:
		// Handle time.Time
		if field.Type() == reflect.TypeOf(time.Time{}) {
			for _, format := range i.config.DateFormats {
				if t, err := time.Parse(format, value); err == nil {
					field.Set(reflect.ValueOf(t))
					return nil
				}
			}
			return fmt.Errorf("invalid date: %s", value)
		}

	case reflect.Ptr:
		// Create new pointer and set value
		if field.IsNil() {
			field.Set(reflect.New(field.Type().Elem()))
		}
		return i.setFieldValue(field.Elem(), value)

	case reflect.Slice:
		// Handle []string
		if field.Type().Elem().Kind() == reflect.String {
			parts := strings.Split(value, ",")
			for i := range parts {
				parts[i] = strings.TrimSpace(parts[i])
			}
			field.Set(reflect.ValueOf(parts))
		}
	}

	return nil
}

func isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func cleanNumber(s string) string {
	// Remove currency symbols, spaces, etc.
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "₴", "")
	s = strings.ReplaceAll(s, "$", "")
	s = strings.ReplaceAll(s, "€", "")
	s = strings.ReplaceAll(s, "грн", "")
	s = strings.ReplaceAll(s, "UAH", "")
	s = strings.TrimSpace(s)
	return s
}

// Import helpers for common entities

// ImportProducts imports products from file
func ImportProducts(ctx context.Context, reader io.Reader, format ExportFormat) (*ImportResult, error) {
	config := ImportConfig{
		Format: format,
		ColumnMap: map[string]string{
			"Артикул":   "SKU",
			"SKU":       "SKU",
			"Назва":     "Name",
			"Name":      "Name",
			"Ціна":      "Price",
			"Price":     "Price",
			"Залишок":   "Stock",
			"Stock":     "Stock",
			"Категорія": "Category",
			"Category":  "Category",
		},
		RequiredCols: []string{"SKU", "Name"},
	}

	// Product struct for import
	type ImportProduct struct {
		SKU      string  `json:"sku"`
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Price    float64 `json:"price"`
		Stock    int     `json:"stock"`
		Barcode  string  `json:"barcode"`
	}

	var products []ImportProduct
	importer := NewImporter(config)
	return importer.Import(ctx, reader, &products)
}

// ImportPrices imports price updates
func ImportPrices(ctx context.Context, reader io.Reader, format ExportFormat) (*ImportResult, error) {
	config := ImportConfig{
		Format: format,
		ColumnMap: map[string]string{
			"Артикул": "SKU",
			"SKU":     "SKU",
			"Ціна":    "Price",
			"Price":   "Price",
		},
		RequiredCols: []string{"SKU", "Price"},
	}

	type PriceUpdate struct {
		SKU   string  `json:"sku"`
		Price float64 `json:"price"`
	}

	var prices []PriceUpdate
	importer := NewImporter(config)
	return importer.Import(ctx, reader, &prices)
}

// ImportStock imports stock updates
func ImportStock(ctx context.Context, reader io.Reader, format ExportFormat) (*ImportResult, error) {
	config := ImportConfig{
		Format: format,
		ColumnMap: map[string]string{
			"Артикул":  "SKU",
			"SKU":      "SKU",
			"Залишок":  "Stock",
			"Stock":    "Stock",
			"Кількість": "Stock",
			"Склад":    "Warehouse",
			"Warehouse": "Warehouse",
		},
		RequiredCols: []string{"SKU", "Stock"},
	}

	type StockUpdate struct {
		SKU       string `json:"sku"`
		Stock     int    `json:"stock"`
		Warehouse string `json:"warehouse"`
	}

	var stocks []StockUpdate
	importer := NewImporter(config)
	return importer.Import(ctx, reader, &stocks)
}
