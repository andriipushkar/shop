package pagination

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCursor_Encode(t *testing.T) {
	cursor := &Cursor{
		ID:        "test-id-123",
		CreatedAt: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		SortValue: "test-value",
		SortField: "created_at",
	}

	encoded := cursor.Encode()
	if encoded == "" {
		t.Error("expected non-empty encoded cursor")
	}

	// Verify it's valid base64
	_, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		t.Errorf("expected valid base64, got error: %v", err)
	}
}

func TestDecodeCursor(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
		wantNil bool
	}{
		{
			name:    "empty string",
			input:   "",
			wantErr: false,
			wantNil: true,
		},
		{
			name:    "invalid base64",
			input:   "not-valid-base64!!!",
			wantErr: true,
		},
		{
			name:    "invalid json",
			input:   base64.URLEncoding.EncodeToString([]byte("not json")),
			wantErr: true,
		},
		{
			name:    "valid cursor",
			input:   base64.URLEncoding.EncodeToString([]byte(`{"id":"test-123"}`)),
			wantErr: false,
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cursor, err := DecodeCursor(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodeCursor() error = %v, wantErr %v", err, tt.wantErr)
			}
			if (cursor == nil) != tt.wantNil && !tt.wantErr {
				t.Errorf("DecodeCursor() cursor = %v, wantNil %v", cursor, tt.wantNil)
			}
		})
	}
}

func TestCursor_RoundTrip(t *testing.T) {
	original := &Cursor{
		ID:        "test-id-456",
		CreatedAt: time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC),
		SortValue: "sort-value",
		SortField: "name",
	}

	encoded := original.Encode()
	decoded, err := DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("DecodeCursor() error = %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("expected ID %s, got %s", original.ID, decoded.ID)
	}
	if decoded.SortValue != original.SortValue {
		t.Errorf("expected SortValue %s, got %s", original.SortValue, decoded.SortValue)
	}
	if decoded.SortField != original.SortField {
		t.Errorf("expected SortField %s, got %s", original.SortField, decoded.SortField)
	}
}

func TestParseParams(t *testing.T) {
	tests := []struct {
		name        string
		query       string
		wantLimit   int
		wantErr     bool
		wantCursor  bool
	}{
		{
			name:      "no params",
			query:     "",
			wantLimit: DefaultLimit,
		},
		{
			name:      "custom limit",
			query:     "limit=50",
			wantLimit: 50,
		},
		{
			name:      "limit exceeds max",
			query:     "limit=200",
			wantLimit: MaxLimit,
		},
		{
			name:    "invalid limit",
			query:   "limit=abc",
			wantErr: true,
		},
		{
			name:    "negative limit",
			query:   "limit=-5",
			wantErr: true,
		},
		{
			name:       "with valid after cursor",
			query:      "after=" + base64.URLEncoding.EncodeToString([]byte(`{"id":"123"}`)),
			wantLimit:  DefaultLimit,
			wantCursor: true,
		},
		{
			name:    "with invalid after cursor",
			query:   "after=invalid!!!",
			wantErr: true,
		},
		{
			name:       "with valid before cursor",
			query:      "before=" + base64.URLEncoding.EncodeToString([]byte(`{"id":"456"}`)),
			wantLimit:  DefaultLimit,
			wantCursor: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			params, err := ParseParams(req)

			if (err != nil) != tt.wantErr {
				t.Errorf("ParseParams() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if params.Limit != tt.wantLimit {
					t.Errorf("expected limit %d, got %d", tt.wantLimit, params.Limit)
				}
				if tt.wantCursor && params.Cursor == nil {
					t.Error("expected cursor to be set")
				}
			}
		})
	}
}

func TestParseOffsetParams(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantPage   int
		wantLimit  int
		wantOffset int
	}{
		{
			name:       "no params",
			query:      "",
			wantPage:   1,
			wantLimit:  DefaultLimit,
			wantOffset: 0,
		},
		{
			name:       "page 2",
			query:      "page=2",
			wantPage:   2,
			wantLimit:  DefaultLimit,
			wantOffset: DefaultLimit,
		},
		{
			name:       "custom limit",
			query:      "limit=50",
			wantPage:   1,
			wantLimit:  50,
			wantOffset: 0,
		},
		{
			name:       "page 3 with limit 10",
			query:      "page=3&limit=10",
			wantPage:   3,
			wantLimit:  10,
			wantOffset: 20,
		},
		{
			name:       "limit exceeds max",
			query:      "limit=200",
			wantPage:   1,
			wantLimit:  MaxLimit,
			wantOffset: 0,
		},
		{
			name:       "invalid page",
			query:      "page=abc",
			wantPage:   1,
			wantLimit:  DefaultLimit,
			wantOffset: 0,
		},
		{
			name:       "negative page",
			query:      "page=-1",
			wantPage:   1,
			wantLimit:  DefaultLimit,
			wantOffset: 0,
		},
		{
			name:       "invalid limit",
			query:      "limit=abc",
			wantPage:   1,
			wantLimit:  DefaultLimit,
			wantOffset: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			params, err := ParseOffsetParams(req)

			if err != nil {
				t.Fatalf("ParseOffsetParams() error = %v", err)
			}

			if params.Page != tt.wantPage {
				t.Errorf("expected page %d, got %d", tt.wantPage, params.Page)
			}
			if params.Limit != tt.wantLimit {
				t.Errorf("expected limit %d, got %d", tt.wantLimit, params.Limit)
			}
			if params.Offset != tt.wantOffset {
				t.Errorf("expected offset %d, got %d", tt.wantOffset, params.Offset)
			}
		})
	}
}

func TestNewOffsetResult(t *testing.T) {
	tests := []struct {
		name       string
		items      []string
		total      int
		page       int
		limit      int
		wantPages  int
	}{
		{
			name:      "exact pages",
			items:     []string{"a", "b"},
			total:     10,
			page:      1,
			limit:     5,
			wantPages: 2,
		},
		{
			name:      "partial last page",
			items:     []string{"a"},
			total:     11,
			page:      1,
			limit:     5,
			wantPages: 3,
		},
		{
			name:      "single page",
			items:     []string{"a", "b", "c"},
			total:     3,
			page:      1,
			limit:     10,
			wantPages: 1,
		},
		{
			name:      "empty result",
			items:     []string{},
			total:     0,
			page:      1,
			limit:     10,
			wantPages: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NewOffsetResult(tt.items, tt.total, tt.page, tt.limit)

			if result.TotalPages != tt.wantPages {
				t.Errorf("expected %d pages, got %d", tt.wantPages, result.TotalPages)
			}
			if result.Total != tt.total {
				t.Errorf("expected total %d, got %d", tt.total, result.Total)
			}
			if result.Page != tt.page {
				t.Errorf("expected page %d, got %d", tt.page, result.Page)
			}
			if result.Limit != tt.limit {
				t.Errorf("expected limit %d, got %d", tt.limit, result.Limit)
			}
		})
	}
}

func TestBuildCursorPaginatedResult(t *testing.T) {
	getCursor := func(item string) *Cursor {
		return &Cursor{ID: item}
	}

	t.Run("empty items", func(t *testing.T) {
		result := BuildCursorPaginatedResult([]string{}, 10, getCursor, 0)
		if len(result.Items) != 0 {
			t.Error("expected empty items")
		}
		if result.PageInfo.HasNextPage {
			t.Error("expected no next page")
		}
	})

	t.Run("with items less than limit", func(t *testing.T) {
		items := []string{"a", "b", "c"}
		result := BuildCursorPaginatedResult(items, 10, getCursor, 3)

		if len(result.Items) != 3 {
			t.Errorf("expected 3 items, got %d", len(result.Items))
		}
		if result.PageInfo.HasNextPage {
			t.Error("expected no next page")
		}
		if result.PageInfo.StartCursor == "" {
			t.Error("expected start cursor")
		}
		if result.PageInfo.EndCursor == "" {
			t.Error("expected end cursor")
		}
	})

	t.Run("with items exceeding limit", func(t *testing.T) {
		items := []string{"a", "b", "c", "d", "e", "f"}
		result := BuildCursorPaginatedResult(items, 5, getCursor, 100)

		if len(result.Items) != 5 {
			t.Errorf("expected 5 items (limit), got %d", len(result.Items))
		}
		if !result.PageInfo.HasNextPage {
			t.Error("expected next page")
		}
		if result.PageInfo.TotalCount != 100 {
			t.Errorf("expected total count 100, got %d", result.PageInfo.TotalCount)
		}
	})
}

func TestParseSort(t *testing.T) {
	allowedFields := map[string]string{
		"name":       "name",
		"created_at": "created_at",
		"price":      "price",
	}

	tests := []struct {
		name      string
		sortStr   string
		wantField string
		wantOrder SortOrder
		wantErr   bool
		wantNil   bool
	}{
		{
			name:    "empty string",
			sortStr: "",
			wantNil: true,
		},
		{
			name:      "ascending",
			sortStr:   "name",
			wantField: "name",
			wantOrder: SortAsc,
		},
		{
			name:      "descending",
			sortStr:   "-created_at",
			wantField: "created_at",
			wantOrder: SortDesc,
		},
		{
			name:    "invalid field",
			sortStr: "invalid_field",
			wantErr: true,
		},
		{
			name:    "invalid field descending",
			sortStr: "-unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sort, err := ParseSort(tt.sortStr, allowedFields)

			if (err != nil) != tt.wantErr {
				t.Errorf("ParseSort() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantNil {
				if sort != nil {
					t.Error("expected nil sort")
				}
				return
			}

			if !tt.wantErr && sort != nil {
				if sort.Field != tt.wantField {
					t.Errorf("expected field %s, got %s", tt.wantField, sort.Field)
				}
				if sort.Order != tt.wantOrder {
					t.Errorf("expected order %s, got %s", tt.wantOrder, sort.Order)
				}
			}
		})
	}
}

func TestSortField_BuildOrderByClause(t *testing.T) {
	tests := []struct {
		name      string
		sortField *SortField
		want      string
	}{
		{
			name:      "nil sort field",
			sortField: nil,
			want:      "created_at DESC",
		},
		{
			name: "ascending",
			sortField: &SortField{
				Field: "name",
				Order: SortAsc,
			},
			want: "name ASC",
		},
		{
			name: "descending",
			sortField: &SortField{
				Field: "price",
				Order: SortDesc,
			},
			want: "price DESC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.sortField.BuildOrderByClause()
			if result != tt.want {
				t.Errorf("BuildOrderByClause() = %v, want %v", result, tt.want)
			}
		})
	}
}

func TestPageInfo(t *testing.T) {
	info := PageInfo{
		HasNextPage:     true,
		HasPreviousPage: false,
		StartCursor:     "start",
		EndCursor:       "end",
		TotalCount:      100,
	}

	if !info.HasNextPage {
		t.Error("expected HasNextPage to be true")
	}
	if info.HasPreviousPage {
		t.Error("expected HasPreviousPage to be false")
	}
	if info.TotalCount != 100 {
		t.Errorf("expected TotalCount 100, got %d", info.TotalCount)
	}
}

func TestPaginatedResult(t *testing.T) {
	result := &PaginatedResult[string]{
		Items: []string{"a", "b", "c"},
		PageInfo: PageInfo{
			HasNextPage: true,
			TotalCount:  10,
		},
	}

	if len(result.Items) != 3 {
		t.Errorf("expected 3 items, got %d", len(result.Items))
	}
	if !result.PageInfo.HasNextPage {
		t.Error("expected HasNextPage")
	}
}

func TestConstants(t *testing.T) {
	if DefaultLimit != 20 {
		t.Errorf("expected DefaultLimit 20, got %d", DefaultLimit)
	}
	if MaxLimit != 100 {
		t.Errorf("expected MaxLimit 100, got %d", MaxLimit)
	}
	if SortAsc != "asc" {
		t.Errorf("expected SortAsc 'asc', got %s", SortAsc)
	}
	if SortDesc != "desc" {
		t.Errorf("expected SortDesc 'desc', got %s", SortDesc)
	}
}

func TestErrors(t *testing.T) {
	if ErrInvalidCursor == nil {
		t.Error("ErrInvalidCursor should not be nil")
	}
	if ErrInvalidLimit == nil {
		t.Error("ErrInvalidLimit should not be nil")
	}
	if ErrInvalidCursor.Error() != "invalid cursor" {
		t.Errorf("expected 'invalid cursor', got %s", ErrInvalidCursor.Error())
	}
	if ErrInvalidLimit.Error() != "invalid limit" {
		t.Errorf("expected 'invalid limit', got %s", ErrInvalidLimit.Error())
	}
}
