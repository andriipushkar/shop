import Redis from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
    if (!process.env.REDIS_URL) {
        return null;
    }

    if (!redis) {
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError(err) {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true;
                }
                return false;
            },
        });

        redis.on('error', (error) => {
            console.error('Redis connection error:', error);
        });

        redis.on('connect', () => {
            console.log('Redis connected');
        });
    }

    return redis;
}

// Cache key prefixes
const CACHE_PREFIX = {
    product: 'product:',
    category: 'category:',
    user: 'user:',
    session: 'session:',
    cart: 'cart:',
    search: 'search:',
    settings: 'settings:',
} as const;

// Default TTL values (in seconds)
const DEFAULT_TTL = {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 3600, // 1 hour
    veryLong: 86400, // 24 hours
} as const;

export class CacheService {
    private redis: Redis | null;

    constructor() {
        this.redis = getRedisClient();
    }

    // Check if cache is available
    isAvailable(): boolean {
        return this.redis !== null && this.redis.status === 'ready';
    }

    // Get value from cache
    async get<T>(key: string): Promise<T | null> {
        if (!this.redis) return null;

        try {
            const data = await this.redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    // Set value in cache
    async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL.medium): Promise<boolean> {
        if (!this.redis) return false;

        try {
            await this.redis.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    // Delete value from cache
    async delete(key: string): Promise<boolean> {
        if (!this.redis) return false;

        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    // Delete multiple keys by pattern
    async deletePattern(pattern: string): Promise<boolean> {
        if (!this.redis) return false;

        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            return true;
        } catch (error) {
            console.error('Cache deletePattern error:', error);
            return false;
        }
    }

    // Get or set (cache-aside pattern)
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl = DEFAULT_TTL.medium
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fetchFn();
        await this.set(key, value, ttl);
        return value;
    }

    // Product caching
    async getProduct<T>(productId: string): Promise<T | null> {
        return this.get<T>(`${CACHE_PREFIX.product}${productId}`);
    }

    async setProduct<T>(productId: string, product: T): Promise<boolean> {
        return this.set(`${CACHE_PREFIX.product}${productId}`, product, DEFAULT_TTL.medium);
    }

    async invalidateProduct(productId: string): Promise<boolean> {
        return this.delete(`${CACHE_PREFIX.product}${productId}`);
    }

    // Category caching
    async getCategories<T>(): Promise<T | null> {
        return this.get<T>(`${CACHE_PREFIX.category}all`);
    }

    async setCategories<T>(categories: T): Promise<boolean> {
        return this.set(`${CACHE_PREFIX.category}all`, categories, DEFAULT_TTL.long);
    }

    async invalidateCategories(): Promise<boolean> {
        return this.deletePattern(`${CACHE_PREFIX.category}*`);
    }

    // Search results caching
    async getSearchResults<T>(query: string, filters: object): Promise<T | null> {
        const key = `${CACHE_PREFIX.search}${Buffer.from(JSON.stringify({ query, filters })).toString('base64')}`;
        return this.get<T>(key);
    }

    async setSearchResults<T>(query: string, filters: object, results: T): Promise<boolean> {
        const key = `${CACHE_PREFIX.search}${Buffer.from(JSON.stringify({ query, filters })).toString('base64')}`;
        return this.set(key, results, DEFAULT_TTL.short);
    }

    // Cart caching
    async getCart<T>(cartId: string): Promise<T | null> {
        return this.get<T>(`${CACHE_PREFIX.cart}${cartId}`);
    }

    async setCart<T>(cartId: string, cart: T): Promise<boolean> {
        return this.set(`${CACHE_PREFIX.cart}${cartId}`, cart, DEFAULT_TTL.long);
    }

    async invalidateCart(cartId: string): Promise<boolean> {
        return this.delete(`${CACHE_PREFIX.cart}${cartId}`);
    }

    // Session caching
    async getSession<T>(sessionId: string): Promise<T | null> {
        return this.get<T>(`${CACHE_PREFIX.session}${sessionId}`);
    }

    async setSession<T>(sessionId: string, session: T, ttl = DEFAULT_TTL.veryLong): Promise<boolean> {
        return this.set(`${CACHE_PREFIX.session}${sessionId}`, session, ttl);
    }

    async invalidateSession(sessionId: string): Promise<boolean> {
        return this.delete(`${CACHE_PREFIX.session}${sessionId}`);
    }

    // Rate limiting helper
    async checkRateLimit(
        key: string,
        limit: number,
        windowSeconds: number
    ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
        if (!this.redis) {
            return { allowed: true, remaining: limit, resetIn: 0 };
        }

        const rateLimitKey = `ratelimit:${key}`;

        try {
            const multi = this.redis.multi();
            multi.incr(rateLimitKey);
            multi.ttl(rateLimitKey);

            const results = await multi.exec();
            if (!results) {
                return { allowed: true, remaining: limit, resetIn: 0 };
            }

            const count = results[0]?.[1] as number;
            let ttl = results[1]?.[1] as number;

            // Set expiry if this is the first request
            if (ttl === -1) {
                await this.redis.expire(rateLimitKey, windowSeconds);
                ttl = windowSeconds;
            }

            const allowed = count <= limit;
            const remaining = Math.max(0, limit - count);

            return { allowed, remaining, resetIn: ttl };
        } catch (error) {
            console.error('Rate limit check error:', error);
            return { allowed: true, remaining: limit, resetIn: 0 };
        }
    }

    // Clear all cache
    async flushAll(): Promise<boolean> {
        if (!this.redis) return false;

        try {
            await this.redis.flushdb();
            return true;
        } catch (error) {
            console.error('Cache flush error:', error);
            return false;
        }
    }

    // Close connection
    async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            redis = null;
        }
    }
}

// Export singleton instance
export const cache = new CacheService();

// Export types and constants
export { CACHE_PREFIX, DEFAULT_TTL };
