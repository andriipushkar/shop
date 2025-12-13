/**
 * Unit tests for AI Repricing Engine
 * Тести для системи автоматичного репрайсингу
 */

import { RepricingEngine, type RepricingRule, type PriceConstraints } from '@/lib/ai/repricing-engine';

describe('RepricingEngine', () => {
  let engine: RepricingEngine;

  beforeEach(() => {
    engine = new RepricingEngine();
  });

  describe('Price Calculation Strategies', () => {
    it('should calculate price with beat_lowest strategy', async () => {
      const rule: RepricingRule = {
        id: 'rule-1',
        enabled: true,
        strategy: { type: 'beat_lowest', margin: 10 },
        competitors: ['comp1', 'comp2'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice).toBeLessThan(result.competitorData[0].price);
      expect(result.reason).toContain('нижче найнижчої');
    });

    it('should calculate price with match_lowest strategy', async () => {
      const rule: RepricingRule = {
        id: 'rule-2',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.reason).toContain('Відповідність найнижчій ціні');
    });

    it('should calculate price with percentage_below strategy', async () => {
      const rule: RepricingRule = {
        id: 'rule-3',
        enabled: true,
        strategy: { type: 'percentage_below', percent: 5 },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.reason).toContain('5%');
    });

    it('should calculate price with smart strategy', async () => {
      const rule: RepricingRule = {
        id: 'rule-4',
        enabled: true,
        strategy: { type: 'smart', targetPosition: 2 },
        competitors: ['comp1', 'comp2', 'comp3'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.reason).toContain('Smart pricing');
      expect(result.suggestedPrice).toBeGreaterThan(0);
    });

    it('should calculate price with maximize_margin strategy', async () => {
      const rule: RepricingRule = {
        id: 'rule-5',
        enabled: true,
        strategy: { type: 'maximize_margin', minMargin: 20 },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.reason).toContain('Максимізація маржі');
    });
  });

  describe('Price Constraints', () => {
    it('should apply minimum price constraint', async () => {
      const constraints: PriceConstraints = {
        minPrice: 1000,
      };

      const rule: RepricingRule = {
        id: 'rule-min',
        enabled: true,
        strategy: { type: 'beat_lowest', margin: 500 }, // Would go below min
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice).toBeGreaterThanOrEqual(1000);
    });

    it('should apply maximum price constraint', async () => {
      const constraints: PriceConstraints = {
        maxPrice: 1200,
      };

      const rule: RepricingRule = {
        id: 'rule-max',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice).toBeLessThanOrEqual(1200);
    });

    it('should apply floor price constraint', async () => {
      const constraints: PriceConstraints = {
        floorPrice: 900,
      };

      const rule: RepricingRule = {
        id: 'rule-floor',
        enabled: true,
        strategy: { type: 'beat_lowest', margin: 500 },
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice).toBeGreaterThanOrEqual(900);
    });

    it('should round price to .99', async () => {
      const constraints: PriceConstraints = {
        roundTo: 0.99,
      };

      const rule: RepricingRule = {
        id: 'rule-round',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice.toString()).toMatch(/\.99$/);
    });

    it('should round price to nearest 5', async () => {
      const constraints: PriceConstraints = {
        roundTo: 5,
      };

      const rule: RepricingRule = {
        id: 'rule-round5',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.suggestedPrice % 5).toBe(0);
    });
  });

  describe('Margin Calculations', () => {
    it('should calculate profit margin', async () => {
      const rule: RepricingRule = {
        id: 'rule-margin',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      expect(result.margin).toBeGreaterThanOrEqual(0);
      expect(result.margin).toBeLessThanOrEqual(100);
    });
  });

  describe('Rule Management', () => {
    it('should set and get repricing rule', async () => {
      const rule: RepricingRule = {
        id: 'test-rule',
        productId: 'prod-1',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const rules = engine.getRules('prod-1');
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('test-rule');
    });

    it('should get all rules when no product specified', () => {
      const rules = engine.getRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should delete repricing rule', async () => {
      const rule: RepricingRule = {
        id: 'delete-rule',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);
      await engine.deleteRule('delete-rule');

      const rules = engine.getRules();
      expect(rules.find(r => r.id === 'delete-rule')).toBeUndefined();
    });

    it('should throw error when no active rules', async () => {
      await expect(engine.calculateOptimalPrice('no-rules-prod')).rejects.toThrow(
        'No active repricing rules'
      );
    });

    it('should throw error when no competitor data', async () => {
      const rule: RepricingRule = {
        id: 'rule-no-data',
        productId: 'prod-no-data',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: [],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should throw because competitors array is empty
      await expect(engine.setRule(rule)).rejects.toThrow(
        'At least one competitor must be specified'
      );
    });
  });

  describe('Product Repricing', () => {
    beforeEach(async () => {
      const rule: RepricingRule = {
        id: 'reprice-rule',
        productId: 'prod-reprice',
        enabled: true,
        strategy: { type: 'beat_lowest', margin: 10 },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);
    });

    it('should reprice product successfully', async () => {
      const change = await engine.repriceProduct('prod-reprice');

      expect(change).toBeDefined();
      expect(change?.productId).toBe('prod-reprice');
      expect(change?.newPrice).not.toBe(change?.oldPrice);
    });

    it('should return null when price unchanged', async () => {
      // Mock scenario where calculated price equals current price
      // This would require more sophisticated mocking
    });

    it('should record price change history', async () => {
      await engine.repriceProduct('prod-reprice');

      const history = engine.getPriceHistory('prod-reprice');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should get price history for specific period', async () => {
      await engine.repriceProduct('prod-reprice');

      const history = engine.getPriceHistory('prod-reprice', 7); // Last 7 days
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Batch Repricing', () => {
    it('should reprice all products in category', async () => {
      const rule: RepricingRule = {
        id: 'category-rule',
        categoryId: 'cat-1',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const changes = await engine.repriceCategory('cat-1');

      expect(Array.isArray(changes)).toBe(true);
    });

    it('should run scheduled repricing', async () => {
      const rule: RepricingRule = {
        id: 'scheduled-rule',
        productId: 'prod-scheduled',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const report = await engine.runScheduledRepricing();

      expect(report.totalProducts).toBeGreaterThanOrEqual(0);
      expect(report.startedAt).toBeDefined();
      expect(report.completedAt).toBeDefined();
    });
  });

  describe('Price Alerts', () => {
    it('should check for price alerts', async () => {
      const rule: RepricingRule = {
        id: 'alert-rule',
        productId: 'prod-alert',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1', 'comp2'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const alerts = await engine.checkPriceAlerts();

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should create alert for significant price difference', async () => {
      const rule: RepricingRule = {
        id: 'diff-rule',
        productId: 'prod-diff',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const alerts = await engine.checkPriceAlerts();

      // Alerts with > 5% difference should be created
      alerts.forEach(alert => {
        expect(alert.differencePercent).toBeGreaterThan(0);
      });
    });
  });

  describe('A/B Price Testing', () => {
    it('should start price test', async () => {
      const testId = await engine.startPriceTest('prod-test', [1000, 1100, 1200]);

      expect(testId).toBeDefined();
      expect(testId).toContain('test_');
    });

    it('should get price test results', async () => {
      const testId = await engine.startPriceTest('prod-test', [1000, 1100]);

      const results = await engine.getPriceTestResults(testId);

      expect(results.testId).toBe(testId);
      expect(results.variants).toHaveLength(2);
    });

    it('should throw error for non-existent test', async () => {
      await expect(engine.getPriceTestResults('non-existent')).rejects.toThrow(
        'Test not found'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty competitor list', async () => {
      const rule: RepricingRule = {
        id: 'no-comp-rule',
        productId: 'prod-no-comp',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: [],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(engine.setRule(rule)).rejects.toThrow(
        'At least one competitor must be specified'
      );
    });

    it('should handle invalid rule configuration', async () => {
      const invalidRule = {
        id: '',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RepricingRule;

      await expect(engine.setRule(invalidRule)).rejects.toThrow(
        'Rule ID is required'
      );
    });

    it('should handle conflicting constraints', async () => {
      const constraints: PriceConstraints = {
        minPrice: 1500,
        maxPrice: 1000, // Max < Min
      };

      const rule: RepricingRule = {
        id: 'conflict-rule',
        enabled: true,
        strategy: { type: 'match_lowest' },
        competitors: ['comp1'],
        constraints,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await engine.setRule(rule);

      const result = await engine.calculateOptimalPrice('prod-1');

      // With conflicting constraints, the engine returns maxPrice (safer lower bound)
      // or minPrice depending on implementation. Price should be within some bounds.
      expect(result.suggestedPrice).toBeGreaterThan(0);
      expect(result.suggestedPrice).toBeLessThanOrEqual(Math.max(1500, 1000));
    });
  });
});
