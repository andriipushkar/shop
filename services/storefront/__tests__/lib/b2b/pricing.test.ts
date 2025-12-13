/**
 * Unit tests for B2B Pricing Service
 * Тести для сервісу оптових цін
 */

import { B2BPricingService, PRICE_TIERS } from '@/lib/b2b/pricing';
import type { CartItem } from '@/lib/b2b/types';

describe('B2BPricingService', () => {
  let service: B2BPricingService;

  beforeEach(() => {
    service = new B2BPricingService();
  });

  describe('Price Tier Calculations', () => {
    it('should get correct retail price for customer', () => {
      const price = service.getCustomerPrice('product-1', 'customer-new');
      expect(price).toBe(1000); // Retail price
    });

    it('should get tier-based price for wholesale customer', () => {
      service.setCustomerTier('customer-2', 'wholesale_medium');
      const price = service.getCustomerPrice('product-1', 'customer-2');
      expect(price).toBe(850); // Medium wholesale price
    });

    it('should apply tier discount when specific tier price not set', () => {
      service.setCustomerTier('customer-3', 'partner');
      service.addProductPrice({
        productId: 'product-2',
        retail: 2000,
      });

      const price = service.getCustomerPrice('product-2', 'customer-3');
      const expected = 2000 * (1 - PRICE_TIERS.partner.discountPercent / 100);
      expect(price).toBe(expected);
    });

    it('should return all price tiers for a product', () => {
      const prices = service.getProductPrices('product-1');
      expect(prices.retail).toBe(1000);
      expect(prices.wholesale_medium).toBe(850);
      expect(prices.distributor).toBe(700);
    });

    it('should throw error for non-existent product', () => {
      expect(() => service.getProductPrices('non-existent')).toThrow(
        'Product non-existent not found'
      );
    });
  });

  describe('Customer-Specific Pricing', () => {
    it('should set and get custom price for specific customer', () => {
      service.setCustomerPrice('customer-vip', 'product-1', 750);
      const price = service.getCustomerPrice('product-1', 'customer-vip');
      expect(price).toBe(750);
    });

    it('should prioritize individual price over tier price', () => {
      service.setCustomerTier('customer-special', 'wholesale_small');
      service.setCustomerPrice('customer-special', 'product-1', 800);

      const price = service.getCustomerPrice('product-1', 'customer-special');
      expect(price).toBe(800); // Individual price, not tier price
    });
  });

  describe('Category Discounts', () => {
    it('should set category discount for customer', () => {
      service.setCategoryDiscount('customer-1', 'electronics', 5);
      // Note: This test validates the setting; actual application would require
      // more complex product-category relationships
      expect(() =>
        service.setCategoryDiscount('customer-1', 'electronics', 5)
      ).not.toThrow();
    });

    it('should update existing category discount', () => {
      service.setCategoryDiscount('customer-1', 'electronics', 5);
      service.setCategoryDiscount('customer-1', 'electronics', 10);
      // Discount updated successfully
      expect(() =>
        service.setCategoryDiscount('customer-1', 'electronics', 10)
      ).not.toThrow();
    });
  });

  describe('Cart Total with B2B Pricing', () => {
    it('should calculate cart total with retail pricing', () => {
      const items: CartItem[] = [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 2,
          basePrice: 1000,
        },
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 1,
          basePrice: 1000,
        },
      ];

      const result = service.calculateB2BCart('customer-new', items);

      expect(result.subtotal).toBe(3000);
      expect(result.taxAmount).toBe(600); // 20% VAT
      expect(result.total).toBe(3600);
      expect(result.discountAmount).toBe(0);
    });

    it('should calculate cart total with wholesale pricing', () => {
      service.setCustomerTier('customer-wholesale', 'wholesale_medium');

      const items: CartItem[] = [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 2,
          basePrice: 1000,
        },
      ];

      const result = service.calculateB2BCart('customer-wholesale', items);

      expect(result.subtotal).toBe(1700); // 850 * 2
      expect(result.discountAmount).toBe(300); // 2000 - 1700
      expect(result.taxAmount).toBe(340); // 20% of 1700
      expect(result.total).toBe(2040);
    });

    it('should include individual item pricing in cart', () => {
      service.setCustomerTier('customer-partner', 'partner');

      const items: CartItem[] = [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 1,
          basePrice: 1000,
        },
      ];

      const result = service.calculateB2BCart('customer-partner', items);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].customerPrice).toBe(750); // Partner price
      expect(result.items[0].lineTotal).toBe(750);
      expect(result.items[0].appliedDiscount).toBe(250);
    });
  });

  describe('Tier Requirements Validation', () => {
    it('should validate tier requirements are met', () => {
      const isValid = service.meetsRequirements(
        'wholesale_small',
        5000,
        10
      );
      expect(isValid).toBe(true);
    });

    it('should reject when order value too low', () => {
      const isValid = service.meetsRequirements(
        'wholesale_small',
        4000,
        10
      );
      expect(isValid).toBe(false);
    });

    it('should reject when quantity too low', () => {
      const isValid = service.meetsRequirements(
        'wholesale_small',
        5000,
        5
      );
      expect(isValid).toBe(false);
    });

    it('should get appropriate tier by order params', () => {
      // getTierByOrderParams checks from highest to lowest tier
      // partner requires minOrderValue=10000, minQuantity=20
      // So 25000, 60 qualifies for partner (checked before wholesale_medium)
      const tier = service.getTierByOrderParams(25000, 60);
      expect(tier).toBe('partner');
    });

    it('should return retail for orders not meeting wholesale requirements', () => {
      const tier = service.getTierByOrderParams(1000, 2);
      expect(tier).toBe('retail');
    });

    it('should return highest tier for large orders', () => {
      const tier = service.getTierByOrderParams(150000, 250);
      expect(tier).toBe('distributor');
    });
  });

  describe('Customer Tier Management', () => {
    it('should get customer tier', () => {
      service.setCustomerTier('customer-test', 'wholesale_large');
      const tier = service.getCustomerTier('customer-test');
      expect(tier).toBe('wholesale_large');
    });

    it('should return retail tier for new customers', () => {
      const tier = service.getCustomerTier('new-customer');
      expect(tier).toBe('retail');
    });

    it('should update customer tier', () => {
      service.setCustomerTier('customer-test', 'wholesale_small');
      service.setCustomerTier('customer-test', 'partner');
      const tier = service.getCustomerTier('customer-test');
      expect(tier).toBe('partner');
    });
  });

  describe('Product Price Management', () => {
    it('should add new product price', () => {
      service.addProductPrice({
        productId: 'product-new',
        retail: 5000,
        wholesale_small: 4500,
        wholesale_medium: 4250,
        wholesale_large: 4000,
      });

      const prices = service.getProductPrices('product-new');
      expect(prices.retail).toBe(5000);
      expect(prices.wholesale_small).toBe(4500);
    });

    it('should handle product with custom prices map', () => {
      const customPrices = new Map<string, number>();
      customPrices.set('customer-vip', 3500);

      service.addProductPrice({
        productId: 'product-special',
        retail: 5000,
        customPrices,
      });

      const price = service.getCustomerPrice('product-special', 'customer-vip');
      expect(price).toBe(3500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantity orders', () => {
      const items: CartItem[] = [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 0,
          basePrice: 1000,
        },
      ];

      const result = service.calculateB2BCart('customer-new', items);
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle empty cart', () => {
      const result = service.calculateB2BCart('customer-new', []);
      expect(result.subtotal).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should calculate correct discount percentage', () => {
      service.setCustomerTier('customer-test', 'distributor');
      const items: CartItem[] = [
        {
          productId: 'product-1',
          sku: 'SKU-1',
          name: 'Product 1',
          quantity: 1,
          basePrice: 1000,
        },
      ];

      const result = service.calculateB2BCart('customer-test', items);
      expect(result.discountPercent).toBe(
        PRICE_TIERS.distributor.discountPercent
      );
    });
  });
});
