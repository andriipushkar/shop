/**
 * B2B Pricing System
 * Система оптових цін з різними рівнями
 */

import type {
  PriceTier,
  PriceConfig,
  ProductPrice,
  CustomerPricing,
  CategoryDiscount,
  CartItem,
  B2BCartTotal,
  B2BCartItem
} from './types';

// Price tier configurations
export const PRICE_TIERS: Record<PriceTier, PriceConfig> = {
  retail: {
    tier: 'retail',
    name: 'Retail',
    nameUk: 'Роздріб',
    minOrderValue: 0,
    minQuantity: 1,
    discountPercent: 0
  },
  wholesale_small: {
    tier: 'wholesale_small',
    name: 'Small Wholesale',
    nameUk: 'Малий опт',
    minOrderValue: 5000,
    minQuantity: 10,
    discountPercent: 10
  },
  wholesale_medium: {
    tier: 'wholesale_medium',
    name: 'Medium Wholesale',
    nameUk: 'Середній опт',
    minOrderValue: 20000,
    minQuantity: 50,
    discountPercent: 15
  },
  wholesale_large: {
    tier: 'wholesale_large',
    name: 'Large Wholesale',
    nameUk: 'Великий опт',
    minOrderValue: 50000,
    minQuantity: 100,
    discountPercent: 20
  },
  partner: {
    tier: 'partner',
    name: 'Partner',
    nameUk: 'Партнер',
    minOrderValue: 10000,
    minQuantity: 20,
    discountPercent: 25
  },
  distributor: {
    tier: 'distributor',
    name: 'Distributor',
    nameUk: 'Дистриб\'ютор',
    minOrderValue: 100000,
    minQuantity: 200,
    discountPercent: 30
  }
};

export class B2BPricingService {
  private customerPricingCache: Map<string, CustomerPricing> = new Map();
  private productPricesCache: Map<string, ProductPrice> = new Map();

  constructor() {
    // Initialize with mock data for demonstration
    this.initializeMockData();
  }

  private initializeMockData() {
    // Mock customer pricing
    this.customerPricingCache.set('customer-1', {
      customerId: 'customer-1',
      tier: 'wholesale_medium',
      customDiscounts: [
        { categoryId: 'electronics', discountPercent: 5 }
      ]
    });

    // Mock product prices
    this.productPricesCache.set('product-1', {
      productId: 'product-1',
      retail: 1000,
      wholesale_small: 900,
      wholesale_medium: 850,
      wholesale_large: 800,
      partner: 750,
      distributor: 700
    });
  }

  /**
   * Get price for specific customer
   * Отримати ціну для конкретного клієнта
   */
  getCustomerPrice(productId: string, customerId: string): number {
    const customerPricing = this.customerPricingCache.get(customerId);
    const productPrice = this.productPricesCache.get(productId);

    if (!productPrice) {
      throw new Error(`Product ${productId} not found`);
    }

    // Check for individual custom price
    if (customerPricing?.individualPrices?.has(productId)) {
      return customerPricing.individualPrices.get(productId)!;
    }

    // Check for custom price in product
    if (productPrice.customPrices?.has(customerId)) {
      return productPrice.customPrices.get(customerId)!;
    }

    // Get tier-based price
    const tier = customerPricing?.tier || 'retail';
    const tierPrice = productPrice[tier];

    if (tierPrice) {
      return tierPrice;
    }

    // Calculate price based on tier discount
    const tierConfig = PRICE_TIERS[tier];
    const discount = tierConfig.discountPercent / 100;
    return productPrice.retail * (1 - discount);
  }

  /**
   * Get all prices for product
   * Отримати всі ціни для товару
   */
  getProductPrices(productId: string): ProductPrice {
    const productPrice = this.productPricesCache.get(productId);

    if (!productPrice) {
      throw new Error(`Product ${productId} not found`);
    }

    return productPrice;
  }

  /**
   * Set tier for customer
   * Встановити рівень для клієнта
   */
  setCustomerTier(customerId: string, tier: PriceTier): void {
    const existing = this.customerPricingCache.get(customerId) || {
      customerId,
      tier: 'retail'
    };

    this.customerPricingCache.set(customerId, {
      ...existing,
      tier
    });
  }

  /**
   * Set custom price for specific customer
   * Встановити індивідуальну ціну для клієнта
   */
  setCustomerPrice(customerId: string, productId: string, price: number): void {
    const existing = this.customerPricingCache.get(customerId) || {
      customerId,
      tier: 'retail'
    };

    const individualPrices = existing.individualPrices || new Map();
    individualPrices.set(productId, price);

    this.customerPricingCache.set(customerId, {
      ...existing,
      individualPrices
    });
  }

  /**
   * Set category discount for customer
   * Встановити знижку на категорію для клієнта
   */
  setCategoryDiscount(customerId: string, categoryId: string, discountPercent: number): void {
    const existing = this.customerPricingCache.get(customerId) || {
      customerId,
      tier: 'retail'
    };

    const customDiscounts = existing.customDiscounts || [];
    const existingDiscountIndex = customDiscounts.findIndex(d => d.categoryId === categoryId);

    if (existingDiscountIndex >= 0) {
      customDiscounts[existingDiscountIndex].discountPercent = discountPercent;
    } else {
      customDiscounts.push({ categoryId, discountPercent });
    }

    this.customerPricingCache.set(customerId, {
      ...existing,
      customDiscounts
    });
  }

  /**
   * Calculate cart total with B2B pricing
   * Розрахувати суму кошика з оптовими цінами
   */
  calculateB2BCart(customerId: string, items: CartItem[]): B2BCartTotal {
    let subtotal = 0;
    let discountAmount = 0;

    const b2bItems: B2BCartItem[] = items.map(item => {
      const customerPrice = this.getCustomerPrice(item.productId, customerId);
      const lineTotal = customerPrice * item.quantity;
      const originalTotal = item.basePrice * item.quantity;
      const itemDiscount = originalTotal - lineTotal;

      subtotal += lineTotal;
      discountAmount += itemDiscount;

      return {
        ...item,
        customerPrice,
        lineTotal,
        appliedDiscount: itemDiscount
      };
    });

    const customerPricing = this.customerPricingCache.get(customerId);
    const tier = customerPricing?.tier || 'retail';
    const tierConfig = PRICE_TIERS[tier];

    // Calculate tax (20% VAT for Ukraine)
    const taxAmount = subtotal * 0.20;
    const total = subtotal + taxAmount;

    return {
      subtotal,
      discountAmount,
      discountPercent: tierConfig.discountPercent,
      taxAmount,
      total,
      items: b2bItems
    };
  }

  /**
   * Generate price list for customer (export)
   * Згенерувати прайс-лист для клієнта (експорт)
   */
  async generatePriceList(
    customerId: string,
    format: 'xlsx' | 'csv' | 'xml'
  ): Promise<Buffer> {
    // This would typically call the PriceListGenerator
    // For now, return empty buffer as placeholder
    return Buffer.from('');
  }

  /**
   * Add product price
   * Додати ціну товару
   */
  addProductPrice(productPrice: ProductPrice): void {
    this.productPricesCache.set(productPrice.productId, productPrice);
  }

  /**
   * Get customer tier
   * Отримати рівень клієнта
   */
  getCustomerTier(customerId: string): PriceTier {
    const customerPricing = this.customerPricingCache.get(customerId);
    return customerPricing?.tier || 'retail';
  }

  /**
   * Check if customer meets tier requirements
   * Перевірити чи клієнт відповідає вимогам рівня
   */
  meetsRequirements(tier: PriceTier, orderValue: number, totalQuantity: number): boolean {
    const tierConfig = PRICE_TIERS[tier];
    return orderValue >= tierConfig.minOrderValue && totalQuantity >= tierConfig.minQuantity;
  }

  /**
   * Get tier by order value and quantity
   * Отримати рівень за сумою замовлення та кількістю
   */
  getTierByOrderParams(orderValue: number, totalQuantity: number): PriceTier {
    const tiers: PriceTier[] = [
      'distributor',
      'partner',
      'wholesale_large',
      'wholesale_medium',
      'wholesale_small',
      'retail'
    ];

    for (const tier of tiers) {
      if (this.meetsRequirements(tier, orderValue, totalQuantity)) {
        return tier;
      }
    }

    return 'retail';
  }
}

// Singleton instance
export const pricingService = new B2BPricingService();
