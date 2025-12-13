/**
 * Competitor Price Monitoring System
 * Tracks and analyzes competitor prices for products
 */

export interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  productSku: string;
  productName: string;
  price: number;
  currency: string;
  url: string;
  inStock: boolean;
  lastChecked: Date;
  priceHistory: PriceHistoryEntry[];
}

export interface PriceHistoryEntry {
  price: number;
  date: Date;
  inStock: boolean;
}

export interface Competitor {
  id: string;
  name: string;
  nameUk: string;
  domain: string;
  logo?: string;
  isActive: boolean;
  checkFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface ProductPriceComparison {
  productId: string;
  productName: string;
  productSku: string;
  ourPrice: number;
  ourComparePrice?: number;
  competitors: CompetitorPriceInfo[];
  analysis: PriceAnalysis;
}

export interface CompetitorPriceInfo {
  competitorId: string;
  competitorName: string;
  price: number;
  priceDiff: number;
  priceDiffPercent: number;
  url: string;
  inStock: boolean;
  lastChecked: Date;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface PriceAnalysis {
  marketPosition: 'cheapest' | 'below_average' | 'average' | 'above_average' | 'most_expensive';
  averageMarketPrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceRange: number;
  competitorCount: number;
  inStockCompetitors: number;
  recommendation: PriceRecommendation;
}

export interface PriceRecommendation {
  action: 'keep' | 'raise' | 'lower' | 'monitor';
  suggestedPrice?: number;
  reason: string;
  reasonUk: string;
  potentialImpact: {
    revenueChange: number;
    marginChange: number;
    competitiveness: number;
  };
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  alertType: 'competitor_lower' | 'competitor_out_of_stock' | 'significant_change' | 'new_competitor';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  messageUk: string;
  competitorId?: string;
  competitorName?: string;
  previousPrice?: number;
  currentPrice?: number;
  createdAt: Date;
  isRead: boolean;
  isResolved: boolean;
}

export interface PriceMonitoringConfig {
  alertThresholds: {
    priceDropPercent: number; // Alert when competitor drops price by this %
    priceRisePercent: number; // Alert when competitor raises price by this %
    underCutPercent: number; // Alert when competitor undercuts us by this %
  };
  competitorWeights: Record<string, number>; // Weight for each competitor (0-1)
  autoAdjust: boolean;
  marginTarget: number; // Target margin percentage
  minPrice: number; // Minimum allowed price
}

// Ukrainian competitors
export const COMPETITORS: Competitor[] = [
  {
    id: 'rozetka',
    name: 'Rozetka',
    nameUk: 'Розетка',
    domain: 'rozetka.com.ua',
    isActive: true,
    checkFrequency: 'hourly',
  },
  {
    id: 'citrus',
    name: 'Citrus',
    nameUk: 'Цитрус',
    domain: 'citrus.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
  {
    id: 'foxtrot',
    name: 'Foxtrot',
    nameUk: 'Фокстрот',
    domain: 'foxtrot.com.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
  {
    id: 'comfy',
    name: 'Comfy',
    nameUk: 'Comfy',
    domain: 'comfy.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
  {
    id: 'epicentrk',
    name: 'Epicentr K',
    nameUk: 'Епіцентр К',
    domain: 'epicentrk.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
  {
    id: 'allo',
    name: 'Allo',
    nameUk: 'Алло',
    domain: 'allo.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
  {
    id: 'moyo',
    name: 'MOYO',
    nameUk: 'MOYO',
    domain: 'moyo.ua',
    isActive: true,
    checkFrequency: 'daily',
  },
];

// Default monitoring configuration
export const DEFAULT_CONFIG: PriceMonitoringConfig = {
  alertThresholds: {
    priceDropPercent: 5,
    priceRisePercent: 10,
    underCutPercent: 3,
  },
  competitorWeights: {
    rozetka: 1.0, // Highest weight - market leader
    citrus: 0.8,
    foxtrot: 0.8,
    comfy: 0.7,
    epicentrk: 0.6,
    allo: 0.7,
    moyo: 0.6,
  },
  autoAdjust: false,
  marginTarget: 15, // 15% target margin
  minPrice: 0,
};

/**
 * Analyze price position in market
 */
export function analyzeMarketPosition(
  ourPrice: number,
  competitorPrices: CompetitorPriceInfo[]
): PriceAnalysis {
  const inStockPrices = competitorPrices
    .filter(c => c.inStock)
    .map(c => c.price);

  if (inStockPrices.length === 0) {
    return {
      marketPosition: 'average',
      averageMarketPrice: ourPrice,
      lowestPrice: ourPrice,
      highestPrice: ourPrice,
      priceRange: 0,
      competitorCount: competitorPrices.length,
      inStockCompetitors: 0,
      recommendation: {
        action: 'keep',
        reason: 'No competitor prices available',
        reasonUk: 'Немає даних про ціни конкурентів',
        potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
      },
    };
  }

  const allPrices = [...inStockPrices, ourPrice];
  const averageMarketPrice = inStockPrices.reduce((a, b) => a + b, 0) / inStockPrices.length;
  const lowestPrice = Math.min(...allPrices);
  const highestPrice = Math.max(...allPrices);
  const priceRange = highestPrice - lowestPrice;

  // Determine market position
  let marketPosition: PriceAnalysis['marketPosition'];
  const ourPosition = (ourPrice - lowestPrice) / (priceRange || 1);

  if (ourPrice === lowestPrice) {
    marketPosition = 'cheapest';
  } else if (ourPosition <= 0.25) {
    marketPosition = 'below_average';
  } else if (ourPosition <= 0.75) {
    marketPosition = 'average';
  } else if (ourPrice === highestPrice) {
    marketPosition = 'most_expensive';
  } else {
    marketPosition = 'above_average';
  }

  // Generate recommendation
  const recommendation = generatePriceRecommendation(
    ourPrice,
    averageMarketPrice,
    lowestPrice,
    marketPosition
  );

  return {
    marketPosition,
    averageMarketPrice: Math.round(averageMarketPrice),
    lowestPrice,
    highestPrice,
    priceRange,
    competitorCount: competitorPrices.length,
    inStockCompetitors: inStockPrices.length,
    recommendation,
  };
}

/**
 * Generate price recommendation based on analysis
 */
function generatePriceRecommendation(
  ourPrice: number,
  avgPrice: number,
  lowestPrice: number,
  position: PriceAnalysis['marketPosition']
): PriceRecommendation {
  const diffFromAvg = ((ourPrice - avgPrice) / avgPrice) * 100;
  const diffFromLowest = ((ourPrice - lowestPrice) / lowestPrice) * 100;

  if (position === 'most_expensive' && diffFromAvg > 15) {
    const suggestedPrice = Math.round(avgPrice * 1.05);
    return {
      action: 'lower',
      suggestedPrice,
      reason: `Price is ${diffFromAvg.toFixed(1)}% above market average`,
      reasonUk: `Ціна на ${diffFromAvg.toFixed(1)}% вище середньоринкової`,
      potentialImpact: {
        revenueChange: -5,
        marginChange: -3,
        competitiveness: 15,
      },
    };
  }

  if (position === 'cheapest' && diffFromAvg < -10) {
    const suggestedPrice = Math.round(avgPrice * 0.95);
    return {
      action: 'raise',
      suggestedPrice,
      reason: 'Price is significantly below market, margin opportunity',
      reasonUk: 'Ціна значно нижче ринку, є можливість збільшити маржу',
      potentialImpact: {
        revenueChange: 8,
        marginChange: 5,
        competitiveness: -5,
      },
    };
  }

  if (position === 'above_average' && diffFromLowest > 20) {
    return {
      action: 'monitor',
      reason: 'Monitor competitor prices, consider promotion',
      reasonUk: 'Моніторте ціни конкурентів, розгляньте акцію',
      potentialImpact: {
        revenueChange: 0,
        marginChange: 0,
        competitiveness: 0,
      },
    };
  }

  return {
    action: 'keep',
    reason: 'Price is competitive in the market',
    reasonUk: 'Ціна конкурентоспроможна на ринку',
    potentialImpact: {
      revenueChange: 0,
      marginChange: 0,
      competitiveness: 0,
    },
  };
}

/**
 * Calculate price trend from history
 */
export function calculatePriceTrend(
  history: PriceHistoryEntry[],
  days: number = 7
): { trend: 'up' | 'down' | 'stable'; percent: number } {
  if (history.length < 2) {
    return { trend: 'stable', percent: 0 };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentHistory = history.filter(h => new Date(h.date) >= cutoffDate);

  if (recentHistory.length < 2) {
    return { trend: 'stable', percent: 0 };
  }

  const oldest = recentHistory[0].price;
  const newest = recentHistory[recentHistory.length - 1].price;
  const change = ((newest - oldest) / oldest) * 100;

  if (Math.abs(change) < 1) {
    return { trend: 'stable', percent: 0 };
  }

  return {
    trend: change > 0 ? 'up' : 'down',
    percent: Math.abs(Math.round(change * 10) / 10),
  };
}

/**
 * Generate price alerts based on competitor data
 */
export function generatePriceAlerts(
  ourProduct: { id: string; name: string; price: number },
  competitorPrices: CompetitorPriceInfo[],
  config: PriceMonitoringConfig = DEFAULT_CONFIG
): PriceAlert[] {
  const alerts: PriceAlert[] = [];
  const now = new Date();

  for (const competitor of competitorPrices) {
    // Alert: Competitor undercuts our price
    if (competitor.inStock && competitor.price < ourProduct.price) {
      const underCutPercent = ((ourProduct.price - competitor.price) / ourProduct.price) * 100;

      if (underCutPercent >= config.alertThresholds.underCutPercent) {
        alerts.push({
          id: `alert-${ourProduct.id}-${competitor.competitorId}-undercut-${Date.now()}`,
          productId: ourProduct.id,
          productName: ourProduct.name,
          alertType: 'competitor_lower',
          severity: underCutPercent >= 10 ? 'high' : underCutPercent >= 5 ? 'medium' : 'low',
          message: `${competitor.competitorName} is ${underCutPercent.toFixed(1)}% cheaper`,
          messageUk: `${competitor.competitorName} дешевше на ${underCutPercent.toFixed(1)}%`,
          competitorId: competitor.competitorId,
          competitorName: competitor.competitorName,
          previousPrice: ourProduct.price,
          currentPrice: competitor.price,
          createdAt: now,
          isRead: false,
          isResolved: false,
        });
      }
    }

    // Alert: Competitor out of stock (opportunity)
    if (!competitor.inStock && competitor.price > 0) {
      alerts.push({
        id: `alert-${ourProduct.id}-${competitor.competitorId}-oos-${Date.now()}`,
        productId: ourProduct.id,
        productName: ourProduct.name,
        alertType: 'competitor_out_of_stock',
        severity: 'low',
        message: `${competitor.competitorName} is out of stock - opportunity to capture sales`,
        messageUk: `${competitor.competitorName} немає в наявності - можливість захопити продажі`,
        competitorId: competitor.competitorId,
        competitorName: competitor.competitorName,
        createdAt: now,
        isRead: false,
        isResolved: false,
      });
    }

    // Alert: Significant price change
    if (competitor.trend !== 'stable' && competitor.trendPercent >= config.alertThresholds.priceDropPercent) {
      alerts.push({
        id: `alert-${ourProduct.id}-${competitor.competitorId}-change-${Date.now()}`,
        productId: ourProduct.id,
        productName: ourProduct.name,
        alertType: 'significant_change',
        severity: competitor.trendPercent >= 15 ? 'high' : 'medium',
        message: `${competitor.competitorName} ${competitor.trend === 'up' ? 'raised' : 'dropped'} price by ${competitor.trendPercent}%`,
        messageUk: `${competitor.competitorName} ${competitor.trend === 'up' ? 'підняв' : 'знизив'} ціну на ${competitor.trendPercent}%`,
        competitorId: competitor.competitorId,
        competitorName: competitor.competitorName,
        createdAt: now,
        isRead: false,
        isResolved: false,
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

/**
 * Calculate optimal price based on competitor data and config
 */
export function calculateOptimalPrice(
  currentPrice: number,
  costPrice: number,
  analysis: PriceAnalysis,
  config: PriceMonitoringConfig = DEFAULT_CONFIG
): {
  optimalPrice: number;
  minAllowedPrice: number;
  maxAllowedPrice: number;
  projectedMargin: number;
} {
  const minAllowedPrice = Math.max(
    config.minPrice,
    costPrice * (1 + config.marginTarget / 100)
  );
  const maxAllowedPrice = analysis.highestPrice;

  let optimalPrice: number;

  switch (analysis.recommendation.action) {
    case 'lower':
      optimalPrice = analysis.recommendation.suggestedPrice || analysis.averageMarketPrice;
      break;
    case 'raise':
      optimalPrice = analysis.recommendation.suggestedPrice || Math.round(currentPrice * 1.05);
      break;
    default:
      optimalPrice = currentPrice;
  }

  // Ensure within bounds
  optimalPrice = Math.max(minAllowedPrice, Math.min(maxAllowedPrice, optimalPrice));

  const projectedMargin = ((optimalPrice - costPrice) / optimalPrice) * 100;

  return {
    optimalPrice: Math.round(optimalPrice),
    minAllowedPrice: Math.round(minAllowedPrice),
    maxAllowedPrice: Math.round(maxAllowedPrice),
    projectedMargin: Math.round(projectedMargin * 10) / 10,
  };
}

/**
 * Get price monitoring summary for dashboard
 */
export function getPriceMonitoringSummary(
  comparisons: ProductPriceComparison[]
): {
  totalProducts: number;
  cheapest: number;
  competitive: number;
  expensive: number;
  alertsCount: number;
  averagePosition: string;
  opportunities: string[];
  opportunitiesUk: string[];
} {
  const positionCounts = {
    cheapest: 0,
    below_average: 0,
    average: 0,
    above_average: 0,
    most_expensive: 0,
  };

  let alertsCount = 0;
  const opportunities: string[] = [];
  const opportunitiesUk: string[] = [];

  for (const comparison of comparisons) {
    positionCounts[comparison.analysis.marketPosition]++;

    if (comparison.analysis.recommendation.action === 'lower') {
      alertsCount++;
    }

    if (comparison.analysis.inStockCompetitors === 0) {
      opportunities.push(`${comparison.productName} - no competitor stock`);
      opportunitiesUk.push(`${comparison.productName} - конкуренти не мають на складі`);
    }
  }

  const competitive = positionCounts.cheapest + positionCounts.below_average + positionCounts.average;
  const expensive = positionCounts.above_average + positionCounts.most_expensive;

  // Calculate average position
  const positions = ['cheapest', 'below_average', 'average', 'above_average', 'most_expensive'];
  const positionValues = comparisons.map(c => positions.indexOf(c.analysis.marketPosition));
  const avgPositionValue = positionValues.reduce((a, b) => a + b, 0) / positionValues.length;
  const avgPosition = positions[Math.round(avgPositionValue)];

  return {
    totalProducts: comparisons.length,
    cheapest: positionCounts.cheapest,
    competitive,
    expensive,
    alertsCount,
    averagePosition: avgPosition,
    opportunities: opportunities.slice(0, 5),
    opportunitiesUk: opportunitiesUk.slice(0, 5),
  };
}

/**
 * Format price change for display
 */
export function formatPriceChange(
  oldPrice: number,
  newPrice: number
): {
  diff: number;
  percent: number;
  direction: 'up' | 'down' | 'same';
  formatted: string;
  formattedUk: string;
} {
  const diff = newPrice - oldPrice;
  const percent = (diff / oldPrice) * 100;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';

  const formatted = direction === 'same'
    ? 'No change'
    : `${direction === 'up' ? '+' : ''}${diff.toLocaleString('uk-UA')} ₴ (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`;

  const formattedUk = direction === 'same'
    ? 'Без змін'
    : `${direction === 'up' ? '+' : ''}${diff.toLocaleString('uk-UA')} ₴ (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`;

  return {
    diff,
    percent: Math.round(percent * 10) / 10,
    direction,
    formatted,
    formattedUk,
  };
}
