/**
 * Unit tests for Commission Calculator
 * Тести для калькулятора комісії
 */

import { CommissionCalculator } from '@/lib/dropshipping/commission-calculator';
import type { SupplierOrder } from '@/lib/dropshipping/supplier-service';

describe('CommissionCalculator', () => {
  let calculator: CommissionCalculator;

  beforeEach(() => {
    calculator = new CommissionCalculator(15); // 15% default commission
  });

  describe('calculateOrderCommission', () => {
    it('should calculate commission for order with default rate', () => {
      const order: SupplierOrder = {
        id: 'order-1',
        supplierId: 'sup-1',
        platformOrderId: 'plat-1',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-1',
            name: 'Product 1',
            quantity: 2,
            price: 1000,
          },
        ],
        shippingAddress: {
          street: 'Test',
          city: 'Kyiv',
          postalCode: '01001',
          country: 'Ukraine',
        },
        status: 'new',
        supplierTotal: 2000,
        platformCommission: 300,
        createdAt: new Date(),
      };

      const result = calculator.calculateOrderCommission(order);

      expect(result.subtotal).toBe(2000);
      expect(result.commission).toBe(300);
      expect(result.commissionRate).toBe(15);
      expect(result.supplierAmount).toBe(1700);
      expect(result.platformAmount).toBe(300);
    });

    it('should calculate commission for multiple items', () => {
      const order: SupplierOrder = {
        id: 'order-2',
        supplierId: 'sup-1',
        platformOrderId: 'plat-2',
        items: [
          { productId: 'prod-1', sku: 'SKU-1', name: 'Product 1', quantity: 1, price: 1000 },
          { productId: 'prod-2', sku: 'SKU-2', name: 'Product 2', quantity: 2, price: 500 },
        ],
        shippingAddress: {
          street: 'Test',
          city: 'Kyiv',
          postalCode: '01001',
          country: 'Ukraine',
        },
        status: 'new',
        supplierTotal: 2000,
        platformCommission: 300,
        createdAt: new Date(),
      };

      const result = calculator.calculateOrderCommission(order);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].itemTotal).toBe(1000);
      expect(result.items[1].itemTotal).toBe(1000);
    });
  });

  describe('calculateRetailPrice', () => {
    it('should calculate retail price from supplier price', () => {
      const retailPrice = calculator.calculateRetailPrice(850, 'sup-1', 'cat-1');

      expect(retailPrice).toBe(1000); // 850 / 0.85 = 1000
    });

    it('should round retail price correctly', () => {
      const retailPrice = calculator.calculateRetailPrice(855, 'sup-1', 'cat-1');

      expect(retailPrice).toBeCloseTo(1005.88, 2);
    });

    it('should throw error when commission rate is too high', () => {
      calculator.setCommissionRule({
        id: 'rule-1',
        type: 'supplier',
        targetId: 'sup-bad',
        rate: 100,
        priority: 1,
      });

      expect(() => {
        calculator.calculateRetailPrice(1000, 'sup-bad', 'cat-1');
      }).toThrow('Ставка комісії занадто висока');
    });
  });

  describe('Commission Rules', () => {
    it('should apply product-specific commission rule', () => {
      calculator.setCommissionRule({
        id: 'rule-prod',
        type: 'product',
        targetId: 'prod-special',
        rate: 10,
        priority: 10,
      });

      const rate = calculator.getCommissionRate('sup-1', 'cat-1', 'prod-special');

      expect(rate).toBe(10);
    });

    it('should apply category commission rule', () => {
      calculator.setCommissionRule({
        id: 'rule-cat',
        type: 'category',
        targetId: 'electronics',
        rate: 12,
        priority: 5,
      });

      const rate = calculator.getCommissionRate('sup-1', 'electronics');

      expect(rate).toBe(12);
    });

    it('should apply supplier commission rule', () => {
      calculator.setCommissionRule({
        id: 'rule-sup',
        type: 'supplier',
        targetId: 'sup-vip',
        rate: 8,
        priority: 3,
      });

      const rate = calculator.getCommissionRate('sup-vip', 'cat-1');

      expect(rate).toBe(8);
    });

    it('should prioritize rules correctly (product > category > supplier)', () => {
      calculator.setCommissionRule({
        id: 'rule-sup',
        type: 'supplier',
        targetId: 'sup-1',
        rate: 20,
        priority: 1,
      });

      calculator.setCommissionRule({
        id: 'rule-cat',
        type: 'category',
        targetId: 'cat-1',
        rate: 18,
        priority: 5,
      });

      calculator.setCommissionRule({
        id: 'rule-prod',
        type: 'product',
        targetId: 'prod-1',
        rate: 16,
        priority: 10,
      });

      const rate = calculator.getCommissionRate('sup-1', 'cat-1', 'prod-1');

      expect(rate).toBe(16); // Product rule has highest priority
    });

    it('should use default rate when no rules match', () => {
      const rate = calculator.getCommissionRate('new-supplier', 'new-category');

      expect(rate).toBe(15);
    });

    it('should remove commission rule', () => {
      calculator.setCommissionRule({
        id: 'temp-rule',
        type: 'supplier',
        targetId: 'sup-temp',
        rate: 25,
        priority: 1,
      });

      calculator.removeCommissionRule('temp-rule');

      const rate = calculator.getCommissionRate('sup-temp', 'cat-1');
      expect(rate).toBe(15); // Back to default
    });
  });

  describe('calculateSuggestedRetailPrice', () => {
    it('should calculate suggested retail with profit margin', () => {
      const suggested = calculator.calculateSuggestedRetailPrice(
        850,
        'sup-1',
        'cat-1',
        20 // 20% additional profit
      );

      const base = calculator.calculateRetailPrice(850, 'sup-1', 'cat-1');
      expect(suggested).toBe(Math.round((base * 1.2) * 100) / 100);
    });

    it('should use default 20% margin when not specified', () => {
      const suggested = calculator.calculateSuggestedRetailPrice(850, 'sup-1', 'cat-1');
      const base = calculator.calculateRetailPrice(850, 'sup-1', 'cat-1');

      expect(suggested).toBeCloseTo(base * 1.2, 2);
    });
  });

  describe('Pricing Validation', () => {
    it('should validate profitable pricing', () => {
      const result = calculator.validatePricing(1200, 850, 'sup-1', 'cat-1');

      expect(result.valid).toBe(true);
      expect(result.profit).toBeGreaterThan(0);
    });

    it('should reject pricing below break-even', () => {
      const result = calculator.validatePricing(900, 850, 'sup-1', 'cat-1');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('нижче точки беззбитковості');
    });

    it('should calculate break-even price correctly', () => {
      const breakEven = calculator.calculateBreakEvenPrice(850, 'sup-1', 'cat-1');

      expect(breakEven).toBe(1000); // 850 / 0.85
    });
  });

  describe('Profit Margin Calculations', () => {
    it('should calculate profit margin correctly', () => {
      const margin = calculator.calculateProfitMargin(1200, 850);

      expect(margin).toBeCloseTo(41.18, 2); // ((1200 - 850) / 850) * 100
    });

    it('should return 0 margin when supplier price is 0', () => {
      const margin = calculator.calculateProfitMargin(1200, 0);

      expect(margin).toBe(0);
    });

    it('should handle negative margin', () => {
      const margin = calculator.calculateProfitMargin(800, 1000);

      expect(margin).toBeLessThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amounts', () => {
      const order: SupplierOrder = {
        id: 'order-zero',
        supplierId: 'sup-1',
        platformOrderId: 'plat-zero',
        items: [],
        shippingAddress: {
          street: 'Test',
          city: 'Kyiv',
          postalCode: '01001',
          country: 'Ukraine',
        },
        status: 'new',
        supplierTotal: 0,
        platformCommission: 0,
        createdAt: new Date(),
      };

      const result = calculator.calculateOrderCommission(order);

      expect(result.subtotal).toBe(0);
      expect(result.commission).toBe(0);
    });

    it('should load rules from storage', () => {
      const rules = [
        {
          id: 'loaded-rule',
          type: 'supplier' as const,
          targetId: 'sup-loaded',
          rate: 22,
          priority: 1,
        },
      ];

      calculator.loadRules(rules);

      const rate = calculator.getCommissionRate('sup-loaded', 'cat-1');
      expect(rate).toBe(22);
    });

    it('should get all rules', () => {
      calculator.setCommissionRule({
        id: 'rule-1',
        type: 'supplier',
        targetId: 'sup-1',
        rate: 15,
        priority: 1,
      });

      const rules = calculator.getCommissionRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should filter rules by supplier', () => {
      calculator.setCommissionRule({
        id: 'rule-sup-1',
        type: 'supplier',
        targetId: 'sup-1',
        rate: 15,
        priority: 1,
      });

      calculator.setCommissionRule({
        id: 'rule-sup-2',
        type: 'supplier',
        targetId: 'sup-2',
        rate: 18,
        priority: 1,
      });

      const rules = calculator.getCommissionRules('sup-1');
      expect(rules).toHaveLength(1);
      expect(rules[0].targetId).toBe('sup-1');
    });
  });
});
