// Redis Cache Service
// Server-side caching layer with Redis
// Enhanced with cache warming, advanced invalidation, and performance monitoring

export interface CacheConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    defaultTTL?: number;
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
    PRODUCTS: 5 * 60,        // 5 minutes
    PRODUCT_LIST: 2 * 60,    // 2 minutes
    CATEGORIES: 60 * 60,     // 1 hour
    CART: 24 * 60 * 60,      // 24 hours
    SESSION: 7 * 24 * 60 * 60, // 7 days
    USER_PROFILE: 15 * 60,   // 15 minutes
    SEARCH: 10 * 60,         // 10 minutes
    HOT_DEALS: 5 * 60,       // 5 minutes
    ANALYTICS: 30 * 60,      // 30 minutes
} as const;

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    tags?: string[];
    compress?: boolean;
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    keys: number;
    memory: string;
    uptime: number;
}

export interface CachedItem<T> {
    value: T;
    createdAt: string;
    expiresAt?: string;
    tags?: string[];
}

// Memory cache fallback for when Redis is not available
class MemoryCache {
    private cache: Map<string, { value: unknown; expiresAt?: number; tags?: string[] }> = new Map();
    private hits = 0;
    private misses = 0;

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) {
            this.misses++;
            return null;
        }

        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        this.hits++;
        return item.value as T;
    }

    async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
        const expiresAt = options?.ttl ? Date.now() + options.ttl * 1000 : undefined;
        this.cache.set(key, { value, expiresAt, tags: options?.tags });
    }

    async delete(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async deleteByPattern(pattern: string): Promise<number> {
        const regex = new RegExp(pattern.replace('*', '.*'));
        let deleted = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }

        return deleted;
    }

    async deleteByTag(tag: string): Promise<number> {
        let deleted = 0;

        for (const [key, item] of this.cache.entries()) {
            if (item.tags?.includes(tag)) {
                this.cache.delete(key);
                deleted++;
            }
        }

        return deleted;
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    async getStats(): Promise<CacheStats> {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
            keys: this.cache.size,
            memory: `${Math.round((JSON.stringify([...this.cache.values()]).length / 1024))} KB`,
            uptime: 0,
        };
    }

    async has(key: string): Promise<boolean> {
        const item = this.cache.get(key);
        if (!item) return false;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
}

class RedisCacheService {
    private config: CacheConfig;
    private memoryCache: MemoryCache;
    private isConnected = false;
    private readonly defaultTTL = 3600; // 1 hour

    constructor(config?: Partial<CacheConfig>) {
        this.config = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            keyPrefix: 'shop:',
            defaultTTL: 3600,
            ...config,
        };
        this.memoryCache = new MemoryCache();
    }

    // Initialize Redis connection
    async connect(): Promise<boolean> {
        // In a real implementation, you would use ioredis or redis package
        // For now, we simulate with memory cache
        try {
            // const Redis = require('ioredis');
            // this.client = new Redis(this.config);
            this.isConnected = true;
            console.log('Cache service initialized (using memory fallback)');
            return true;
        } catch {
            console.warn('Redis not available, using memory cache');
            this.isConnected = false;
            return false;
        }
    }

    // Get full key with prefix
    private getKey(key: string): string {
        return `${this.config.keyPrefix}${key}`;
    }

    // Get value from cache
    async get<T>(key: string): Promise<T | null> {
        const fullKey = this.getKey(key);
        return this.memoryCache.get<T>(fullKey);
    }

    // Set value in cache
    async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
        const fullKey = this.getKey(key);
        const ttl = options?.ttl ?? this.config.defaultTTL ?? this.defaultTTL;
        await this.memoryCache.set(fullKey, value, { ...options, ttl });
    }

    // Get or set - returns cached value or computes and caches new value
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        options?: CacheOptions
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        await this.set(key, value, options);
        return value;
    }

    // Delete from cache
    async delete(key: string): Promise<boolean> {
        const fullKey = this.getKey(key);
        return this.memoryCache.delete(fullKey);
    }

    // Delete by pattern (e.g., "products:*")
    async deleteByPattern(pattern: string): Promise<number> {
        const fullPattern = this.getKey(pattern);
        return this.memoryCache.deleteByPattern(fullPattern);
    }

    // Delete by tag
    async deleteByTag(tag: string): Promise<number> {
        return this.memoryCache.deleteByTag(tag);
    }

    // Check if key exists
    async has(key: string): Promise<boolean> {
        const fullKey = this.getKey(key);
        return this.memoryCache.has(fullKey);
    }

    // Clear all cache
    async clear(): Promise<void> {
        await this.memoryCache.clear();
    }

    // Get cache statistics
    async getStats(): Promise<CacheStats> {
        return this.memoryCache.getStats();
    }

    // Cache decorators for common use cases

    // Cache products (5 min TTL as requested)
    async cacheProduct<T>(productId: string, factory: () => Promise<T>): Promise<T> {
        return this.getOrSet(`products:${productId}`, factory, {
            ttl: CACHE_TTL.PRODUCTS, // 5 minutes
            tags: ['products'],
        });
    }

    // Cache product list
    async cacheProductList<T>(
        key: string,
        factory: () => Promise<T>,
        ttl = 300
    ): Promise<T> {
        return this.getOrSet(`products:list:${key}`, factory, {
            ttl,
            tags: ['products', 'product-lists'],
        });
    }

    // Cache category (1 hour TTL as requested)
    async cacheCategory<T>(categoryId: string, factory: () => Promise<T>): Promise<T> {
        return this.getOrSet(`categories:${categoryId}`, factory, {
            ttl: CACHE_TTL.CATEGORIES, // 1 hour
            tags: ['categories'],
        });
    }

    // Cache user session (7 days TTL as requested)
    async cacheUserSession<T>(userId: string, factory: () => Promise<T>): Promise<T> {
        return this.getOrSet(`sessions:${userId}`, factory, {
            ttl: CACHE_TTL.SESSION, // 7 days
            tags: ['sessions'],
        });
    }

    // Cache search results
    async cacheSearchResults<T>(query: string, filters: Record<string, unknown>, factory: () => Promise<T>): Promise<T> {
        const key = `search:${this.hashObject({ query, filters })}`;
        return this.getOrSet(key, factory, {
            ttl: 300, // 5 minutes
            tags: ['search'],
        });
    }

    // Cache cart
    async cacheCart<T>(cartId: string, factory: () => Promise<T>): Promise<T> {
        return this.getOrSet(`carts:${cartId}`, factory, {
            ttl: 86400, // 24 hours
            tags: ['carts'],
        });
    }

    // Cache homepage data
    async cacheHomepage<T>(factory: () => Promise<T>): Promise<T> {
        return this.getOrSet('pages:homepage', factory, {
            ttl: 600, // 10 minutes
            tags: ['pages', 'homepage'],
        });
    }

    // Cache CMS page
    async cacheCMSPage<T>(slug: string, factory: () => Promise<T>): Promise<T> {
        return this.getOrSet(`cms:pages:${slug}`, factory, {
            ttl: 1800, // 30 minutes
            tags: ['cms', 'pages'],
        });
    }

    // Invalidation helpers

    // Invalidate product cache
    async invalidateProduct(productId: string): Promise<void> {
        await this.delete(`products:${productId}`);
        await this.deleteByPattern('products:list:*');
    }

    // Invalidate all products
    async invalidateAllProducts(): Promise<void> {
        await this.deleteByTag('products');
    }

    // Invalidate category
    async invalidateCategory(categoryId: string): Promise<void> {
        await this.delete(`categories:${categoryId}`);
        await this.deleteByPattern('products:list:*');
    }

    // Invalidate search cache
    async invalidateSearch(): Promise<void> {
        await this.deleteByTag('search');
    }

    // Invalidate user session
    async invalidateUserSession(userId: string): Promise<void> {
        await this.delete(`sessions:${userId}`);
    }

    // Invalidate cart
    async invalidateCart(cartId: string): Promise<void> {
        await this.delete(`carts:${cartId}`);
    }

    // Invalidate CMS
    async invalidateCMS(slug?: string): Promise<void> {
        if (slug) {
            await this.delete(`cms:pages:${slug}`);
        } else {
            await this.deleteByTag('cms');
        }
    }

    // Rate limiting
    async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetAt: number;
    }> {
        const fullKey = this.getKey(`ratelimit:${key}`);
        const current = await this.get<{ count: number; resetAt: number }>(fullKey);

        const now = Date.now();
        const resetAt = now + windowSeconds * 1000;

        if (!current || current.resetAt < now) {
            await this.set(fullKey, { count: 1, resetAt }, { ttl: windowSeconds });
            return { allowed: true, remaining: limit - 1, resetAt };
        }

        if (current.count >= limit) {
            return { allowed: false, remaining: 0, resetAt: current.resetAt };
        }

        current.count++;
        await this.set(fullKey, current, { ttl: Math.ceil((current.resetAt - now) / 1000) });

        return {
            allowed: true,
            remaining: limit - current.count,
            resetAt: current.resetAt,
        };
    }

    // Distributed locking
    async acquireLock(resource: string, ttlSeconds = 30): Promise<string | null> {
        const lockKey = this.getKey(`locks:${resource}`);
        const lockId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        const exists = await this.has(lockKey);
        if (exists) {
            return null;
        }

        await this.set(lockKey, lockId, { ttl: ttlSeconds });
        return lockId;
    }

    async releaseLock(resource: string, lockId: string): Promise<boolean> {
        const lockKey = this.getKey(`locks:${resource}`);
        const currentLockId = await this.get<string>(lockKey);

        if (currentLockId === lockId) {
            await this.delete(lockKey);
            return true;
        }

        return false;
    }

    // Helper to hash objects for cache keys
    private hashObject(obj: Record<string, unknown>): string {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Cache warming utilities
    async warmPopularProducts<T>(fetchFn: () => Promise<T[]>): Promise<void> {
        const products = await fetchFn();
        const promises = (products as any[]).map((product) =>
            this.cacheProduct(product.id, () => Promise.resolve(product))
        );
        await Promise.all(promises);
        console.log(`Warmed cache for ${products.length} popular products`);
    }

    async warmCategories<T>(fetchFn: () => Promise<T[]>): Promise<void> {
        const categories = await fetchFn();
        const promises = (categories as any[]).map((category) =>
            this.cacheCategory(category.id, () => Promise.resolve(category))
        );
        await Promise.all(promises);
        console.log(`Warmed cache for ${categories.length} categories`);
    }

    async warmHotDeals<T>(fetchFn: () => Promise<T[]>): Promise<void> {
        const deals = await fetchFn();
        await this.set('hot-deals', deals, {
            ttl: CACHE_TTL.HOT_DEALS,
            tags: ['products', 'hot-deals'],
        });
        console.log(`Warmed cache for ${deals.length} hot deals`);
    }
}

// Singleton instance
export const redisCache = new RedisCacheService();

// Initialize on import
if (typeof window === 'undefined') {
    redisCache.connect().catch(console.error);
}

// React hook (client-side doesn't directly use Redis)
export function useCache() {
    return redisCache;
}

// Cache middleware for API routes
export function withCache(options: CacheOptions = {}) {
    return async function cacheMiddleware(
        handler: (req: Request) => Promise<Response>,
        req: Request
    ): Promise<Response> {
        const url = new URL(req.url);
        const cacheKey = `api:${url.pathname}:${url.search}`;

        // Check cache
        const cached = await redisCache.get<{ body: string; headers: Record<string, string> }>(cacheKey);
        if (cached) {
            return new Response(cached.body, {
                headers: {
                    ...cached.headers,
                    'X-Cache': 'HIT',
                },
            });
        }

        // Execute handler
        const response = await handler(req);
        const body = await response.text();

        // Cache response
        await redisCache.set(cacheKey, {
            body,
            headers: Object.fromEntries(response.headers.entries()),
        }, options);

        return new Response(body, {
            headers: {
                ...Object.fromEntries(response.headers.entries()),
                'X-Cache': 'MISS',
            },
        });
    };
}
