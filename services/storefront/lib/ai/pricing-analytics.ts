/**
 * Pricing Analytics
 * Аналітика для цінових рішень
 */

export interface PriceElasticity {
  productId: string;
  productName: string;
  elasticity: number; // Price elasticity coefficient (typically negative)
  optimalPrice: number;
  currentPrice: number;
  revenueMaximizingPrice: number;
  marginMaximizingPrice: number;
  dataPoints: number;
  confidence: number;
  lastCalculated: Date;
}

export interface CompetitorAnalysis {
  competitorId: string;
  competitorName: string;
  websiteUrl: string;
  avgPriceDifference: number; // vs our prices (%)
  productsMonitored: number;
  productsInStock: number;
  pricingStrategy: string; // Detected strategy
  priceChangeFrequency: number; // Changes per week
  reactionTime: number; // Hours to react to our changes
  lastChecked: Date;
  marketPosition: 'aggressive' | 'competitive' | 'premium';
}

export interface MarketPosition {
  categoryId: string;
  categoryName: string;
  ourPosition: number; // 1 = cheapest
  totalCompetitors: number;
  avgMarketPrice: number;
  ourAvgPrice: number;
  marketShare: number; // Estimated %
  priceIndex: number; // Our price / market avg (< 1 = cheaper)
  competitorPrices: {
    competitorName: string;
    avgPrice: number;
    position: number;
  }[];
  lastUpdated: Date;
}

export interface OptimizationSuggestion {
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  expectedRevenueChange: number;
  expectedMarginChange: number;
  expectedSalesChange: number;
  confidence: number;
  reasoning: string[];
  urgency: 'high' | 'medium' | 'low';
  category: string;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  competitorId: string;
  competitorName: string;
  condition: 'below' | 'above' | 'change';
  threshold: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
  notifyEmail?: string;
  notifyWebhook?: string;
  createdAt: Date;
}

export interface PriceHistory {
  productId: string;
  history: {
    date: Date;
    ourPrice: number;
    competitorPrices: { competitorId: string; price: number }[];
    marketAvg: number;
    ourPosition: number;
  }[];
}

export interface CompetitorPriceMatrix {
  products: {
    productId: string;
    productName: string;
    ourPrice: number;
    competitors: {
      [competitorId: string]: {
        price: number;
        difference: number;
        differencePercent: number;
        inStock: boolean;
      };
    };
    cheapestCompetitor: string;
    ourRanking: number;
  }[];
  lastUpdated: Date;
}

export class PricingAnalyticsService {
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private elasticityCache: Map<string, PriceElasticity> = new Map();

  /**
   * Calculate price elasticity for a product
   * Розрахувати цінову еластичність товару
   */
  async calculateElasticity(productId: string): Promise<PriceElasticity> {
    // Get historical price and sales data
    const priceHistory = await this.getPriceHistory(productId, 90);
    const salesHistory = await this.getSalesHistory(productId, 90);

    if (priceHistory.length < 30 || salesHistory.length < 30) {
      throw new Error('Insufficient data to calculate elasticity');
    }

    // Calculate elasticity using regression
    const elasticity = this.calculatePriceElasticityCoefficient(priceHistory, salesHistory);

    // Get current price
    const currentPrice = await this.getCurrentPrice(productId);

    // Calculate optimal prices for different objectives
    const { revenueMaximizing, marginMaximizing } = this.calculateOptimalPrices(
      elasticity,
      currentPrice,
      await this.getProductCost(productId)
    );

    const result: PriceElasticity = {
      productId,
      productName: await this.getProductName(productId),
      elasticity,
      currentPrice,
      optimalPrice: revenueMaximizing, // Default to revenue maximizing
      revenueMaximizingPrice: revenueMaximizing,
      marginMaximizingPrice: marginMaximizing,
      dataPoints: priceHistory.length,
      confidence: this.calculateConfidence(priceHistory, salesHistory),
      lastCalculated: new Date(),
    };

    // Cache result
    this.elasticityCache.set(productId, result);

    return result;
  }

  /**
   * Analyze competitor pricing strategy
   * Проаналізувати цінову стратегію конкурента
   */
  async analyzeCompetitor(competitorId: string): Promise<CompetitorAnalysis> {
    // Get competitor price history
    const priceHistory = await this.getCompetitorPriceHistory(competitorId, 30);

    // Calculate average price difference
    const avgPriceDifference = this.calculateAvgPriceDifference(competitorId, priceHistory);

    // Count monitored products
    const productsMonitored = await this.getMonitoredProductsCount(competitorId);
    const productsInStock = await this.getInStockProductsCount(competitorId);

    // Detect pricing strategy
    const pricingStrategy = this.detectPricingStrategy(priceHistory);

    // Calculate price change frequency
    const priceChangeFrequency = this.calculatePriceChangeFrequency(priceHistory);

    // Calculate reaction time to our changes
    const reactionTime = await this.calculateReactionTime(competitorId);

    // Determine market position
    let marketPosition: 'aggressive' | 'competitive' | 'premium';
    if (avgPriceDifference < -5) {
      marketPosition = 'aggressive';
    } else if (avgPriceDifference > 5) {
      marketPosition = 'premium';
    } else {
      marketPosition = 'competitive';
    }

    return {
      competitorId,
      competitorName: await this.getCompetitorName(competitorId),
      websiteUrl: await this.getCompetitorWebsite(competitorId),
      avgPriceDifference,
      productsMonitored,
      productsInStock,
      pricingStrategy,
      priceChangeFrequency,
      reactionTime,
      lastChecked: new Date(),
      marketPosition,
    };
  }

  /**
   * Get market position for a category
   * Отримати ринкову позицію для категорії
   */
  async getMarketPosition(categoryId: string): Promise<MarketPosition> {
    // Get all products in category
    const products = await this.getProductsInCategory(categoryId);

    // Get competitor data for these products
    const competitorData = await this.getCompetitorDataForCategory(categoryId);

    // Calculate our average price
    const ourPrices = await Promise.all(products.map(p => this.getCurrentPrice(p)));
    const ourAvgPrice = ourPrices.reduce((a, b) => a + b, 0) / ourPrices.length;

    // Calculate market average
    const allPrices = [...ourPrices];
    competitorData.forEach(comp => {
      comp.prices.forEach(p => allPrices.push(p));
    });
    const avgMarketPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

    // Calculate our position
    const sortedPrices = [...new Set(allPrices)].sort((a, b) => a - b);
    const ourPosition = sortedPrices.findIndex(p => p >= ourAvgPrice) + 1;

    // Calculate market share (simplified estimate based on price competitiveness)
    const totalCompetitors = competitorData.length;
    const priceIndex = ourAvgPrice / avgMarketPrice;
    const estimatedShare = Math.max(0, Math.min(100, 100 / (totalCompetitors + 1) * (2 - priceIndex)));

    // Get competitor prices summary
    const competitorPrices = competitorData.map((comp, index) => ({
      competitorName: comp.name,
      avgPrice: comp.prices.reduce((a, b) => a + b, 0) / comp.prices.length,
      position: index + 1,
    }));

    return {
      categoryId,
      categoryName: await this.getCategoryName(categoryId),
      ourPosition,
      totalCompetitors,
      avgMarketPrice,
      ourAvgPrice,
      marketShare: estimatedShare,
      priceIndex,
      competitorPrices,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get price optimization suggestions
   * Отримати рекомендації з оптимізації цін
   */
  async getOptimizationSuggestions(filters?: {
    categoryId?: string;
    minImpact?: number;
    urgency?: string;
  }): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Get products to analyze
    let products: string[];
    if (filters?.categoryId) {
      products = await this.getProductsInCategory(filters.categoryId);
    } else {
      products = await this.getAllProducts();
    }

    for (const productId of products) {
      try {
        const suggestion = await this.analyzePricingOpportunity(productId);

        if (suggestion && Math.abs(suggestion.expectedRevenueChange) >= (filters?.minImpact || 0)) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(`Failed to analyze product ${productId}:`, error);
      }
    }

    // Sort by expected revenue impact
    suggestions.sort((a, b) => Math.abs(b.expectedRevenueChange) - Math.abs(a.expectedRevenueChange));

    // Apply urgency filter
    if (filters?.urgency) {
      return suggestions.filter(s => s.urgency === filters.urgency);
    }

    return suggestions;
  }

  /**
   * Setup price alert for monitoring
   * Налаштувати ціновий алерт для моніторингу
   */
  async setupPriceAlert(config: {
    productId: string;
    competitorId: string;
    condition: 'below' | 'above' | 'change';
    threshold: number;
    notifyEmail?: string;
    notifyWebhook?: string;
  }): Promise<void> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const alert: PriceAlert = {
      id: alertId,
      productId: config.productId,
      productName: await this.getProductName(config.productId),
      competitorId: config.competitorId,
      competitorName: await this.getCompetitorName(config.competitorId),
      condition: config.condition,
      threshold: config.threshold,
      currentValue: 0,
      triggered: false,
      notifyEmail: config.notifyEmail,
      notifyWebhook: config.notifyWebhook,
      createdAt: new Date(),
    };

    this.priceAlerts.set(alertId, alert);
    console.log(`Price alert ${alertId} created for product ${config.productId}`);
  }

  /**
   * Check all active price alerts
   * Перевірити всі активні цінові алерти
   */
  async checkPriceAlerts(): Promise<PriceAlert[]> {
    const triggeredAlerts: PriceAlert[] = [];

    for (const alert of this.priceAlerts.values()) {
      if (alert.triggered) continue; // Already triggered

      // Get current competitor price
      const competitorPrice = await this.getCompetitorPrice(
        alert.productId,
        alert.competitorId
      );

      if (!competitorPrice) continue;

      // Get our price
      const ourPrice = await this.getCurrentPrice(alert.productId);

      let shouldTrigger = false;
      let currentValue = 0;

      switch (alert.condition) {
        case 'below':
          currentValue = competitorPrice;
          shouldTrigger = competitorPrice < alert.threshold;
          break;

        case 'above':
          currentValue = competitorPrice;
          shouldTrigger = competitorPrice > alert.threshold;
          break;

        case 'change':
          const priceDiff = Math.abs(competitorPrice - ourPrice);
          currentValue = priceDiff;
          shouldTrigger = priceDiff > alert.threshold;
          break;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        alert.currentValue = currentValue;

        triggeredAlerts.push(alert);

        // Send notifications
        if (alert.notifyEmail) {
          await this.sendEmailNotification(alert);
        }

        if (alert.notifyWebhook) {
          await this.sendWebhookNotification(alert);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Get price comparison matrix across competitors
   * Отримати матрицю порівняння цін між конкурентами
   */
  async getCompetitorPriceMatrix(categoryId?: string): Promise<CompetitorPriceMatrix> {
    // Get products
    const productIds = categoryId
      ? await this.getProductsInCategory(categoryId)
      : await this.getAllProducts();

    const products = await Promise.all(
      productIds.slice(0, 50).map(async (productId) => { // Limit to 50 for performance
        const productName = await this.getProductName(productId);
        const ourPrice = await this.getCurrentPrice(productId);

        // Get competitor prices
        const competitorData = await this.getCompetitorPrices(productId);

        const competitors: {
          [competitorId: string]: {
            price: number;
            difference: number;
            differencePercent: number;
            inStock: boolean;
          };
        } = {};

        let cheapestPrice = ourPrice;
        let cheapestCompetitor = 'us';

        competitorData.forEach(comp => {
          const difference = comp.price - ourPrice;
          const differencePercent = (difference / ourPrice) * 100;

          competitors[comp.competitorId] = {
            price: comp.price,
            difference,
            differencePercent,
            inStock: comp.inStock,
          };

          if (comp.price < cheapestPrice && comp.inStock) {
            cheapestPrice = comp.price;
            cheapestCompetitor = comp.competitorId;
          }
        });

        // Calculate our ranking
        const allPrices = [ourPrice, ...competitorData.filter(c => c.inStock).map(c => c.price)];
        allPrices.sort((a, b) => a - b);
        const ourRanking = allPrices.indexOf(ourPrice) + 1;

        return {
          productId,
          productName,
          ourPrice,
          competitors,
          cheapestCompetitor,
          ourRanking,
        };
      })
    );

    return {
      products,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get detailed price history for a product
   * Отримати детальну історію цін для товару
   */
  async getDetailedPriceHistory(productId: string, days: number = 30): Promise<PriceHistory> {
    const history: PriceHistory['history'] = [];
    const competitors = await this.getCompetitors();

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const ourPrice = await this.getPriceAtDate(productId, date);
      const competitorPrices: { competitorId: string; price: number }[] = [];

      for (const compId of competitors) {
        const price = await this.getCompetitorPriceAtDate(productId, compId, date);
        if (price) {
          competitorPrices.push({ competitorId: compId, price });
        }
      }

      const allPrices = [ourPrice, ...competitorPrices.map(c => c.price)];
      const marketAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      const sortedPrices = [...allPrices].sort((a, b) => a - b);
      const ourPosition = sortedPrices.indexOf(ourPrice) + 1;

      history.push({
        date,
        ourPrice,
        competitorPrices,
        marketAvg,
        ourPosition,
      });
    }

    return {
      productId,
      history,
    };
  }

  // Private helper methods

  private calculatePriceElasticityCoefficient(
    priceHistory: { date: Date; price: number }[],
    salesHistory: { date: Date; quantity: number }[]
  ): number {
    // Merge price and sales data by date
    const merged = priceHistory.map(p => {
      const sales = salesHistory.find(s => s.date.getTime() === p.date.getTime());
      return {
        price: p.price,
        quantity: sales?.quantity || 0,
      };
    }).filter(d => d.quantity > 0);

    if (merged.length < 10) {
      throw new Error('Insufficient paired data');
    }

    // Calculate log-log regression for elasticity
    // ln(Q) = a + b * ln(P)
    // b is the elasticity coefficient

    const lnPrices = merged.map(d => Math.log(d.price));
    const lnQuantities = merged.map(d => Math.log(d.quantity));

    const n = merged.length;
    const sumLnP = lnPrices.reduce((a, b) => a + b, 0);
    const sumLnQ = lnQuantities.reduce((a, b) => a + b, 0);
    const sumLnPLnQ = lnPrices.reduce((sum, lnP, i) => sum + lnP * lnQuantities[i], 0);
    const sumLnPSquared = lnPrices.reduce((sum, lnP) => sum + lnP * lnP, 0);

    const elasticity = (n * sumLnPLnQ - sumLnP * sumLnQ) / (n * sumLnPSquared - sumLnP * sumLnP);

    return elasticity;
  }

  private calculateOptimalPrices(
    elasticity: number,
    currentPrice: number,
    cost: number
  ): {
    revenueMaximizing: number;
    marginMaximizing: number;
  } {
    // Revenue maximizing price: P* = -1/elasticity * MC (simplified)
    // For typical demand curve: P* = MC / (1 + 1/elasticity)

    let revenueMaximizing: number;
    if (elasticity < -1) {
      // Elastic demand
      revenueMaximizing = cost / (1 + 1 / elasticity);
    } else {
      // Inelastic or unit elastic - use current price with small adjustment
      revenueMaximizing = currentPrice * 1.05;
    }

    // Margin maximizing is typically higher
    const marginMaximizing = revenueMaximizing * 1.1;

    // Ensure prices are above cost
    revenueMaximizing = Math.max(revenueMaximizing, cost * 1.2);
    marginMaximizing = Math.max(marginMaximizing, cost * 1.3);

    return {
      revenueMaximizing: Math.round(revenueMaximizing * 100) / 100,
      marginMaximizing: Math.round(marginMaximizing * 100) / 100,
    };
  }

  private calculateConfidence(
    priceHistory: { date: Date; price: number }[],
    salesHistory: { date: Date; quantity: number }[]
  ): number {
    // Base confidence on data quantity and variance
    const dataPoints = Math.min(priceHistory.length, salesHistory.length);
    let confidence = Math.min(100, (dataPoints / 60) * 100);

    // Reduce confidence if high variance in sales
    const avgSales = salesHistory.reduce((sum, s) => sum + s.quantity, 0) / salesHistory.length;
    const variance = salesHistory.reduce((sum, s) => sum + Math.pow(s.quantity - avgSales, 2), 0) / salesHistory.length;
    const cv = Math.sqrt(variance) / avgSales;

    confidence *= (1 - Math.min(0.5, cv));

    return Math.round(confidence);
  }

  private calculateAvgPriceDifference(
    competitorId: string,
    priceHistory: { productId: string; ourPrice: number; theirPrice: number }[]
  ): number {
    if (priceHistory.length === 0) return 0;

    const differences = priceHistory.map(p => ((p.theirPrice - p.ourPrice) / p.ourPrice) * 100);
    return differences.reduce((a, b) => a + b, 0) / differences.length;
  }

  private detectPricingStrategy(
    priceHistory: { productId: string; ourPrice: number; theirPrice: number; date: Date }[]
  ): string {
    if (priceHistory.length < 10) {
      return 'Недостатньо даних';
    }

    // Analyze price positioning
    const avgDifference = this.calculateAvgPriceDifference('', priceHistory);

    // Analyze price change patterns
    const changes = priceHistory.slice(1).map((p, i) => p.theirPrice - priceHistory[i].theirPrice);
    const priceChanges = changes.filter(c => Math.abs(c) > 1).length;
    const changeRatio = priceChanges / priceHistory.length;

    if (avgDifference < -10 && changeRatio > 0.3) {
      return 'Агресивний репрайсинг';
    } else if (avgDifference < -5) {
      return 'Стратегія низьких цін';
    } else if (avgDifference > 10) {
      return 'Преміум позиціонування';
    } else if (changeRatio > 0.2) {
      return 'Динамічне ціноутворення';
    } else if (Math.abs(avgDifference) < 2) {
      return 'Стратегія відповідності цін';
    } else {
      return 'Стандартне ціноутворення';
    }
  }

  private calculatePriceChangeFrequency(
    priceHistory: { productId: string; theirPrice: number; date: Date }[]
  ): number {
    if (priceHistory.length < 7) return 0;

    // Group by product and count changes
    const byProduct = new Map<string, { price: number; date: Date }[]>();

    priceHistory.forEach(p => {
      if (!byProduct.has(p.productId)) {
        byProduct.set(p.productId, []);
      }
      byProduct.get(p.productId)!.push({ price: p.theirPrice, date: p.date });
    });

    let totalChanges = 0;
    let totalWeeks = 0;

    byProduct.forEach(history => {
      history.sort((a, b) => a.date.getTime() - b.date.getTime());

      let changes = 0;
      for (let i = 1; i < history.length; i++) {
        if (Math.abs(history[i].price - history[i - 1].price) > 1) {
          changes++;
        }
      }

      const days = (history[history.length - 1].date.getTime() - history[0].date.getTime()) / (1000 * 60 * 60 * 24);
      const weeks = days / 7;

      totalChanges += changes;
      totalWeeks += weeks;
    });

    return totalWeeks > 0 ? totalChanges / totalWeeks : 0;
  }

  private async calculateReactionTime(competitorId: string): Promise<number> {
    // TODO: Implement actual reaction time calculation
    // This would require tracking our price changes and when competitor responded
    return 24 + Math.random() * 48; // Mock: 24-72 hours
  }

  private async analyzePricingOpportunity(productId: string): Promise<OptimizationSuggestion | null> {
    const currentPrice = await this.getCurrentPrice(productId);
    const cost = await this.getProductCost(productId);
    const competitorPrices = await this.getCompetitorPrices(productId);

    if (competitorPrices.length === 0) {
      return null; // Can't optimize without competitor data
    }

    const reasoning: string[] = [];
    let suggestedPrice = currentPrice;
    let urgency: 'high' | 'medium' | 'low' = 'low';

    // Find lowest competitor price
    const lowestCompetitor = competitorPrices
      .filter(c => c.inStock)
      .sort((a, b) => a.price - b.price)[0];

    if (lowestCompetitor) {
      const priceDiff = currentPrice - lowestCompetitor.price;
      const priceDiffPercent = (priceDiff / currentPrice) * 100;

      // If we're significantly more expensive
      if (priceDiffPercent > 10) {
        suggestedPrice = lowestCompetitor.price + 1; // Beat by 1 UAH
        reasoning.push(`Конкурент продає на ${priceDiffPercent.toFixed(1)}% дешевше`);
        reasoning.push('Рекомендується зниження ціни для конкурентоспроможності');
        urgency = priceDiffPercent > 20 ? 'high' : 'medium';
      }

      // If we're cheapest
      else if (priceDiffPercent < -5) {
        suggestedPrice = lowestCompetitor.price - 5; // Stay competitive but increase margin
        reasoning.push('Ми найдешевші на ринку');
        reasoning.push('Можна підвищити ціну без втрати конкурентності');
        urgency = 'low';
      }
    }

    // Check if suggested price maintains minimum margin
    const minMargin = 20; // 20% minimum
    const minPrice = cost * (1 + minMargin / 100);

    if (suggestedPrice < minPrice) {
      suggestedPrice = minPrice;
      reasoning.push(`Скориговано до мінімальної маржі ${minMargin}%`);
    }

    // Don't suggest if change is too small
    if (Math.abs(suggestedPrice - currentPrice) < 5) {
      return null;
    }

    // Estimate impact
    const elasticity = this.elasticityCache.get(productId)?.elasticity || -1.5;
    const priceChangePercent = ((suggestedPrice - currentPrice) / currentPrice) * 100;
    const salesChangePercent = elasticity * priceChangePercent;

    const avgMonthlySales = 30; // Mock
    const expectedSalesChange = (avgMonthlySales * salesChangePercent) / 100;
    const expectedRevenueChange = (suggestedPrice * (avgMonthlySales + expectedSalesChange)) -
                                   (currentPrice * avgMonthlySales);

    const currentMargin = ((currentPrice - cost) / currentPrice) * 100;
    const newMargin = ((suggestedPrice - cost) / suggestedPrice) * 100;
    const expectedMarginChange = newMargin - currentMargin;

    return {
      productId,
      productName: await this.getProductName(productId),
      currentPrice,
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      priceChange: suggestedPrice - currentPrice,
      priceChangePercent,
      expectedRevenueChange,
      expectedMarginChange,
      expectedSalesChange,
      confidence: 70,
      reasoning,
      urgency,
      category: await this.getProductCategory(productId),
    };
  }

  private async sendEmailNotification(alert: PriceAlert): Promise<void> {
    console.log(`Sending email notification for alert ${alert.id} to ${alert.notifyEmail}`);
    // TODO: Implement actual email sending
  }

  private async sendWebhookNotification(alert: PriceAlert): Promise<void> {
    console.log(`Sending webhook notification for alert ${alert.id} to ${alert.notifyWebhook}`);
    // TODO: Implement actual webhook call
  }

  // Mock data methods (replace with actual database queries)

  private async getCurrentPrice(productId: string): Promise<number> {
    return 1000 + Math.random() * 500;
  }

  private async getProductCost(productId: string): Promise<number> {
    return 600 + Math.random() * 300;
  }

  private async getProductName(productId: string): Promise<string> {
    return `Товар ${productId}`;
  }

  private async getProductCategory(productId: string): Promise<string> {
    return 'Електроніка';
  }

  private async getCategoryName(categoryId: string): Promise<string> {
    return `Категорія ${categoryId}`;
  }

  private async getCompetitorName(competitorId: string): Promise<string> {
    const names = ['Rozetka', 'Foxtrot', 'Citrus', 'Comfy', 'Eldorado'];
    return names[Math.floor(Math.random() * names.length)];
  }

  private async getCompetitorWebsite(competitorId: string): Promise<string> {
    return `https://competitor-${competitorId}.com`;
  }

  private async getPriceHistory(productId: string, days: number): Promise<{ date: Date; price: number }[]> {
    const history: { date: Date; price: number }[] = [];
    const basePrice = 1000;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      history.push({
        date,
        price: basePrice + (Math.random() - 0.5) * 100,
      });
    }

    return history;
  }

  private async getSalesHistory(productId: string, days: number): Promise<{ date: Date; quantity: number }[]> {
    const history: { date: Date; quantity: number }[] = [];
    const baseQuantity = 10;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      history.push({
        date,
        quantity: Math.round(baseQuantity + (Math.random() - 0.5) * 8),
      });
    }

    return history;
  }

  private async getCompetitorPriceHistory(
    competitorId: string,
    days: number
  ): Promise<{ productId: string; ourPrice: number; theirPrice: number; date: Date }[]> {
    const history: { productId: string; ourPrice: number; theirPrice: number; date: Date }[] = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      history.push({
        productId: 'prod1',
        ourPrice: 1000,
        theirPrice: 950 + (Math.random() - 0.5) * 100,
        date,
      });
    }

    return history;
  }

  private async getMonitoredProductsCount(competitorId: string): Promise<number> {
    return 150 + Math.floor(Math.random() * 100);
  }

  private async getInStockProductsCount(competitorId: string): Promise<number> {
    return 120 + Math.floor(Math.random() * 80);
  }

  private async getProductsInCategory(categoryId: string): Promise<string[]> {
    return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'];
  }

  private async getAllProducts(): Promise<string[]> {
    return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5', 'prod6', 'prod7', 'prod8'];
  }

  private async getCompetitorDataForCategory(categoryId: string): Promise<{
    name: string;
    prices: number[];
  }[]> {
    return [
      { name: 'Rozetka', prices: [1000, 1100, 1200, 950, 1050] },
      { name: 'Foxtrot', prices: [1050, 1150, 1250, 1000, 1100] },
      { name: 'Citrus', prices: [980, 1080, 1180, 930, 1030] },
    ];
  }

  private async getCompetitorPrices(productId: string): Promise<{
    competitorId: string;
    competitorName: string;
    price: number;
    inStock: boolean;
  }[]> {
    return [
      { competitorId: 'comp1', competitorName: 'Rozetka', price: 1050, inStock: true },
      { competitorId: 'comp2', competitorName: 'Foxtrot', price: 1100, inStock: true },
      { competitorId: 'comp3', competitorName: 'Citrus', price: 980, inStock: true },
    ];
  }

  private async getCompetitorPrice(productId: string, competitorId: string): Promise<number | null> {
    return 1000 + Math.random() * 200;
  }

  private async getCompetitors(): Promise<string[]> {
    return ['comp1', 'comp2', 'comp3'];
  }

  private async getPriceAtDate(productId: string, date: Date): Promise<number> {
    return 1000 + (Math.random() - 0.5) * 100;
  }

  private async getCompetitorPriceAtDate(
    productId: string,
    competitorId: string,
    date: Date
  ): Promise<number | null> {
    return 1000 + (Math.random() - 0.5) * 150;
  }
}

// Singleton instance
export const pricingAnalyticsService = new PricingAnalyticsService();
