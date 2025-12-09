package pagination

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

var (
	ErrInvalidCursor = errors.New("invalid cursor")
	ErrInvalidLimit  = errors.New("invalid limit")
)

// Cursor represents pagination cursor
type Cursor struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	SortValue string    `json:"sort_value,omitempty"`
	SortField string    `json:"sort_field,omitempty"`
}

// Encode encodes cursor to string
func (c *Cursor) Encode() string {
	data, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(data)
}

// DecodeCursor decodes cursor from string
func DecodeCursor(encoded string) (*Cursor, error) {
	if encoded == "" {
		return nil, nil
	}

	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, ErrInvalidCursor
	}

	var cursor Cursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return nil, ErrInvalidCursor
	}

	return &cursor, nil
}

// PageInfo represents pagination information
type PageInfo struct {
	HasNextPage     bool   `json:"has_next_page"`
	HasPreviousPage bool   `json:"has_previous_page"`
	StartCursor     string `json:"start_cursor,omitempty"`
	EndCursor       string `json:"end_cursor,omitempty"`
	TotalCount      int    `json:"total_count,omitempty"`
}

// PaginatedResult represents paginated result
type PaginatedResult[T any] struct {
	Items    []T      `json:"items"`
	PageInfo PageInfo `json:"page_info"`
}

// Params represents pagination parameters
type Params struct {
	Limit  int
	Cursor *Cursor
	After  string
	Before string
}

// DefaultLimit is the default page size
const DefaultLimit = 20

// MaxLimit is the maximum page size
const MaxLimit = 100

// ParseParams parses pagination parameters from request
func ParseParams(r *http.Request) (*Params, error) {
	params := &Params{
		Limit: DefaultLimit,
	}

	// Parse limit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			return nil, ErrInvalidLimit
		}
		if limit > MaxLimit {
			limit = MaxLimit
		}
		params.Limit = limit
	}

	// Parse cursor
	if after := r.URL.Query().Get("after"); after != "" {
		cursor, err := DecodeCursor(after)
		if err != nil {
			return nil, err
		}
		params.Cursor = cursor
		params.After = after
	}

	if before := r.URL.Query().Get("before"); before != "" {
		cursor, err := DecodeCursor(before)
		if err != nil {
			return nil, err
		}
		params.Cursor = cursor
		params.Before = before
	}

	return params, nil
}

// OffsetParams represents offset-based pagination parameters
type OffsetParams struct {
	Page   int
	Limit  int
	Offset int
}

// ParseOffsetParams parses offset pagination parameters from request
func ParseOffsetParams(r *http.Request) (*OffsetParams, error) {
	params := &OffsetParams{
		Page:  1,
		Limit: DefaultLimit,
	}

	// Parse page
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
		params.Page = page
	}

	// Parse limit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = DefaultLimit
		}
		if limit > MaxLimit {
			limit = MaxLimit
		}
		params.Limit = limit
	}

	params.Offset = (params.Page - 1) * params.Limit

	return params, nil
}

// OffsetResult represents offset-based pagination result
type OffsetResult[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	TotalPages int `json:"total_pages"`
}

// NewOffsetResult creates a new offset result
func NewOffsetResult[T any](items []T, total, page, limit int) *OffsetResult[T] {
	totalPages := total / limit
	if total%limit > 0 {
		totalPages++
	}

	return &OffsetResult[T]{
		Items:      items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}
}

// BuildCursorPaginatedResult builds cursor paginated result
func BuildCursorPaginatedResult[T any](items []T, limit int, getCursor func(T) *Cursor, totalCount int) *PaginatedResult[T] {
	result := &PaginatedResult[T]{
		Items: items,
		PageInfo: PageInfo{
			TotalCount: totalCount,
		},
	}

	if len(items) == 0 {
		return result
	}

	// Has next page if we got exactly limit items (plus 1 for checking)
	result.PageInfo.HasNextPage = len(items) > limit
	if result.PageInfo.HasNextPage {
		items = items[:limit]
		result.Items = items
	}

	// Build cursors
	if len(items) > 0 {
		startCursor := getCursor(items[0])
		endCursor := getCursor(items[len(items)-1])
		result.PageInfo.StartCursor = startCursor.Encode()
		result.PageInfo.EndCursor = endCursor.Encode()
	}

	return result
}

// SortOrder represents sort order
type SortOrder string

const (
	SortAsc  SortOrder = "asc"
	SortDesc SortOrder = "desc"
)

// SortField represents a sort field
type SortField struct {
	Field string
	Order SortOrder
}

// ParseSort parses sort parameter
func ParseSort(sortStr string, allowedFields map[string]string) (*SortField, error) {
	if sortStr == "" {
		return nil, nil
	}

	order := SortAsc
	field := sortStr

	if sortStr[0] == '-' {
		order = SortDesc
		field = sortStr[1:]
	}

	dbField, ok := allowedFields[field]
	if !ok {
		return nil, fmt.Errorf("invalid sort field: %s", field)
	}

	return &SortField{
		Field: dbField,
		Order: order,
	}, nil
}

// BuildOrderByClause builds SQL ORDER BY clause
func (s *SortField) BuildOrderByClause() string {
	if s == nil {
		return "created_at DESC"
	}

	orderStr := "ASC"
	if s.Order == SortDesc {
		orderStr = "DESC"
	}

	return fmt.Sprintf("%s %s", s.Field, orderStr)
}
