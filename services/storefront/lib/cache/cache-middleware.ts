/**
 * API Caching Middleware
 *
 * Provides HTTP caching middleware for API routes with:
 * - Cache GET requests only
 * - Stale-while-revalidate pattern
 * - Proper cache headers
 * - ETag support
 * - Conditional requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { redisCache, CACHE_TTL } from './redis-cache';

export interface CacheMiddlewareOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Stale-while-revalidate time in seconds
   */
  staleWhileRevalidate?: number;

  /**
   * Tags for cache invalidation
   */
  tags?: string[];

  /**
   * Whether to include query params in cache key
   */
  includeQuery?: boolean;

  /**
   * Whether to use ETags
   */
  useETag?: boolean;

  /**
   * Custom cache key function
   */
  getCacheKey?: (req: NextRequest) => string;

  /**
   * Vary headers - cache different responses based on these headers
   */
  varyHeaders?: string[];
}

/**
 * Generate ETag from content
 */
function generateETag(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `"${Math.abs(hash).toString(36)}"`;
}

/**
 * Get cache key from request
 */
function getCacheKey(req: NextRequest, options: CacheMiddlewareOptions): string {
  if (options.getCacheKey) {
    return options.getCacheKey(req);
  }

  const url = new URL(req.url);
  let key = `api:${url.pathname}`;

  // Include query params
  if (options.includeQuery !== false && url.search) {
    key += `:${url.search}`;
  }

  // Include vary headers
  if (options.varyHeaders && options.varyHeaders.length > 0) {
    const varyValues = options.varyHeaders
      .map((header) => req.headers.get(header) || '')
      .join(':');
    key += `:${varyValues}`;
  }

  return key;
}

/**
 * Cache middleware for API routes
 */
export function withCache(options: CacheMiddlewareOptions = {}) {
  return async function cacheMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return handler(req);
      }

      const cacheKey = getCacheKey(req, options);
      const ttl = options.ttl || CACHE_TTL.PRODUCTS;
      const swr = options.staleWhileRevalidate || Math.floor(ttl / 2);

      try {
        // Check for cached response
        const cached = await redisCache.get<{
          body: string;
          headers: Record<string, string>;
          etag?: string;
          timestamp: number;
        }>(cacheKey);

        if (cached) {
          // Check If-None-Match header (ETag)
          if (options.useETag && cached.etag) {
            const ifNoneMatch = req.headers.get('if-none-match');
            if (ifNoneMatch === cached.etag) {
              return new NextResponse(null, {
                status: 304,
                headers: {
                  'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${swr}`,
                  ETag: cached.etag,
                  'X-Cache': 'HIT',
                },
              });
            }
          }

          // Check if stale
          const age = Math.floor((Date.now() - cached.timestamp) / 1000);
          const isStale = age > ttl;

          // Return cached response
          const headers = new Headers(cached.headers);
          headers.set('X-Cache', isStale ? 'STALE' : 'HIT');
          headers.set('Age', age.toString());
          headers.set(
            'Cache-Control',
            `public, max-age=${Math.max(0, ttl - age)}, stale-while-revalidate=${swr}`
          );

          if (cached.etag) {
            headers.set('ETag', cached.etag);
          }

          if (options.varyHeaders && options.varyHeaders.length > 0) {
            headers.set('Vary', options.varyHeaders.join(', '));
          }

          // Revalidate in background if stale
          if (isStale && age < ttl + swr) {
            // Don't await - revalidate in background
            handler(req)
              .then(async (response) => {
                const body = await response.text();
                const etag = options.useETag ? generateETag(body) : undefined;

                await redisCache.set(
                  cacheKey,
                  {
                    body,
                    headers: Object.fromEntries(response.headers.entries()),
                    etag,
                    timestamp: Date.now(),
                  },
                  {
                    ttl: ttl + swr,
                    tags: options.tags,
                  }
                );
              })
              .catch(console.error);
          }

          return new NextResponse(cached.body, {
            status: 200,
            headers,
          });
        }

        // No cache - execute handler
        const response = await handler(req);

        // Only cache successful responses
        if (response.status >= 200 && response.status < 300) {
          const body = await response.text();
          const etag = options.useETag ? generateETag(body) : undefined;

          // Store in cache
          await redisCache.set(
            cacheKey,
            {
              body,
              headers: Object.fromEntries(response.headers.entries()),
              etag,
              timestamp: Date.now(),
            },
            {
              ttl: ttl + swr,
              tags: options.tags,
            }
          );

          // Add cache headers to response
          const headers = new Headers(response.headers);
          headers.set('X-Cache', 'MISS');
          headers.set(
            'Cache-Control',
            `public, max-age=${ttl}, stale-while-revalidate=${swr}`
          );

          if (etag) {
            headers.set('ETag', etag);
          }

          if (options.varyHeaders && options.varyHeaders.length > 0) {
            headers.set('Vary', options.varyHeaders.join(', '));
          }

          return new NextResponse(body, {
            status: response.status,
            headers,
          });
        }

        return response;
      } catch (error) {
        console.error('Cache middleware error:', error);
        // On error, bypass cache and return fresh response
        return handler(req);
      }
    };
  };
}

/**
 * Invalidate cache by path pattern
 */
export async function invalidateCacheByPath(pathPattern: string): Promise<number> {
  return redisCache.deleteByPattern(`api:${pathPattern}*`);
}

/**
 * Invalidate cache by tag
 */
export async function invalidateCacheByTag(tag: string): Promise<number> {
  return redisCache.deleteByTag(tag);
}

/**
 * Predefined cache configurations
 */
export const CachePresets = {
  /**
   * Product cache - 5 minutes
   */
  product: {
    ttl: CACHE_TTL.PRODUCTS,
    staleWhileRevalidate: 60,
    tags: ['products'],
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * Product list cache - 2 minutes
   */
  productList: {
    ttl: CACHE_TTL.PRODUCT_LIST,
    staleWhileRevalidate: 60,
    tags: ['products', 'product-lists'],
    includeQuery: true,
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * Category cache - 1 hour
   */
  category: {
    ttl: CACHE_TTL.CATEGORIES,
    staleWhileRevalidate: 300,
    tags: ['categories'],
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * Search cache - 10 minutes
   */
  search: {
    ttl: CACHE_TTL.SEARCH,
    staleWhileRevalidate: 120,
    tags: ['search'],
    includeQuery: true,
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * Hot deals cache - 5 minutes
   */
  hotDeals: {
    ttl: CACHE_TTL.HOT_DEALS,
    staleWhileRevalidate: 60,
    tags: ['products', 'hot-deals'],
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * User profile cache - 15 minutes
   */
  userProfile: {
    ttl: CACHE_TTL.USER_PROFILE,
    staleWhileRevalidate: 300,
    tags: ['users'],
    varyHeaders: ['authorization'],
    useETag: true,
  } as CacheMiddlewareOptions,

  /**
   * Analytics cache - 30 minutes
   */
  analytics: {
    ttl: CACHE_TTL.ANALYTICS,
    staleWhileRevalidate: 600,
    tags: ['analytics'],
    includeQuery: true,
    useETag: false,
  } as CacheMiddlewareOptions,

  /**
   * Static content - 1 day
   */
  static: {
    ttl: 24 * 60 * 60,
    staleWhileRevalidate: 3600,
    tags: ['static'],
    useETag: true,
  } as CacheMiddlewareOptions,
};

/**
 * Example usage:
 *
 * // In API route handler
 * import { withCache, CachePresets } from '@/lib/cache/cache-middleware';
 *
 * // Option 1: Use preset
 * export const GET = withCache(CachePresets.product)(async (req) => {
 *   const data = await fetchProduct();
 *   return NextResponse.json(data);
 * });
 *
 * // Option 2: Custom configuration
 * export const GET = withCache({
 *   ttl: 300,
 *   staleWhileRevalidate: 60,
 *   tags: ['custom'],
 *   useETag: true,
 * })(async (req) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 *
 * // Option 3: Invalidate cache
 * import { invalidateCacheByTag } from '@/lib/cache/cache-middleware';
 * await invalidateCacheByTag('products');
 */
