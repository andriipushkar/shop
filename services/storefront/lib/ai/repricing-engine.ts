/**
 * AI Repricing Engine
 * Автоматичний репрайсинг на основі цін конкурентів
 */

interface CronSchedule {
  enabled: boolean;
  pattern: string; // e.g., "0 */4 * * *" (every 4 hours)
  timezone?: string;
}

export interface RepricingRule {
  id: string;
  productId?: string; // null = global rule
  categoryId?: string;
  brandId?: string;
  enabled: boolean;
  strategy: RepricingStrategy;
  competitors: string[]; // Competitor IDs to monitor
  constraints: PriceConstraints;
  schedule?: CronSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export type RepricingStrategy =
  | { type: 'beat_lowest'; margin: number } // Beat lowest price by X UAH
  | { type: 'match_lowest' } // Match lowest competitor price
  | { type: 'percentage_below'; percent: number } // X% below lowest
  | { type: 'smart'; targetPosition: number } // AI determines optimal price for target position
  | { type: 'maximize_margin'; minMargin: number }; // Maximize margin while staying competitive

export interface PriceConstraints {
  minPrice?: number;
  maxPrice?: number;
  minMargin?: number; // Мінімальна маржа %
  maxDiscount?: number; // Максимальна знижка від базової ціни %
  floorPrice?: number; // Собівартість + мінімальний прибуток
  ceilingPrice?: number; // Максимальна ціна (РРЦ)
  roundTo?: number; // Округлення (0.99, 5, 10)
}

export interface PriceChange {
  id: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  competitorPrices: CompetitorPrice[];
  margin: number;
  appliedAt: Date;
  ruleId: string;
  status: 'applied' | 'pending' | 'rejected';
}

export interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  price: number;
  url: string;
  lastChecked: Date;
  inStock: boolean;
  position?: number; // Market position (1 = cheapest)
}

export interface RepricingReport {
  totalProducts: number;
  repriced: number;
  skipped: number;
  errors: number;
  avgPriceChange: number;
  estimatedRevenueImpact: number;
  changes: PriceChange[];
  startedAt: Date;
  completedAt: Date;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  competitorId: string;
  competitorName: string;
  ourPrice: number;
  competitorPrice: number;
  difference: number;
  differencePercent: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface PriceTestResult {
  testId: string;
  productId: string;
  variants: {
    price: number;
    impressions: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }[];
  winner: number;
  confidence: number;
  startedAt: Date;
  endedAt?: Date;
}

export class RepricingEngine {
  private rules: Map<string, RepricingRule> = new Map();
  private priceHistory: Map<string, PriceChange[]> = new Map();
  private activeTests: Map<string, PriceTestResult> = new Map();

  /**
   * Create or update a repricing rule
   * Створити або оновити правило репрайсингу
   */
  async setRule(rule: RepricingRule): Promise<void> {
    // Validate rule
    this.validateRule(rule);

    // Store rule
    this.rules.set(rule.id, {
      ...rule,
      updatedAt: new Date(),
      createdAt: rule.createdAt || new Date(),
    });

    // TODO: Persist to database
    console.log(`Repricing rule ${rule.id} saved`);
  }

  /**
   * Get repricing rules for a product or all rules
   * Отримати правила репрайсингу для товару або всі правила
   */
  getRules(productId?: string): RepricingRule[] {
    const allRules = Array.from(this.rules.values());

    if (!productId) {
      return allRules;
    }

    // Return rules that apply to this product
    return allRules.filter(rule =>
      !rule.productId || // Global rule
      rule.productId === productId
    );
  }

  /**
   * Delete a repricing rule
   * Видалити правило репрайсингу
   */
  async deleteRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
    // TODO: Delete from database
  }

  /**
   * Calculate optimal price based on competitor data and strategy
   * Розрахувати оптимальну ціну на основі даних конкурентів та стратегії
   */
  async calculateOptimalPrice(productId: string): Promise<{
    suggestedPrice: number;
    reason: string;
    competitorData: CompetitorPrice[];
    margin: number;
  }> {
    // Get applicable rules
    const rules = this.getRules(productId).filter(r => r.enabled);

    if (rules.length === 0) {
      throw new Error('No active repricing rules for this product');
    }

    // Get competitor prices (mock data for now)
    const competitorData = await this.fetchCompetitorPrices(productId);

    if (competitorData.length === 0) {
      throw new Error('No competitor data available');
    }

    // Sort by price
    competitorData.sort((a, b) => a.price - b.price);
    const lowestPrice = competitorData[0].price;

    // Apply the first active rule (in real scenario, might want to combine strategies)
    const rule = rules[0];
    let suggestedPrice = 0;
    let reason = '';

    switch (rule.strategy.type) {
      case 'beat_lowest':
        suggestedPrice = lowestPrice - rule.strategy.margin;
        reason = `Ціна нижче найнижчої конкурентної на ${rule.strategy.margin} грн`;
        break;

      case 'match_lowest':
        suggestedPrice = lowestPrice;
        reason = 'Відповідність найнижчій ціні конкурентів';
        break;

      case 'percentage_below':
        suggestedPrice = lowestPrice * (1 - rule.strategy.percent / 100);
        reason = `${rule.strategy.percent}% нижче найнижчої ціни конкурентів`;
        break;

      case 'smart':
        // AI-based pricing to achieve target position
        suggestedPrice = this.calculateSmartPrice(competitorData, rule.strategy.targetPosition);
        reason = `Smart pricing для позиції ${rule.strategy.targetPosition}`;
        break;

      case 'maximize_margin':
        // Find highest price while maintaining minimum margin
        suggestedPrice = this.calculateMaxMarginPrice(lowestPrice, rule.strategy.minMargin);
        reason = `Максимізація маржі (мін. ${rule.strategy.minMargin}%)`;
        break;

      default:
        throw new Error('Unknown repricing strategy');
    }

    // Apply constraints
    suggestedPrice = this.applyConstraints(suggestedPrice, rule.constraints);

    // Calculate margin (mock calculation)
    const cost = suggestedPrice * 0.7; // Assume 30% margin
    const margin = ((suggestedPrice - cost) / suggestedPrice) * 100;

    return {
      suggestedPrice,
      reason,
      competitorData,
      margin,
    };
  }

  /**
   * Apply repricing to a single product
   * Застосувати репрайсинг до одного товару
   */
  async repriceProduct(productId: string): Promise<PriceChange | null> {
    try {
      // Get current price (mock)
      const currentPrice = await this.getCurrentPrice(productId);

      // Calculate optimal price
      const { suggestedPrice, reason, competitorData, margin } =
        await this.calculateOptimalPrice(productId);

      // Check if price actually changed
      if (Math.abs(currentPrice - suggestedPrice) < 0.01) {
        return null; // No change needed
      }

      // Get applicable rule
      const rule = this.getRules(productId).find(r => r.enabled);
      if (!rule) {
        throw new Error('No active rule found');
      }

      // Create price change record
      const change: PriceChange = {
        id: `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        oldPrice: currentPrice,
        newPrice: suggestedPrice,
        reason,
        competitorPrices: competitorData,
        margin,
        appliedAt: new Date(),
        ruleId: rule.id,
        status: 'applied',
      };

      // Store in history
      if (!this.priceHistory.has(productId)) {
        this.priceHistory.set(productId, []);
      }
      this.priceHistory.get(productId)!.push(change);

      // TODO: Update product price in database
      console.log(`Price updated for product ${productId}: ${currentPrice} -> ${suggestedPrice}`);

      return change;
    } catch (error) {
      console.error(`Failed to reprice product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Batch repricing for a category
   * Масовий репрайсинг для категорії
   */
  async repriceCategory(categoryId: string): Promise<PriceChange[]> {
    // Get all products in category (mock)
    const productIds = await this.getProductsInCategory(categoryId);

    const changes: PriceChange[] = [];

    for (const productId of productIds) {
      const change = await this.repriceProduct(productId);
      if (change) {
        changes.push(change);
      }
    }

    return changes;
  }

  /**
   * Run scheduled repricing for all applicable products
   * Запустити заплановий репрайсинг для всіх відповідних товарів
   */
  async runScheduledRepricing(): Promise<RepricingReport> {
    const startedAt = new Date();
    const changes: PriceChange[] = [];
    let skipped = 0;
    let errors = 0;

    // Get all products with active repricing rules
    const productsToReprice = await this.getProductsWithActiveRules();

    for (const productId of productsToReprice) {
      try {
        const change = await this.repriceProduct(productId);
        if (change) {
          changes.push(change);
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`Error repricing product ${productId}:`, error);
      }
    }

    const completedAt = new Date();
    const avgPriceChange = changes.length > 0
      ? changes.reduce((sum, c) => sum + (c.newPrice - c.oldPrice), 0) / changes.length
      : 0;

    // Estimate revenue impact (simplified)
    const estimatedRevenueImpact = changes.reduce((sum, c) => {
      // Assume 10 sales per day per product
      const dailySales = 10;
      return sum + (c.newPrice - c.oldPrice) * dailySales;
    }, 0);

    return {
      totalProducts: productsToReprice.length,
      repriced: changes.length,
      skipped,
      errors,
      avgPriceChange,
      estimatedRevenueImpact,
      changes,
      startedAt,
      completedAt,
    };
  }

  /**
   * Get price change history for a product
   * Отримати історію змін цін для товару
   */
  getPriceHistory(productId: string, days: number = 30): PriceChange[] {
    const history = this.priceHistory.get(productId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.filter(change => change.appliedAt >= cutoffDate);
  }

  /**
   * Check for price alerts (competitors underpricing us)
   * Перевірити цінові сповіщення (конкуренти продають дешевше)
   */
  async checkPriceAlerts(): Promise<PriceAlert[]> {
    const alerts: PriceAlert[] = [];
    const productsToMonitor = await this.getProductsWithActiveRules();

    for (const productId of productsToMonitor) {
      const currentPrice = await this.getCurrentPrice(productId);
      const competitorData = await this.fetchCompetitorPrices(productId);

      for (const competitor of competitorData) {
        if (!competitor.inStock) continue;

        const difference = currentPrice - competitor.price;
        const differencePercent = (difference / currentPrice) * 100;

        // Alert if competitor is more than 5% cheaper
        if (differencePercent > 5) {
          alerts.push({
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId,
            productName: `Product ${productId}`, // TODO: Get actual name
            competitorId: competitor.competitorId,
            competitorName: competitor.competitorName,
            ourPrice: currentPrice,
            competitorPrice: competitor.price,
            difference,
            differencePercent,
            severity: differencePercent > 20 ? 'critical' :
                     differencePercent > 10 ? 'high' : 'medium',
            createdAt: new Date(),
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Start A/B test for different price points
   * Запустити A/B тест для різних цін
   */
  async startPriceTest(productId: string, variants: number[]): Promise<string> {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const test: PriceTestResult = {
      testId,
      productId,
      variants: variants.map(price => ({
        price,
        impressions: 0,
        conversions: 0,
        revenue: 0,
        conversionRate: 0,
      })),
      winner: variants[0],
      confidence: 0,
      startedAt: new Date(),
    };

    this.activeTests.set(testId, test);

    // TODO: Implement actual A/B testing logic
    console.log(`Started price test ${testId} for product ${productId}`);

    return testId;
  }

  /**
   * Get results of a price A/B test
   * Отримати результати цінового A/B тесту
   */
  async getPriceTestResults(testId: string): Promise<PriceTestResult> {
    const test = this.activeTests.get(testId);

    if (!test) {
      throw new Error('Test not found');
    }

    // TODO: Get actual test data from analytics
    // For now, return mock data
    return test;
  }

  // Private helper methods

  private validateRule(rule: RepricingRule): void {
    if (!rule.id) {
      throw new Error('Rule ID is required');
    }

    if (!rule.strategy) {
      throw new Error('Strategy is required');
    }

    if (rule.competitors.length === 0) {
      throw new Error('At least one competitor must be specified');
    }
  }

  private applyConstraints(price: number, constraints: PriceConstraints): number {
    let adjustedPrice = price;

    // Apply min/max price
    if (constraints.minPrice && adjustedPrice < constraints.minPrice) {
      adjustedPrice = constraints.minPrice;
    }
    if (constraints.maxPrice && adjustedPrice > constraints.maxPrice) {
      adjustedPrice = constraints.maxPrice;
    }

    // Apply floor/ceiling
    if (constraints.floorPrice && adjustedPrice < constraints.floorPrice) {
      adjustedPrice = constraints.floorPrice;
    }
    if (constraints.ceilingPrice && adjustedPrice > constraints.ceilingPrice) {
      adjustedPrice = constraints.ceilingPrice;
    }

    // Apply rounding
    if (constraints.roundTo) {
      if (constraints.roundTo === 0.99) {
        adjustedPrice = Math.floor(adjustedPrice) + 0.99;
      } else {
        adjustedPrice = Math.round(adjustedPrice / constraints.roundTo) * constraints.roundTo;
      }
    }

    return adjustedPrice;
  }

  private calculateSmartPrice(competitorData: CompetitorPrice[], targetPosition: number): number {
    // Sort by price
    const sortedPrices = competitorData.map(c => c.price).sort((a, b) => a - b);

    if (targetPosition <= 0) {
      targetPosition = 1;
    }
    if (targetPosition > sortedPrices.length + 1) {
      targetPosition = sortedPrices.length + 1;
    }

    // Calculate price for target position
    if (targetPosition === 1) {
      // Be cheapest
      return sortedPrices[0] - 1;
    } else if (targetPosition > sortedPrices.length) {
      // Be most expensive
      return sortedPrices[sortedPrices.length - 1] + 1;
    } else {
      // Be between positions
      const lowerPrice = sortedPrices[targetPosition - 2];
      const upperPrice = sortedPrices[targetPosition - 1];
      return (lowerPrice + upperPrice) / 2;
    }
  }

  private calculateMaxMarginPrice(lowestCompetitorPrice: number, minMargin: number): number {
    // Try to maximize price while staying competitive
    // Assume we want to be within 10% of lowest competitor
    const maxPrice = lowestCompetitorPrice * 1.1;

    // Ensure minimum margin
    // price = cost / (1 - margin/100)
    // For now, return a price that's competitive
    return maxPrice;
  }

  private async fetchCompetitorPrices(productId: string): Promise<CompetitorPrice[]> {
    // TODO: Implement actual competitor price scraping/API integration
    // For now, return mock data
    return [
      {
        competitorId: 'comp1',
        competitorName: 'Конкурент 1',
        price: 1000 + Math.random() * 200,
        url: 'https://competitor1.com/product',
        lastChecked: new Date(),
        inStock: true,
        position: 1,
      },
      {
        competitorId: 'comp2',
        competitorName: 'Конкурент 2',
        price: 1100 + Math.random() * 200,
        url: 'https://competitor2.com/product',
        lastChecked: new Date(),
        inStock: true,
        position: 2,
      },
      {
        competitorId: 'comp3',
        competitorName: 'Конкурент 3',
        price: 1200 + Math.random() * 200,
        url: 'https://competitor3.com/product',
        lastChecked: new Date(),
        inStock: true,
        position: 3,
      },
    ];
  }

  private async getCurrentPrice(productId: string): Promise<number> {
    // TODO: Get actual price from database
    return 1150;
  }

  private async getProductsInCategory(categoryId: string): Promise<string[]> {
    // TODO: Get actual products from database
    return ['prod1', 'prod2', 'prod3'];
  }

  private async getProductsWithActiveRules(): Promise<string[]> {
    // Get all products that have active repricing rules
    const productIds = new Set<string>();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (rule.productId) {
        productIds.add(rule.productId);
      } else if (rule.categoryId) {
        // Get all products in category
        const products = await this.getProductsInCategory(rule.categoryId);
        products.forEach(p => productIds.add(p));
      }
    }

    return Array.from(productIds);
  }
}

// Singleton instance
export const repricingEngine = new RepricingEngine();
