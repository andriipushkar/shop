/**
 * Core Loyalty Program Logic
 * Enhanced implementation with tier system, points calculation, and redemption rules
 */

// Import types from main loyalty module
import {
  LoyaltyTier,
  LoyaltyTierId,
  LOYALTY_TIERS,
  POINTS_PER_CURRENCY,
  POINTS_TO_CURRENCY_RATE,
  MIN_REDEMPTION_POINTS,
  POINTS_EXPIRY_MONTHS,
  PointsTransaction,
  TransactionType,
} from '../loyalty';

// ==================== CORE CALCULATIONS ====================

/**
 * Calculate points earned for a purchase
 * 1 UAH = 1 point base rate (before tier multiplier)
 * @param amount - Purchase amount in UAH
 * @param tier - Customer's loyalty tier
 * @param isPromotion - Whether a points promotion is active
 * @returns Points earned
 */
export function calculatePointsEarned(
  amount: number,
  tier: LoyaltyTier,
  isPromotion: boolean = false
): number {
  if (amount <= 0) return 0;

  // Base points: 1 point per 10 UAH
  const basePoints = Math.floor(amount / POINTS_PER_CURRENCY);

  // Apply tier multiplier
  let multiplier = tier.multiplier;

  // Apply promotional multiplier if active
  if (isPromotion) {
    multiplier *= 2;
  }

  return Math.floor(basePoints * multiplier);
}

/**
 * Calculate discount value from points
 * 100 points = 1 UAH discount (as per requirements)
 * @param points - Number of points to redeem
 * @returns Discount amount in UAH
 */
export function calculateDiscountFromPoints(points: number): number {
  if (points < MIN_REDEMPTION_POINTS) return 0;

  // Convert points to UAH (1 point = 1 UAH)
  return points * POINTS_TO_CURRENCY_RATE;
}

/**
 * Calculate maximum redeemable points for an order
 * Limits redemption to a percentage of order total to prevent full-order coverage
 * @param orderTotal - Order total in UAH
 * @param availablePoints - Customer's available points
 * @param maxRedemptionPercent - Max percentage of order that can be covered (default 50%)
 * @returns Maximum points that can be redeemed
 */
export function calculateMaxRedeemablePoints(
  orderTotal: number,
  availablePoints: number,
  maxRedemptionPercent: number = 50
): number {
  // Maximum UAH that can be discounted based on order total
  const maxDiscountUAH = (orderTotal * maxRedemptionPercent) / 100;

  // Convert to points (1 UAH = 1 point for redemption)
  const maxPointsByOrder = Math.floor(maxDiscountUAH / POINTS_TO_CURRENCY_RATE);

  // Return the minimum of available points and order-based max
  return Math.min(availablePoints, maxPointsByOrder);
}

/**
 * Determine tier based on lifetime points
 * @param lifetimePoints - Total points earned over customer lifetime
 * @returns Appropriate loyalty tier
 */
export function determineTier(lifetimePoints: number): LoyaltyTier {
  // Iterate from highest to lowest tier
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    const tier = LOYALTY_TIERS[i];
    if (lifetimePoints >= tier.minPoints) {
      if (tier.maxPoints === null || lifetimePoints <= tier.maxPoints) {
        return tier;
      }
    }
  }

  // Default to Bronze if no tier matches
  return LOYALTY_TIERS[0];
}

/**
 * Get the next tier for a customer
 * @param currentTierId - Current tier ID
 * @returns Next tier or null if already at highest tier
 */
export function getNextTier(currentTierId: LoyaltyTierId): LoyaltyTier | null {
  const currentIndex = LOYALTY_TIERS.findIndex(t => t.id === currentTierId);

  if (currentIndex === -1 || currentIndex === LOYALTY_TIERS.length - 1) {
    return null;
  }

  return LOYALTY_TIERS[currentIndex + 1];
}

/**
 * Calculate points needed to reach next tier
 * @param currentPoints - Customer's current lifetime points
 * @param currentTierId - Current tier ID
 * @returns Points needed or null if at highest tier
 */
export function calculatePointsToNextTier(
  currentPoints: number,
  currentTierId: LoyaltyTierId
): number | null {
  const nextTier = getNextTier(currentTierId);

  if (!nextTier) {
    return null;
  }

  const pointsNeeded = nextTier.minPoints - currentPoints;
  return Math.max(0, pointsNeeded);
}

/**
 * Calculate tier progress percentage
 * @param currentPoints - Customer's current lifetime points
 * @param tier - Current tier
 * @returns Progress percentage (0-100)
 */
export function calculateTierProgress(
  currentPoints: number,
  tier: LoyaltyTier
): number {
  const nextTier = getNextTier(tier.id);

  // If at max tier, return 100%
  if (!nextTier) {
    return 100;
  }

  // Calculate progress within current tier range
  const tierRange = nextTier.minPoints - tier.minPoints;
  const pointsInTier = currentPoints - tier.minPoints;

  const progress = (pointsInTier / tierRange) * 100;

  return Math.min(100, Math.max(0, Math.round(progress)));
}

// ==================== POINTS EXPIRY ====================

/**
 * Calculate expiry date for points
 * @param earnedDate - Date points were earned
 * @param expiryMonths - Number of months until expiry (default from config)
 * @returns Expiry date
 */
export function calculatePointsExpiry(
  earnedDate: Date = new Date(),
  expiryMonths: number = POINTS_EXPIRY_MONTHS
): Date {
  const expiryDate = new Date(earnedDate);
  expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
  return expiryDate;
}

/**
 * Check if points are expiring soon
 * @param expiryDate - Points expiry date
 * @param warningDays - Days before expiry to warn (default 30)
 * @returns True if expiring within warning period
 */
export function arePointsExpiringSoon(
  expiryDate: Date,
  warningDays: number = 30
): boolean {
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + warningDays);

  return expiryDate > now && expiryDate <= warningDate;
}

/**
 * Get points expiring within a time period
 * @param transactions - Points transactions
 * @param daysThreshold - Days to check (default 30)
 * @returns Object with expiring points count and nearest expiry date
 */
export function getExpiringPoints(
  transactions: PointsTransaction[],
  daysThreshold: number = 30
): { points: number; expiryDate: Date | null } {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  let expiringPoints = 0;
  let nearestExpiry: Date | null = null;

  transactions.forEach(tx => {
    if (tx.expiresAt && tx.points > 0 && tx.type.startsWith('earned_')) {
      const expiryDate = new Date(tx.expiresAt);

      if (expiryDate > now && expiryDate <= thresholdDate) {
        expiringPoints += tx.points;

        if (!nearestExpiry || expiryDate < nearestExpiry) {
          nearestExpiry = expiryDate;
        }
      }
    }
  });

  return { points: expiringPoints, expiryDate: nearestExpiry };
}

// ==================== TIER BENEFITS ====================

/**
 * Check if customer qualifies for free shipping
 * @param tier - Customer's loyalty tier
 * @param orderTotal - Order total in UAH
 * @returns True if qualifies for free shipping
 */
export function qualifiesForFreeShipping(
  tier: LoyaltyTier,
  orderTotal: number
): boolean {
  const freeShippingBenefit = tier.benefits.find(b => b.type === 'free_shipping');

  if (!freeShippingBenefit) {
    return false;
  }

  // If value is 0, free shipping on all orders
  if (freeShippingBenefit.value === 0) {
    return true;
  }

  // Otherwise, check if order meets minimum
  return orderTotal >= (freeShippingBenefit.value || 0);
}

/**
 * Get discount percentage for tier
 * @param tier - Customer's loyalty tier
 * @returns Discount percentage (0 if none)
 */
export function getTierDiscountPercent(tier: LoyaltyTier): number {
  const discountBenefit = tier.benefits.find(b => b.type === 'special_discount');
  return discountBenefit?.value || 0;
}

/**
 * Get birthday bonus points for tier
 * @param tier - Customer's loyalty tier
 * @returns Birthday bonus points
 */
export function getBirthdayBonus(tier: LoyaltyTier): number {
  const birthdayBenefit = tier.benefits.find(b => b.type === 'birthday_bonus');
  return birthdayBenefit?.value || 0;
}

/**
 * Check if tier has exclusive access
 * @param tier - Customer's loyalty tier
 * @returns True if has exclusive access
 */
export function hasExclusiveAccess(tier: LoyaltyTier): boolean {
  return tier.benefits.some(b => b.type === 'exclusive_access');
}

/**
 * Check if tier has priority support
 * @param tier - Customer's loyalty tier
 * @returns True if has priority support
 */
export function hasPrioritySupport(tier: LoyaltyTier): boolean {
  return tier.benefits.some(b => b.type === 'priority_support');
}

// ==================== TRANSACTION HELPERS ====================

/**
 * Create a points earned transaction
 */
export function createEarnedTransaction(
  memberId: string,
  points: number,
  type: TransactionType,
  description: string,
  descriptionUk: string,
  orderId?: string
): Omit<PointsTransaction, 'id' | 'balance' | 'createdAt'> {
  return {
    memberId,
    type,
    points,
    description,
    descriptionUk,
    orderId,
    expiresAt: calculatePointsExpiry(),
  };
}

/**
 * Create a points redeemed transaction
 */
export function createRedeemedTransaction(
  memberId: string,
  points: number,
  description: string,
  descriptionUk: string,
  orderId?: string
): Omit<PointsTransaction, 'id' | 'balance' | 'createdAt'> {
  return {
    memberId,
    type: 'redeemed',
    points: -points, // Negative for redemption
    description,
    descriptionUk,
    orderId,
  };
}

// ==================== VALIDATION ====================

/**
 * Validate points redemption
 * @param pointsToRedeem - Points customer wants to redeem
 * @param availablePoints - Customer's available points
 * @param orderTotal - Order total in UAH
 * @returns Validation result
 */
export function validateRedemption(
  pointsToRedeem: number,
  availablePoints: number,
  orderTotal: number
): { valid: boolean; error?: string; errorUk?: string } {
  // Check minimum redemption
  if (pointsToRedeem < MIN_REDEMPTION_POINTS) {
    return {
      valid: false,
      error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points`,
      errorUk: `Мінімальне погашення ${MIN_REDEMPTION_POINTS} балів`,
    };
  }

  // Check available points
  if (pointsToRedeem > availablePoints) {
    return {
      valid: false,
      error: 'Insufficient points',
      errorUk: 'Недостатньо балів',
    };
  }

  // Check max redemption limit
  const maxRedeemable = calculateMaxRedeemablePoints(orderTotal, availablePoints);
  if (pointsToRedeem > maxRedeemable) {
    return {
      valid: false,
      error: `Maximum redeemable points for this order: ${maxRedeemable}`,
      errorUk: `Максимальна кількість балів для цього замовлення: ${maxRedeemable}`,
    };
  }

  return { valid: true };
}

// ==================== FORMATTING ====================

/**
 * Format points for display
 * @param points - Points to format
 * @param locale - Locale (default: uk-UA)
 * @returns Formatted points string
 */
export function formatPoints(points: number, locale: string = 'uk-UA'): string {
  return points.toLocaleString(locale);
}

/**
 * Format currency for display
 * @param amount - Amount in UAH
 * @param locale - Locale (default: uk-UA)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, locale: string = 'uk-UA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get tier badge style
 * @param tierId - Tier ID
 * @returns CSS classes for tier badge
 */
export function getTierBadgeClasses(tierId: LoyaltyTierId): string {
  const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold';

  switch (tierId) {
    case 'bronze':
      return `${baseClasses} bg-amber-100 text-amber-800 border border-amber-300`;
    case 'silver':
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-300`;
    case 'gold':
      return `${baseClasses} bg-yellow-100 text-yellow-900 border border-yellow-400`;
    case 'platinum':
      return `${baseClasses} bg-slate-100 text-slate-800 border border-slate-300`;
    case 'vip':
      return `${baseClasses} bg-purple-100 text-purple-800 border border-purple-400`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-300`;
  }
}

/**
 * Get tier icon/emoji
 * @param tierId - Tier ID
 * @returns Emoji icon for tier
 */
export function getTierIcon(tierId: LoyaltyTierId): string {
  switch (tierId) {
    case 'bronze':
      return '🥉';
    case 'silver':
      return '🥈';
    case 'gold':
      return '🥇';
    case 'platinum':
      return '💎';
    case 'vip':
      return '👑';
    default:
      return '🏅';
  }
}

// ==================== EXPORTS ====================

export {
  LOYALTY_TIERS,
  POINTS_PER_CURRENCY,
  POINTS_TO_CURRENCY_RATE,
  MIN_REDEMPTION_POINTS,
  POINTS_EXPIRY_MONTHS,
};

export type { LoyaltyTier, LoyaltyTierId, PointsTransaction, TransactionType };
