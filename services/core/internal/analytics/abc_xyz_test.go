package analytics

import (
	"math"
	"testing"
)

func TestCalculateVariability(t *testing.T) {
	tests := []struct {
		name         string
		monthlySales []float64
		expectedCV   float64
		tolerance    float64
	}{
		{
			name:         "Stable demand (low CV)",
			monthlySales: []float64{100, 100, 100, 100, 100, 100},
			expectedCV:   0,
			tolerance:    0.01,
		},
		{
			name:         "Variable demand",
			monthlySales: []float64{50, 100, 75, 125, 100, 50},
			expectedCV:   30, // Approximate
			tolerance:    10,
		},
		{
			name:         "Highly variable demand",
			monthlySales: []float64{10, 200, 30, 150, 5, 180},
			expectedCV:   80, // High variability
			tolerance:    20,
		},
		{
			name:         "Empty sales",
			monthlySales: []float64{},
			expectedCV:   100, // Default high CV for no data
			tolerance:    0,
		},
		{
			name:         "Zero sales",
			monthlySales: []float64{0, 0, 0, 0},
			expectedCV:   100, // Default high CV for zero average
			tolerance:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cv, _, _ := calculateVariability(tt.monthlySales)

			if math.Abs(cv-tt.expectedCV) > tt.tolerance {
				t.Errorf("Expected CV ≈ %.2f, got %.2f", tt.expectedCV, cv)
			}
		})
	}
}

func TestABCClassification(t *testing.T) {
	config := DefaultABCXYZConfig()

	tests := []struct {
		cumulativePercent float64
		expectedCategory  ABCCategory
	}{
		{10, ABCCategoryA},   // Top 10% -> A
		{50, ABCCategoryA},   // Still within 80% -> A
		{79, ABCCategoryA},   // Just under 80% -> A
		{80, ABCCategoryA},   // Exactly 80% -> A
		{81, ABCCategoryB},   // Just over 80% -> B
		{90, ABCCategoryB},   // Within 80-95% -> B
		{95, ABCCategoryB},   // Exactly 95% -> B
		{96, ABCCategoryC},   // Over 95% -> C
		{100, ABCCategoryC},  // Last items -> C
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			var category ABCCategory
			if tt.cumulativePercent <= config.ABoundary {
				category = ABCCategoryA
			} else if tt.cumulativePercent <= config.BBoundary {
				category = ABCCategoryB
			} else {
				category = ABCCategoryC
			}

			if category != tt.expectedCategory {
				t.Errorf("Cumulative %.2f%% expected %s, got %s",
					tt.cumulativePercent, tt.expectedCategory, category)
			}
		})
	}
}

func TestXYZClassification(t *testing.T) {
	config := DefaultABCXYZConfig()

	tests := []struct {
		cv               float64
		expectedCategory XYZCategory
	}{
		{5, XYZCategoryX},   // Very stable
		{10, XYZCategoryX},  // Exactly X boundary
		{11, XYZCategoryY},  // Just over X boundary
		{20, XYZCategoryY},  // Middle variability
		{25, XYZCategoryY},  // Exactly Y boundary
		{26, XYZCategoryZ},  // Just over Y boundary
		{50, XYZCategoryZ},  // High variability
		{100, XYZCategoryZ}, // Very high variability
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			var category XYZCategory
			if tt.cv <= config.XBoundary {
				category = XYZCategoryX
			} else if tt.cv <= config.YBoundary {
				category = XYZCategoryY
			} else {
				category = XYZCategoryZ
			}

			if category != tt.expectedCategory {
				t.Errorf("CV %.2f expected %s, got %s",
					tt.cv, tt.expectedCategory, category)
			}
		})
	}
}

func TestGetRecommendation(t *testing.T) {
	tests := []struct {
		abc         ABCCategory
		xyz         XYZCategory
		shouldExist bool
	}{
		{ABCCategoryA, XYZCategoryX, true},
		{ABCCategoryA, XYZCategoryY, true},
		{ABCCategoryA, XYZCategoryZ, true},
		{ABCCategoryB, XYZCategoryX, true},
		{ABCCategoryB, XYZCategoryY, true},
		{ABCCategoryB, XYZCategoryZ, true},
		{ABCCategoryC, XYZCategoryX, true},
		{ABCCategoryC, XYZCategoryY, true},
		{ABCCategoryC, XYZCategoryZ, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.abc)+string(tt.xyz), func(t *testing.T) {
			rec := getRecommendation(tt.abc, tt.xyz)
			if tt.shouldExist && rec == "" {
				t.Errorf("Expected recommendation for %s%s", tt.abc, tt.xyz)
			}
		})
	}
}

func TestBuildSummary(t *testing.T) {
	results := []ABCXYZResult{
		{ABCCategory: ABCCategoryA, XYZCategory: XYZCategoryX, Revenue: 1000},
		{ABCCategory: ABCCategoryA, XYZCategory: XYZCategoryY, Revenue: 800},
		{ABCCategory: ABCCategoryB, XYZCategory: XYZCategoryX, Revenue: 500},
		{ABCCategory: ABCCategoryB, XYZCategory: XYZCategoryZ, Revenue: 300},
		{ABCCategory: ABCCategoryC, XYZCategory: XYZCategoryZ, Revenue: 100},
	}

	totalRevenue := 2700.0

	summary := buildSummary(results, totalRevenue)

	// Test ABC counts
	if summary.CategoryA.ProductCount != 2 {
		t.Errorf("Expected 2 A products, got %d", summary.CategoryA.ProductCount)
	}
	if summary.CategoryB.ProductCount != 2 {
		t.Errorf("Expected 2 B products, got %d", summary.CategoryB.ProductCount)
	}
	if summary.CategoryC.ProductCount != 1 {
		t.Errorf("Expected 1 C product, got %d", summary.CategoryC.ProductCount)
	}

	// Test XYZ counts
	if summary.CategoryX.ProductCount != 2 {
		t.Errorf("Expected 2 X products, got %d", summary.CategoryX.ProductCount)
	}
	if summary.CategoryY.ProductCount != 1 {
		t.Errorf("Expected 1 Y product, got %d", summary.CategoryY.ProductCount)
	}
	if summary.CategoryZ.ProductCount != 2 {
		t.Errorf("Expected 2 Z products, got %d", summary.CategoryZ.ProductCount)
	}

	// Test revenue
	expectedARevenue := 1800.0
	if summary.CategoryA.Revenue != expectedARevenue {
		t.Errorf("Expected A revenue %.2f, got %.2f", expectedARevenue, summary.CategoryA.Revenue)
	}
}

func TestBuildMatrix(t *testing.T) {
	results := []ABCXYZResult{
		{ProductID: "1", ABCCategory: ABCCategoryA, XYZCategory: XYZCategoryX, CombinedCategory: "AX", Revenue: 1000},
		{ProductID: "2", ABCCategory: ABCCategoryA, XYZCategory: XYZCategoryX, CombinedCategory: "AX", Revenue: 900},
		{ProductID: "3", ABCCategory: ABCCategoryB, XYZCategory: XYZCategoryY, CombinedCategory: "BY", Revenue: 500},
		{ProductID: "4", ABCCategory: ABCCategoryC, XYZCategory: XYZCategoryZ, CombinedCategory: "CZ", Revenue: 100},
	}

	totalRevenue := 2500.0

	matrix := buildMatrix(results, totalRevenue)

	// Test AX cell
	if matrix.AX.ProductCount != 2 {
		t.Errorf("Expected 2 AX products, got %d", matrix.AX.ProductCount)
	}
	if matrix.AX.Revenue != 1900 {
		t.Errorf("Expected AX revenue 1900, got %.2f", matrix.AX.Revenue)
	}

	// Test BY cell
	if matrix.BY.ProductCount != 1 {
		t.Errorf("Expected 1 BY product, got %d", matrix.BY.ProductCount)
	}

	// Test CZ cell
	if matrix.CZ.ProductCount != 1 {
		t.Errorf("Expected 1 CZ product, got %d", matrix.CZ.ProductCount)
	}

	// Test percentages
	expectedAXPercent := 50.0 // 2 out of 4
	if math.Abs(matrix.AX.ProductPercent-expectedAXPercent) > 0.1 {
		t.Errorf("Expected AX product percent %.2f, got %.2f", expectedAXPercent, matrix.AX.ProductPercent)
	}
}

func TestDefaultABCXYZConfig(t *testing.T) {
	config := DefaultABCXYZConfig()

	if config.ABoundary != 80 {
		t.Errorf("Expected A boundary 80, got %.2f", config.ABoundary)
	}
	if config.BBoundary != 95 {
		t.Errorf("Expected B boundary 95, got %.2f", config.BBoundary)
	}
	if config.XBoundary != 10 {
		t.Errorf("Expected X boundary 10, got %.2f", config.XBoundary)
	}
	if config.YBoundary != 25 {
		t.Errorf("Expected Y boundary 25, got %.2f", config.YBoundary)
	}
	if config.AnalysisBy != "revenue" {
		t.Errorf("Expected analysis by 'revenue', got %s", config.AnalysisBy)
	}
}
