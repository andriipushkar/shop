package analytics

import (
	"context"
	"sort"
	"time"
)

// RFMScore represents individual R, F, M scores (1-5)
type RFMScore struct {
	Recency   int `json:"recency"`   // 1-5, 5 = most recent
	Frequency int `json:"frequency"` // 1-5, 5 = most frequent
	Monetary  int `json:"monetary"`  // 1-5, 5 = highest spending
}

// RFMSegment represents customer segment
type RFMSegment string

const (
	SegmentChampions         RFMSegment = "champions"           // 5,5,5 - 4,4,4
	SegmentLoyalCustomers    RFMSegment = "loyal_customers"     // High F
	SegmentPotentialLoyalist RFMSegment = "potential_loyalist"  // Recent, medium F
	SegmentNewCustomers      RFMSegment = "new_customers"       // Very recent, low F
	SegmentPromising         RFMSegment = "promising"           // Recent, low F/M
	SegmentNeedAttention     RFMSegment = "need_attention"      // Above average but declining
	SegmentAboutToSleep      RFMSegment = "about_to_sleep"      // Below average R
	SegmentAtRisk            RFMSegment = "at_risk"             // High value but not recent
	SegmentCantLoseThem      RFMSegment = "cant_lose_them"      // Valuable but lost
	SegmentHibernating       RFMSegment = "hibernating"         // Low R, low F, low M
	SegmentLost              RFMSegment = "lost"                // Lowest scores
)

// RFMCustomer represents customer with RFM analysis
type RFMCustomer struct {
	CustomerID       string     `json:"customer_id"`
	Name             string     `json:"name"`
	Email            string     `json:"email"`
	Phone            string     `json:"phone,omitempty"`
	Recency          int        `json:"recency_days"`        // Days since last order
	Frequency        int        `json:"frequency"`           // Number of orders
	Monetary         float64    `json:"monetary"`            // Total spending
	RecencyScore     int        `json:"recency_score"`       // 1-5
	FrequencyScore   int        `json:"frequency_score"`     // 1-5
	MonetaryScore    int        `json:"monetary_score"`      // 1-5
	RFMScore         string     `json:"rfm_score"`           // Combined "555", "432", etc.
	Segment          RFMSegment `json:"segment"`
	SegmentName      string     `json:"segment_name"`        // Localized name
	FirstOrderDate   time.Time  `json:"first_order_date"`
	LastOrderDate    time.Time  `json:"last_order_date"`
	AvgOrderValue    float64    `json:"avg_order_value"`
	LifetimeValue    float64    `json:"lifetime_value"`
	Recommendations  []string   `json:"recommendations"`
}

// RFMAnalysis represents complete RFM analysis
type RFMAnalysis struct {
	Period         Period            `json:"period"`
	AnalysisDate   time.Time         `json:"analysis_date"`
	TotalCustomers int               `json:"total_customers"`
	Customers      []RFMCustomer     `json:"customers"`
	Segments       []RFMSegmentStats `json:"segments"`
	Distribution   RFMDistribution   `json:"distribution"`
}

// RFMSegmentStats represents segment statistics
type RFMSegmentStats struct {
	Segment         RFMSegment `json:"segment"`
	SegmentName     string     `json:"segment_name"`
	CustomerCount   int        `json:"customer_count"`
	CustomerPercent float64    `json:"customer_percent"`
	TotalRevenue    float64    `json:"total_revenue"`
	RevenuePercent  float64    `json:"revenue_percent"`
	AvgOrderValue   float64    `json:"avg_order_value"`
	AvgOrderCount   float64    `json:"avg_order_count"`
	Description     string     `json:"description"`
	Actions         []string   `json:"actions"`
}

// RFMDistribution represents score distribution
type RFMDistribution struct {
	RecencyDist   map[int]int `json:"recency_distribution"`
	FrequencyDist map[int]int `json:"frequency_distribution"`
	MonetaryDist  map[int]int `json:"monetary_distribution"`
}

// RFMConfig represents analysis configuration
type RFMConfig struct {
	// Quantile boundaries for scoring (default: quintiles)
	RecencyBoundaries   []float64 `json:"recency_boundaries"`   // Days thresholds
	FrequencyBoundaries []float64 `json:"frequency_boundaries"` // Order count thresholds
	MonetaryBoundaries  []float64 `json:"monetary_boundaries"`  // Spending thresholds

	// Or use automatic quantile calculation
	UseQuantiles bool `json:"use_quantiles"`
	Quantiles    int  `json:"quantiles"` // Default: 5
}

// DefaultRFMConfig returns default configuration
func DefaultRFMConfig() RFMConfig {
	return RFMConfig{
		UseQuantiles: true,
		Quantiles:    5,
	}
}

// PerformRFMAnalysis performs RFM analysis on customers
func (s *AnalyticsService) PerformRFMAnalysis(ctx context.Context, period Period, config RFMConfig) (*RFMAnalysis, error) {
	// Get customer transactions
	transactions, err := s.repo.GetCustomerTransactions(ctx, period)
	if err != nil {
		return nil, err
	}

	if len(transactions) == 0 {
		return &RFMAnalysis{Period: period, AnalysisDate: time.Now()}, nil
	}

	// Aggregate by customer
	customerData := aggregateCustomerData(transactions)

	// Calculate RFM values
	now := time.Now()
	customers := make([]RFMCustomer, 0, len(customerData))

	recencyValues := make([]float64, 0)
	frequencyValues := make([]float64, 0)
	monetaryValues := make([]float64, 0)

	for _, cd := range customerData {
		recency := int(now.Sub(cd.LastOrderDate).Hours() / 24)

		customers = append(customers, RFMCustomer{
			CustomerID:     cd.CustomerID,
			Name:           cd.CustomerName,
			Email:          cd.CustomerEmail,
			Recency:        recency,
			Frequency:      cd.OrderCount,
			Monetary:       cd.TotalSpent,
			FirstOrderDate: cd.FirstOrderDate,
			LastOrderDate:  cd.LastOrderDate,
			AvgOrderValue:  cd.TotalSpent / float64(cd.OrderCount),
		})

		recencyValues = append(recencyValues, float64(recency))
		frequencyValues = append(frequencyValues, float64(cd.OrderCount))
		monetaryValues = append(monetaryValues, cd.TotalSpent)
	}

	// Calculate score boundaries
	var rBounds, fBounds, mBounds []float64
	if config.UseQuantiles {
		rBounds = calculateQuantiles(recencyValues, config.Quantiles)
		fBounds = calculateQuantiles(frequencyValues, config.Quantiles)
		mBounds = calculateQuantiles(monetaryValues, config.Quantiles)
	} else {
		rBounds = config.RecencyBoundaries
		fBounds = config.FrequencyBoundaries
		mBounds = config.MonetaryBoundaries
	}

	// Score customers
	totalRevenue := 0.0
	for i := range customers {
		// Recency: lower is better, so reverse scoring
		customers[i].RecencyScore = 6 - scoreValue(float64(customers[i].Recency), rBounds, true)
		customers[i].FrequencyScore = scoreValue(float64(customers[i].Frequency), fBounds, false)
		customers[i].MonetaryScore = scoreValue(customers[i].Monetary, mBounds, false)

		customers[i].RFMScore = formatScore(customers[i].RecencyScore, customers[i].FrequencyScore, customers[i].MonetaryScore)
		customers[i].Segment = determineSegment(customers[i].RecencyScore, customers[i].FrequencyScore, customers[i].MonetaryScore)
		customers[i].SegmentName = getSegmentName(customers[i].Segment)
		customers[i].Recommendations = getSegmentRecommendations(customers[i].Segment)
		customers[i].LifetimeValue = calculateLTV(customers[i])

		totalRevenue += customers[i].Monetary
	}

	// Build segment statistics
	segments := buildSegmentStats(customers, totalRevenue)

	// Build distribution
	distribution := RFMDistribution{
		RecencyDist:   make(map[int]int),
		FrequencyDist: make(map[int]int),
		MonetaryDist:  make(map[int]int),
	}
	for _, c := range customers {
		distribution.RecencyDist[c.RecencyScore]++
		distribution.FrequencyDist[c.FrequencyScore]++
		distribution.MonetaryDist[c.MonetaryScore]++
	}

	return &RFMAnalysis{
		Period:         period,
		AnalysisDate:   now,
		TotalCustomers: len(customers),
		Customers:      customers,
		Segments:       segments,
		Distribution:   distribution,
	}, nil
}

type aggregatedCustomer struct {
	CustomerID     string
	CustomerName   string
	CustomerEmail  string
	OrderCount     int
	TotalSpent     float64
	FirstOrderDate time.Time
	LastOrderDate  time.Time
}

func aggregateCustomerData(transactions []CustomerTransaction) map[string]*aggregatedCustomer {
	result := make(map[string]*aggregatedCustomer)

	for _, t := range transactions {
		if c, exists := result[t.CustomerID]; exists {
			c.OrderCount++
			c.TotalSpent += t.OrderTotal
			if t.OrderDate.Before(c.FirstOrderDate) {
				c.FirstOrderDate = t.OrderDate
			}
			if t.OrderDate.After(c.LastOrderDate) {
				c.LastOrderDate = t.OrderDate
			}
		} else {
			result[t.CustomerID] = &aggregatedCustomer{
				CustomerID:     t.CustomerID,
				CustomerName:   t.CustomerName,
				CustomerEmail:  t.CustomerEmail,
				OrderCount:     1,
				TotalSpent:     t.OrderTotal,
				FirstOrderDate: t.OrderDate,
				LastOrderDate:  t.OrderDate,
			}
		}
	}

	return result
}

func calculateQuantiles(values []float64, n int) []float64 {
	if len(values) == 0 {
		return nil
	}

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	bounds := make([]float64, n-1)
	for i := 1; i < n; i++ {
		idx := len(sorted) * i / n
		if idx >= len(sorted) {
			idx = len(sorted) - 1
		}
		bounds[i-1] = sorted[idx]
	}

	return bounds
}

func scoreValue(value float64, bounds []float64, reverse bool) int {
	score := 1
	for _, b := range bounds {
		if value > b {
			score++
		}
	}

	if score > 5 {
		score = 5
	}

	return score
}

func formatScore(r, f, m int) string {
	return string(rune('0'+r)) + string(rune('0'+f)) + string(rune('0'+m))
}

func determineSegment(r, f, m int) RFMSegment {
	// Champions: Best customers
	if r >= 4 && f >= 4 && m >= 4 {
		return SegmentChampions
	}

	// Loyal Customers: High frequency with decent recency OR very high frequency
	// (3,4,5), (2,5,4)
	if (r >= 3 && f >= 4 && m >= 3) || (r == 2 && f >= 5 && m >= 4) {
		return SegmentLoyalCustomers
	}

	// Can't Lose Them: Very low recency with high frequency
	// (1,5,4), (2,4,4)
	if (r == 1 && f >= 5 && m >= 4) || (r == 2 && f == 4 && m == 4) {
		return SegmentCantLoseThem
	}

	// At Risk: Low recency with medium-high frequency and monetary
	// (1,4,5), (2,3,4)
	if r <= 2 && f >= 3 && m >= 3 {
		return SegmentAtRisk
	}

	// New Customers: Very recent, first purchase
	if r >= 4 && f == 1 {
		return SegmentNewCustomers
	}

	// Potential Loyalist: Recent with repeat purchases and decent spending
	// (4,3,2), (5,2,2)
	if r >= 4 && f >= 2 && m >= 2 {
		return SegmentPotentialLoyalist
	}

	// Promising: Recent but minimal spending or frequency
	// (3,1,2), (4,2,1)
	if r >= 3 && (f == 1 || m == 1) {
		return SegmentPromising
	}

	// Need Attention: Above average but declining
	// (3,3,3), (3,3,4)
	if r == 3 && f >= 3 && m >= 3 {
		return SegmentNeedAttention
	}

	// About to Sleep: Below average recency with some activity
	// (2,3,2), (2,2,2)
	if r == 2 && f >= 2 {
		return SegmentAboutToSleep
	}

	// Hibernating: Low recency, low activity
	// (1,1,1), (2,1,2)
	if r <= 2 && f <= 2 && m <= 2 {
		return SegmentHibernating
	}

	// Lost: Lowest scores
	return SegmentLost
}

func getSegmentName(segment RFMSegment) string {
	names := map[RFMSegment]string{
		SegmentChampions:         "Чемпіони",
		SegmentLoyalCustomers:    "Лояльні клієнти",
		SegmentPotentialLoyalist: "Потенційно лояльні",
		SegmentNewCustomers:      "Нові клієнти",
		SegmentPromising:         "Перспективні",
		SegmentNeedAttention:     "Потребують уваги",
		SegmentAboutToSleep:      "Засинають",
		SegmentAtRisk:            "Під ризиком",
		SegmentCantLoseThem:      "Не можемо втратити",
		SegmentHibernating:       "Сплячі",
		SegmentLost:              "Втрачені",
	}
	return names[segment]
}

func getSegmentRecommendations(segment RFMSegment) []string {
	recommendations := map[RFMSegment][]string{
		SegmentChampions: {
			"Запропонуйте ексклюзивні пропозиції",
			"Залучіть до програми лояльності VIP",
			"Попросіть залишити відгук",
			"Запропонуйте реферальну програму",
		},
		SegmentLoyalCustomers: {
			"Подякуйте за лояльність",
			"Запропонуйте upsell/cross-sell",
			"Залучіть до бета-тестування нових продуктів",
		},
		SegmentPotentialLoyalist: {
			"Запропонуйте програму лояльності",
			"Надайте персоналізовані рекомендації",
			"Нагадайте про переваги регулярних покупок",
		},
		SegmentNewCustomers: {
			"Надішліть welcome-серію листів",
			"Запропонуйте знижку на наступну покупку",
			"Розкажіть про бестселери",
		},
		SegmentPromising: {
			"Підтримуйте залученість контентом",
			"Запропонуйте тестові продукти",
			"Створіть персоналізовані пропозиції",
		},
		SegmentNeedAttention: {
			"Надішліть персоналізовану пропозицію",
			"Проведіть опитування задоволеності",
			"Запропонуйте обмежену акцію",
		},
		SegmentAboutToSleep: {
			"Надішліть реактиваційну кампанію",
			"Запропонуйте спеціальну знижку",
			"Нагадайте про незавершені дії",
		},
		SegmentAtRisk: {
			"Терміново зверніться з персональною пропозицією",
			"Дізнайтесь причину відсутності покупок",
			"Запропонуйте значну знижку",
		},
		SegmentCantLoseThem: {
			"Зробіть особистий дзвінок",
			"Надайте VIP-обслуговування",
			"Запропонуйте ексклюзивну угоду",
		},
		SegmentHibernating: {
			"Надішліть win-back кампанію",
			"Покажіть нові продукти",
			"Запропонуйте значну знижку для повернення",
		},
		SegmentLost: {
			"Спробуйте останню реактивацію",
			"Дізнайтесь причину втрати",
			"Розгляньте видалення з активної бази",
		},
	}
	return recommendations[segment]
}

func calculateLTV(customer RFMCustomer) float64 {
	// Simple LTV calculation
	// LTV = Average Order Value × Purchase Frequency × Customer Lifespan
	customerAge := time.Since(customer.FirstOrderDate).Hours() / 24 / 365 // years
	if customerAge < 0.1 {
		customerAge = 0.1 // Minimum 1 month
	}

	avgPurchaseFrequency := float64(customer.Frequency) / customerAge

	// Assuming 3 year customer lifespan
	expectedLifespan := 3.0

	return customer.AvgOrderValue * avgPurchaseFrequency * expectedLifespan
}

func buildSegmentStats(customers []RFMCustomer, totalRevenue float64) []RFMSegmentStats {
	segmentData := make(map[RFMSegment]*RFMSegmentStats)

	for _, c := range customers {
		if _, exists := segmentData[c.Segment]; !exists {
			segmentData[c.Segment] = &RFMSegmentStats{
				Segment:     c.Segment,
				SegmentName: getSegmentName(c.Segment),
				Description: getSegmentDescription(c.Segment),
				Actions:     getSegmentRecommendations(c.Segment),
			}
		}

		segmentData[c.Segment].CustomerCount++
		segmentData[c.Segment].TotalRevenue += c.Monetary
		segmentData[c.Segment].AvgOrderValue += c.AvgOrderValue
		segmentData[c.Segment].AvgOrderCount += float64(c.Frequency)
	}

	total := float64(len(customers))
	stats := make([]RFMSegmentStats, 0, len(segmentData))

	for _, s := range segmentData {
		if s.CustomerCount > 0 {
			s.CustomerPercent = float64(s.CustomerCount) / total * 100
			s.AvgOrderValue = s.AvgOrderValue / float64(s.CustomerCount)
			s.AvgOrderCount = s.AvgOrderCount / float64(s.CustomerCount)
		}
		if totalRevenue > 0 {
			s.RevenuePercent = s.TotalRevenue / totalRevenue * 100
		}
		stats = append(stats, *s)
	}

	// Sort by revenue
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].TotalRevenue > stats[j].TotalRevenue
	})

	return stats
}

func getSegmentDescription(segment RFMSegment) string {
	descriptions := map[RFMSegment]string{
		SegmentChampions:         "Найкращі клієнти: купують часто, недавно та на великі суми",
		SegmentLoyalCustomers:    "Регулярні покупці з хорошим чеком",
		SegmentPotentialLoyalist: "Нещодавні покупці, які можуть стати лояльними",
		SegmentNewCustomers:      "Клієнти, які щойно зробили першу покупку",
		SegmentPromising:         "Недавні клієнти з невеликими покупками",
		SegmentNeedAttention:     "Раніше активні клієнти, активність знижується",
		SegmentAboutToSleep:      "Клієнти, які давно не купували",
		SegmentAtRisk:            "Цінні клієнти, які перестали купувати",
		SegmentCantLoseThem:      "Найцінніші клієнти під загрозою втрати",
		SegmentHibernating:       "Неактивні клієнти з низькою цінністю",
		SegmentLost:              "Клієнти, які ймовірно втрачені назавжди",
	}
	return descriptions[segment]
}

// GetCustomersBySegment returns customers in specific segment
func (s *AnalyticsService) GetCustomersBySegment(ctx context.Context, period Period, segment RFMSegment) ([]RFMCustomer, error) {
	analysis, err := s.PerformRFMAnalysis(ctx, period, DefaultRFMConfig())
	if err != nil {
		return nil, err
	}

	var filtered []RFMCustomer
	for _, c := range analysis.Customers {
		if c.Segment == segment {
			filtered = append(filtered, c)
		}
	}

	return filtered, nil
}

// GetHighValueAtRiskCustomers returns high-value customers that need attention
func (s *AnalyticsService) GetHighValueAtRiskCustomers(ctx context.Context, period Period) ([]RFMCustomer, error) {
	analysis, err := s.PerformRFMAnalysis(ctx, period, DefaultRFMConfig())
	if err != nil {
		return nil, err
	}

	atRiskSegments := map[RFMSegment]bool{
		SegmentAtRisk:       true,
		SegmentCantLoseThem: true,
		SegmentNeedAttention: true,
	}

	var filtered []RFMCustomer
	for _, c := range analysis.Customers {
		if atRiskSegments[c.Segment] {
			filtered = append(filtered, c)
		}
	}

	// Sort by lifetime value
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].LifetimeValue > filtered[j].LifetimeValue
	})

	return filtered, nil
}
