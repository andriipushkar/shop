/**
 * Loyalty Program System
 * Points, tiers, rewards, and customer engagement
 */

// ==================== TYPES ====================

export interface LoyaltyMember {
  id: string;
  userId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  tier: LoyaltyTier;
  points: LoyaltyPoints;
  stats: LoyaltyStats;
  preferences: LoyaltyPreferences;
  joinedAt: Date;
  tierUpdatedAt: Date;
  lastActivityAt: Date;
}

export type LoyaltyTierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';

export interface LoyaltyTier {
  id: LoyaltyTierId;
  name: string;
  nameUk: string;
  minPoints: number;
  maxPoints: number | null;
  benefits: TierBenefit[];
  multiplier: number; // Points multiplier
  color: string;
  icon: string;
}

export interface TierBenefit {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  type: BenefitType;
  value?: number;
}

export type BenefitType =
  | 'points_multiplier'
  | 'free_shipping'
  | 'birthday_bonus'
  | 'exclusive_access'
  | 'priority_support'
  | 'special_discount'
  | 'free_returns'
  | 'extended_warranty'
  | 'cashback';

export interface LoyaltyPoints {
  available: number;
  pending: number;
  expiringSoon: number;
  expiryDate?: Date;
  lifetime: number;
}

export interface LoyaltyStats {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  pointsEarned: number;
  pointsRedeemed: number;
  referralsCount: number;
  reviewsCount: number;
  currentStreak: number; // Consecutive months with orders
  longestStreak: number;
}

export interface LoyaltyPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  marketingConsent: boolean;
  birthdayReminder: boolean;
  tierChangeAlerts: boolean;
  expiryReminders: boolean;
}

export interface PointsTransaction {
  id: string;
  memberId: string;
  type: TransactionType;
  points: number;
  balance: number;
  description: string;
  descriptionUk: string;
  orderId?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export type TransactionType =
  | 'earned_purchase'
  | 'earned_review'
  | 'earned_referral'
  | 'earned_birthday'
  | 'earned_bonus'
  | 'earned_promotion'
  | 'redeemed'
  | 'expired'
  | 'adjusted'
  | 'tier_bonus';

export interface Reward {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  type: RewardType;
  pointsCost: number;
  value?: number;
  image?: string;
  available: boolean;
  stock?: number;
  requiredTier?: LoyaltyTierId;
  validDays?: number;
  maxPerUser?: number;
}

export type RewardType =
  | 'discount_percent'
  | 'discount_fixed'
  | 'free_shipping'
  | 'free_product'
  | 'gift_card'
  | 'experience'
  | 'upgrade';

export interface RedeemedReward {
  id: string;
  rewardId: string;
  memberId: string;
  pointsSpent: number;
  code?: string;
  status: 'active' | 'used' | 'expired';
  redeemedAt: Date;
  usedAt?: Date;
  expiresAt?: Date;
}

export interface ReferralProgram {
  referrerBonus: number;
  refereeBonus: number;
  maxReferrals?: number;
  conditions: string[];
}

// ==================== TIER CONFIGURATION ====================

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    nameUk: 'Бронза',
    minPoints: 0,
    maxPoints: 999,
    multiplier: 1,
    color: '#CD7F32',
    icon: 'bronze-medal',
    benefits: [
      {
        id: 'base_earning',
        name: 'Earn 1 point per 10 UAH',
        nameUk: 'Отримуйте 1 бал за кожні 10 грн',
        description: 'Earn points on every purchase',
        descriptionUk: 'Отримуйте бали за кожну покупку',
        type: 'points_multiplier',
        value: 1,
      },
      {
        id: 'birthday_bonus',
        name: 'Birthday Bonus',
        nameUk: 'Подарунок на день народження',
        description: '50 bonus points on your birthday',
        descriptionUk: '50 бонусних балів на ваш день народження',
        type: 'birthday_bonus',
        value: 50,
      },
    ],
  },
  {
    id: 'silver',
    name: 'Silver',
    nameUk: 'Срібло',
    minPoints: 1000,
    maxPoints: 4999,
    multiplier: 1.25,
    color: '#C0C0C0',
    icon: 'silver-medal',
    benefits: [
      {
        id: 'points_125',
        name: 'Earn 1.25x points',
        nameUk: 'Отримуйте x1.25 балів',
        description: '25% more points on every purchase',
        descriptionUk: 'На 25% більше балів за кожну покупку',
        type: 'points_multiplier',
        value: 1.25,
      },
      {
        id: 'birthday_bonus',
        name: 'Birthday Bonus',
        nameUk: 'Подарунок на день народження',
        description: '100 bonus points on your birthday',
        descriptionUk: '100 бонусних балів на ваш день народження',
        type: 'birthday_bonus',
        value: 100,
      },
      {
        id: 'special_discount',
        name: 'Member Discount',
        nameUk: 'Знижка учасника',
        description: '5% off select products',
        descriptionUk: '5% знижки на окремі товари',
        type: 'special_discount',
        value: 5,
      },
    ],
  },
  {
    id: 'gold',
    name: 'Gold',
    nameUk: 'Золото',
    minPoints: 5000,
    maxPoints: 14999,
    multiplier: 1.5,
    color: '#FFD700',
    icon: 'gold-medal',
    benefits: [
      {
        id: 'points_150',
        name: 'Earn 1.5x points',
        nameUk: 'Отримуйте x1.5 балів',
        description: '50% more points on every purchase',
        descriptionUk: 'На 50% більше балів за кожну покупку',
        type: 'points_multiplier',
        value: 1.5,
      },
      {
        id: 'free_shipping',
        name: 'Free Shipping',
        nameUk: 'Безкоштовна доставка',
        description: 'Free shipping on orders over 500 UAH',
        descriptionUk: 'Безкоштовна доставка від 500 грн',
        type: 'free_shipping',
        value: 500,
      },
      {
        id: 'birthday_bonus',
        name: 'Birthday Bonus',
        nameUk: 'Подарунок на день народження',
        description: '200 bonus points on your birthday',
        descriptionUk: '200 бонусних балів на ваш день народження',
        type: 'birthday_bonus',
        value: 200,
      },
      {
        id: 'priority_support',
        name: 'Priority Support',
        nameUk: 'Пріоритетна підтримка',
        description: 'Fast-track customer support',
        descriptionUk: 'Швидка підтримка клієнтів',
        type: 'priority_support',
      },
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    nameUk: 'Платина',
    minPoints: 15000,
    maxPoints: 49999,
    multiplier: 2,
    color: '#E5E4E2',
    icon: 'platinum-medal',
    benefits: [
      {
        id: 'points_200',
        name: 'Earn 2x points',
        nameUk: 'Отримуйте x2 балів',
        description: 'Double points on every purchase',
        descriptionUk: 'Подвійні бали за кожну покупку',
        type: 'points_multiplier',
        value: 2,
      },
      {
        id: 'free_shipping',
        name: 'Free Shipping',
        nameUk: 'Безкоштовна доставка',
        description: 'Free shipping on all orders',
        descriptionUk: 'Безкоштовна доставка на всі замовлення',
        type: 'free_shipping',
        value: 0,
      },
      {
        id: 'free_returns',
        name: 'Free Returns',
        nameUk: 'Безкоштовне повернення',
        description: '60-day free returns',
        descriptionUk: 'Безкоштовне повернення протягом 60 днів',
        type: 'free_returns',
      },
      {
        id: 'exclusive_access',
        name: 'Early Access',
        nameUk: 'Ранній доступ',
        description: 'Early access to sales and new products',
        descriptionUk: 'Ранній доступ до розпродажів та новинок',
        type: 'exclusive_access',
      },
      {
        id: 'birthday_bonus',
        name: 'Birthday Bonus',
        nameUk: 'Подарунок на день народження',
        description: '500 bonus points on your birthday',
        descriptionUk: '500 бонусних балів на ваш день народження',
        type: 'birthday_bonus',
        value: 500,
      },
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    nameUk: 'VIP',
    minPoints: 50000,
    maxPoints: null,
    multiplier: 3,
    color: '#8B008B',
    icon: 'crown',
    benefits: [
      {
        id: 'points_300',
        name: 'Earn 3x points',
        nameUk: 'Отримуйте x3 балів',
        description: 'Triple points on every purchase',
        descriptionUk: 'Потрійні бали за кожну покупку',
        type: 'points_multiplier',
        value: 3,
      },
      {
        id: 'free_shipping',
        name: 'Free Express Shipping',
        nameUk: 'Безкоштовна експрес-доставка',
        description: 'Free express shipping on all orders',
        descriptionUk: 'Безкоштовна експрес-доставка на всі замовлення',
        type: 'free_shipping',
        value: 0,
      },
      {
        id: 'cashback',
        name: '5% Cashback',
        nameUk: '5% кешбек',
        description: '5% cashback on all purchases',
        descriptionUk: '5% кешбек на всі покупки',
        type: 'cashback',
        value: 5,
      },
      {
        id: 'extended_warranty',
        name: 'Extended Warranty',
        nameUk: 'Розширена гарантія',
        description: '+6 months warranty on all products',
        descriptionUk: '+6 місяців гарантії на всі товари',
        type: 'extended_warranty',
        value: 6,
      },
      {
        id: 'personal_manager',
        name: 'Personal Manager',
        nameUk: 'Персональний менеджер',
        description: 'Dedicated personal account manager',
        descriptionUk: 'Персональний менеджер вашого акаунту',
        type: 'priority_support',
      },
      {
        id: 'birthday_bonus',
        name: 'Birthday Bonus',
        nameUk: 'Подарунок на день народження',
        description: '1000 bonus points on your birthday',
        descriptionUk: '1000 бонусних балів на ваш день народження',
        type: 'birthday_bonus',
        value: 1000,
      },
    ],
  },
];

export const REFERRAL_PROGRAM: ReferralProgram = {
  referrerBonus: 100,
  refereeBonus: 50,
  maxReferrals: 50,
  conditions: [
    'Referee must make a purchase of at least 500 UAH',
    'Points are credited after order delivery',
    'Valid for new customers only',
  ],
};

export const POINTS_PER_CURRENCY = 10; // 1 point per 10 UAH
export const POINTS_EXPIRY_MONTHS = 12;
export const POINTS_PER_REVIEW = 20;
export const MIN_REDEMPTION_POINTS = 100;
export const POINTS_TO_CURRENCY_RATE = 1; // 1 point = 1 UAH discount

// ==================== FUNCTIONS ====================

/**
 * Calculate points for purchase
 */
export function calculatePointsForPurchase(
  amount: number,
  tier: LoyaltyTier,
  isDoublePointsPromo: boolean = false
): number {
  const basePoints = Math.floor(amount / POINTS_PER_CURRENCY);
  let multiplier = tier.multiplier;

  if (isDoublePointsPromo) {
    multiplier *= 2;
  }

  return Math.floor(basePoints * multiplier);
}

/**
 * Get tier by points
 */
export function getTierByPoints(points: number): LoyaltyTier {
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (points >= LOYALTY_TIERS[i].minPoints) {
      return LOYALTY_TIERS[i];
    }
  }
  return LOYALTY_TIERS[0];
}

/**
 * Get next tier
 */
export function getNextTier(currentTier: LoyaltyTierId): LoyaltyTier | null {
  const currentIndex = LOYALTY_TIERS.findIndex(t => t.id === currentTier);
  if (currentIndex < LOYALTY_TIERS.length - 1) {
    return LOYALTY_TIERS[currentIndex + 1];
  }
  return null;
}

/**
 * Calculate points to next tier
 */
export function getPointsToNextTier(currentPoints: number, currentTier: LoyaltyTierId): number | null {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return null;

  return Math.max(0, nextTier.minPoints - currentPoints);
}

/**
 * Calculate tier progress percentage
 */
export function getTierProgress(currentPoints: number, currentTier: LoyaltyTier): number {
  const nextTier = getNextTier(currentTier.id);
  if (!nextTier) return 100;

  const tierRange = nextTier.minPoints - currentTier.minPoints;
  const pointsInTier = currentPoints - currentTier.minPoints;

  return Math.min(100, Math.round((pointsInTier / tierRange) * 100));
}

/**
 * Calculate points value in currency
 */
export function calculatePointsValue(points: number): number {
  return points * POINTS_TO_CURRENCY_RATE;
}

/**
 * Calculate max redeemable points for order
 */
export function calculateMaxRedeemablePoints(
  orderTotal: number,
  availablePoints: number,
  maxRedemptionPercent: number = 50
): number {
  const maxByOrder = Math.floor(orderTotal * (maxRedemptionPercent / 100));
  return Math.min(availablePoints, maxByOrder);
}

/**
 * Check if points are expiring soon
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
    if (tx.expiresAt && tx.points > 0) {
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

// ==================== API FUNCTIONS ====================

/**
 * Get member profile
 */
export async function getMemberProfile(): Promise<LoyaltyMember | null> {
  const response = await fetch('/api/loyalty/profile');

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Enroll in loyalty program
 */
export async function enrollInProgram(preferences?: Partial<LoyaltyPreferences>): Promise<LoyaltyMember> {
  const response = await fetch('/api/loyalty/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to enroll');
  }

  return response.json();
}

/**
 * Get points history
 */
export async function getPointsHistory(
  limit: number = 50,
  offset: number = 0
): Promise<{ transactions: PointsTransaction[]; total: number }> {
  const response = await fetch(`/api/loyalty/history?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    return { transactions: [], total: 0 };
  }

  return response.json();
}

/**
 * Get available rewards
 */
export async function getAvailableRewards(): Promise<Reward[]> {
  const response = await fetch('/api/loyalty/rewards');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Redeem reward
 */
export async function redeemReward(rewardId: string): Promise<RedeemedReward> {
  const response = await fetch('/api/loyalty/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to redeem reward');
  }

  return response.json();
}

/**
 * Get user's redeemed rewards
 */
export async function getRedeemedRewards(): Promise<RedeemedReward[]> {
  const response = await fetch('/api/loyalty/redeemed');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Generate referral link
 */
export async function generateReferralLink(): Promise<{ link: string; code: string }> {
  const response = await fetch('/api/loyalty/referral-link', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to generate referral link');
  }

  return response.json();
}

/**
 * Apply referral code
 */
export async function applyReferralCode(code: string): Promise<{ success: boolean; bonus: number }> {
  const response = await fetch('/api/loyalty/apply-referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Invalid referral code');
  }

  return response.json();
}

/**
 * Update preferences
 */
export async function updateLoyaltyPreferences(
  preferences: Partial<LoyaltyPreferences>
): Promise<LoyaltyPreferences> {
  const response = await fetch('/api/loyalty/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error('Failed to update preferences');
  }

  return response.json();
}

// ==================== UTILITIES ====================

/**
 * Format points with Ukrainian locale
 */
export function formatPoints(points: number): string {
  return points.toLocaleString('uk-UA');
}

/**
 * Get tier badge color class
 */
export function getTierColorClass(tier: LoyaltyTierId): string {
  switch (tier) {
    case 'bronze':
      return 'bg-amber-700 text-white';
    case 'silver':
      return 'bg-gray-400 text-white';
    case 'gold':
      return 'bg-yellow-500 text-black';
    case 'platinum':
      return 'bg-gray-200 text-gray-800';
    case 'vip':
      return 'bg-purple-600 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

/**
 * Get transaction type label
 */
export function getTransactionTypeLabel(type: TransactionType): { en: string; uk: string } {
  const labels: Record<TransactionType, { en: string; uk: string }> = {
    earned_purchase: { en: 'Purchase', uk: 'Покупка' },
    earned_review: { en: 'Review', uk: 'Відгук' },
    earned_referral: { en: 'Referral', uk: 'Реферал' },
    earned_birthday: { en: 'Birthday Bonus', uk: 'День народження' },
    earned_bonus: { en: 'Bonus', uk: 'Бонус' },
    earned_promotion: { en: 'Promotion', uk: 'Акція' },
    redeemed: { en: 'Redeemed', uk: 'Використано' },
    expired: { en: 'Expired', uk: 'Закінчився термін' },
    adjusted: { en: 'Adjustment', uk: 'Коригування' },
    tier_bonus: { en: 'Tier Bonus', uk: 'Бонус рівня' },
  };

  return labels[type] || { en: type, uk: type };
}
