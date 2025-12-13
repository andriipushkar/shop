/**
 * Tests for Coupons System
 */

import {
  validateCoupon,
  validateCouponCode,
  generateCouponCode,
  formatCouponDiscount,
  Coupon,
  CouponType,
  CartItem,
  COUPON_TYPE_LABELS,
} from '../../lib/coupons';

describe('Coupons System', () => {
  // Sample coupons
  const createPercentCoupon = (overrides?: Partial<Coupon>): Coupon => ({
    id: 'coupon-1',
    code: 'SALE20',
    name: 'Sale 20%',
    nameUk: 'Знижка 20%',
    description: '20% off all items',
    descriptionUk: '20% знижка на всі товари',
    type: 'percent',
    value: 20,
    minOrderAmount: 500,
    maxDiscount: 1000,
    usageLimit: 100,
    usageCount: 50,
    perUserLimit: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    isActive: true,
    conditions: {},
    excludedProducts: [],
    excludedCategories: [],
    appliedProducts: [],
    appliedCategories: [],
    stackable: false,
    firstOrderOnly: false,
    newCustomerOnly: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createFixedCoupon = (overrides?: Partial<Coupon>): Coupon => ({
    ...createPercentCoupon(),
    id: 'coupon-2',
    code: 'SAVE100',
    name: 'Save 100',
    nameUk: 'Економте 100',
    type: 'fixed',
    value: 100,
    ...overrides,
  });

  const createCart = (overrides?: Partial<CartItem>[]): CartItem[] => {
    const defaultItems: CartItem[] = [
      {
        productId: 'prod-1',
        categoryId: 'cat-1',
        price: 1000,
        quantity: 2,
        name: 'Product 1',
      },
    ];
    return overrides ? [...defaultItems, ...overrides.map(o => ({ ...defaultItems[0], ...o }))] : defaultItems;
  };

  describe('validateCouponCode', () => {
    it('should validate correct coupon code', () => {
      const result = validateCouponCode('SALE20');
      expect(result.valid).toBe(true);
    });

    it('should reject short code', () => {
      const result = validateCouponCode('AB');
      expect(result.valid).toBe(false);
    });

    it('should reject long code', () => {
      const result = validateCouponCode('A'.repeat(25));
      expect(result.valid).toBe(false);
    });

    it('should reject invalid characters', () => {
      const result = validateCouponCode('CODE@123');
      expect(result.valid).toBe(false);
    });

    it('should accept alphanumeric with dashes and underscores', () => {
      const result = validateCouponCode('SALE-20_OFF');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCoupon', () => {
    it('should validate active coupon with valid cart', () => {
      const coupon = createPercentCoupon();
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
      expect(result.discount).toBeGreaterThan(0);
    });

    it('should reject expired coupon', () => {
      const coupon = createPercentCoupon({
        endDate: new Date('2023-01-01'),
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject coupon below minimum order value', () => {
      const coupon = createPercentCoupon({
        minOrderAmount: 5000,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject inactive coupon', () => {
      const coupon = createPercentCoupon({
        isActive: false,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
    });

    it('should reject coupon that reached usage limit', () => {
      const coupon = createPercentCoupon({
        usageLimit: 100,
        usageCount: 100,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
    });

    it('should reject coupon for wrong category', () => {
      const coupon = createPercentCoupon({
        appliedCategories: ['cat-other'],
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
    });

    it('should validate coupon for correct category', () => {
      const coupon = createPercentCoupon({
        appliedCategories: ['cat-1'],
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
    });

    it('should reject first order coupon for returning customer', () => {
      const coupon = createPercentCoupon({
        firstOrderOnly: true,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart, 'user-1', 5); // 5 previous orders

      expect(result.valid).toBe(false);
    });

    it('should validate first order coupon for new customer', () => {
      const coupon = createPercentCoupon({
        firstOrderOnly: true,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart, 'user-1', 0);

      expect(result.valid).toBe(true);
    });

    it('should reject coupon for excluded product', () => {
      const coupon = createPercentCoupon({
        excludedProducts: ['prod-1'],
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
    });
  });

  describe('Discount calculation', () => {
    it('should calculate percent discount correctly', () => {
      const coupon = createPercentCoupon({ value: 20 });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      // Cart total is 2000 (1000 * 2), 20% = 400
      expect(result.discount).toBe(400);
    });

    it('should respect maximum discount for percent coupon', () => {
      const coupon = createPercentCoupon({
        value: 50,
        maxDiscount: 500,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      // 50% of 2000 = 1000, but max is 500
      expect(result.discount).toBe(500);
    });

    it('should calculate fixed discount correctly', () => {
      const coupon = createFixedCoupon({ value: 100 });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.discount).toBe(100);
    });

    it('should not exceed cart total for fixed discount', () => {
      const coupon = createFixedCoupon({ value: 5000 });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      // Cart total is 2000, so discount can't be more
      expect(result.discount).toBeLessThanOrEqual(2000);
    });

    it('should set freeShipping for free_shipping coupon', () => {
      const coupon = createPercentCoupon({
        type: 'free_shipping',
        value: 0,
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
      expect(result.freeShipping).toBe(true);
    });
  });

  describe('generateCouponCode', () => {
    it('should generate code with prefix', () => {
      const code = generateCouponCode('SALE');

      expect(code.startsWith('SALE')).toBe(true);
    });

    it('should generate code with default prefix', () => {
      const code = generateCouponCode();

      expect(code.startsWith('PROMO')).toBe(true);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        codes.add(generateCouponCode());
      }

      expect(codes.size).toBe(100); // All codes should be unique
    });

    it('should generate alphanumeric code', () => {
      const code = generateCouponCode();

      // The code should be valid
      const validation = validateCouponCode(code);
      expect(validation.valid).toBe(true);
    });
  });

  describe('formatCouponDiscount', () => {
    it('should format percent discount', () => {
      const coupon = createPercentCoupon({ value: 20 });
      const formatted = formatCouponDiscount(coupon);

      expect(formatted).toContain('20');
      expect(formatted).toContain('%');
    });

    it('should format fixed discount', () => {
      const coupon = createFixedCoupon({ value: 100 });
      const formatted = formatCouponDiscount(coupon);

      expect(formatted).toContain('100');
    });

    it('should format free shipping', () => {
      const coupon = createPercentCoupon({ type: 'free_shipping' });
      const formatted = formatCouponDiscount(coupon);

      expect(formatted.toLowerCase()).toContain('безкоштовн');
    });

    it('should format cashback', () => {
      const coupon = createPercentCoupon({
        type: 'cashback',
        value: 5,
      });
      const formatted = formatCouponDiscount(coupon);

      expect(formatted.toLowerCase()).toContain('кешбек');
      expect(formatted).toContain('5');
    });
  });

  describe('Buy X Get Y Coupons', () => {
    it('should validate buy X get Y coupon', () => {
      const coupon = createPercentCoupon({
        type: 'buy_x_get_y',
        value: 2, // Buy 2, get 1 free
        appliedProducts: ['prod-1'],
        minOrderAmount: 0, // No minimum for this test
      });
      const cart: CartItem[] = [
        { productId: 'prod-1', categoryId: 'cat-1', price: 200, quantity: 3, name: 'Product 1' },
      ];

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
      expect(result.discount).toBeGreaterThan(0);
    });
  });

  describe('Bundle Coupons', () => {
    it('should validate bundle coupon', () => {
      const coupon = createPercentCoupon({
        type: 'bundle',
        value: 15, // 15% bundle discount
      });
      const cart: CartItem[] = [
        { productId: 'prod-1', categoryId: 'cat-1', price: 1000, quantity: 1, name: 'Product 1' },
        { productId: 'prod-2', categoryId: 'cat-1', price: 500, quantity: 1, name: 'Product 2' },
      ];

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
      // 15% of 1500 = 225
      expect(result.discount).toBeCloseTo(225, 0);
    });
  });

  describe('Coupon conditions', () => {
    it('should validate minimum items condition', () => {
      const coupon = createPercentCoupon({
        conditions: { minItems: 5 },
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      // Cart has 2 items, need 5
      expect(result.valid).toBe(false);
    });

    it('should validate day of week condition', () => {
      const today = new Date().getDay();
      const coupon = createPercentCoupon({
        conditions: { dayOfWeek: [today] },
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(true);
    });

    it('should reject when day of week doesn\'t match', () => {
      const today = new Date().getDay();
      const otherDay = (today + 1) % 7;
      const coupon = createPercentCoupon({
        conditions: { dayOfWeek: [otherDay] },
      });
      const cart = createCart();

      const result = validateCoupon(coupon, cart);

      expect(result.valid).toBe(false);
    });
  });

  describe('COUPON_TYPE_LABELS', () => {
    it('should have all coupon types', () => {
      expect(COUPON_TYPE_LABELS.percent).toBeDefined();
      expect(COUPON_TYPE_LABELS.fixed).toBeDefined();
      expect(COUPON_TYPE_LABELS.free_shipping).toBeDefined();
      expect(COUPON_TYPE_LABELS.buy_x_get_y).toBeDefined();
      expect(COUPON_TYPE_LABELS.bundle).toBeDefined();
      expect(COUPON_TYPE_LABELS.cashback).toBeDefined();
    });

    it('should have both languages', () => {
      Object.values(COUPON_TYPE_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
      });
    });
  });
});
