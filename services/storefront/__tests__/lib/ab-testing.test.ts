/**
 * Tests for A/B Testing System
 */

import {
  assignVariant,
  matchesTargeting,
  calculateSignificance,
  calculateConversionRate,
  calculateUplift,
  isSignificant,
  getRequiredSampleSize,
  getStatusLabel,
  generateSessionId,
  getSessionId,
  getStoredAssignments,
  storeAssignment,
  getAssignment,
  clearAssignments,
  DEFAULT_METRICS,
  EXPERIMENT_COOKIE_NAME,
  EXPERIMENT_COOKIE_DURATION,
  Experiment,
  Variant,
  Targeting,
  ExperimentStatus,
} from '../../lib/ab-testing';

describe('A/B Testing System', () => {
  // Sample experiment
  const createSampleExperiment = (overrides?: Partial<Experiment>): Experiment => ({
    id: 'exp-1',
    name: 'Button Color Test',
    description: 'Testing button colors for conversion',
    type: 'ab_test',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Control',
        description: 'Original blue button',
        weight: 50,
        config: { buttonColor: 'blue' },
        isControl: true,
      },
      {
        id: 'variant-a',
        name: 'Variant A',
        description: 'Green button',
        weight: 50,
        config: { buttonColor: 'green' },
        isControl: false,
      },
    ],
    targeting: {},
    metrics: [],
    allocation: 100, // 100% traffic allocation
    startDate: new Date('2024-01-01'),
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('assignVariant', () => {
    it('should assign variant based on user ID', () => {
      const experiment = createSampleExperiment();
      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).not.toBeNull();
      expect(experiment.variants.some(v => v.id === variant?.id)).toBe(true);
    });

    it('should consistently assign same variant to same user', () => {
      const experiment = createSampleExperiment();
      const variant1 = assignVariant(experiment, 'user-123', 'session-1');
      const variant2 = assignVariant(experiment, 'user-123', 'session-2');

      expect(variant1?.id).toBe(variant2?.id);
    });

    it('should return null for non-running experiment', () => {
      const experiment = createSampleExperiment({ status: 'paused' });
      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).toBeNull();
    });

    it('should return null for completed experiment', () => {
      const experiment = createSampleExperiment({ status: 'completed' });
      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).toBeNull();
    });

    it('should respect allocation percentage', () => {
      const experiment = createSampleExperiment({
        allocation: 0, // 0% traffic allocation
      });

      const variant = assignVariant(experiment, 'user-123', 'session-456');
      expect(variant).toBeNull();
    });

    it('should use session ID if user ID is null', () => {
      const experiment = createSampleExperiment();
      const variant = assignVariant(experiment, null, 'session-456');

      expect(variant).not.toBeNull();
    });

    it('should distribute variants by weight', () => {
      const experiment = createSampleExperiment({
        variants: [
          { id: 'a', name: 'A', weight: 80, config: {}, isControl: true },
          { id: 'b', name: 'B', weight: 20, config: {}, isControl: false },
        ],
      });

      const counts: Record<string, number> = { a: 0, b: 0 };

      for (let i = 0; i < 1000; i++) {
        const variant = assignVariant(experiment, `user-${i}`, `session-${i}`);
        if (variant) {
          counts[variant.id]++;
        }
      }

      expect(counts.a).toBeGreaterThan(counts.b);
    });
  });

  describe('matchesTargeting', () => {
    it('should match when no targeting rules', () => {
      const targeting: Targeting = {};

      const context = {
        deviceType: 'desktop' as const,
        browser: 'chrome',
        country: 'UA',
        language: 'uk',
        isLoggedIn: true,
        userSegment: 'vip',
      };

      expect(matchesTargeting(targeting, context)).toBe(true);
    });

    it('should match device type', () => {
      const targeting: Targeting = {
        deviceTypes: ['mobile'],
      };

      expect(matchesTargeting(targeting, { deviceType: 'mobile' })).toBe(true);
      expect(matchesTargeting(targeting, { deviceType: 'desktop' })).toBe(false);
    });

    it('should match browser', () => {
      const targeting: Targeting = {
        browsers: ['chrome', 'firefox'],
      };

      expect(matchesTargeting(targeting, { browser: 'chrome' })).toBe(true);
      expect(matchesTargeting(targeting, { browser: 'safari' })).toBe(false);
    });

    it('should match country', () => {
      const targeting: Targeting = {
        countries: ['UA', 'PL'],
      };

      expect(matchesTargeting(targeting, { country: 'UA' })).toBe(true);
      expect(matchesTargeting(targeting, { country: 'US' })).toBe(false);
    });

    it('should match language', () => {
      const targeting: Targeting = {
        languages: ['uk', 'ru'],
      };

      expect(matchesTargeting(targeting, { language: 'uk' })).toBe(true);
      expect(matchesTargeting(targeting, { language: 'en' })).toBe(false);
    });

    it('should match user segments', () => {
      const targeting: Targeting = {
        userSegments: ['vip', 'returning'],
      };

      expect(matchesTargeting(targeting, { userSegment: 'vip' })).toBe(true);
      expect(matchesTargeting(targeting, { userSegment: 'new' })).toBe(false);
    });

    it('should combine multiple targeting rules', () => {
      const targeting: Targeting = {
        deviceTypes: ['mobile'],
        countries: ['UA'],
      };

      expect(matchesTargeting(targeting, { deviceType: 'mobile', country: 'UA' })).toBe(true);
      expect(matchesTargeting(targeting, { deviceType: 'desktop', country: 'UA' })).toBe(false);
      expect(matchesTargeting(targeting, { deviceType: 'mobile', country: 'US' })).toBe(false);
    });
  });

  describe('calculateSignificance', () => {
    it('should calculate statistical significance', () => {
      const significance = calculateSignificance(50, 1000, 75, 1000);

      expect(significance).toBeGreaterThanOrEqual(0);
      expect(significance).toBeLessThanOrEqual(100);
    });

    it('should return lower significance for similar results', () => {
      const significance = calculateSignificance(50, 1000, 51, 1000);

      expect(significance).toBeLessThan(50);
    });

    it('should return higher significance for very different results', () => {
      const significance = calculateSignificance(50, 1000, 150, 1000);

      expect(significance).toBeGreaterThan(90);
    });

    it('should handle zero conversions', () => {
      const significance = calculateSignificance(0, 1000, 50, 1000);

      expect(typeof significance).toBe('number');
    });

    it('should handle small sample sizes', () => {
      const significance = calculateSignificance(1, 10, 2, 10);

      expect(typeof significance).toBe('number');
    });
  });

  describe('calculateConversionRate', () => {
    it('should calculate conversion rate correctly', () => {
      const rate = calculateConversionRate(50, 1000);

      expect(rate).toBe(5);
    });

    it('should return 0 for no participants', () => {
      const rate = calculateConversionRate(50, 0);

      expect(rate).toBe(0);
    });

    it('should handle 100% conversion', () => {
      const rate = calculateConversionRate(100, 100);

      expect(rate).toBe(100);
    });

    it('should handle decimal conversion rates', () => {
      const rate = calculateConversionRate(1, 3);

      expect(rate).toBeCloseTo(33.33, 1);
    });
  });

  describe('calculateUplift', () => {
    it('should calculate positive uplift', () => {
      const uplift = calculateUplift(5, 7.5);

      expect(uplift).toBe(50);
    });

    it('should calculate negative uplift', () => {
      const uplift = calculateUplift(10, 8);

      expect(uplift).toBe(-20);
    });

    it('should return 0 for zero control', () => {
      const uplift = calculateUplift(0, 10);

      expect(uplift).toBe(0);
    });

    it('should return 0 for same values', () => {
      const uplift = calculateUplift(5, 5);

      expect(uplift).toBe(0);
    });
  });

  describe('isSignificant', () => {
    it('should return true for high confidence', () => {
      expect(isSignificant(99, 95)).toBe(true);
    });

    it('should return false for low confidence', () => {
      expect(isSignificant(80, 95)).toBe(false);
    });

    it('should use default 95% threshold', () => {
      expect(isSignificant(96)).toBe(true);
      expect(isSignificant(94)).toBe(false);
    });
  });

  describe('getRequiredSampleSize', () => {
    it('should calculate required sample size', () => {
      // baselineConversionRate = 0.05 (5%), minimumDetectableEffect = 0.20 (20% relative increase)
      const sampleSize = getRequiredSampleSize(0.05, 0.20);

      expect(sampleSize).toBeGreaterThan(0);
    });

    it('should return larger sample for smaller differences', () => {
      // Smaller effect size requires larger sample
      const smallEffect = getRequiredSampleSize(0.05, 0.10); // 10% effect
      const largeEffect = getRequiredSampleSize(0.05, 0.50); // 50% effect

      expect(smallEffect).toBeGreaterThan(largeEffect);
    });
  });

  describe('getStatusLabel', () => {
    it('should return labels for all statuses', () => {
      const statuses: ExperimentStatus[] = ['draft', 'running', 'paused', 'completed', 'archived'];

      statuses.forEach(status => {
        const label = getStatusLabel(status);
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
      });
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('DEFAULT_METRICS', () => {
    it('should have multiple default metrics', () => {
      expect(DEFAULT_METRICS.length).toBeGreaterThan(0);
    });

    it('should have all required fields', () => {
      DEFAULT_METRICS.forEach(metric => {
        expect(metric.id).toBeTruthy();
        expect(metric.name).toBeTruthy();
        expect(metric.type).toBeTruthy();
        expect(typeof metric.isPrimary).toBe('boolean');
      });
    });

    it('should have conversion metric', () => {
      const conversionMetric = DEFAULT_METRICS.find(m => m.id === 'conversion');
      expect(conversionMetric).toBeDefined();
    });

    it('should have revenue metric', () => {
      const revenueMetric = DEFAULT_METRICS.find(m => m.id === 'revenue');
      expect(revenueMetric).toBeDefined();
    });

    it('should have one primary metric', () => {
      const primaryMetrics = DEFAULT_METRICS.filter(m => m.isPrimary);
      expect(primaryMetrics.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Constants', () => {
    it('should have EXPERIMENT_COOKIE_NAME', () => {
      expect(EXPERIMENT_COOKIE_NAME).toBeTruthy();
    });

    it('should have EXPERIMENT_COOKIE_DURATION', () => {
      expect(EXPERIMENT_COOKIE_DURATION).toBeGreaterThan(0);
      expect(EXPERIMENT_COOKIE_DURATION).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Experiment lifecycle', () => {
    it('should have valid status transitions', () => {
      const validStatuses: ExperimentStatus[] = ['draft', 'running', 'paused', 'completed', 'archived'];

      validStatuses.forEach(status => {
        const experiment = createSampleExperiment({ status });
        expect(validStatuses).toContain(experiment.status);
      });
    });

    it('should not assign variants when draft', () => {
      const experiment = createSampleExperiment({ status: 'draft' });
      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).toBeNull();
    });

    it('should not assign variants when archived', () => {
      const experiment = createSampleExperiment({ status: 'archived' });
      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).toBeNull();
    });
  });

  describe('Multivariate tests', () => {
    it('should handle more than 2 variants', () => {
      const experiment = createSampleExperiment({
        type: 'multivariate',
        variants: [
          { id: 'control', name: 'Control', weight: 25, config: { color: 'blue' }, isControl: true },
          { id: 'variant-a', name: 'A', weight: 25, config: { color: 'green' }, isControl: false },
          { id: 'variant-b', name: 'B', weight: 25, config: { color: 'red' }, isControl: false },
          { id: 'variant-c', name: 'C', weight: 25, config: { color: 'orange' }, isControl: false },
        ],
      });

      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).not.toBeNull();
      expect(experiment.variants.some(v => v.id === variant?.id)).toBe(true);
    });
  });

  describe('Feature flags', () => {
    it('should work as feature flag', () => {
      const experiment = createSampleExperiment({
        type: 'feature_flag',
        variants: [
          { id: 'off', name: 'Off', weight: 90, config: { enabled: false }, isControl: true },
          { id: 'on', name: 'On', weight: 10, config: { enabled: true }, isControl: false },
        ],
      });

      const variant = assignVariant(experiment, 'user-123', 'session-456');

      expect(variant).not.toBeNull();
      expect(typeof variant?.config.enabled).toBe('boolean');
    });
  });
});
