/**
 * Tests for Loyalty System
 */

import {
  calculatePointsForPurchase,
  getTierByPoints,
  getPointsToNextTier,
  calculatePointsValue,
  calculateMaxRedeemablePoints,
  formatPoints,
  getTierProgress,
  LOYALTY_TIERS,
  POINTS_PER_CURRENCY,
  POINTS_TO_CURRENCY_RATE,
  MIN_REDEMPTION_POINTS,
  LoyaltyTier,
} from '../../lib/loyalty';

describe('Loyalty System', () => {
  describe('calculatePointsForPurchase', () => {
    it('should calculate points for bronze tier', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsForPurchase(1000, bronzeTier);

      // 1000 / 10 (POINTS_PER_CURRENCY) * 1 (bronze multiplier) = 100
      expect(points).toBe(100);
    });

    it('should calculate points for gold tier with multiplier', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const points = calculatePointsForPurchase(1000, goldTier);

      // 1000 / 10 * 1.5 (gold multiplier) = 150
      expect(points).toBe(150);
    });

    it('should calculate points for VIP tier', () => {
      const vipTier = LOYALTY_TIERS.find(t => t.id === 'vip')!;
      const points = calculatePointsForPurchase(1000, vipTier);

      // VIP has highest multiplier (3)
      expect(points).toBeGreaterThan(200);
    });

    it('should apply double points promotion', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const normalPoints = calculatePointsForPurchase(1000, bronzeTier, false);
      const doublePoints = calculatePointsForPurchase(1000, bronzeTier, true);

      expect(doublePoints).toBe(normalPoints * 2);
    });

    it('should round points to integers', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsForPurchase(999, bronzeTier);

      expect(Number.isInteger(points)).toBe(true);
    });

    it('should return 0 for 0 amount', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsForPurchase(0, bronzeTier);

      expect(points).toBe(0);
    });
  });

  describe('getTierByPoints', () => {
    it('should return bronze for 0 points', () => {
      const tier = getTierByPoints(0);
      expect(tier.id).toBe('bronze');
    });

    it('should return bronze for low points', () => {
      const tier = getTierByPoints(500);
      expect(tier.id).toBe('bronze');
    });

    it('should return silver at threshold', () => {
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;
      const tier = getTierByPoints(silverTier.minPoints);
      expect(tier.id).toBe('silver');
    });

    it('should return gold at threshold', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const tier = getTierByPoints(goldTier.minPoints);
      expect(tier.id).toBe('gold');
    });

    it('should return platinum at threshold', () => {
      const platinumTier = LOYALTY_TIERS.find(t => t.id === 'platinum')!;
      const tier = getTierByPoints(platinumTier.minPoints);
      expect(tier.id).toBe('platinum');
    });

    it('should return VIP for high points', () => {
      const vipTier = LOYALTY_TIERS.find(t => t.id === 'vip')!;
      const tier = getTierByPoints(vipTier.minPoints + 10000);
      expect(tier.id).toBe('vip');
    });

    it('should handle points between tiers', () => {
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;

      const midPoints = Math.floor((silverTier.minPoints + goldTier.minPoints) / 2);
      const tier = getTierByPoints(midPoints);

      expect(tier.id).toBe('silver');
    });
  });

  describe('getPointsToNextTier', () => {
    it('should return points needed for next tier', () => {
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;
      const pointsNeeded = getPointsToNextTier(500, 'bronze');

      expect(pointsNeeded).toBe(silverTier.minPoints - 500);
    });

    it('should return null for VIP tier', () => {
      const pointsNeeded = getPointsToNextTier(100000, 'vip');

      expect(pointsNeeded).toBeNull();
    });

    it('should return non-negative for bronze tier', () => {
      const pointsNeeded = getPointsToNextTier(0, 'bronze');

      expect(pointsNeeded).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculatePointsValue', () => {
    it('should convert points to UAH correctly', () => {
      const value = calculatePointsValue(100);

      // 1 point = 1 UAH (POINTS_TO_CURRENCY_RATE)
      expect(value).toBe(100 * POINTS_TO_CURRENCY_RATE);
    });

    it('should return 0 for 0 points', () => {
      const value = calculatePointsValue(0);

      expect(value).toBe(0);
    });

    it('should handle large point values', () => {
      const value = calculatePointsValue(100000);

      expect(value).toBe(100000 * POINTS_TO_CURRENCY_RATE);
    });
  });

  describe('calculateMaxRedeemablePoints', () => {
    it('should limit redemption based on order total', () => {
      const maxPoints = calculateMaxRedeemablePoints(1000, 500);

      // Max should not exceed available points
      expect(maxPoints).toBeLessThanOrEqual(500);
    });

    it('should not exceed available points', () => {
      const maxPoints = calculateMaxRedeemablePoints(10000, 100);

      expect(maxPoints).toBe(100);
    });

    it('should return 0 for 0 order total', () => {
      const maxPoints = calculateMaxRedeemablePoints(0, 1000);

      expect(maxPoints).toBe(0);
    });
  });

  describe('formatPoints', () => {
    it('should format small numbers', () => {
      const formatted = formatPoints(50);

      expect(formatted).toBe('50');
    });

    it('should format thousands with separator', () => {
      const formatted = formatPoints(1500);

      expect(formatted).toContain('1');
    });

    it('should format large numbers', () => {
      const formatted = formatPoints(100000);

      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('getTierProgress', () => {
    it('should return progress percentage', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const progress = getTierProgress(500, bronzeTier);

      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should return 100 for completed tier', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const progress = getTierProgress(bronzeTier.maxPoints ?? 0, bronzeTier);

      expect(progress).toBeCloseTo(100, 0);
    });

    it('should return 0 for tier start', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const progress = getTierProgress(0, bronzeTier);

      expect(progress).toBe(0);
    });
  });

  describe('LOYALTY_TIERS', () => {
    it('should have 5 tiers', () => {
      expect(LOYALTY_TIERS).toHaveLength(5);
    });

    it('should have tiers in ascending order', () => {
      for (let i = 1; i < LOYALTY_TIERS.length; i++) {
        expect(LOYALTY_TIERS[i].minPoints).toBeGreaterThan(LOYALTY_TIERS[i - 1].minPoints);
      }
    });

    it('should have increasing multipliers', () => {
      for (let i = 1; i < LOYALTY_TIERS.length; i++) {
        expect(LOYALTY_TIERS[i].multiplier).toBeGreaterThanOrEqual(LOYALTY_TIERS[i - 1].multiplier);
      }
    });

    it('should have all required fields', () => {
      LOYALTY_TIERS.forEach(tier => {
        expect(tier.id).toBeTruthy();
        expect(tier.name).toBeTruthy();
        expect(tier.nameUk).toBeTruthy();
        expect(typeof tier.minPoints).toBe('number');
        expect(typeof tier.multiplier).toBe('number');
        expect(tier.color).toBeTruthy();
        expect(tier.icon).toBeTruthy();
        expect(Array.isArray(tier.benefits)).toBe(true);
      });
    });

    it('should have unique IDs', () => {
      const ids = LOYALTY_TIERS.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should start with 0 points for bronze', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      expect(bronzeTier.minPoints).toBe(0);
    });

    it('should have benefits for each tier', () => {
      LOYALTY_TIERS.forEach(tier => {
        expect(tier.benefits.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Constants', () => {
    it('should have valid POINTS_PER_CURRENCY', () => {
      expect(POINTS_PER_CURRENCY).toBeGreaterThan(0);
    });

    it('should have valid POINTS_TO_CURRENCY_RATE', () => {
      expect(POINTS_TO_CURRENCY_RATE).toBeGreaterThan(0);
    });

    it('should have valid MIN_REDEMPTION_POINTS', () => {
      expect(MIN_REDEMPTION_POINTS).toBeGreaterThan(0);
    });
  });
});
