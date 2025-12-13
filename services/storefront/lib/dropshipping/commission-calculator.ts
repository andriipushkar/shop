/**
 * Commission Calculator
 * Розрахунок комісії платформи
 */

import { SupplierOrder } from './supplier-service';

export interface CommissionRule {
  id: string;
  type: 'category' | 'supplier' | 'product';
  targetId: string; // categoryId, supplierId, or productId
  rate: number; // Percentage
  minAmount?: number;
  maxAmount?: number;
  priority: number; // Higher priority = applied first
}

export interface CommissionBreakdown {
  subtotal: number;
  commission: number;
  commissionRate: number;
  supplierAmount: number;
  platformAmount: number;
  items: ItemCommission[];
}

export interface ItemCommission {
  productId: string;
  itemTotal: number;
  commission: number;
  commissionRate: number;
}

export class CommissionCalculator {
  private rules: CommissionRule[] = [];
  private defaultRate: number = 15; // Default 15% commission

  constructor(defaultRate?: number) {
    if (defaultRate !== undefined) {
      this.defaultRate = defaultRate;
    }
  }

  /**
   * Calculate commission for an entire order
   * Розрахунок комісії для всього замовлення
   */
  calculateOrderCommission(order: SupplierOrder): CommissionBreakdown {
    const items: ItemCommission[] = [];
    let totalCommission = 0;

    // Calculate commission for each item
    order.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      const rate = this.getCommissionRate(order.supplierId, '', item.productId);
      const commission = this.calculateCommissionAmount(itemTotal, rate);

      items.push({
        productId: item.productId,
        itemTotal,
        commission,
        commissionRate: rate,
      });

      totalCommission += commission;
    });

    const subtotal = order.supplierTotal;
    const effectiveRate = subtotal > 0 ? (totalCommission / subtotal) * 100 : 0;

    return {
      subtotal,
      commission: totalCommission,
      commissionRate: effectiveRate,
      supplierAmount: subtotal - totalCommission,
      platformAmount: totalCommission,
      items,
    };
  }

  /**
   * Calculate retail price from supplier price
   * Розрахунок роздрібної ціни від ціни постачальника
   */
  calculateRetailPrice(
    supplierPrice: number,
    supplierId: string,
    categoryId: string
  ): number {
    const commissionRate = this.getCommissionRate(supplierId, categoryId);

    // Retail price should cover supplier price + commission
    // If commission is 15%, retail = supplier / 0.85
    const markup = 1 - (commissionRate / 100);

    if (markup <= 0) {
      throw new Error('Ставка комісії занадто висока');
    }

    const retailPrice = supplierPrice / markup;

    // Round to 2 decimal places
    return Math.round(retailPrice * 100) / 100;
  }

  /**
   * Calculate suggested retail price with profit margin
   * Розрахунок рекомендованої роздрібної ціни з маржею
   */
  calculateSuggestedRetailPrice(
    supplierPrice: number,
    supplierId: string,
    categoryId: string,
    profitMargin: number = 20 // Additional 20% profit margin
  ): number {
    const baseRetail = this.calculateRetailPrice(supplierPrice, supplierId, categoryId);
    const suggested = baseRetail * (1 + profitMargin / 100);

    return Math.round(suggested * 100) / 100;
  }

  /**
   * Get effective commission rate
   * Отримати ефективну ставку комісії
   */
  getCommissionRate(
    supplierId: string,
    categoryId?: string,
    productId?: string
  ): number {
    // Sort rules by priority (highest first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    // Check product-specific rule first
    if (productId) {
      const productRule = sortedRules.find(
        r => r.type === 'product' && r.targetId === productId
      );
      if (productRule) return productRule.rate;
    }

    // Check category rule
    if (categoryId) {
      const categoryRule = sortedRules.find(
        r => r.type === 'category' && r.targetId === categoryId
      );
      if (categoryRule) return categoryRule.rate;
    }

    // Check supplier rule
    const supplierRule = sortedRules.find(
      r => r.type === 'supplier' && r.targetId === supplierId
    );
    if (supplierRule) return supplierRule.rate;

    // Return default rate
    return this.defaultRate;
  }

  /**
   * Calculate commission amount
   * Розрахувати суму комісії
   */
  private calculateCommissionAmount(amount: number, rate: number): number {
    const commission = (amount * rate) / 100;

    // Apply min/max limits if they exist
    const applicableRule = this.rules.find(r => {
      const calculated = (amount * r.rate) / 100;
      return calculated === commission;
    });

    if (applicableRule) {
      if (applicableRule.minAmount && commission < applicableRule.minAmount) {
        return applicableRule.minAmount;
      }
      if (applicableRule.maxAmount && commission > applicableRule.maxAmount) {
        return applicableRule.maxAmount;
      }
    }

    return Math.round(commission * 100) / 100;
  }

  /**
   * Set commission rule
   * Встановити правило комісії
   */
  setCommissionRule(rule: CommissionRule): void {
    // Remove existing rule for same target
    this.rules = this.rules.filter(
      r => !(r.type === rule.type && r.targetId === rule.targetId)
    );

    // Add new rule
    this.rules.push(rule);
  }

  /**
   * Remove commission rule
   * Видалити правило комісії
   */
  removeCommissionRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Get all commission rules, optionally filtered by supplier
   * Отримати всі правила комісії
   */
  getCommissionRules(supplierId?: string): CommissionRule[] {
    if (supplierId) {
      return this.rules.filter(r => r.type === 'supplier' && r.targetId === supplierId);
    }
    return [...this.rules];
  }

  /**
   * Load rules from storage
   * Завантажити правила зі сховища
   */
  loadRules(rules: CommissionRule[]): void {
    this.rules = rules;
  }

  /**
   * Calculate profit margin
   * Розрахувати маржу прибутку
   */
  calculateProfitMargin(retailPrice: number, supplierPrice: number): number {
    if (supplierPrice === 0) return 0;

    const profit = retailPrice - supplierPrice;
    const margin = (profit / supplierPrice) * 100;

    return Math.round(margin * 100) / 100;
  }

  /**
   * Calculate break-even price
   * Розрахувати точку беззбитковості
   */
  calculateBreakEvenPrice(
    supplierPrice: number,
    supplierId: string,
    categoryId: string
  ): number {
    const commissionRate = this.getCommissionRate(supplierId, categoryId);
    const markup = 1 - (commissionRate / 100);

    if (markup <= 0) {
      throw new Error('Ставка комісії занадто висока');
    }

    return Math.round((supplierPrice / markup) * 100) / 100;
  }

  /**
   * Validate pricing
   * Перевірити ціноутворення
   */
  validatePricing(
    retailPrice: number,
    supplierPrice: number,
    supplierId: string,
    categoryId: string
  ): {
    valid: boolean;
    breakEven: number;
    commission: number;
    profit: number;
    message?: string;
  } {
    const breakEven = this.calculateBreakEvenPrice(supplierPrice, supplierId, categoryId);
    const commissionRate = this.getCommissionRate(supplierId, categoryId);
    const commission = (retailPrice * commissionRate) / 100;
    const profit = retailPrice - supplierPrice - commission;

    if (retailPrice < breakEven) {
      return {
        valid: false,
        breakEven,
        commission,
        profit,
        message: `Роздрібна ціна нижче точки беззбитковості (${breakEven})`,
      };
    }

    return {
      valid: true,
      breakEven,
      commission,
      profit,
    };
  }
}

// Default export
export default CommissionCalculator;
