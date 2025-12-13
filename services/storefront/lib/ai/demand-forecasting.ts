/**
 * AI Demand Forecasting
 * Прогнозування попиту та рекомендації закупівель
 */

export interface DemandForecast {
  productId: string;
  productName: string;
  period: 'day' | 'week' | 'month';
  forecast: ForecastPoint[];
  confidence: number; // 0-100%
  factors: ForecastFactor[];
  generatedAt: Date;
}

export interface ForecastPoint {
  date: Date;
  quantity: number;
  low: number; // Lower bound (95% CI)
  high: number; // Upper bound (95% CI)
  revenue?: number;
}

export interface ForecastFactor {
  name: string;
  impact: number; // -1 to 1
  description: string;
}

export interface PurchaseRecommendation {
  productId: string;
  productName: string;
  sku?: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  recommendedQuantity: number;
  reorderPoint: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  optimalOrderDate: Date;
  supplierLeadTime: number;
  estimatedCost: number;
  estimatedRevenue: number;
  roi: number;
}

export interface SeasonalityPattern {
  productId: string;
  pattern: 'weekly' | 'monthly' | 'yearly' | 'none';
  peaks: { period: string; multiplier: number }[];
  troughs: { period: string; multiplier: number }[];
  strength: number; // 0-1, how strong the seasonality is
}

export interface TrendAnalysis {
  trend: 'growing' | 'declining' | 'stable';
  growthRate: number; // Annual growth rate %
  confidence: number; // 0-100%
  dataPoints: number;
  lastUpdated: Date;
}

export interface ScenarioSimulation {
  scenarioName: string;
  baselineSales: number;
  projectedSales: number;
  salesChange: number;
  salesChangePercent: number;
  revenueImpact: number;
  marginImpact: number;
  confidence: number;
  assumptions: string[];
}

export interface ModelAccuracy {
  productId: string;
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  mae: number; // Mean Absolute Error
  r2: number; // R-squared
  trainedOn: number; // Number of data points
  lastTrained: Date;
}

export class DemandForecastingService {
  private models: Map<string, ModelAccuracy> = new Map();
  private forecasts: Map<string, DemandForecast> = new Map();

  /**
   * Generate demand forecast for a product
   * Створити прогноз попиту для товару
   */
  async forecastDemand(productId: string, days: number): Promise<DemandForecast> {
    // Get historical sales data
    const historicalData = await this.getHistoricalSales(productId, 90); // Last 90 days

    if (historicalData.length < 14) {
      throw new Error('Insufficient historical data (need at least 14 days)');
    }

    // Train or update model
    await this.trainModel(productId);

    // Calculate base forecast using moving average + trend
    const forecast = this.calculateForecast(historicalData, days);

    // Apply seasonality adjustments
    const seasonality = await this.analyzeSeasonality(productId);
    const adjustedForecast = this.applySeasonality(forecast, seasonality);

    // Calculate confidence intervals
    const forecastPoints = this.calculateConfidenceIntervals(adjustedForecast, historicalData);

    // Identify influencing factors
    const factors = await this.identifyFactors(productId, historicalData);

    const demandForecast: DemandForecast = {
      productId,
      productName: await this.getProductName(productId),
      period: days <= 7 ? 'day' : days <= 31 ? 'week' : 'month',
      forecast: forecastPoints,
      confidence: this.calculateOverallConfidence(historicalData),
      factors,
      generatedAt: new Date(),
    };

    // Cache forecast
    this.forecasts.set(productId, demandForecast);

    return demandForecast;
  }

  /**
   * Forecast demand for all products in a category
   * Прогноз попиту для всіх товарів у категорії
   */
  async forecastCategory(
    categoryId: string,
    days: number
  ): Promise<Map<string, DemandForecast>> {
    const products = await this.getProductsInCategory(categoryId);
    const forecasts = new Map<string, DemandForecast>();

    for (const productId of products) {
      try {
        const forecast = await this.forecastDemand(productId, days);
        forecasts.set(productId, forecast);
      } catch (error) {
        console.error(`Failed to forecast for product ${productId}:`, error);
      }
    }

    return forecasts;
  }

  /**
   * Get purchase recommendations based on demand forecasts
   * Отримати рекомендації закупівель на основі прогнозів попиту
   */
  async getPurchaseRecommendations(filters?: {
    categoryId?: string;
    supplierId?: string;
    urgency?: string;
    minValue?: number;
  }): Promise<PurchaseRecommendation[]> {
    // Get all products (or filtered)
    let products: string[];

    if (filters?.categoryId) {
      products = await this.getProductsInCategory(filters.categoryId);
    } else {
      products = await this.getAllProducts();
    }

    const recommendations: PurchaseRecommendation[] = [];

    for (const productId of products) {
      try {
        // Get current stock
        const currentStock = await this.getCurrentStock(productId);

        // Get demand forecast (next 30 days)
        const forecast = await this.forecastDemand(productId, 30);

        // Calculate average daily sales
        const avgDailySales = forecast.forecast.slice(0, 7).reduce((sum, p) => sum + p.quantity, 0) / 7;

        // Calculate days until stockout
        const daysUntilStockout = avgDailySales > 0 ? currentStock / avgDailySales : 999;

        // Get supplier lead time
        const supplierLeadTime = await this.getSupplierLeadTime(productId);

        // Calculate reorder point (lead time demand + safety stock)
        const leadTimeDemand = avgDailySales * supplierLeadTime;
        const safetyStock = avgDailySales * 7; // 1 week safety stock
        const reorderPoint = leadTimeDemand + safetyStock;

        // Check if we need to reorder
        if (currentStock <= reorderPoint || daysUntilStockout <= supplierLeadTime) {
          // Calculate recommended order quantity (Economic Order Quantity simplified)
          const avgMonthlySales = avgDailySales * 30;
          const recommendedQuantity = Math.max(
            Math.ceil(avgMonthlySales), // At least 1 month supply
            Math.ceil(reorderPoint - currentStock) // Or enough to reach reorder point
          );

          // Get product cost
          const cost = await this.getProductCost(productId);
          const price = await this.getProductPrice(productId);

          // Calculate ROI
          const estimatedCost = recommendedQuantity * cost;
          const estimatedRevenue = recommendedQuantity * price;
          const roi = ((estimatedRevenue - estimatedCost) / estimatedCost) * 100;

          // Determine urgency
          let urgency: 'critical' | 'high' | 'medium' | 'low';
          if (daysUntilStockout <= supplierLeadTime) {
            urgency = 'critical';
          } else if (daysUntilStockout <= supplierLeadTime * 2) {
            urgency = 'high';
          } else if (currentStock <= reorderPoint * 1.5) {
            urgency = 'medium';
          } else {
            urgency = 'low';
          }

          // Calculate optimal order date
          const optimalOrderDate = new Date();
          optimalOrderDate.setDate(
            optimalOrderDate.getDate() + Math.max(0, daysUntilStockout - supplierLeadTime - 7)
          );

          recommendations.push({
            productId,
            productName: await this.getProductName(productId),
            sku: await this.getProductSKU(productId),
            currentStock,
            avgDailySales,
            daysUntilStockout,
            recommendedQuantity,
            reorderPoint,
            urgency,
            optimalOrderDate,
            supplierLeadTime,
            estimatedCost,
            estimatedRevenue,
            roi,
          });
        }
      } catch (error) {
        console.error(`Failed to generate recommendation for ${productId}:`, error);
      }
    }

    // Sort by urgency
    recommendations.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    // Apply filters
    if (filters?.urgency) {
      return recommendations.filter(r => r.urgency === filters.urgency);
    }

    if (filters?.minValue) {
      return recommendations.filter(r => r.estimatedCost >= filters.minValue);
    }

    return recommendations;
  }

  /**
   * Analyze seasonality patterns in demand
   * Аналіз сезонності попиту
   */
  async analyzeSeasonality(productId: string): Promise<SeasonalityPattern> {
    const historicalData = await this.getHistoricalSales(productId, 365); // 1 year

    if (historicalData.length < 90) {
      return {
        productId,
        pattern: 'none',
        peaks: [],
        troughs: [],
        strength: 0,
      };
    }

    // Detect weekly pattern
    const weeklyPattern = this.detectWeeklySeasonality(historicalData);

    // Detect monthly pattern
    const monthlyPattern = this.detectMonthlySeasonality(historicalData);

    // Detect yearly pattern (if enough data)
    const yearlyPattern = historicalData.length >= 365
      ? this.detectYearlySeasonality(historicalData)
      : null;

    // Determine dominant pattern
    let pattern: 'weekly' | 'monthly' | 'yearly' | 'none' = 'none';
    let strength = 0;
    let peaks: { period: string; multiplier: number }[] = [];
    let troughs: { period: string; multiplier: number }[] = [];

    if (yearlyPattern && yearlyPattern.strength > 0.3) {
      pattern = 'yearly';
      strength = yearlyPattern.strength;
      peaks = yearlyPattern.peaks;
      troughs = yearlyPattern.troughs;
    } else if (monthlyPattern.strength > 0.2) {
      pattern = 'monthly';
      strength = monthlyPattern.strength;
      peaks = monthlyPattern.peaks;
      troughs = monthlyPattern.troughs;
    } else if (weeklyPattern.strength > 0.15) {
      pattern = 'weekly';
      strength = weeklyPattern.strength;
      peaks = weeklyPattern.peaks;
      troughs = weeklyPattern.troughs;
    }

    return {
      productId,
      pattern,
      peaks,
      troughs,
      strength,
    };
  }

  /**
   * Detect demand trends
   * Виявлення трендів попиту
   */
  async detectTrends(productId: string): Promise<TrendAnalysis> {
    const historicalData = await this.getHistoricalSales(productId, 90);

    if (historicalData.length < 30) {
      throw new Error('Insufficient data for trend analysis');
    }

    // Calculate linear regression
    const { slope, confidence } = this.calculateLinearRegression(historicalData);

    // Determine trend direction
    let trend: 'growing' | 'declining' | 'stable';
    if (slope > 0.02) {
      trend = 'growing';
    } else if (slope < -0.02) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Annualize growth rate
    const avgSales = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
    const growthRate = avgSales > 0 ? (slope / avgSales) * 365 * 100 : 0;

    return {
      trend,
      growthRate,
      confidence: confidence * 100,
      dataPoints: historicalData.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Simulate what-if scenarios
   * Симуляція сценаріїв "що якщо"
   */
  async simulateScenario(scenario: {
    productId: string;
    priceChange?: number;
    promotionDiscount?: number;
    competitorAction?: string;
  }): Promise<ScenarioSimulation> {
    // Get baseline forecast
    const forecast = await this.forecastDemand(scenario.productId, 30);
    const baselineSales = forecast.forecast.reduce((sum, p) => sum + p.quantity, 0);

    let salesMultiplier = 1.0;
    const assumptions: string[] = [];

    // Price elasticity effect
    if (scenario.priceChange) {
      // Assume price elasticity of -1.5 (1% price increase = 1.5% sales decrease)
      const priceElasticity = -1.5;
      const priceChangePercent = scenario.priceChange;
      const salesChangePercent = priceElasticity * priceChangePercent;
      salesMultiplier *= (1 + salesChangePercent / 100);

      assumptions.push(
        `Зміна ціни на ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}% -> ${salesChangePercent > 0 ? '+' : ''}${salesChangePercent.toFixed(1)}% продажів`
      );
    }

    // Promotion effect
    if (scenario.promotionDiscount) {
      // Promotion typically increases sales by 2-3x the discount percentage
      const promotionBoost = scenario.promotionDiscount * 2.5;
      salesMultiplier *= (1 + promotionBoost / 100);

      assumptions.push(
        `Знижка ${scenario.promotionDiscount}% -> +${promotionBoost.toFixed(1)}% продажів`
      );
    }

    // Competitor action effect
    if (scenario.competitorAction) {
      if (scenario.competitorAction === 'price_cut') {
        salesMultiplier *= 0.85; // 15% sales decrease
        assumptions.push('Конкурент знизив ціну -> -15% продажів');
      } else if (scenario.competitorAction === 'promotion') {
        salesMultiplier *= 0.90; // 10% sales decrease
        assumptions.push('Конкурент запустив акцію -> -10% продажів');
      } else if (scenario.competitorAction === 'out_of_stock') {
        salesMultiplier *= 1.25; // 25% sales increase
        assumptions.push('Конкурент розпродав запаси -> +25% продажів');
      }
    }

    const projectedSales = baselineSales * salesMultiplier;
    const salesChange = projectedSales - baselineSales;
    const salesChangePercent = (salesChange / baselineSales) * 100;

    // Calculate revenue impact
    const price = await this.getProductPrice(scenario.productId);
    const adjustedPrice = scenario.priceChange
      ? price * (1 + scenario.priceChange / 100)
      : price;

    if (scenario.promotionDiscount) {
      adjustedPrice * (1 - scenario.promotionDiscount / 100);
    }

    const revenueImpact = (projectedSales * adjustedPrice) - (baselineSales * price);

    // Calculate margin impact
    const cost = await this.getProductCost(scenario.productId);
    const baselineMargin = ((price - cost) / price) * 100;
    const projectedMargin = ((adjustedPrice - cost) / adjustedPrice) * 100;
    const marginImpact = projectedMargin - baselineMargin;

    return {
      scenarioName: this.generateScenarioName(scenario),
      baselineSales,
      projectedSales,
      salesChange,
      salesChangePercent,
      revenueImpact,
      marginImpact,
      confidence: 70, // Moderate confidence in simulation
      assumptions,
    };
  }

  /**
   * Train forecasting model with historical data
   * Навчити модель прогнозування на історичних даних
   */
  async trainModel(productId: string): Promise<void> {
    const historicalData = await this.getHistoricalSales(productId, 180); // 6 months

    if (historicalData.length < 30) {
      throw new Error('Insufficient data to train model');
    }

    // Calculate model accuracy using cross-validation
    const { mape, rmse, mae, r2 } = this.crossValidate(historicalData);

    const accuracy: ModelAccuracy = {
      productId,
      mape,
      rmse,
      mae,
      r2,
      trainedOn: historicalData.length,
      lastTrained: new Date(),
    };

    this.models.set(productId, accuracy);
    console.log(`Model trained for product ${productId}: MAPE=${mape.toFixed(2)}%`);
  }

  /**
   * Get model accuracy metrics
   * Отримати метрики точності моделі
   */
  getModelAccuracy(productId: string): ModelAccuracy {
    const accuracy = this.models.get(productId);

    if (!accuracy) {
      throw new Error('Model not trained for this product');
    }

    return accuracy;
  }

  // Private helper methods

  private calculateForecast(
    historicalData: { date: Date; quantity: number }[],
    days: number
  ): { date: Date; quantity: number }[] {
    const forecast: { date: Date; quantity: number }[] = [];

    // Simple moving average with trend
    const windowSize = 7;
    const recentData = historicalData.slice(-windowSize);
    const avgSales = recentData.reduce((sum, d) => sum + d.quantity, 0) / windowSize;

    // Calculate trend
    const { slope } = this.calculateLinearRegression(historicalData.slice(-30));

    const lastDate = historicalData[historicalData.length - 1].date;

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const trendAdjustment = slope * i;
      const quantity = Math.max(0, avgSales + trendAdjustment);

      forecast.push({
        date: forecastDate,
        quantity: Math.round(quantity),
      });
    }

    return forecast;
  }

  private applySeasonality(
    forecast: { date: Date; quantity: number }[],
    seasonality: SeasonalityPattern
  ): { date: Date; quantity: number }[] {
    if (seasonality.pattern === 'none') {
      return forecast;
    }

    return forecast.map(point => {
      let multiplier = 1.0;

      if (seasonality.pattern === 'weekly') {
        const dayOfWeek = point.date.getDay();
        const pattern = seasonality.peaks.find(p => p.period === dayOfWeek.toString());
        if (pattern) {
          multiplier = pattern.multiplier;
        }
      } else if (seasonality.pattern === 'monthly') {
        const day = point.date.getDate();
        const pattern = seasonality.peaks.find(p => parseInt(p.period) === day);
        if (pattern) {
          multiplier = pattern.multiplier;
        }
      }

      return {
        ...point,
        quantity: Math.round(point.quantity * multiplier),
      };
    });
  }

  private calculateConfidenceIntervals(
    forecast: { date: Date; quantity: number }[],
    historicalData: { date: Date; quantity: number }[]
  ): ForecastPoint[] {
    // Calculate standard deviation of historical data
    const avg = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, d) => sum + Math.pow(d.quantity - avg, 2), 0) / historicalData.length;
    const stdDev = Math.sqrt(variance);

    return forecast.map((point, index) => {
      // Confidence interval widens with time
      const intervalWidth = stdDev * 1.96 * Math.sqrt(1 + index / forecast.length);

      return {
        date: point.date,
        quantity: point.quantity,
        low: Math.max(0, Math.round(point.quantity - intervalWidth)),
        high: Math.round(point.quantity + intervalWidth),
      };
    });
  }

  private async identifyFactors(
    productId: string,
    historicalData: { date: Date; quantity: number }[]
  ): Promise<ForecastFactor[]> {
    const factors: ForecastFactor[] = [];

    // Trend factor
    const { slope } = this.calculateLinearRegression(historicalData);
    if (Math.abs(slope) > 0.01) {
      factors.push({
        name: slope > 0 ? 'Зростаючий тренд' : 'Спадаючий тренд',
        impact: Math.min(1, Math.abs(slope) * 10),
        description: `Продажі ${slope > 0 ? 'зростають' : 'падають'} на ${Math.abs(slope * 30).toFixed(1)} од/місяць`,
      });
    }

    // Seasonality factor
    const seasonality = await this.analyzeSeasonality(productId);
    if (seasonality.strength > 0.2) {
      factors.push({
        name: 'Сезонність',
        impact: seasonality.strength,
        description: `Виявлено ${seasonality.pattern} сезонний патерн`,
      });
    }

    // Volatility factor
    const avg = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, d) => sum + Math.pow(d.quantity - avg, 2), 0) / historicalData.length;
    const cv = Math.sqrt(variance) / avg; // Coefficient of variation

    if (cv > 0.5) {
      factors.push({
        name: 'Висока волатильність',
        impact: -Math.min(0.8, cv),
        description: 'Попит сильно коливається',
      });
    }

    return factors;
  }

  private calculateOverallConfidence(historicalData: { date: Date; quantity: number }[]): number {
    // Base confidence on data quantity and quality
    let confidence = Math.min(100, (historicalData.length / 90) * 100); // More data = more confidence

    // Reduce confidence based on volatility
    const avg = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, d) => sum + Math.pow(d.quantity - avg, 2), 0) / historicalData.length;
    const cv = Math.sqrt(variance) / avg;

    confidence *= (1 - Math.min(0.5, cv)); // High volatility reduces confidence

    return Math.round(confidence);
  }

  private calculateLinearRegression(data: { date: Date; quantity: number }[]): {
    slope: number;
    intercept: number;
    confidence: number;
  } {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.quantity);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    return {
      slope,
      intercept,
      confidence: Math.max(0, Math.min(1, r2)),
    };
  }

  private detectWeeklySeasonality(data: { date: Date; quantity: number }[]): {
    strength: number;
    peaks: { period: string; multiplier: number }[];
    troughs: { period: string; multiplier: number }[];
  } {
    // Group by day of week
    const byDayOfWeek = new Map<number, number[]>();

    data.forEach(d => {
      const day = d.date.getDay();
      if (!byDayOfWeek.has(day)) {
        byDayOfWeek.set(day, []);
      }
      byDayOfWeek.get(day)!.push(d.quantity);
    });

    // Calculate averages
    const avgByDay = new Map<number, number>();
    byDayOfWeek.forEach((values, day) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgByDay.set(day, avg);
    });

    const overallAvg = data.reduce((sum, d) => sum + d.quantity, 0) / data.length;

    // Calculate strength (variance in daily averages)
    const dailyAvgs = Array.from(avgByDay.values());
    const variance = dailyAvgs.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / dailyAvgs.length;
    const strength = Math.min(1, Math.sqrt(variance) / overallAvg);

    // Find peaks and troughs
    const peaks: { period: string; multiplier: number }[] = [];
    const troughs: { period: string; multiplier: number }[] = [];

    avgByDay.forEach((avg, day) => {
      const multiplier = avg / overallAvg;
      if (multiplier > 1.1) {
        peaks.push({ period: day.toString(), multiplier });
      } else if (multiplier < 0.9) {
        troughs.push({ period: day.toString(), multiplier });
      }
    });

    return { strength, peaks, troughs };
  }

  private detectMonthlySeasonality(data: { date: Date; quantity: number }[]): {
    strength: number;
    peaks: { period: string; multiplier: number }[];
    troughs: { period: string; multiplier: number }[];
  } {
    // Group by day of month
    const byDayOfMonth = new Map<number, number[]>();

    data.forEach(d => {
      const day = d.date.getDate();
      if (!byDayOfMonth.has(day)) {
        byDayOfMonth.set(day, []);
      }
      byDayOfMonth.get(day)!.push(d.quantity);
    });

    // Calculate averages
    const avgByDay = new Map<number, number>();
    byDayOfMonth.forEach((values, day) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgByDay.set(day, avg);
    });

    const overallAvg = data.reduce((sum, d) => sum + d.quantity, 0) / data.length;

    // Calculate strength
    const dailyAvgs = Array.from(avgByDay.values());
    const variance = dailyAvgs.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / dailyAvgs.length;
    const strength = Math.min(1, Math.sqrt(variance) / overallAvg);

    const peaks: { period: string; multiplier: number }[] = [];
    const troughs: { period: string; multiplier: number }[] = [];

    avgByDay.forEach((avg, day) => {
      const multiplier = avg / overallAvg;
      if (multiplier > 1.15) {
        peaks.push({ period: day.toString(), multiplier });
      } else if (multiplier < 0.85) {
        troughs.push({ period: day.toString(), multiplier });
      }
    });

    return { strength, peaks, troughs };
  }

  private detectYearlySeasonality(data: { date: Date; quantity: number }[]): {
    strength: number;
    peaks: { period: string; multiplier: number }[];
    troughs: { period: string; multiplier: number }[];
  } | null {
    // Group by month
    const byMonth = new Map<number, number[]>();

    data.forEach(d => {
      const month = d.date.getMonth();
      if (!byMonth.has(month)) {
        byMonth.set(month, []);
      }
      byMonth.get(month)!.push(d.quantity);
    });

    if (byMonth.size < 12) {
      return null; // Not enough monthly data
    }

    // Calculate averages
    const avgByMonth = new Map<number, number>();
    byMonth.forEach((values, month) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgByMonth.set(month, avg);
    });

    const overallAvg = data.reduce((sum, d) => sum + d.quantity, 0) / data.length;

    // Calculate strength
    const monthlyAvgs = Array.from(avgByMonth.values());
    const variance = monthlyAvgs.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / monthlyAvgs.length;
    const strength = Math.min(1, Math.sqrt(variance) / overallAvg);

    const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                       'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

    const peaks: { period: string; multiplier: number }[] = [];
    const troughs: { period: string; multiplier: number }[] = [];

    avgByMonth.forEach((avg, month) => {
      const multiplier = avg / overallAvg;
      if (multiplier > 1.2) {
        peaks.push({ period: monthNames[month], multiplier });
      } else if (multiplier < 0.8) {
        troughs.push({ period: monthNames[month], multiplier });
      }
    });

    return { strength, peaks, troughs };
  }

  private crossValidate(data: { date: Date; quantity: number }[]): {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
  } {
    // Simple train/test split (80/20)
    const splitPoint = Math.floor(data.length * 0.8);
    const trainData = data.slice(0, splitPoint);
    const testData = data.slice(splitPoint);

    // Make predictions on test set
    const predictions = this.calculateForecast(trainData, testData.length);

    // Calculate error metrics
    let sumAbsError = 0;
    let sumAbsPercentError = 0;
    let sumSquaredError = 0;

    testData.forEach((actual, i) => {
      const predicted = predictions[i].quantity;
      const error = actual.quantity - predicted;

      sumAbsError += Math.abs(error);
      sumAbsPercentError += Math.abs(error / actual.quantity) * 100;
      sumSquaredError += error * error;
    });

    const mae = sumAbsError / testData.length;
    const mape = sumAbsPercentError / testData.length;
    const rmse = Math.sqrt(sumSquaredError / testData.length);

    // Calculate R-squared
    const testAvg = testData.reduce((sum, d) => sum + d.quantity, 0) / testData.length;
    const ssTotal = testData.reduce((sum, d) => sum + Math.pow(d.quantity - testAvg, 2), 0);
    const r2 = Math.max(0, 1 - (sumSquaredError / ssTotal));

    return { mape, rmse, mae, r2 };
  }

  private generateScenarioName(scenario: {
    productId: string;
    priceChange?: number;
    promotionDiscount?: number;
    competitorAction?: string;
  }): string {
    const parts: string[] = [];

    if (scenario.priceChange) {
      parts.push(`Ціна ${scenario.priceChange > 0 ? '+' : ''}${scenario.priceChange}%`);
    }

    if (scenario.promotionDiscount) {
      parts.push(`Знижка ${scenario.promotionDiscount}%`);
    }

    if (scenario.competitorAction) {
      parts.push(`Конкурент: ${scenario.competitorAction}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Базовий сценарій';
  }

  // Mock data methods (replace with actual database queries)

  private async getHistoricalSales(productId: string, days: number): Promise<{ date: Date; quantity: number }[]> {
    // TODO: Get actual sales data from database
    const data: { date: Date; quantity: number }[] = [];
    const baseQuantity = 10 + Math.random() * 20;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Add some randomness and weekly pattern
      const dayOfWeek = date.getDay();
      const weekendBoost = (dayOfWeek === 6 || dayOfWeek === 0) ? 1.3 : 1.0;
      const randomness = 0.7 + Math.random() * 0.6;

      data.push({
        date,
        quantity: Math.round(baseQuantity * weekendBoost * randomness),
      });
    }

    return data;
  }

  private async getProductName(productId: string): Promise<string> {
    return `Товар ${productId}`;
  }

  private async getProductSKU(productId: string): Promise<string> {
    return `SKU-${productId}`;
  }

  private async getProductsInCategory(categoryId: string): Promise<string[]> {
    return ['prod1', 'prod2', 'prod3'];
  }

  private async getAllProducts(): Promise<string[]> {
    return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'];
  }

  private async getCurrentStock(productId: string): Promise<number> {
    return Math.floor(Math.random() * 100);
  }

  private async getSupplierLeadTime(productId: string): Promise<number> {
    return 7 + Math.floor(Math.random() * 14); // 7-21 days
  }

  private async getProductCost(productId: string): Promise<number> {
    return 500 + Math.random() * 500;
  }

  private async getProductPrice(productId: string): Promise<number> {
    return 1000 + Math.random() * 500;
  }
}

// Singleton instance
export const demandForecastingService = new DemandForecastingService();
