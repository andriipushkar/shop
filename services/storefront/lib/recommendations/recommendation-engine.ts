/**
 * Product Recommendation Engine
 * Система рекомендацій товарів
 *
 * Підтримує:
 * - Collaborative filtering (користувачі які купили X також купили Y)
 * - Content-based filtering (схожі товари за атрибутами)
 * - Hybrid approach (комбінований підхід)
 * - Trending products (популярні товари)
 * - Personalized recommendations (персоналізовані рекомендації)
 */

import { prisma } from '@/lib/db/prisma';
import { cache, DEFAULT_TTL } from '@/lib/cache';
import {
  findMostSimilar,
  hybridProductSimilarity,
  jaccardSimilarity,
  type ProductVector,
  type SimilarityScore,
} from './similarity';

export interface RecommendationOptions {
  limit?: number;
  minScore?: number;
  excludeIds?: string[];
  includeReasons?: boolean;
  diversify?: boolean;
}

export interface Recommendation {
  productId: string;
  score: number;
  reasons?: string[];
  type: 'collaborative' | 'content' | 'hybrid' | 'trending' | 'history';
}

export interface TrendingProduct {
  productId: string;
  score: number;
  views: number;
  sales: number;
  trend: 'rising' | 'steady' | 'falling';
}

export interface UserBehavior {
  userId: string;
  viewedProducts: string[];
  purchasedProducts: string[];
  cartProducts: string[];
  wishlistProducts: string[];
}

/**
 * Клас для управління рекомендаціями
 */
export class RecommendationEngine {
  /**
   * Отримати схожі товари на основі контенту (Content-Based Filtering)
   */
  async getSimilarProducts(
    productId: string,
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 10, minScore = 0.3, excludeIds = [], includeReasons = true } = options;

    // Перевіряємо кеш
    const cacheKey = `recommendations:similar:${productId}:${limit}`;
    const cached = await cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return this.filterExcluded(cached, excludeIds).slice(0, limit);
    }

    // Отримуємо цільовий продукт
    const targetProduct = await this.getProductVector(productId);
    if (!targetProduct) {
      return [];
    }

    // Отримуємо кандидатів із тієї ж категорії та суміжних
    const candidates = await this.getCandidateProducts(targetProduct.categoryId, excludeIds);

    // Обчислюємо схожість
    const similarityScores = findMostSimilar(
      targetProduct,
      candidates,
      limit * 2, // Беремо більше для різноманітності
      minScore
    );

    const recommendations: Recommendation[] = similarityScores.map(score => ({
      productId: score.productId,
      score: score.score,
      reasons: includeReasons ? score.reasons : undefined,
      type: 'content' as const,
    }));

    // Кешуємо результат
    await cache.set(cacheKey, recommendations, DEFAULT_TTL.long);

    return recommendations.slice(0, limit);
  }

  /**
   * Collaborative Filtering - товари які купували разом
   */
  async getFrequentlyBoughtTogether(
    productId: string,
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 5, excludeIds = [] } = options;

    const cacheKey = `recommendations:bought-together:${productId}:${limit}`;
    const cached = await cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return this.filterExcluded(cached, excludeIds).slice(0, limit);
    }

    // Знаходимо замовлення які містять цей продукт
    const orders = await prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          status: {
            in: ['COMPLETED', 'DELIVERED'],
          },
        },
      },
      select: {
        orderId: true,
      },
      take: 1000, // Обмежуємо для продуктивності
    });

    const orderIds = orders.map(o => o.orderId);

    if (orderIds.length === 0) {
      return [];
    }

    // Знаходимо інші товари з тих самих замовлень
    const coProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        orderId: {
          in: orderIds,
        },
        productId: {
          not: productId,
          notIn: excludeIds,
        },
      },
      _count: {
        productId: true,
      },
      orderBy: {
        _count: {
          productId: 'desc',
        },
      },
      take: limit * 2,
    });

    // Обчислюємо оцінку на основі частоти
    const totalOrders = orderIds.length;
    const recommendations: Recommendation[] = coProducts.map(item => ({
      productId: item.productId,
      score: item._count.productId / totalOrders,
      reasons: [
        `Купували разом у ${item._count.productId} замовленнях`,
        `${Math.round((item._count.productId / totalOrders) * 100)}% покупців обрали обидва товари`,
      ],
      type: 'collaborative' as const,
    }));

    await cache.set(cacheKey, recommendations, DEFAULT_TTL.medium);

    return recommendations.slice(0, limit);
  }

  /**
   * Гібридні рекомендації (комбінуємо content-based і collaborative)
   */
  async getHybridRecommendations(
    productId: string,
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 10, excludeIds = [] } = options;

    const cacheKey = `recommendations:hybrid:${productId}:${limit}`;
    const cached = await cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return this.filterExcluded(cached, excludeIds).slice(0, limit);
    }

    // Отримуємо обидва типи рекомендацій
    const [contentBased, collaborative] = await Promise.all([
      this.getSimilarProducts(productId, { limit: limit * 2, excludeIds }),
      this.getFrequentlyBoughtTogether(productId, { limit: limit * 2, excludeIds }),
    ]);

    // Комбінуємо з вагами
    const combinedMap = new Map<string, Recommendation>();

    // Content-based з вагою 0.6
    for (const rec of contentBased) {
      combinedMap.set(rec.productId, {
        ...rec,
        score: rec.score * 0.6,
        type: 'hybrid' as const,
      });
    }

    // Collaborative з вагою 0.4 (додаємо або підсилюємо)
    for (const rec of collaborative) {
      const existing = combinedMap.get(rec.productId);
      if (existing) {
        existing.score += rec.score * 0.4;
        if (existing.reasons && rec.reasons) {
          existing.reasons.push(...rec.reasons);
        }
      } else {
        combinedMap.set(rec.productId, {
          ...rec,
          score: rec.score * 0.4,
          type: 'hybrid' as const,
        });
      }
    }

    const recommendations = Array.from(combinedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    await cache.set(cacheKey, recommendations, DEFAULT_TTL.medium);

    return recommendations;
  }

  /**
   * Персоналізовані рекомендації на основі історії користувача
   */
  async getPersonalizedRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 20, excludeIds = [] } = options;

    const cacheKey = `recommendations:personalized:${userId}:${limit}`;
    const cached = await cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return this.filterExcluded(cached, excludeIds).slice(0, limit);
    }

    // Отримуємо поведінку користувача
    const behavior = await this.getUserBehavior(userId);

    if (behavior.purchasedProducts.length === 0 && behavior.viewedProducts.length === 0) {
      // Якщо немає історії - повертаємо популярні товари
      return this.getTrendingProducts({ limit, excludeIds });
    }

    // Знаходимо схожих користувачів (collaborative filtering)
    const similarUsers = await this.findSimilarUsers(userId, behavior);

    // Отримуємо рекомендації на основі схожості з іншими
    const collaborativeRecs = await this.getCollaborativeRecommendations(
      userId,
      similarUsers,
      excludeIds
    );

    // Отримуємо content-based рекомендації на основі історії
    const contentRecs = await this.getContentBasedFromHistory(behavior, excludeIds);

    // Комбінуємо з вагами
    const combinedMap = new Map<string, Recommendation>();

    // Collaborative (50%)
    for (const rec of collaborativeRecs) {
      combinedMap.set(rec.productId, {
        ...rec,
        score: rec.score * 0.5,
        type: 'hybrid' as const,
      });
    }

    // Content-based (50%)
    for (const rec of contentRecs) {
      const existing = combinedMap.get(rec.productId);
      if (existing) {
        existing.score += rec.score * 0.5;
      } else {
        combinedMap.set(rec.productId, {
          ...rec,
          score: rec.score * 0.5,
          type: 'hybrid' as const,
        });
      }
    }

    const recommendations = Array.from(combinedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    await cache.set(cacheKey, recommendations, DEFAULT_TTL.short);

    return recommendations;
  }

  /**
   * Популярні товари (Trending)
   */
  async getTrendingProducts(
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 20, excludeIds = [] } = options;

    const cacheKey = `recommendations:trending:${limit}`;
    const cached = await cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return this.filterExcluded(cached, excludeIds).slice(0, limit);
    }

    // Обчислюємо trending score на основі останніх 7 днів
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Продажі за останній тиждень
    const recentSales = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: {
            gte: sevenDaysAgo,
          },
          status: {
            in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
          },
        },
        productId: {
          notIn: excludeIds,
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit * 2,
    });

    // Перегляди за останній тиждень (якщо є аналітика)
    const recentViews = await prisma.analyticsEvent.groupBy({
      by: ['data'],
      where: {
        type: 'product_view',
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: true,
    }).catch(() => []);

    const viewsMap = new Map<string, number>();
    for (const view of recentViews) {
      try {
        const data = view.data as any;
        if (data.productId) {
          viewsMap.set(data.productId, view._count);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Комбінуємо оцінки
    const recommendations: Recommendation[] = recentSales.map(item => {
      const sales = item._sum.quantity || 0;
      const views = viewsMap.get(item.productId) || 0;

      // Trending score = (sales * 3 + views) / 4
      const score = (sales * 3 + views / 10) / 4;

      return {
        productId: item.productId,
        score: score / 100, // Normalize
        reasons: [
          `Продано ${sales} шт за тиждень`,
          views > 0 ? `${views} переглядів` : '',
        ].filter(Boolean),
        type: 'trending' as const,
      };
    });

    // Сортуємо за score
    recommendations.sort((a, b) => b.score - a.score);

    await cache.set(cacheKey, recommendations, DEFAULT_TTL.short);

    return recommendations.slice(0, limit);
  }

  /**
   * Рекомендації на основі переглянутого
   */
  async getRecommendationsFromHistory(
    viewedProductIds: string[],
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 10, excludeIds = [] } = options;

    if (viewedProductIds.length === 0) {
      return [];
    }

    const allExcluded = [...excludeIds, ...viewedProductIds];

    // Отримуємо рекомендації для кожного переглянутого товару
    const recommendations = await Promise.all(
      viewedProductIds.slice(0, 5).map(id => // Беремо останні 5
        this.getSimilarProducts(id, { limit: 5, excludeIds: allExcluded })
      )
    );

    // Об'єднуємо та агрегуємо оцінки
    const scoreMap = new Map<string, { score: number; count: number }>();

    for (const recs of recommendations) {
      for (const rec of recs) {
        const existing = scoreMap.get(rec.productId);
        if (existing) {
          existing.score += rec.score;
          existing.count += 1;
        } else {
          scoreMap.set(rec.productId, { score: rec.score, count: 1 });
        }
      }
    }

    // Усереднюємо оцінки
    const result: Recommendation[] = Array.from(scoreMap.entries())
      .map(([productId, { score, count }]) => ({
        productId,
        score: score / count,
        reasons: [`На основі ${count} переглянутих товарів`],
        type: 'history' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return result;
  }

  // ==================== ПРИВАТНІ МЕТОДИ ====================

  /**
   * Отримати вектор продукту для обчислення схожості
   */
  private async getProductVector(productId: string): Promise<ProductVector | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    const attributes: Record<string, string | number> = {};
    for (const attr of product.attributes) {
      attributes[attr.attribute.name] = attr.value;
    }

    return {
      productId: product.id,
      categoryId: product.categoryId,
      brandId: product.brandId || undefined,
      price: Number(product.price),
      attributes,
      tags: [], // TODO: Add tags support
    };
  }

  /**
   * Отримати кандидатів для порівняння
   */
  private async getCandidateProducts(
    categoryId: string,
    excludeIds: string[]
  ): Promise<ProductVector[]> {
    const products = await prisma.product.findMany({
      where: {
        categoryId,
        status: 'ACTIVE',
        id: {
          notIn: excludeIds,
        },
      },
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
      take: 100, // Обмежуємо для продуктивності
    });

    return products.map(product => {
      const attributes: Record<string, string | number> = {};
      for (const attr of product.attributes) {
        attributes[attr.attribute.name] = attr.value;
      }

      return {
        productId: product.id,
        categoryId: product.categoryId,
        brandId: product.brandId || undefined,
        price: Number(product.price),
        attributes,
        tags: [],
      };
    });
  }

  /**
   * Отримати поведінку користувача
   */
  private async getUserBehavior(userId: string): Promise<UserBehavior> {
    const [orders, cart, wishlist] = await Promise.all([
      // Куплені товари
      prisma.orderItem.findMany({
        where: {
          order: {
            userId,
            status: {
              in: ['COMPLETED', 'DELIVERED'],
            },
          },
        },
        select: { productId: true },
        distinct: ['productId'],
      }),
      // Товари в кошику
      prisma.cartItem.findMany({
        where: {
          cart: { userId },
        },
        select: { productId: true },
      }),
      // Wishlist
      prisma.wishlistItem.findMany({
        where: { userId },
        select: { productId: true },
      }),
    ]);

    // TODO: Get viewed products from analytics
    const viewedProducts: string[] = [];

    return {
      userId,
      viewedProducts,
      purchasedProducts: orders.map(o => o.productId),
      cartProducts: cart.map(c => c.productId),
      wishlistProducts: wishlist.map(w => w.productId),
    };
  }

  /**
   * Знайти схожих користувачів
   */
  private async findSimilarUsers(
    userId: string,
    behavior: UserBehavior
  ): Promise<string[]> {
    // Знаходимо користувачів які купили схожі товари
    const similarUserIds = await prisma.orderItem.findMany({
      where: {
        productId: {
          in: behavior.purchasedProducts,
        },
        order: {
          userId: {
            not: userId,
          },
        },
      },
      select: {
        order: {
          select: {
            userId: true,
          },
        },
      },
      distinct: ['orderId'],
      take: 50,
    });

    return [...new Set(similarUserIds.map(item => item.order.userId).filter(Boolean))] as string[];
  }

  /**
   * Collaborative recommendations від схожих користувачів
   */
  private async getCollaborativeRecommendations(
    userId: string,
    similarUserIds: string[],
    excludeIds: string[]
  ): Promise<Recommendation[]> {
    if (similarUserIds.length === 0) {
      return [];
    }

    const products = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          userId: {
            in: similarUserIds,
          },
        },
        productId: {
          notIn: excludeIds,
        },
      },
      _count: {
        productId: true,
      },
      orderBy: {
        _count: {
          productId: 'desc',
        },
      },
      take: 20,
    });

    return products.map(item => ({
      productId: item.productId,
      score: item._count.productId / similarUserIds.length,
      reasons: [`Рекомендовано на основі схожих покупців`],
      type: 'collaborative' as const,
    }));
  }

  /**
   * Content-based recommendations від історії
   */
  private async getContentBasedFromHistory(
    behavior: UserBehavior,
    excludeIds: string[]
  ): Promise<Recommendation[]> {
    const allProducts = [
      ...behavior.purchasedProducts,
      ...behavior.viewedProducts,
      ...behavior.cartProducts,
    ];

    if (allProducts.length === 0) {
      return [];
    }

    const recommendations = await Promise.all(
      allProducts.slice(0, 5).map(id =>
        this.getSimilarProducts(id, { limit: 4, excludeIds })
      )
    );

    const scoreMap = new Map<string, number>();
    for (const recs of recommendations) {
      for (const rec of recs) {
        scoreMap.set(rec.productId, (scoreMap.get(rec.productId) || 0) + rec.score);
      }
    }

    return Array.from(scoreMap.entries())
      .map(([productId, score]) => ({
        productId,
        score: score / recommendations.length,
        type: 'content' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  /**
   * Фільтрувати виключені ID
   */
  private filterExcluded(
    recommendations: Recommendation[],
    excludeIds: string[]
  ): Recommendation[] {
    if (excludeIds.length === 0) {
      return recommendations;
    }

    return recommendations.filter(rec => !excludeIds.includes(rec.productId));
  }
}

// Експортуємо singleton
export const recommendationEngine = new RecommendationEngine();
