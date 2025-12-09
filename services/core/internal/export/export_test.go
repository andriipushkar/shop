package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"strings"
	"testing"
)

func TestCSVExport(t *testing.T) {
	config := ExportConfig{
		Format:        FormatCSV,
		IncludeHeader: true,
		Columns: []ColumnConfig{
			{Field: "id", Header: "ID"},
			{Field: "name", Header: "Назва"},
			{Field: "price", Header: "Ціна"},
		},
	}
	exporter := NewExporter(config)

	data := []map[string]interface{}{
		{"id": "1", "name": "Product A", "price": 100.50},
		{"id": "2", "name": "Product B", "price": 200.75},
		{"id": "3", "name": "Product C", "price": 50.00},
	}

	result, err := exporter.Export(context.Background(), data, "test")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	// Parse CSV
	reader := csv.NewReader(bytes.NewReader(result.Data))
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("Failed to parse CSV: %v", err)
	}

	// Check header
	if len(records) < 1 {
		t.Fatal("Expected at least header row")
	}
	if records[0][0] != "ID" || records[0][1] != "Назва" || records[0][2] != "Ціна" {
		t.Errorf("Unexpected header: %v", records[0])
	}

	// Check data rows
	if len(records) != 4 { // 1 header + 3 data rows
		t.Errorf("Expected 4 rows, got %d", len(records))
	}
}

func TestJSONExport(t *testing.T) {
	config := ExportConfig{
		Format: FormatJSON,
		Columns: []ColumnConfig{
			{Field: "id", Header: "ID"},
			{Field: "name", Header: "Name"},
			{Field: "active", Header: "Active"},
		},
	}
	exporter := NewExporter(config)

	data := []map[string]interface{}{
		{"id": "1", "name": "Test", "active": true},
		{"id": "2", "name": "Test 2", "active": false},
	}

	result, err := exporter.Export(context.Background(), data, "test")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	// Parse JSON
	var parsed []map[string]interface{}
	err = json.Unmarshal(result.Data, &parsed)
	if err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	if len(parsed) != 2 {
		t.Errorf("Expected 2 items, got %d", len(parsed))
	}
}

func TestExcelExport(t *testing.T) {
	config := ExportConfig{
		Format:        FormatExcel,
		IncludeHeader: true,
		SheetName:     "Products",
		Columns: []ColumnConfig{
			{Field: "id", Header: "ID", Width: 10},
			{Field: "name", Header: "Name", Width: 30},
		},
	}
	exporter := NewExporter(config)

	data := []map[string]interface{}{
		{"id": "1", "name": "Product A"},
		{"id": "2", "name": "Product B"},
	}

	result, err := exporter.Export(context.Background(), data, "products")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	if len(result.Data) == 0 {
		t.Error("Expected non-empty Excel data")
	}
	if result.ContentType != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		t.Errorf("Expected Excel content type, got %s", result.ContentType)
	}
	if !strings.HasSuffix(result.Filename, ".xlsx") {
		t.Errorf("Expected .xlsx extension, got %s", result.Filename)
	}
}

func TestExportResult(t *testing.T) {
	result := &ExportResult{
		Data:        []byte("test data"),
		ContentType: "text/csv",
		Filename:    "test.csv",
		RecordCount: 10,
	}

	if result.RecordCount != 10 {
		t.Errorf("Expected 10 records, got %d", result.RecordCount)
	}
}

func TestDefaultExportConfig(t *testing.T) {
	config := DefaultExportConfig()

	if config.Format != FormatExcel {
		t.Errorf("Expected Excel format, got %s", config.Format)
	}
	if !config.IncludeHeader {
		t.Error("Expected IncludeHeader to be true")
	}
	if config.DateFormat != "02.01.2006" {
		t.Errorf("Expected date format '02.01.2006', got %s", config.DateFormat)
	}
}

func TestColumnConfig(t *testing.T) {
	col := ColumnConfig{
		Field:  "price",
		Header: "Price",
		Width:  15,
		Format: "currency",
	}

	if col.Field != "price" {
		t.Error("Expected field 'price'")
	}
	if col.Format != "currency" {
		t.Error("Expected format 'currency'")
	}
}

func TestExportFormats(t *testing.T) {
	formats := []ExportFormat{
		FormatCSV,
		FormatExcel,
		FormatJSON,
	}

	for _, format := range formats {
		if format == "" {
			t.Error("Export format should not be empty")
		}
	}
}

func TestCSVDelimiter(t *testing.T) {
	config := ExportConfig{
		Format:        FormatCSV,
		IncludeHeader: true,
		Delimiter:     ';',
		Columns: []ColumnConfig{
			{Field: "a", Header: "A"},
			{Field: "b", Header: "B"},
		},
	}
	exporter := NewExporter(config)

	data := []map[string]interface{}{
		{"a": "1", "b": "2"},
	}

	result, err := exporter.Export(context.Background(), data, "test")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	content := string(result.Data)
	if !strings.Contains(content, ";") {
		t.Error("Expected semicolon delimiter in output")
	}
}

func TestEmptyData(t *testing.T) {
	config := ExportConfig{
		Format:        FormatCSV,
		IncludeHeader: true,
		Columns: []ColumnConfig{
			{Field: "id", Header: "ID"},
		},
	}
	exporter := NewExporter(config)

	data := []map[string]interface{}{}

	result, err := exporter.Export(context.Background(), data, "empty")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	if result.RecordCount != 0 {
		t.Errorf("Expected 0 records, got %d", result.RecordCount)
	}
}

func TestLargeExport(t *testing.T) {
	config := ExportConfig{
		Format:        FormatCSV,
		IncludeHeader: true,
		Columns: []ColumnConfig{
			{Field: "id", Header: "ID"},
			{Field: "name", Header: "Name"},
		},
	}
	exporter := NewExporter(config)

	// Large dataset
	data := make([]map[string]interface{}, 1000)
	for i := 0; i < 1000; i++ {
		data[i] = map[string]interface{}{
			"id":   i,
			"name": "Item",
		}
	}

	result, err := exporter.Export(context.Background(), data, "large")
	if err != nil {
		t.Fatalf("Export failed: %v", err)
	}

	if result.RecordCount != 1000 {
		t.Errorf("Expected 1000 records, got %d", result.RecordCount)
	}
}
