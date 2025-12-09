package analytics

import (
	"testing"
	"time"
)

func TestDetermineSegment(t *testing.T) {
	tests := []struct {
		name     string
		r, f, m  int
		expected RFMSegment
	}{
		// Champions
		{"Champions 555", 5, 5, 5, SegmentChampions},
		{"Champions 454", 4, 5, 4, SegmentChampions},
		{"Champions 445", 4, 4, 5, SegmentChampions},

		// Loyal Customers
		{"Loyal 345", 3, 4, 5, SegmentLoyalCustomers},
		{"Loyal 254", 2, 5, 4, SegmentLoyalCustomers},

		// Potential Loyalist
		{"Potential 432", 4, 3, 2, SegmentPotentialLoyalist},
		{"Potential 522", 5, 2, 2, SegmentPotentialLoyalist},

		// New Customers
		{"New 511", 5, 1, 1, SegmentNewCustomers},
		{"New 412", 4, 1, 2, SegmentNewCustomers},

		// Promising
		{"Promising 312", 3, 1, 2, SegmentPromising},
		{"Promising 421", 4, 2, 1, SegmentPromising},

		// Need Attention
		{"Need Attention 333", 3, 3, 3, SegmentNeedAttention},
		{"Need Attention 334", 3, 3, 4, SegmentNeedAttention},

		// About to Sleep
		{"About to Sleep 232", 2, 3, 2, SegmentAboutToSleep},
		{"About to Sleep 222", 2, 2, 2, SegmentAboutToSleep},

		// At Risk
		{"At Risk 145", 1, 4, 5, SegmentAtRisk},
		{"At Risk 234", 2, 3, 4, SegmentAtRisk},

		// Can't Lose Them
		{"Cant Lose 154", 1, 5, 4, SegmentCantLoseThem},
		{"Cant Lose 244", 2, 4, 4, SegmentCantLoseThem},

		// Hibernating
		{"Hibernating 111", 1, 1, 1, SegmentHibernating},
		{"Hibernating 212", 2, 1, 2, SegmentHibernating},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := determineSegment(tt.r, tt.f, tt.m)
			if result != tt.expected {
				t.Errorf("RFM(%d,%d,%d) expected %s, got %s",
					tt.r, tt.f, tt.m, tt.expected, result)
			}
		})
	}
}

func TestGetSegmentName(t *testing.T) {
	segments := []RFMSegment{
		SegmentChampions,
		SegmentLoyalCustomers,
		SegmentPotentialLoyalist,
		SegmentNewCustomers,
		SegmentPromising,
		SegmentNeedAttention,
		SegmentAboutToSleep,
		SegmentAtRisk,
		SegmentCantLoseThem,
		SegmentHibernating,
		SegmentLost,
	}

	for _, segment := range segments {
		name := getSegmentName(segment)
		if name == "" {
			t.Errorf("Expected non-empty name for segment %s", segment)
		}
	}
}

func TestGetSegmentRecommendations(t *testing.T) {
	segments := []RFMSegment{
		SegmentChampions,
		SegmentLoyalCustomers,
		SegmentPotentialLoyalist,
		SegmentNewCustomers,
		SegmentPromising,
		SegmentNeedAttention,
		SegmentAboutToSleep,
		SegmentAtRisk,
		SegmentCantLoseThem,
		SegmentHibernating,
		SegmentLost,
	}

	for _, segment := range segments {
		recs := getSegmentRecommendations(segment)
		if len(recs) == 0 {
			t.Errorf("Expected recommendations for segment %s", segment)
		}
	}
}

func TestCalculateLTV(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name     string
		customer RFMCustomer
		minLTV   float64
	}{
		{
			name: "Active customer",
			customer: RFMCustomer{
				AvgOrderValue:  500,
				Frequency:      12,
				FirstOrderDate: now.AddDate(-1, 0, 0), // 1 year ago
			},
			minLTV: 1000, // Should be significant
		},
		{
			name: "New customer",
			customer: RFMCustomer{
				AvgOrderValue:  200,
				Frequency:      1,
				FirstOrderDate: now.AddDate(0, -1, 0), // 1 month ago
			},
			minLTV: 100, // Lower expected LTV
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ltv := calculateLTV(tt.customer)
			if ltv < tt.minLTV {
				t.Errorf("Expected LTV >= %.2f, got %.2f", tt.minLTV, ltv)
			}
		})
	}
}

func TestFormatScore(t *testing.T) {
	tests := []struct {
		r, f, m  int
		expected string
	}{
		{5, 5, 5, "555"},
		{1, 2, 3, "123"},
		{4, 3, 2, "432"},
	}

	for _, tt := range tests {
		result := formatScore(tt.r, tt.f, tt.m)
		if result != tt.expected {
			t.Errorf("formatScore(%d,%d,%d) expected %s, got %s",
				tt.r, tt.f, tt.m, tt.expected, result)
		}
	}
}

func TestScoreValue(t *testing.T) {
	bounds := []float64{20, 40, 60, 80}

	tests := []struct {
		value    float64
		expected int
	}{
		{10, 1},  // Below first bound
		{25, 2},  // Between first and second
		{50, 3},  // Between second and third
		{70, 4},  // Between third and fourth
		{90, 5},  // Above fourth
	}

	for _, tt := range tests {
		result := scoreValue(tt.value, bounds, false)
		if result != tt.expected {
			t.Errorf("scoreValue(%.2f) expected %d, got %d", tt.value, tt.expected, result)
		}
	}
}

func TestCalculateQuantiles(t *testing.T) {
	values := []float64{10, 20, 30, 40, 50, 60, 70, 80, 90, 100}

	// Calculate quintiles (5 groups)
	bounds := calculateQuantiles(values, 5)

	if len(bounds) != 4 {
		t.Errorf("Expected 4 bounds for quintiles, got %d", len(bounds))
	}

	// Verify bounds are ascending
	for i := 1; i < len(bounds); i++ {
		if bounds[i] < bounds[i-1] {
			t.Errorf("Bounds should be ascending, got %v", bounds)
		}
	}
}

func TestAggregateCustomerData(t *testing.T) {
	now := time.Now()

	transactions := []CustomerTransaction{
		{
			CustomerID:    "c1",
			CustomerName:  "John",
			CustomerEmail: "john@example.com",
			OrderID:       "o1",
			OrderDate:     now.AddDate(0, -1, 0),
			OrderTotal:    100,
		},
		{
			CustomerID:    "c1",
			CustomerName:  "John",
			CustomerEmail: "john@example.com",
			OrderID:       "o2",
			OrderDate:     now.AddDate(0, 0, -10),
			OrderTotal:    150,
		},
		{
			CustomerID:    "c2",
			CustomerName:  "Jane",
			CustomerEmail: "jane@example.com",
			OrderID:       "o3",
			OrderDate:     now.AddDate(0, -2, 0),
			OrderTotal:    200,
		},
	}

	result := aggregateCustomerData(transactions)

	// Check customer 1
	c1 := result["c1"]
	if c1 == nil {
		t.Fatal("Expected customer c1 in results")
	}
	if c1.OrderCount != 2 {
		t.Errorf("Expected 2 orders for c1, got %d", c1.OrderCount)
	}
	if c1.TotalSpent != 250 {
		t.Errorf("Expected total spent 250 for c1, got %.2f", c1.TotalSpent)
	}

	// Check customer 2
	c2 := result["c2"]
	if c2 == nil {
		t.Fatal("Expected customer c2 in results")
	}
	if c2.OrderCount != 1 {
		t.Errorf("Expected 1 order for c2, got %d", c2.OrderCount)
	}
	if c2.TotalSpent != 200 {
		t.Errorf("Expected total spent 200 for c2, got %.2f", c2.TotalSpent)
	}
}

func TestDefaultRFMConfig(t *testing.T) {
	config := DefaultRFMConfig()

	if !config.UseQuantiles {
		t.Error("Expected UseQuantiles to be true")
	}
	if config.Quantiles != 5 {
		t.Errorf("Expected 5 quantiles, got %d", config.Quantiles)
	}
}

func TestGetSegmentDescription(t *testing.T) {
	segments := []RFMSegment{
		SegmentChampions,
		SegmentLoyalCustomers,
		SegmentAtRisk,
		SegmentLost,
	}

	for _, segment := range segments {
		desc := getSegmentDescription(segment)
		if desc == "" {
			t.Errorf("Expected description for segment %s", segment)
		}
	}
}
