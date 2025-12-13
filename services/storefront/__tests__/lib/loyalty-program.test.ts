/**
 * Unit Tests for Loyalty Program
 * Tests core loyalty logic, calculations, and validation
 */

import {
  calculatePointsEarned,
  calculateDiscountFromPoints,
  calculateMaxRedeemablePoints,
  determineTier,
  getNextTier,
  calculatePointsToNextTier,
  calculateTierProgress,
  calculatePointsExpiry,
  arePointsExpiringSoon,
  getExpiringPoints,
  qualifiesForFreeShipping,
  getTierDiscountPercent,
  getBirthdayBonus,
  hasExclusiveAccess,
  hasPrioritySupport,
  validateRedemption,
  formatPoints,
  formatCurrency,
  getTierBadgeClasses,
  getTierIcon,
  LOYALTY_TIERS,
  POINTS_PER_CURRENCY,
  POINTS_TO_CURRENCY_RATE,
  MIN_REDEMPTION_POINTS,
  POINTS_EXPIRY_MONTHS,
} from '../../lib/loyalty/loyalty-program';
import { PointsTransaction } from '../../lib/loyalty';

describe('Loyalty Program - Core Calculations', () => {
  describe('calculatePointsEarned', () => {
    it('should calculate points for bronze tier', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsEarned(1000, bronzeTier, false);

      // 1000 / 10 (POINTS_PER_CURRENCY) * 1 (bronze multiplier) = 100
      expect(points).toBe(100);
    });

    it('should calculate points for gold tier with multiplier', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const points = calculatePointsEarned(1000, goldTier, false);

      // 1000 / 10 * 1.5 (gold multiplier) = 150
      expect(points).toBe(150);
    });

    it('should calculate points for VIP tier', () => {
      const vipTier = LOYALTY_TIERS.find(t => t.id === 'vip')!;
      const points = calculatePointsEarned(1000, vipTier, false);

      // 1000 / 10 * 3 (VIP multiplier) = 300
      expect(points).toBe(300);
    });

    it('should apply double points promotion', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const normalPoints = calculatePointsEarned(1000, bronzeTier, false);
      const doublePoints = calculatePointsEarned(1000, bronzeTier, true);

      expect(doublePoints).toBe(normalPoints * 2);
    });

    it('should return 0 for 0 amount', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsEarned(0, bronzeTier, false);

      expect(points).toBe(0);
    });

    it('should return 0 for negative amount', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsEarned(-100, bronzeTier, false);

      expect(points).toBe(0);
    });

    it('should round down to nearest integer', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const points = calculatePointsEarned(999, bronzeTier, false);

      expect(Number.isInteger(points)).toBe(true);
      expect(points).toBe(99);
    });
  });

  describe('calculateDiscountFromPoints', () => {
    it('should convert points to UAH correctly', () => {
      const discount = calculateDiscountFromPoints(100);

      // 100 points * 1 (rate) = 100 UAH
      expect(discount).toBe(100);
    });

    it('should return 0 for points below minimum', () => {
      const discount = calculateDiscountFromPoints(50);

      expect(discount).toBe(0);
    });

    it('should handle large point values', () => {
      const discount = calculateDiscountFromPoints(10000);

      expect(discount).toBe(10000);
    });

    it('should return 0 for 0 points', () => {
      const discount = calculateDiscountFromPoints(0);

      expect(discount).toBe(0);
    });
  });

  describe('calculateMaxRedeemablePoints', () => {
    it('should limit redemption to 50% of order by default', () => {
      const maxPoints = calculateMaxRedeemablePoints(1000, 1000);

      // Max 50% of 1000 UAH = 500 UAH = 500 points
      expect(maxPoints).toBe(500);
    });

    it('should not exceed available points', () => {
      const maxPoints = calculateMaxRedeemablePoints(10000, 100);

      expect(maxPoints).toBe(100);
    });

    it('should respect custom redemption percentage', () => {
      const maxPoints = calculateMaxRedeemablePoints(1000, 1000, 30);

      // Max 30% of 1000 UAH = 300 UAH = 300 points
      expect(maxPoints).toBe(300);
    });

    it('should return 0 for 0 order total', () => {
      const maxPoints = calculateMaxRedeemablePoints(0, 1000);

      expect(maxPoints).toBe(0);
    });
  });
});

describe('Loyalty Program - Tier Management', () => {
  describe('determineTier', () => {
    it('should return bronze for 0 points', () => {
      const tier = determineTier(0);
      expect(tier.id).toBe('bronze');
    });

    it('should return bronze for low points', () => {
      const tier = determineTier(500);
      expect(tier.id).toBe('bronze');
    });

    it('should return silver at threshold', () => {
      const tier = determineTier(1000);
      expect(tier.id).toBe('silver');
    });

    it('should return gold at threshold', () => {
      const tier = determineTier(5000);
      expect(tier.id).toBe('gold');
    });

    it('should return platinum at threshold', () => {
      const tier = determineTier(15000);
      expect(tier.id).toBe('platinum');
    });

    it('should return VIP for high points', () => {
      const tier = determineTier(50000);
      expect(tier.id).toBe('vip');
    });

    it('should return VIP for very high points', () => {
      const tier = determineTier(1000000);
      expect(tier.id).toBe('vip');
    });
  });

  describe('getNextTier', () => {
    it('should return silver for bronze', () => {
      const nextTier = getNextTier('bronze');
      expect(nextTier?.id).toBe('silver');
    });

    it('should return gold for silver', () => {
      const nextTier = getNextTier('silver');
      expect(nextTier?.id).toBe('gold');
    });

    it('should return null for VIP', () => {
      const nextTier = getNextTier('vip');
      expect(nextTier).toBeNull();
    });
  });

  describe('calculatePointsToNextTier', () => {
    it('should calculate points needed for next tier', () => {
      const pointsNeeded = calculatePointsToNextTier(500, 'bronze');
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;

      expect(pointsNeeded).toBe(silverTier.minPoints - 500);
    });

    it('should return 0 if already at next tier threshold', () => {
      const pointsNeeded = calculatePointsToNextTier(1000, 'bronze');

      expect(pointsNeeded).toBe(0);
    });

    it('should return null for VIP tier', () => {
      const pointsNeeded = calculatePointsToNextTier(100000, 'vip');

      expect(pointsNeeded).toBeNull();
    });
  });

  describe('calculateTierProgress', () => {
    it('should return 0% at tier start', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const progress = calculateTierProgress(0, bronzeTier);

      expect(progress).toBe(0);
    });

    it('should return 50% at tier midpoint', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;
      const midpoint = (bronzeTier.minPoints + silverTier.minPoints) / 2;
      const progress = calculateTierProgress(midpoint, bronzeTier);

      expect(progress).toBe(50);
    });

    it('should return 100% for VIP tier', () => {
      const vipTier = LOYALTY_TIERS.find(t => t.id === 'vip')!;
      const progress = calculateTierProgress(100000, vipTier);

      expect(progress).toBe(100);
    });

    it('should not exceed 100%', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const progress = calculateTierProgress(5000, bronzeTier);

      expect(progress).toBeLessThanOrEqual(100);
    });
  });
});

describe('Loyalty Program - Points Expiry', () => {
  describe('calculatePointsExpiry', () => {
    it('should add correct months to current date', () => {
      const now = new Date('2024-01-01');
      const expiry = calculatePointsExpiry(now, 12);

      expect(expiry.getFullYear()).toBe(2025);
      expect(expiry.getMonth()).toBe(0); // January
    });

    it('should use default expiry months', () => {
      const now = new Date();
      const expiry = calculatePointsExpiry(now);
      const monthsDiff = (expiry.getFullYear() - now.getFullYear()) * 12 + expiry.getMonth() - now.getMonth();

      expect(monthsDiff).toBe(POINTS_EXPIRY_MONTHS);
    });
  });

  describe('arePointsExpiringSoon', () => {
    it('should return true for points expiring within warning period', () => {
      const expiryDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
      const expiring = arePointsExpiringSoon(expiryDate, 30);

      expect(expiring).toBe(true);
    });

    it('should return false for points expiring after warning period', () => {
      const expiryDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000); // 45 days
      const expiring = arePointsExpiringSoon(expiryDate, 30);

      expect(expiring).toBe(false);
    });

    it('should return false for already expired points', () => {
      const expiryDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // Yesterday
      const expiring = arePointsExpiringSoon(expiryDate, 30);

      expect(expiring).toBe(false);
    });
  });

  describe('getExpiringPoints', () => {
    it('should calculate expiring points correctly', () => {
      const transactions: PointsTransaction[] = [
        {
          id: 'tx_1',
          memberId: 'member_1',
          type: 'earned_purchase',
          points: 100,
          balance: 100,
          description: 'Test',
          descriptionUk: 'Тест',
          expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
        {
          id: 'tx_2',
          memberId: 'member_1',
          type: 'earned_purchase',
          points: 200,
          balance: 300,
          description: 'Test',
          descriptionUk: 'Тест',
          expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      ];

      const { points } = getExpiringPoints(transactions, 30);

      expect(points).toBe(100);
    });

    it('should ignore redeemed transactions', () => {
      const transactions: PointsTransaction[] = [
        {
          id: 'tx_1',
          memberId: 'member_1',
          type: 'redeemed',
          points: -100,
          balance: 0,
          description: 'Test',
          descriptionUk: 'Тест',
          createdAt: new Date(),
        },
      ];

      const { points } = getExpiringPoints(transactions, 30);

      expect(points).toBe(0);
    });
  });
});

describe('Loyalty Program - Tier Benefits', () => {
  describe('qualifiesForFreeShipping', () => {
    it('should return true for platinum tier on all orders', () => {
      const platinumTier = LOYALTY_TIERS.find(t => t.id === 'platinum')!;
      const qualifies = qualifiesForFreeShipping(platinumTier, 100);

      expect(qualifies).toBe(true);
    });

    it('should check order minimum for gold tier', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const qualifies = qualifiesForFreeShipping(goldTier, 600);

      expect(qualifies).toBe(true);
    });

    it('should return false if below minimum', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const qualifies = qualifiesForFreeShipping(goldTier, 400);

      expect(qualifies).toBe(false);
    });
  });

  describe('getTierDiscountPercent', () => {
    it('should return discount for silver tier', () => {
      const silverTier = LOYALTY_TIERS.find(t => t.id === 'silver')!;
      const discount = getTierDiscountPercent(silverTier);

      expect(discount).toBeGreaterThan(0);
    });

    it('should return 0 for bronze tier', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const discount = getTierDiscountPercent(bronzeTier);

      expect(discount).toBe(0);
    });
  });

  describe('getBirthdayBonus', () => {
    it('should return bonus for all tiers', () => {
      LOYALTY_TIERS.forEach(tier => {
        const bonus = getBirthdayBonus(tier);
        expect(bonus).toBeGreaterThan(0);
      });
    });

    it('should increase with tier level', () => {
      const bronzeBonus = getBirthdayBonus(LOYALTY_TIERS.find(t => t.id === 'bronze')!);
      const vipBonus = getBirthdayBonus(LOYALTY_TIERS.find(t => t.id === 'vip')!);

      expect(vipBonus).toBeGreaterThan(bronzeBonus);
    });
  });

  describe('hasExclusiveAccess', () => {
    it('should return true for platinum tier and above', () => {
      const platinumTier = LOYALTY_TIERS.find(t => t.id === 'platinum')!;
      const hasAccess = hasExclusiveAccess(platinumTier);

      expect(hasAccess).toBe(true);
    });

    it('should return false for bronze tier', () => {
      const bronzeTier = LOYALTY_TIERS.find(t => t.id === 'bronze')!;
      const hasAccess = hasExclusiveAccess(bronzeTier);

      expect(hasAccess).toBe(false);
    });

    it('should return false for gold tier', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const hasAccess = hasExclusiveAccess(goldTier);

      expect(hasAccess).toBe(false);
    });
  });

  describe('hasPrioritySupport', () => {
    it('should return true for gold tier and above', () => {
      const goldTier = LOYALTY_TIERS.find(t => t.id === 'gold')!;
      const hasSupport = hasPrioritySupport(goldTier);

      expect(hasSupport).toBe(true);
    });
  });
});

describe('Loyalty Program - Validation', () => {
  describe('validateRedemption', () => {
    it('should reject points below minimum', () => {
      const result = validateRedemption(50, 1000, 1000);

      expect(result.valid).toBe(false);
      expect(result.errorUk).toContain('Мінімальне погашення');
    });

    it('should reject if insufficient points', () => {
      const result = validateRedemption(500, 300, 1000);

      expect(result.valid).toBe(false);
      expect(result.errorUk).toBe('Недостатньо балів');
    });

    it('should reject if exceeds max redeemable', () => {
      const result = validateRedemption(800, 1000, 1000);

      expect(result.valid).toBe(false);
      expect(result.errorUk).toContain('Максимальна кількість балів');
    });

    it('should accept valid redemption', () => {
      const result = validateRedemption(300, 1000, 1000);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('Loyalty Program - Formatting', () => {
  describe('formatPoints', () => {
    it('should format points with Ukrainian locale', () => {
      const formatted = formatPoints(1500);

      expect(formatted).toContain('1');
      expect(typeof formatted).toBe('string');
    });

    it('should handle large numbers', () => {
      const formatted = formatPoints(1000000);

      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with UAH symbol', () => {
      const formatted = formatCurrency(1000);

      expect(formatted).toContain('1');
      expect(typeof formatted).toBe('string');
    });

    it('should handle decimal values', () => {
      const formatted = formatCurrency(1234.56);

      expect(formatted).toBeTruthy();
    });
  });

  describe('getTierBadgeClasses', () => {
    it('should return classes for all tiers', () => {
      LOYALTY_TIERS.forEach(tier => {
        const classes = getTierBadgeClasses(tier.id);
        expect(classes).toContain('inline-flex');
        expect(classes.length).toBeGreaterThan(0);
      });
    });

    it('should return different classes for different tiers', () => {
      const bronzeClasses = getTierBadgeClasses('bronze');
      const vipClasses = getTierBadgeClasses('vip');

      expect(bronzeClasses).not.toBe(vipClasses);
    });
  });

  describe('getTierIcon', () => {
    it('should return icons for all tiers', () => {
      LOYALTY_TIERS.forEach(tier => {
        const icon = getTierIcon(tier.id);
        expect(icon).toBeTruthy();
        expect(typeof icon).toBe('string');
      });
    });

    it('should return different icons for different tiers', () => {
      const bronzeIcon = getTierIcon('bronze');
      const vipIcon = getTierIcon('vip');

      expect(bronzeIcon).not.toBe(vipIcon);
    });
  });
});
