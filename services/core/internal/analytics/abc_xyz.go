package analytics

import (
	"context"
	"fmt"
	"math"
	"sort"
)

// ABCCategory represents ABC classification
type ABCCategory string

const (
	ABCCategoryA ABCCategory = "A" // 80% of value (top ~20% products)
	ABCCategoryB ABCCategory = "B" // 15% of value (next ~30% products)
	ABCCategoryC ABCCategory = "C" // 5% of value (remaining ~50% products)
)

// XYZCategory represents XYZ classification (demand variability)
type XYZCategory string

const (
	XYZCategoryX XYZCategory = "X" // Stable demand (CV < 10%)
	XYZCategoryY XYZCategory = "Y" // Variable demand (CV 10-25%)
	XYZCategoryZ XYZCategory = "Z" // Highly variable demand (CV > 25%)
)

// ABCXYZResult represents product classification result
type ABCXYZResult struct {
	ProductID       string      `json:"product_id"`
	SKU             string      `json:"sku"`
	Name            string      `json:"name"`
	Category        string      `json:"category"`
	Revenue         float64     `json:"revenue"`
	RevenuePercent  float64     `json:"revenue_percent"`
	CumulativePercent float64   `json:"cumulative_percent"`
	Quantity        int         `json:"quantity"`
	Margin          float64     `json:"margin"`
	MarginPercent   float64     `json:"margin_percent"`
	ABCCategory     ABCCategory `json:"abc_category"`
	XYZCategory     XYZCategory `json:"xyz_category"`
	CombinedCategory string     `json:"combined_category"` // e.g., "AX", "BY", "CZ"
	CV              float64     `json:"cv"`               // Coefficient of variation
	AvgMonthlySales float64     `json:"avg_monthly_sales"`
	StdDev          float64     `json:"std_dev"`
	Recommendation  string      `json:"recommendation"`
}

// ABCXYZAnalysis represents complete ABC-XYZ analysis
type ABCXYZAnalysis struct {
	Period          Period          `json:"period"`
	TotalRevenue    float64         `json:"total_revenue"`
	TotalProducts   int             `json:"total_products"`
	Products        []ABCXYZResult  `json:"products"`
	Summary         ABCXYZSummary   `json:"summary"`
	Matrix          ABCXYZMatrix    `json:"matrix"`
}

// ABCXYZSummary provides category summaries
type ABCXYZSummary struct {
	CategoryA CategorySummary `json:"category_a"`
	CategoryB CategorySummary `json:"category_b"`
	CategoryC CategorySummary `json:"category_c"`
	CategoryX CategorySummary `json:"category_x"`
	CategoryY CategorySummary `json:"category_y"`
	CategoryZ CategorySummary `json:"category_z"`
}

// CategorySummary represents summary for one category
type CategorySummary struct {
	ProductCount   int     `json:"product_count"`
	ProductPercent float64 `json:"product_percent"`
	Revenue        float64 `json:"revenue"`
	RevenuePercent float64 `json:"revenue_percent"`
}

// ABCXYZMatrix represents 3x3 matrix of ABC-XYZ combinations
type ABCXYZMatrix struct {
	AX MatrixCell `json:"ax"`
	AY MatrixCell `json:"ay"`
	AZ MatrixCell `json:"az"`
	BX MatrixCell `json:"bx"`
	BY MatrixCell `json:"by"`
	BZ MatrixCell `json:"bz"`
	CX MatrixCell `json:"cx"`
	CY MatrixCell `json:"cy"`
	CZ MatrixCell `json:"cz"`
}

// MatrixCell represents one cell in ABC-XYZ matrix
type MatrixCell struct {
	ProductCount   int      `json:"product_count"`
	ProductPercent float64  `json:"product_percent"`
	Revenue        float64  `json:"revenue"`
	RevenuePercent float64  `json:"revenue_percent"`
	Products       []string `json:"product_ids,omitempty"`
}

// ABCXYZConfig represents analysis configuration
type ABCXYZConfig struct {
	// ABC thresholds (cumulative percentage)
	ABoundary float64 `json:"a_boundary"` // Default: 80%
	BBoundary float64 `json:"b_boundary"` // Default: 95%

	// XYZ thresholds (coefficient of variation)
	XBoundary float64 `json:"x_boundary"` // Default: 10%
	YBoundary float64 `json:"y_boundary"` // Default: 25%

	// Analysis type
	AnalysisBy string `json:"analysis_by"` // "revenue", "quantity", "margin"
}

// DefaultABCXYZConfig returns default configuration
func DefaultABCXYZConfig() ABCXYZConfig {
	return ABCXYZConfig{
		ABoundary:  80,
		BBoundary:  95,
		XBoundary:  10,
		YBoundary:  25,
		AnalysisBy: "revenue",
	}
}

// PerformABCXYZAnalysis performs ABC-XYZ analysis
func (s *AnalyticsService) PerformABCXYZAnalysis(ctx context.Context, period Period, config ABCXYZConfig) (*ABCXYZAnalysis, error) {
	// Get sales data
	salesData, err := s.repo.GetProductSalesData(ctx, period)
	if err != nil {
		return nil, err
	}

	if len(salesData) == 0 {
		return &ABCXYZAnalysis{Period: period}, nil
	}

	// Calculate total revenue
	totalRevenue := 0.0
	for _, p := range salesData {
		totalRevenue += p.Revenue
	}

	// Sort by revenue (descending)
	sort.Slice(salesData, func(i, j int) bool {
		return salesData[i].Revenue > salesData[j].Revenue
	})

	// Perform ABC and XYZ classification
	results := make([]ABCXYZResult, len(salesData))
	cumulativePercent := 0.0

	for i, p := range salesData {
		revenuePercent := 0.0
		if totalRevenue > 0 {
			revenuePercent = p.Revenue / totalRevenue * 100
		}
		cumulativePercent += revenuePercent

		// ABC classification
		abcCategory := ABCCategoryC
		if cumulativePercent <= config.ABoundary {
			abcCategory = ABCCategoryA
		} else if cumulativePercent <= config.BBoundary {
			abcCategory = ABCCategoryB
		}

		// XYZ classification - calculate CV from monthly sales
		cv, avgSales, stdDev := calculateVariability(p.MonthlySales)
		xyzCategory := XYZCategoryZ
		if cv <= config.XBoundary {
			xyzCategory = XYZCategoryX
		} else if cv <= config.YBoundary {
			xyzCategory = XYZCategoryY
		}

		marginPercent := 0.0
		if p.Revenue > 0 {
			marginPercent = p.Margin / p.Revenue * 100
		}

		results[i] = ABCXYZResult{
			ProductID:         p.ProductID,
			SKU:               p.SKU,
			Name:              p.Name,
			Category:          p.Category,
			Revenue:           p.Revenue,
			RevenuePercent:    revenuePercent,
			CumulativePercent: cumulativePercent,
			Quantity:          p.Quantity,
			Margin:            p.Margin,
			MarginPercent:     marginPercent,
			ABCCategory:       abcCategory,
			XYZCategory:       xyzCategory,
			CombinedCategory:  string(abcCategory) + string(xyzCategory),
			CV:                cv,
			AvgMonthlySales:   avgSales,
			StdDev:            stdDev,
			Recommendation:    getRecommendation(abcCategory, xyzCategory),
		}
	}

	// Build summary and matrix
	analysis := &ABCXYZAnalysis{
		Period:        period,
		TotalRevenue:  totalRevenue,
		TotalProducts: len(results),
		Products:      results,
		Summary:       buildSummary(results, totalRevenue),
		Matrix:        buildMatrix(results, totalRevenue),
	}

	return analysis, nil
}

func calculateVariability(monthlySales []float64) (cv, avg, stdDev float64) {
	if len(monthlySales) == 0 {
		return 100, 0, 0 // High variability if no data
	}

	// Calculate average
	sum := 0.0
	for _, s := range monthlySales {
		sum += s
	}
	avg = sum / float64(len(monthlySales))

	if avg == 0 {
		return 100, 0, 0
	}

	// Calculate standard deviation
	sumSquares := 0.0
	for _, s := range monthlySales {
		diff := s - avg
		sumSquares += diff * diff
	}
	stdDev = math.Sqrt(sumSquares / float64(len(monthlySales)))

	// Coefficient of variation (%)
	cv = (stdDev / avg) * 100

	return cv, avg, stdDev
}

func getRecommendation(abc ABCCategory, xyz XYZCategory) string {
	recommendations := map[string]string{
		"AX": "Ключові товари. Підтримуйте постійний запас, точне прогнозування.",
		"AY": "Важливі товари з сезонністю. Гнучке управління запасами.",
		"AZ": "Високоприбуткові але непередбачувані. Аналізуйте причини коливань.",
		"BX": "Стабільний середній попит. Стандартне управління запасами.",
		"BY": "Середня важливість, змінний попит. Регулярний моніторинг.",
		"BZ": "Нестабільні продажі. Розгляньте оптимізацію асортименту.",
		"CX": "Низький але стабільний попит. Мінімальні запаси.",
		"CY": "Низька важливість, нестабільний попит. Можливий вивід з асортименту.",
		"CZ": "Найнижчий пріоритет. Рекомендовано вивести з асортименту.",
	}

	key := string(abc) + string(xyz)
	if rec, ok := recommendations[key]; ok {
		return rec
	}
	return ""
}

func buildSummary(results []ABCXYZResult, totalRevenue float64) ABCXYZSummary {
	summary := ABCXYZSummary{}

	for _, r := range results {
		switch r.ABCCategory {
		case ABCCategoryA:
			summary.CategoryA.ProductCount++
			summary.CategoryA.Revenue += r.Revenue
		case ABCCategoryB:
			summary.CategoryB.ProductCount++
			summary.CategoryB.Revenue += r.Revenue
		case ABCCategoryC:
			summary.CategoryC.ProductCount++
			summary.CategoryC.Revenue += r.Revenue
		}

		switch r.XYZCategory {
		case XYZCategoryX:
			summary.CategoryX.ProductCount++
			summary.CategoryX.Revenue += r.Revenue
		case XYZCategoryY:
			summary.CategoryY.ProductCount++
			summary.CategoryY.Revenue += r.Revenue
		case XYZCategoryZ:
			summary.CategoryZ.ProductCount++
			summary.CategoryZ.Revenue += r.Revenue
		}
	}

	total := float64(len(results))
	if total > 0 {
		summary.CategoryA.ProductPercent = float64(summary.CategoryA.ProductCount) / total * 100
		summary.CategoryB.ProductPercent = float64(summary.CategoryB.ProductCount) / total * 100
		summary.CategoryC.ProductPercent = float64(summary.CategoryC.ProductCount) / total * 100
		summary.CategoryX.ProductPercent = float64(summary.CategoryX.ProductCount) / total * 100
		summary.CategoryY.ProductPercent = float64(summary.CategoryY.ProductCount) / total * 100
		summary.CategoryZ.ProductPercent = float64(summary.CategoryZ.ProductCount) / total * 100
	}

	if totalRevenue > 0 {
		summary.CategoryA.RevenuePercent = summary.CategoryA.Revenue / totalRevenue * 100
		summary.CategoryB.RevenuePercent = summary.CategoryB.Revenue / totalRevenue * 100
		summary.CategoryC.RevenuePercent = summary.CategoryC.Revenue / totalRevenue * 100
		summary.CategoryX.RevenuePercent = summary.CategoryX.Revenue / totalRevenue * 100
		summary.CategoryY.RevenuePercent = summary.CategoryY.Revenue / totalRevenue * 100
		summary.CategoryZ.RevenuePercent = summary.CategoryZ.Revenue / totalRevenue * 100
	}

	return summary
}

func buildMatrix(results []ABCXYZResult, totalRevenue float64) ABCXYZMatrix {
	matrix := ABCXYZMatrix{}

	// Count products in each cell
	cells := map[string]*MatrixCell{
		"AX": &matrix.AX, "AY": &matrix.AY, "AZ": &matrix.AZ,
		"BX": &matrix.BX, "BY": &matrix.BY, "BZ": &matrix.BZ,
		"CX": &matrix.CX, "CY": &matrix.CY, "CZ": &matrix.CZ,
	}

	for _, r := range results {
		key := r.CombinedCategory
		if cell, ok := cells[key]; ok {
			cell.ProductCount++
			cell.Revenue += r.Revenue
			cell.Products = append(cell.Products, r.ProductID)
		}
	}

	// Calculate percentages
	total := float64(len(results))
	for _, cell := range cells {
		if total > 0 {
			cell.ProductPercent = float64(cell.ProductCount) / total * 100
		}
		if totalRevenue > 0 {
			cell.RevenuePercent = cell.Revenue / totalRevenue * 100
		}
	}

	return matrix
}

// GetProductsByCategory returns products in specific ABC-XYZ category
func (s *AnalyticsService) GetProductsByCategory(ctx context.Context, period Period, abc ABCCategory, xyz XYZCategory) ([]ABCXYZResult, error) {
	analysis, err := s.PerformABCXYZAnalysis(ctx, period, DefaultABCXYZConfig())
	if err != nil {
		return nil, err
	}

	var filtered []ABCXYZResult
	for _, p := range analysis.Products {
		if p.ABCCategory == abc && p.XYZCategory == xyz {
			filtered = append(filtered, p)
		}
	}

	return filtered, nil
}

// GetOptimizationSuggestions returns actionable suggestions based on ABC-XYZ
func (s *AnalyticsService) GetOptimizationSuggestions(ctx context.Context, period Period) ([]OptimizationSuggestion, error) {
	analysis, err := s.PerformABCXYZAnalysis(ctx, period, DefaultABCXYZConfig())
	if err != nil {
		return nil, err
	}

	var suggestions []OptimizationSuggestion

	// Count CZ products
	czCount := 0
	czProducts := []string{}
	for _, p := range analysis.Products {
		if p.CombinedCategory == "CZ" {
			czCount++
			if len(czProducts) < 10 {
				czProducts = append(czProducts, p.Name)
			}
		}
	}

	if czCount > 0 {
		suggestions = append(suggestions, OptimizationSuggestion{
			Type:        "inventory_reduction",
			Priority:    "high",
			Title:       "Оптимізація асортименту",
			Description: fmt.Sprintf("Виявлено %d товарів категорії CZ (низький дохід, нестабільний попит). Рекомендовано розглянути вивід з асортименту.", czCount),
			Impact:      "Зменшення складських витрат та заморожених коштів",
			Products:    czProducts,
		})
	}

	// Check AZ products
	azCount := 0
	azProducts := []string{}
	for _, p := range analysis.Products {
		if p.CombinedCategory == "AZ" {
			azCount++
			if len(azProducts) < 10 {
				azProducts = append(azProducts, p.Name)
			}
		}
	}

	if azCount > 0 {
		suggestions = append(suggestions, OptimizationSuggestion{
			Type:        "demand_analysis",
			Priority:    "medium",
			Title:       "Аналіз нестабільного попиту",
			Description: fmt.Sprintf("Виявлено %d високоприбуткових товарів з нестабільним попитом (AZ). Рекомендовано провести детальний аналіз причин коливань.", azCount),
			Impact:      "Покращення прогнозування та планування закупівель",
			Products:    azProducts,
		})
	}

	return suggestions, nil
}

// OptimizationSuggestion represents optimization suggestion
type OptimizationSuggestion struct {
	Type        string   `json:"type"`
	Priority    string   `json:"priority"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Impact      string   `json:"impact"`
	Products    []string `json:"products,omitempty"`
}

