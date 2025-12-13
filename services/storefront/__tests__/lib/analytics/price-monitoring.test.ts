/**
 * Tests for Competitor Price Monitoring
 */
import {
  analyzeMarketPosition,
  calculatePriceTrend,
  generatePriceAlerts,
  calculateOptimalPrice,
  getPriceMonitoringSummary,
  formatPriceChange,
  COMPETITORS,
  DEFAULT_CONFIG,
  CompetitorPriceInfo,
  PriceHistoryEntry,
  ProductPriceComparison,
} from '@/lib/analytics/price-monitoring';

describe('Price Monitoring', () => {
  describe('analyzeMarketPosition', () => {
    const mockCompetitors: CompetitorPriceInfo[] = [
      {
        competitorId: 'rozetka',
        competitorName: 'Rozetka',
        price: 1000,
        priceDiff: 0,
        priceDiffPercent: 0,
        url: 'https://rozetka.com.ua/product',
        inStock: true,
        lastChecked: new Date(),
        trend: 'stable',
        trendPercent: 0,
      },
      {
        competitorId: 'citrus',
        competitorName: 'Citrus',
        price: 1200,
        priceDiff: 200,
        priceDiffPercent: 20,
        url: 'https://citrus.ua/product',
        inStock: true,
        lastChecked: new Date(),
        trend: 'stable',
        trendPercent: 0,
      },
      {
        competitorId: 'foxtrot',
        competitorName: 'Foxtrot',
        price: 1100,
        priceDiff: 100,
        priceDiffPercent: 10,
        url: 'https://foxtrot.com.ua/product',
        inStock: true,
        lastChecked: new Date(),
        trend: 'stable',
        trendPercent: 0,
      },
    ];

    it('should identify cheapest position', () => {
      const analysis = analyzeMarketPosition(950, mockCompetitors);
      expect(analysis.marketPosition).toBe('cheapest');
    });

    it('should identify most expensive position', () => {
      const analysis = analyzeMarketPosition(1300, mockCompetitors);
      expect(analysis.marketPosition).toBe('most_expensive');
    });

    it('should calculate average market price correctly', () => {
      const analysis = analyzeMarketPosition(1100, mockCompetitors);
      expect(analysis.averageMarketPrice).toBe(1100); // (1000 + 1200 + 1100) / 3
    });

    it('should identify lowest and highest prices', () => {
      const analysis = analyzeMarketPosition(1100, mockCompetitors);
      expect(analysis.lowestPrice).toBe(1000);
      expect(analysis.highestPrice).toBe(1200);
    });

    it('should count in-stock competitors', () => {
      const competitorsWithOOS = [
        ...mockCompetitors,
        {
          ...mockCompetitors[0],
          competitorId: 'allo',
          competitorName: 'Allo',
          inStock: false,
        },
      ];
      const analysis = analyzeMarketPosition(1100, competitorsWithOOS);
      expect(analysis.inStockCompetitors).toBe(3);
      expect(analysis.competitorCount).toBe(4);
    });

    it('should generate lower recommendation when most expensive', () => {
      const analysis = analyzeMarketPosition(1500, mockCompetitors);
      expect(analysis.recommendation.action).toBe('lower');
    });

    it('should generate raise recommendation when cheapest with margin opportunity', () => {
      const cheapCompetitors = mockCompetitors.map(c => ({ ...c, price: c.price * 1.3 }));
      const analysis = analyzeMarketPosition(1000, cheapCompetitors);
      expect(analysis.recommendation.action).toBe('raise');
    });
  });

  describe('calculatePriceTrend', () => {
    it('should detect upward trend', () => {
      const now = new Date();
      const history: PriceHistoryEntry[] = [
        { price: 1000, date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), inStock: true },
        { price: 1050, date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), inStock: true },
        { price: 1100, date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), inStock: true },
      ];
      const trend = calculatePriceTrend(history, 7);
      expect(trend.trend).toBe('up');
      expect(trend.percent).toBeGreaterThan(0);
    });

    it('should detect downward trend', () => {
      const now = new Date();
      const history: PriceHistoryEntry[] = [
        { price: 1100, date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), inStock: true },
        { price: 1050, date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), inStock: true },
        { price: 1000, date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), inStock: true },
      ];
      const trend = calculatePriceTrend(history, 7);
      expect(trend.trend).toBe('down');
    });

    it('should detect stable trend for small changes', () => {
      const now = new Date();
      const history: PriceHistoryEntry[] = [
        { price: 1000, date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), inStock: true },
        { price: 1005, date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), inStock: true },
      ];
      const trend = calculatePriceTrend(history, 7);
      expect(trend.trend).toBe('stable');
    });

    it('should return stable for insufficient history', () => {
      const history: PriceHistoryEntry[] = [
        { price: 1000, date: new Date(), inStock: true },
      ];
      const trend = calculatePriceTrend(history, 7);
      expect(trend.trend).toBe('stable');
      expect(trend.percent).toBe(0);
    });
  });

  describe('generatePriceAlerts', () => {
    const product = { id: 'prod-1', name: 'Test Product', price: 1000 };

    it('should generate alert when competitor undercuts price', () => {
      const competitors: CompetitorPriceInfo[] = [
        {
          competitorId: 'rozetka',
          competitorName: 'Rozetka',
          price: 900,
          priceDiff: -100,
          priceDiffPercent: -10,
          url: 'https://rozetka.com.ua/product',
          inStock: true,
          lastChecked: new Date(),
          trend: 'stable',
          trendPercent: 0,
        },
      ];

      const alerts = generatePriceAlerts(product, competitors);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.alertType === 'competitor_lower')).toBe(true);
    });

    it('should generate alert when competitor is out of stock', () => {
      const competitors: CompetitorPriceInfo[] = [
        {
          competitorId: 'rozetka',
          competitorName: 'Rozetka',
          price: 1000,
          priceDiff: 0,
          priceDiffPercent: 0,
          url: 'https://rozetka.com.ua/product',
          inStock: false,
          lastChecked: new Date(),
          trend: 'stable',
          trendPercent: 0,
        },
      ];

      const alerts = generatePriceAlerts(product, competitors);

      expect(alerts.some(a => a.alertType === 'competitor_out_of_stock')).toBe(true);
    });

    it('should generate alert for significant price change', () => {
      const competitors: CompetitorPriceInfo[] = [
        {
          competitorId: 'rozetka',
          competitorName: 'Rozetka',
          price: 1000,
          priceDiff: 0,
          priceDiffPercent: 0,
          url: 'https://rozetka.com.ua/product',
          inStock: true,
          lastChecked: new Date(),
          trend: 'down',
          trendPercent: 15,
        },
      ];

      const alerts = generatePriceAlerts(product, competitors);

      expect(alerts.some(a => a.alertType === 'significant_change')).toBe(true);
    });

    it('should not generate undercut alert for small differences', () => {
      const competitors: CompetitorPriceInfo[] = [
        {
          competitorId: 'rozetka',
          competitorName: 'Rozetka',
          price: 995,
          priceDiff: -5,
          priceDiffPercent: -0.5,
          url: 'https://rozetka.com.ua/product',
          inStock: true,
          lastChecked: new Date(),
          trend: 'stable',
          trendPercent: 0,
        },
      ];

      const alerts = generatePriceAlerts(product, competitors);

      expect(alerts.some(a => a.alertType === 'competitor_lower')).toBe(false);
    });

    it('should assign correct severity based on undercut percentage', () => {
      const competitors: CompetitorPriceInfo[] = [
        {
          competitorId: 'rozetka',
          competitorName: 'Rozetka',
          price: 800, // 20% cheaper
          priceDiff: -200,
          priceDiffPercent: -20,
          url: 'https://rozetka.com.ua/product',
          inStock: true,
          lastChecked: new Date(),
          trend: 'stable',
          trendPercent: 0,
        },
      ];

      const alerts = generatePriceAlerts(product, competitors);
      const undercutAlert = alerts.find(a => a.alertType === 'competitor_lower');

      expect(undercutAlert?.severity).toBe('high');
    });
  });

  describe('calculateOptimalPrice', () => {
    it('should respect minimum margin', () => {
      const analysis = {
        marketPosition: 'cheapest' as const,
        averageMarketPrice: 800,
        lowestPrice: 700,
        highestPrice: 1000,
        priceRange: 300,
        competitorCount: 3,
        inStockCompetitors: 3,
        recommendation: {
          action: 'raise' as const,
          suggestedPrice: 850,
          reason: 'Test',
          reasonUk: 'Test',
          potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
        },
      };

      const result = calculateOptimalPrice(700, 600, analysis);

      // Should not go below cost + margin target
      expect(result.optimalPrice).toBeGreaterThanOrEqual(result.minAllowedPrice);
    });

    it('should not exceed highest market price', () => {
      const analysis = {
        marketPosition: 'cheapest' as const,
        averageMarketPrice: 800,
        lowestPrice: 700,
        highestPrice: 1000,
        priceRange: 300,
        competitorCount: 3,
        inStockCompetitors: 3,
        recommendation: {
          action: 'raise' as const,
          suggestedPrice: 1200,
          reason: 'Test',
          reasonUk: 'Test',
          potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
        },
      };

      const result = calculateOptimalPrice(700, 500, analysis);

      expect(result.optimalPrice).toBeLessThanOrEqual(1000);
    });

    it('should calculate projected margin', () => {
      const analysis = {
        marketPosition: 'average' as const,
        averageMarketPrice: 1000,
        lowestPrice: 900,
        highestPrice: 1100,
        priceRange: 200,
        competitorCount: 3,
        inStockCompetitors: 3,
        recommendation: {
          action: 'keep' as const,
          reason: 'Test',
          reasonUk: 'Test',
          potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
        },
      };

      const result = calculateOptimalPrice(1000, 700, analysis);

      expect(result.projectedMargin).toBeGreaterThan(0);
      expect(result.projectedMargin).toBeLessThan(100);
    });
  });

  describe('getPriceMonitoringSummary', () => {
    const mockComparisons: ProductPriceComparison[] = [
      {
        productId: 'prod-1',
        productName: 'Product 1',
        productSku: 'SKU-1',
        ourPrice: 1000,
        competitors: [],
        analysis: {
          marketPosition: 'cheapest',
          averageMarketPrice: 1100,
          lowestPrice: 1000,
          highestPrice: 1200,
          priceRange: 200,
          competitorCount: 2,
          inStockCompetitors: 2,
          recommendation: {
            action: 'keep',
            reason: 'Test',
            reasonUk: 'Test',
            potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
          },
        },
      },
      {
        productId: 'prod-2',
        productName: 'Product 2',
        productSku: 'SKU-2',
        ourPrice: 2000,
        competitors: [],
        analysis: {
          marketPosition: 'most_expensive',
          averageMarketPrice: 1600,
          lowestPrice: 1500,
          highestPrice: 2000,
          priceRange: 500,
          competitorCount: 2,
          inStockCompetitors: 0,
          recommendation: {
            action: 'lower',
            reason: 'Test',
            reasonUk: 'Test',
            potentialImpact: { revenueChange: 0, marginChange: 0, competitiveness: 0 },
          },
        },
      },
    ];

    it('should count products by position', () => {
      const summary = getPriceMonitoringSummary(mockComparisons);

      expect(summary.totalProducts).toBe(2);
      expect(summary.cheapest).toBe(1);
      expect(summary.expensive).toBe(1);
    });

    it('should count alerts', () => {
      const summary = getPriceMonitoringSummary(mockComparisons);

      expect(summary.alertsCount).toBe(1); // One product has 'lower' recommendation
    });

    it('should identify opportunities', () => {
      const summary = getPriceMonitoringSummary(mockComparisons);

      expect(summary.opportunities.length).toBeGreaterThan(0);
      expect(summary.opportunitiesUk.length).toBeGreaterThan(0);
    });
  });

  describe('formatPriceChange', () => {
    it('should format price increase', () => {
      const result = formatPriceChange(1000, 1150);

      expect(result.direction).toBe('up');
      expect(result.diff).toBe(150);
      expect(result.percent).toBe(15);
      expect(result.formatted).toContain('+');
    });

    it('should format price decrease', () => {
      const result = formatPriceChange(1000, 900);

      expect(result.direction).toBe('down');
      expect(result.diff).toBe(-100);
      expect(result.percent).toBe(-10);
    });

    it('should format no change', () => {
      const result = formatPriceChange(1000, 1000);

      expect(result.direction).toBe('same');
      expect(result.diff).toBe(0);
      expect(result.formatted).toContain('No change');
      expect(result.formattedUk).toContain('Без змін');
    });
  });

  describe('COMPETITORS configuration', () => {
    it('should have valid competitor configurations', () => {
      for (const competitor of COMPETITORS) {
        expect(competitor.id).toBeDefined();
        expect(competitor.name).toBeDefined();
        expect(competitor.nameUk).toBeDefined();
        expect(competitor.domain).toBeDefined();
        expect(['hourly', 'daily', 'weekly']).toContain(competitor.checkFrequency);
      }
    });

    it('should include major Ukrainian retailers', () => {
      const ids = COMPETITORS.map(c => c.id);
      expect(ids).toContain('rozetka');
      expect(ids).toContain('citrus');
      expect(ids).toContain('foxtrot');
      expect(ids).toContain('comfy');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have valid threshold values', () => {
      expect(DEFAULT_CONFIG.alertThresholds.priceDropPercent).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.alertThresholds.priceRisePercent).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.alertThresholds.underCutPercent).toBeGreaterThan(0);
    });

    it('should have weights for all competitors', () => {
      for (const competitor of COMPETITORS) {
        expect(DEFAULT_CONFIG.competitorWeights[competitor.id]).toBeDefined();
        expect(DEFAULT_CONFIG.competitorWeights[competitor.id]).toBeGreaterThanOrEqual(0);
        expect(DEFAULT_CONFIG.competitorWeights[competitor.id]).toBeLessThanOrEqual(1);
      }
    });
  });
});
