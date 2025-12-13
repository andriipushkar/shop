/**
 * Coupons and Promo Codes System
 * Flexible discount system with various coupon types
 */

// ==================== TYPES ====================

export interface Coupon {
  id: string;
  code: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  conditions: CouponConditions;
  excludedProducts?: string[];
  excludedCategories?: string[];
  appliedProducts?: string[];
  appliedCategories?: string[];
  stackable: boolean;
  firstOrderOnly: boolean;
  newCustomerOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CouponType =
  | 'percent' // Percentage discount
  | 'fixed' // Fixed amount discount
  | 'free_shipping' // Free shipping
  | 'buy_x_get_y' // Buy X get Y free/discounted
  | 'bundle' // Bundle discount
  | 'cashback'; // Cashback to loyalty points

export interface CouponConditions {
  minItems?: number;
  maxItems?: number;
  categories?: string[];
  brands?: string[];
  paymentMethods?: string[];
  deliveryMethods?: string[];
  customerSegments?: string[];
  dayOfWeek?: number[]; // 0-6
  timeRange?: { start: string; end: string };
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  errorUk?: string;
  discount?: number;
  freeShipping?: boolean;
  appliedItems?: string[];
}

export interface AppliedCouponDetails {
  coupon: Coupon;
  discount: number;
  freeShipping: boolean;
  appliedToItems: string[];
  originalTotal: number;
  newTotal: number;
}

export interface CouponUsage {
  couponId: string;
  userId: string;
  orderId: string;
  discount: number;
  usedAt: Date;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate: Date;
  endDate: Date;
  conditions?: CouponConditions;
  excludedProducts?: string[];
  excludedCategories?: string[];
  appliedProducts?: string[];
  appliedCategories?: string[];
  stackable?: boolean;
  firstOrderOnly?: boolean;
  newCustomerOnly?: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  categoryId: string;
  brandId?: string;
}

// ==================== CONSTANTS ====================

export const COUPON_TYPE_LABELS: Record<CouponType, { en: string; uk: string }> = {
  percent: { en: 'Percentage Discount', uk: 'Відсоткова знижка' },
  fixed: { en: 'Fixed Discount', uk: 'Фіксована знижка' },
  free_shipping: { en: 'Free Shipping', uk: 'Безкоштовна доставка' },
  buy_x_get_y: { en: 'Buy X Get Y', uk: 'Купи X отримай Y' },
  bundle: { en: 'Bundle Discount', uk: 'Знижка на набір' },
  cashback: { en: 'Cashback', uk: 'Кешбек' },
};

export const COMMON_PROMO_PREFIXES = [
  'SALE', 'PROMO', 'DISCOUNT', 'WELCOME', 'FIRST', 'VIP', 'LOYAL',
  'ЗНИЖКА', 'АКЦІЯ', 'ВІТАЄМО', 'ПЕРШИЙ',
];

// ==================== VALIDATION ====================

/**
 * Validate coupon code format
 */
export function validateCouponCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.length < 3) {
    return { valid: false, error: 'Код занадто короткий' };
  }

  if (code.length > 20) {
    return { valid: false, error: 'Код занадто довгий' };
  }

  if (!/^[A-Z0-9_-]+$/i.test(code)) {
    return { valid: false, error: 'Код може містити лише літери, цифри, дефіс та підкреслення' };
  }

  return { valid: true };
}

/**
 * Validate coupon against order
 */
export function validateCoupon(
  coupon: Coupon,
  cart: CartItem[],
  userId?: string,
  userOrderCount?: number,
  userCouponUsage?: number,
  isNewCustomer?: boolean
): CouponValidationResult {
  const now = new Date();

  // Check if active
  if (!coupon.isActive) {
    return { valid: false, error: 'Coupon is inactive', errorUk: 'Купон неактивний' };
  }

  // Check dates
  if (now < new Date(coupon.startDate)) {
    return { valid: false, error: 'Coupon not yet active', errorUk: 'Купон ще не активний' };
  }

  if (now > new Date(coupon.endDate)) {
    return { valid: false, error: 'Coupon expired', errorUk: 'Термін дії купона закінчився' };
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, error: 'Coupon usage limit reached', errorUk: 'Ліміт використання купона вичерпано' };
  }

  // Check per user limit
  if (coupon.perUserLimit && userCouponUsage !== undefined && userCouponUsage >= coupon.perUserLimit) {
    return { valid: false, error: 'You have already used this coupon', errorUk: 'Ви вже використали цей купон' };
  }

  // Check first order only
  if (coupon.firstOrderOnly && userOrderCount !== undefined && userOrderCount > 0) {
    return { valid: false, error: 'Coupon valid for first order only', errorUk: 'Купон діє лише на перше замовлення' };
  }

  // Check new customer only
  if (coupon.newCustomerOnly && !isNewCustomer) {
    return { valid: false, error: 'Coupon valid for new customers only', errorUk: 'Купон діє лише для нових клієнтів' };
  }

  // Calculate applicable items
  let applicableItems = cart;

  // Filter by applied categories
  if (coupon.appliedCategories && coupon.appliedCategories.length > 0) {
    applicableItems = applicableItems.filter(item =>
      coupon.appliedCategories!.includes(item.categoryId)
    );
  }

  // Filter by applied products
  if (coupon.appliedProducts && coupon.appliedProducts.length > 0) {
    applicableItems = applicableItems.filter(item =>
      coupon.appliedProducts!.includes(item.productId)
    );
  }

  // Exclude categories
  if (coupon.excludedCategories && coupon.excludedCategories.length > 0) {
    applicableItems = applicableItems.filter(item =>
      !coupon.excludedCategories!.includes(item.categoryId)
    );
  }

  // Exclude products
  if (coupon.excludedProducts && coupon.excludedProducts.length > 0) {
    applicableItems = applicableItems.filter(item =>
      !coupon.excludedProducts!.includes(item.productId)
    );
  }

  if (applicableItems.length === 0) {
    return { valid: false, error: 'No applicable items in cart', errorUk: 'У кошику немає товарів, на які діє купон' };
  }

  // Calculate subtotal for applicable items
  const applicableSubtotal = applicableItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Check minimum order amount
  if (coupon.minOrderAmount && applicableSubtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      error: `Minimum order amount is ${coupon.minOrderAmount} UAH`,
      errorUk: `Мінімальна сума замовлення ${coupon.minOrderAmount} грн`,
    };
  }

  // Check conditions
  if (coupon.conditions) {
    const { minItems, maxItems, dayOfWeek, timeRange } = coupon.conditions;

    const totalItems = applicableItems.reduce((sum, item) => sum + item.quantity, 0);

    if (minItems && totalItems < minItems) {
      return {
        valid: false,
        error: `Minimum ${minItems} items required`,
        errorUk: `Мінімум ${minItems} товарів`,
      };
    }

    if (maxItems && totalItems > maxItems) {
      return {
        valid: false,
        error: `Maximum ${maxItems} items allowed`,
        errorUk: `Максимум ${maxItems} товарів`,
      };
    }

    if (dayOfWeek && dayOfWeek.length > 0) {
      const today = now.getDay();
      if (!dayOfWeek.includes(today)) {
        return { valid: false, error: 'Coupon not valid today', errorUk: 'Купон не діє сьогодні' };
      }
    }

    if (timeRange) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < timeRange.start || currentTime > timeRange.end) {
        return {
          valid: false,
          error: `Coupon valid from ${timeRange.start} to ${timeRange.end}`,
          errorUk: `Купон діє з ${timeRange.start} до ${timeRange.end}`,
        };
      }
    }
  }

  // Calculate discount
  let discount = 0;
  let freeShipping = false;

  switch (coupon.type) {
    case 'percent':
      discount = applicableSubtotal * (coupon.value / 100);
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
      break;

    case 'fixed':
      discount = Math.min(coupon.value, applicableSubtotal);
      break;

    case 'free_shipping':
      freeShipping = true;
      break;

    case 'cashback':
      // Cashback is handled separately as loyalty points
      discount = 0;
      break;

    case 'buy_x_get_y':
    case 'bundle':
      // These require special handling based on cart contents
      discount = calculateBundleDiscount(coupon, applicableItems);
      break;
  }

  return {
    valid: true,
    discount: Math.round(discount * 100) / 100,
    freeShipping,
    appliedItems: applicableItems.map(item => item.productId),
  };
}

/**
 * Calculate bundle/buy X get Y discount
 */
function calculateBundleDiscount(coupon: Coupon, items: CartItem[]): number {
  // Simple implementation - can be extended based on specific rules
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (coupon.type === 'buy_x_get_y') {
    // Assume value is buy X, get 1 free (or discounted)
    const buyCount = Math.floor(coupon.value);
    const freeItems = Math.floor(totalItems / (buyCount + 1));

    // Cheapest item is free
    const sortedByPrice = [...items].sort((a, b) => a.price - b.price);
    const cheapestPrice = sortedByPrice[0]?.price || 0;

    return freeItems * cheapestPrice;
  }

  if (coupon.type === 'bundle') {
    // Percentage discount on total bundle
    return subtotal * (coupon.value / 100);
  }

  return 0;
}

// ==================== API FUNCTIONS ====================

/**
 * Validate coupon code
 */
export async function validateCouponCode_API(
  code: string,
  cartItems: CartItem[]
): Promise<CouponValidationResult> {
  const response = await fetch('/api/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, items: cartItems }),
  });

  if (!response.ok) {
    const error = await response.json();
    return { valid: false, error: error.message, errorUk: error.messageUk };
  }

  return response.json();
}

/**
 * Apply coupon to order
 */
export async function applyCouponToOrder(
  code: string,
  orderId: string
): Promise<AppliedCouponDetails> {
  const response = await fetch('/api/coupons/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, orderId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to apply coupon');
  }

  return response.json();
}

/**
 * Get available coupons for user
 */
export async function getAvailableCoupons(): Promise<Coupon[]> {
  const response = await fetch('/api/coupons/available');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Get user's coupon history
 */
export async function getCouponHistory(): Promise<CouponUsage[]> {
  const response = await fetch('/api/coupons/history');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Create new coupon (admin)
 */
export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const response = await fetch('/api/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create coupon');
  }

  return response.json();
}

/**
 * Update coupon (admin)
 */
export async function updateCoupon(
  couponId: string,
  updates: Partial<CreateCouponInput>
): Promise<Coupon> {
  const response = await fetch(`/api/admin/coupons/${couponId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update coupon');
  }

  return response.json();
}

/**
 * Delete coupon (admin)
 */
export async function deleteCoupon(couponId: string): Promise<void> {
  const response = await fetch(`/api/admin/coupons/${couponId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete coupon');
  }
}

/**
 * Generate random coupon code
 */
export function generateCouponCode(prefix: string = 'PROMO', length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars
  let code = prefix ? prefix + '-' : '';

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

/**
 * Generate bulk coupon codes
 */
export function generateBulkCoupons(
  prefix: string,
  count: number,
  length: number = 8
): string[] {
  const codes: Set<string> = new Set();

  while (codes.size < count) {
    codes.add(generateCouponCode(prefix, length));
  }

  return Array.from(codes);
}

// ==================== UTILITIES ====================

/**
 * Format coupon discount for display
 */
export function formatCouponDiscount(coupon: Coupon): string {
  switch (coupon.type) {
    case 'percent':
      return `-${coupon.value}%`;
    case 'fixed':
      return `-${coupon.value} грн`;
    case 'free_shipping':
      return 'Безкоштовна доставка';
    case 'buy_x_get_y':
      return `Купи ${coupon.value}, отримай 1 безкоштовно`;
    case 'bundle':
      return `-${coupon.value}% на набір`;
    case 'cashback':
      return `${coupon.value}% кешбек`;
    default:
      return '';
  }
}

/**
 * Check if coupon is expiring soon
 */
export function isExpiringSoon(coupon: Coupon, daysThreshold: number = 3): boolean {
  const now = new Date();
  const endDate = new Date(coupon.endDate);
  const diffDays = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return diffDays > 0 && diffDays <= daysThreshold;
}

/**
 * Get coupon status
 */
export function getCouponStatus(coupon: Coupon): {
  status: 'active' | 'expired' | 'upcoming' | 'exhausted' | 'inactive';
  label: string;
  labelUk: string;
} {
  const now = new Date();

  if (!coupon.isActive) {
    return { status: 'inactive', label: 'Inactive', labelUk: 'Неактивний' };
  }

  if (now < new Date(coupon.startDate)) {
    return { status: 'upcoming', label: 'Upcoming', labelUk: 'Очікується' };
  }

  if (now > new Date(coupon.endDate)) {
    return { status: 'expired', label: 'Expired', labelUk: 'Закінчився' };
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return { status: 'exhausted', label: 'Exhausted', labelUk: 'Вичерпано' };
  }

  return { status: 'active', label: 'Active', labelUk: 'Активний' };
}

/**
 * Calculate remaining usage
 */
export function getRemainingUsage(coupon: Coupon): number | null {
  if (!coupon.usageLimit) return null;
  return Math.max(0, coupon.usageLimit - coupon.usageCount);
}

/**
 * Format coupon validity period
 */
export function formatValidityPeriod(coupon: Coupon): { en: string; uk: string } {
  const startDate = new Date(coupon.startDate).toLocaleDateString('uk-UA');
  const endDate = new Date(coupon.endDate).toLocaleDateString('uk-UA');

  return {
    en: `Valid from ${startDate} to ${endDate}`,
    uk: `Діє з ${startDate} по ${endDate}`,
  };
}
