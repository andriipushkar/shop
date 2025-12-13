/**
 * Database Query Optimizer
 * Оптимізація запитів до БД для покращення продуктивності
 */

import { PrismaClient } from '@prisma/client';
import { cache } from '@/lib/cache';

// ============================================
// ТИПИ
// ============================================

export interface QueryOptions {
    select?: Record<string, boolean>;
    include?: Record<string, boolean | object>;
    take?: number;
    skip?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    cacheKey?: string;
    cacheTTL?: number;
}

export interface BatchQueryOptions {
    batchSize?: number;
    concurrency?: number;
}

export interface QueryMetrics {
    queryTime: number;
    rowCount: number;
    cacheHit: boolean;
    queryType: string;
}

// ============================================
// QUERY OPTIMIZER CLASS
// ============================================

export class QueryOptimizer {
    private prisma: PrismaClient;
    private metricsEnabled: boolean;
    private metrics: QueryMetrics[] = [];

    constructor(prisma: PrismaClient, options: { metricsEnabled?: boolean } = {}) {
        this.prisma = prisma;
        this.metricsEnabled = options.metricsEnabled ?? process.env.NODE_ENV === 'development';
    }

    /**
     * Оптимізований запит з кешуванням
     */
    async cachedQuery<T>(
        queryFn: () => Promise<T>,
        cacheKey: string,
        ttl: number = 300
    ): Promise<T> {
        const startTime = Date.now();

        // Спробувати отримати з кешу
        const cached = await cache.get(cacheKey);
        if (cached) {
            this.recordMetrics({
                queryTime: Date.now() - startTime,
                rowCount: Array.isArray(cached) ? cached.length : 1,
                cacheHit: true,
                queryType: 'cached',
            });
            return cached as T;
        }

        // Виконати запит
        const result = await queryFn();

        // Зберегти в кеш
        await cache.set(cacheKey, result, ttl);

        this.recordMetrics({
            queryTime: Date.now() - startTime,
            rowCount: Array.isArray(result) ? result.length : 1,
            cacheHit: false,
            queryType: 'database',
        });

        return result;
    }

    /**
     * Пакетний запит для великих обсягів даних
     */
    async batchQuery<T, R>(
        items: T[],
        queryFn: (batch: T[]) => Promise<R[]>,
        options: BatchQueryOptions = {}
    ): Promise<R[]> {
        const { batchSize = 100, concurrency = 3 } = options;
        const results: R[] = [];

        // Розбити на батчі
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }

        // Обробити батчі з обмеженням паралелізму
        for (let i = 0; i < batches.length; i += concurrency) {
            const concurrentBatches = batches.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                concurrentBatches.map(batch => queryFn(batch))
            );
            results.push(...batchResults.flat());
        }

        return results;
    }

    /**
     * Оптимізація SELECT - вибір тільки потрібних полів
     */
    selectFields<T extends object>(
        fields: (keyof T)[]
    ): Record<string, boolean> {
        const select: Record<string, boolean> = {};
        for (const field of fields) {
            select[field as string] = true;
        }
        return select;
    }

    /**
     * Пагінація з cursor-based підходом (швидше для великих таблиць)
     */
    cursorPagination(cursor: string | undefined, take: number): {
        take: number;
        skip?: number;
        cursor?: { id: string };
    } {
        if (cursor) {
            return {
                take,
                skip: 1,
                cursor: { id: cursor },
            };
        }
        return { take };
    }

    /**
     * Offset-based пагінація (простіша, але повільніша для великих offset)
     */
    offsetPagination(page: number, pageSize: number): {
        take: number;
        skip: number;
    } {
        return {
            take: pageSize,
            skip: (page - 1) * pageSize,
        };
    }

    /**
     * Записати метрики
     */
    private recordMetrics(metrics: QueryMetrics): void {
        if (!this.metricsEnabled) return;

        this.metrics.push(metrics);

        // Зберігати тільки останні 1000 метрик
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    }

    /**
     * Отримати статистику запитів
     */
    getQueryStats(): {
        totalQueries: number;
        avgQueryTime: number;
        cacheHitRate: number;
        slowQueries: QueryMetrics[];
    } {
        if (this.metrics.length === 0) {
            return {
                totalQueries: 0,
                avgQueryTime: 0,
                cacheHitRate: 0,
                slowQueries: [],
            };
        }

        const totalQueries = this.metrics.length;
        const totalTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0);
        const cacheHits = this.metrics.filter(m => m.cacheHit).length;
        const slowQueries = this.metrics.filter(m => m.queryTime > 100);

        return {
            totalQueries,
            avgQueryTime: Math.round(totalTime / totalQueries),
            cacheHitRate: Math.round((cacheHits / totalQueries) * 100),
            slowQueries,
        };
    }

    /**
     * Очистити метрики
     */
    clearMetrics(): void {
        this.metrics = [];
    }
}

// ============================================
// ОПТИМІЗОВАНІ ЗАПИТИ ДЛЯ ЧАСТИХ ОПЕРАЦІЙ
// ============================================

/**
 * Оптимізований запит для списку товарів
 */
export const productListSelect = {
    id: true,
    sku: true,
    name: true,
    nameUa: true,
    slug: true,
    price: true,
    compareAtPrice: true,
    status: true,
    images: true,
    isFeatured: true,
    isNew: true,
    category: {
        select: {
            id: true,
            name: true,
            nameUa: true,
            slug: true,
        },
    },
    brand: {
        select: {
            id: true,
            name: true,
        },
    },
    _count: {
        select: {
            reviews: true,
        },
    },
};

/**
 * Оптимізований запит для деталей товару
 */
export const productDetailSelect = {
    ...productListSelect,
    description: true,
    descriptionUa: true,
    specifications: true,
    viewCount: true,
    soldCount: true,
    createdAt: true,
    reviews: {
        take: 5,
        orderBy: {
            createdAt: 'desc' as const,
        },
        select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
    },
};

/**
 * Оптимізований запит для списку замовлень
 */
export const orderListSelect = {
    id: true,
    orderNumber: true,
    status: true,
    paymentStatus: true,
    total: true,
    customerName: true,
    customerEmail: true,
    createdAt: true,
    _count: {
        select: {
            items: true,
        },
    },
};

/**
 * Оптимізований запит для деталей замовлення
 */
export const orderDetailSelect = {
    ...orderListSelect,
    subtotal: true,
    discount: true,
    shippingCost: true,
    customerPhone: true,
    paymentMethod: true,
    shippingMethod: true,
    notes: true,
    items: {
        select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            quantity: true,
            total: true,
            product: {
                select: {
                    id: true,
                    slug: true,
                    images: true,
                },
            },
        },
    },
    history: {
        orderBy: {
            createdAt: 'desc' as const,
        },
        take: 10,
    },
};

// ============================================
// ІНДЕКСИ ДЛЯ PRISMA SCHEMA
// ============================================

/**
 * Рекомендовані індекси для оптимізації
 * Додати в schema.prisma:
 *
 * model Product {
 *   @@index([status, categoryId])
 *   @@index([status, brandId])
 *   @@index([status, price])
 *   @@index([status, createdAt])
 *   @@index([status, soldCount])
 *   @@index([status, isFeatured])
 * }
 *
 * model Order {
 *   @@index([status, createdAt])
 *   @@index([paymentStatus, createdAt])
 *   @@index([customerId, createdAt])
 *   @@index([orderNumber])
 * }
 *
 * model Category {
 *   @@index([isActive, sortOrder])
 *   @@index([parentId, isActive])
 * }
 */

// ============================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ============================================

/**
 * Побудувати фільтр для пошуку (case-insensitive)
 */
export function buildSearchFilter(
    search: string,
    fields: string[]
): object {
    const searchLower = search.toLowerCase();

    return {
        OR: fields.map(field => ({
            [field]: {
                contains: searchLower,
                mode: 'insensitive',
            },
        })),
    };
}

/**
 * Побудувати фільтр для діапазону цін
 */
export function buildPriceFilter(
    minPrice?: number,
    maxPrice?: number
): object | undefined {
    if (!minPrice && !maxPrice) return undefined;

    const filter: { gte?: number; lte?: number } = {};
    if (minPrice) filter.gte = minPrice;
    if (maxPrice) filter.lte = maxPrice;

    return { price: filter };
}

/**
 * Побудувати фільтр для діапазону дат
 */
export function buildDateFilter(
    dateFrom?: Date,
    dateTo?: Date,
    field: string = 'createdAt'
): object | undefined {
    if (!dateFrom && !dateTo) return undefined;

    const filter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) filter.gte = dateFrom;
    if (dateTo) filter.lte = dateTo;

    return { [field]: filter };
}

/**
 * Об'єднати фільтри
 */
export function combineFilters(...filters: (object | undefined)[]): object {
    const validFilters = filters.filter(Boolean) as object[];

    if (validFilters.length === 0) return {};
    if (validFilters.length === 1) return validFilters[0];

    return {
        AND: validFilters,
    };
}

/**
 * Створити ключ кешу на основі параметрів запиту
 */
export function createCacheKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .filter(key => params[key] !== undefined && params[key] !== null)
        .map(key => `${key}:${JSON.stringify(params[key])}`)
        .join('|');

    return `${prefix}:${sortedParams}`;
}

// ============================================
// ЕКСПОРТ SINGLETON
// ============================================

let optimizerInstance: QueryOptimizer | null = null;

export function getQueryOptimizer(prisma: PrismaClient): QueryOptimizer {
    if (!optimizerInstance) {
        optimizerInstance = new QueryOptimizer(prisma);
    }
    return optimizerInstance;
}
