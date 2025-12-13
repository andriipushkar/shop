

import { redisCache, CacheOptions } from '@/lib/cache/redis-cache';

describe('RedisCacheService', () => {
    beforeEach(async () => {
        await redisCache.clear();
    });

    describe('Basic operations', () => {
        it('should set and get a value', async () => {
            await redisCache.set('test-key', { name: 'test', value: 123 });

            const result = await redisCache.get<{ name: string; value: number }>('test-key');

            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('should return null for non-existent key', async () => {
            const result = await redisCache.get('non-existent');

            expect(result).toBeNull();
        });

        it('should delete a key', async () => {
            await redisCache.set('to-delete', 'value');

            const deleted = await redisCache.delete('to-delete');
            const result = await redisCache.get('to-delete');

            expect(deleted).toBe(true);
            expect(result).toBeNull();
        });

        it('should check if key exists', async () => {
            await redisCache.set('exists', 'value');

            const exists = await redisCache.has('exists');
            const notExists = await redisCache.has('not-exists');

            expect(exists).toBe(true);
            expect(notExists).toBe(false);
        });

        it('should clear all cache', async () => {
            await redisCache.set('key1', 'value1');
            await redisCache.set('key2', 'value2');

            await redisCache.clear();

            const result1 = await redisCache.get('key1');
            const result2 = await redisCache.get('key2');

            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
    });

    describe('TTL (Time To Live)', () => {
        it('should expire value after TTL', async () => {
            await redisCache.set('expiring', 'value', { ttl: 1 }); // 1 second TTL

            // Value should exist immediately
            let result = await redisCache.get('expiring');
            expect(result).toBe('value');

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 1100));

            result = await redisCache.get('expiring');
            expect(result).toBeNull();
        });
    });

    describe('getOrSet', () => {
        it('should return cached value if exists', async () => {
            await redisCache.set('cached', 'cached-value');

            const factory = jest.fn().mockResolvedValue('new-value');
            const result = await redisCache.getOrSet('cached', factory);

            expect(result).toBe('cached-value');
            expect(factory).not.toHaveBeenCalled();
        });

        it('should call factory and cache if not exists', async () => {
            const factory = jest.fn().mockResolvedValue('factory-value');

            const result = await redisCache.getOrSet('new-key', factory);

            expect(result).toBe('factory-value');
            expect(factory).toHaveBeenCalledTimes(1);

            // Verify it was cached
            const cached = await redisCache.get('new-key');
            expect(cached).toBe('factory-value');
        });
    });

    describe('Pattern-based operations', () => {
        it('should delete by pattern', async () => {
            await redisCache.set('products:1', 'p1');
            await redisCache.set('products:2', 'p2');
            await redisCache.set('users:1', 'u1');

            const deleted = await redisCache.deleteByPattern('products:*');

            expect(deleted).toBe(2);

            const p1 = await redisCache.get('products:1');
            const u1 = await redisCache.get('users:1');

            expect(p1).toBeNull();
            expect(u1).toBe('u1');
        });
    });

    describe('Tag-based operations', () => {
        it('should delete by tag', async () => {
            await redisCache.set('item1', 'value1', { tags: ['products'] });
            await redisCache.set('item2', 'value2', { tags: ['products'] });
            await redisCache.set('item3', 'value3', { tags: ['users'] });

            const deleted = await redisCache.deleteByTag('products');

            expect(deleted).toBe(2);

            const item1 = await redisCache.get('item1');
            const item3 = await redisCache.get('item3');

            expect(item1).toBeNull();
            expect(item3).toBe('value3');
        });
    });

    describe('Cache statistics', () => {
        it('should track cache statistics', async () => {
            // Generate some hits and misses
            await redisCache.set('hit-key', 'value');
            await redisCache.get('hit-key'); // Hit
            await redisCache.get('hit-key'); // Hit
            await redisCache.get('miss-key'); // Miss

            const stats = await redisCache.getStats();

            expect(stats).toMatchObject({
                hits: expect.any(Number),
                misses: expect.any(Number),
                hitRate: expect.any(Number),
                keys: expect.any(Number),
                memory: expect.any(String),
            });
        });
    });

    describe('Specialized cache methods', () => {
        it('should cache product', async () => {
            const factory = jest.fn().mockResolvedValue({ id: '1', name: 'Product 1' });

            const result = await redisCache.cacheProduct('1', factory);

            expect(result).toEqual({ id: '1', name: 'Product 1' });
            expect(factory).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await redisCache.cacheProduct('1', factory);
            expect(result2).toEqual({ id: '1', name: 'Product 1' });
            expect(factory).toHaveBeenCalledTimes(1); // Still 1
        });

        it('should cache product list', async () => {
            const factory = jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);

            const result = await redisCache.cacheProductList('category:electronics', factory);

            expect(result).toHaveLength(2);
        });

        it('should cache category', async () => {
            const factory = jest.fn().mockResolvedValue({ id: '1', name: 'Electronics' });

            const result = await redisCache.cacheCategory('1', factory);

            expect(result).toEqual({ id: '1', name: 'Electronics' });
        });

        it('should cache search results', async () => {
            const factory = jest.fn().mockResolvedValue({ results: [], total: 0 });

            const result = await redisCache.cacheSearchResults(
                'iphone',
                { category: 'smartphones' },
                factory
            );

            expect(result).toEqual({ results: [], total: 0 });
        });

        it('should cache cart', async () => {
            const factory = jest.fn().mockResolvedValue({ items: [], total: 0 });

            const result = await redisCache.cacheCart('cart123', factory);

            expect(result).toEqual({ items: [], total: 0 });
        });

        it('should cache homepage', async () => {
            const factory = jest.fn().mockResolvedValue({ banners: [], products: [] });

            const result = await redisCache.cacheHomepage(factory);

            expect(result).toEqual({ banners: [], products: [] });
        });

        it('should cache CMS page', async () => {
            const factory = jest.fn().mockResolvedValue({ title: 'About', content: 'Content' });

            const result = await redisCache.cacheCMSPage('about', factory);

            expect(result).toEqual({ title: 'About', content: 'Content' });
        });
    });

    describe('Cache invalidation', () => {
        it('should invalidate product cache', async () => {
            await redisCache.set('products:123', { id: '123' });

            await redisCache.invalidateProduct('123');

            const result = await redisCache.get('products:123');
            expect(result).toBeNull();
        });

        it('should invalidate all products', async () => {
            await redisCache.set('item1', 'value1', { tags: ['products'] });
            await redisCache.set('item2', 'value2', { tags: ['products'] });

            await redisCache.invalidateAllProducts();

            const item1 = await redisCache.get('item1');
            expect(item1).toBeNull();
        });

        it('should invalidate category', async () => {
            await redisCache.set('categories:1', { id: '1' });

            await redisCache.invalidateCategory('1');

            const result = await redisCache.get('categories:1');
            expect(result).toBeNull();
        });

        it('should invalidate search cache', async () => {
            await redisCache.set('search1', 'results', { tags: ['search'] });

            await redisCache.invalidateSearch();

            const result = await redisCache.get('search1');
            expect(result).toBeNull();
        });

        it('should invalidate user session', async () => {
            await redisCache.set('sessions:user123', { token: 'abc' });

            await redisCache.invalidateUserSession('user123');

            const result = await redisCache.get('sessions:user123');
            expect(result).toBeNull();
        });

        it('should invalidate cart', async () => {
            await redisCache.set('carts:cart123', { items: [] });

            await redisCache.invalidateCart('cart123');

            const result = await redisCache.get('carts:cart123');
            expect(result).toBeNull();
        });

        it('should invalidate CMS', async () => {
            await redisCache.set('cms1', 'page', { tags: ['cms'] });

            await redisCache.invalidateCMS();

            const result = await redisCache.get('cms1');
            expect(result).toBeNull();
        });
    });

    describe('Rate limiting', () => {
        it('should allow requests within limit', async () => {
            const result = await redisCache.checkRateLimit('user:123', 5, 60);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should block requests over limit', async () => {
            // Make 5 requests
            for (let i = 0; i < 5; i++) {
                await redisCache.checkRateLimit('user:456', 5, 60);
            }

            // 6th request should be blocked
            const result = await redisCache.checkRateLimit('user:456', 5, 60);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('Distributed locking', () => {
        it('should acquire lock', async () => {
            const lockId = await redisCache.acquireLock('resource:1', 30);

            expect(lockId).not.toBeNull();
            expect(typeof lockId).toBe('string');
        });

        it('should not acquire lock if already locked', async () => {
            await redisCache.acquireLock('resource:2', 30);

            const secondLock = await redisCache.acquireLock('resource:2', 30);

            expect(secondLock).toBeNull();
        });

        it('should release lock with correct ID', async () => {
            const lockId = await redisCache.acquireLock('resource:3', 30);

            const released = await redisCache.releaseLock('resource:3', lockId!);

            expect(released).toBe(true);

            // Now should be able to acquire again
            const newLock = await redisCache.acquireLock('resource:3', 30);
            expect(newLock).not.toBeNull();
        });

        it('should not release lock with wrong ID', async () => {
            await redisCache.acquireLock('resource:4', 30);

            const released = await redisCache.releaseLock('resource:4', 'wrong-id');

            expect(released).toBe(false);
        });
    });
});
