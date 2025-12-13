import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cache } from '@/lib/cache';

export interface RateLimitConfig {
    limit: number; // Max requests
    window: number; // Time window in seconds
    identifier?: (req: NextRequest) => string; // Custom identifier function
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    limit: number;
}

// Default rate limit configurations
export const RATE_LIMITS = {
    // API endpoints
    api: { limit: 100, window: 60 }, // 100 requests per minute
    apiStrict: { limit: 30, window: 60 }, // 30 requests per minute

    // Auth endpoints
    auth: { limit: 10, window: 60 }, // 10 requests per minute
    login: { limit: 5, window: 300 }, // 5 attempts per 5 minutes
    register: { limit: 3, window: 3600 }, // 3 registrations per hour
    passwordReset: { limit: 3, window: 3600 }, // 3 resets per hour

    // Search and heavy operations
    search: { limit: 30, window: 60 }, // 30 searches per minute
    export: { limit: 5, window: 3600 }, // 5 exports per hour

    // Admin operations
    admin: { limit: 200, window: 60 }, // 200 requests per minute
    bulkOperation: { limit: 10, window: 60 }, // 10 bulk operations per minute

    // Webhooks
    webhook: { limit: 50, window: 60 }, // 50 webhook calls per minute
} as const;

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
        if (value.resetAt < now) {
            memoryStore.delete(key);
        }
    }
}, 60000); // Clean up every minute

/**
 * Get identifier from request (IP address)
 */
function getDefaultIdentifier(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'anonymous';
    return ip;
}

/**
 * Check rate limit using Redis
 */
async function checkRedisRateLimit(
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const result = await cache.checkRateLimit(key, config.limit, config.window);
    return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetIn: result.resetIn,
        limit: config.limit,
    };
}

/**
 * Check rate limit using memory store (fallback)
 */
function checkMemoryRateLimit(
    key: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const resetAt = now + config.window * 1000;
    const entry = memoryStore.get(key);

    if (!entry || entry.resetAt < now) {
        memoryStore.set(key, { count: 1, resetAt });
        return {
            allowed: true,
            remaining: config.limit - 1,
            resetIn: config.window,
            limit: config.limit,
        };
    }

    entry.count++;
    const allowed = entry.count <= config.limit;
    const remaining = Math.max(0, config.limit - entry.count);
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);

    return { allowed, remaining, resetIn, limit: config.limit };
}

/**
 * Rate limiter function
 */
export async function rateLimit(
    req: NextRequest,
    config: RateLimitConfig,
    prefix = 'rl'
): Promise<RateLimitResult> {
    const identifier = config.identifier
        ? config.identifier(req)
        : getDefaultIdentifier(req);

    const key = `${prefix}:${identifier}`;

    // Try Redis first, fall back to memory
    if (cache.isAvailable()) {
        return checkRedisRateLimit(key, config);
    }

    return checkMemoryRateLimit(key, config);
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimitMiddleware(
    req: NextRequest,
    config: RateLimitConfig = RATE_LIMITS.api
): Promise<NextResponse | null> {
    const result = await rateLimit(req, config);

    if (!result.allowed) {
        return new NextResponse(
            JSON.stringify({
                error: 'Too Many Requests',
                message: 'Перевищено ліміт запитів. Спробуйте пізніше.',
                retryAfter: result.resetIn,
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': result.resetIn.toString(),
                    'X-RateLimit-Limit': result.limit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': result.resetIn.toString(),
                },
            }
        );
    }

    return null; // Continue to handler
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<Response>>(
    handler: T,
    config: RateLimitConfig = RATE_LIMITS.api
) {
    return async (req: NextRequest, ...args: Parameters<T> extends [unknown, ...infer R] ? R : never): Promise<Response> => {
        const limitResponse = await rateLimitMiddleware(req, config);
        if (limitResponse) return limitResponse;

        const response = await handler(req, ...args);

        // Get current rate limit info for headers
        const result = await rateLimit(req, config);

        // Clone response to add headers
        const newHeaders = new Headers(response.headers);
        newHeaders.set('X-RateLimit-Limit', result.limit.toString());
        newHeaders.set('X-RateLimit-Remaining', result.remaining.toString());
        newHeaders.set('X-RateLimit-Reset', result.resetIn.toString());

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
        });
    };
}

/**
 * Create a custom rate limiter with specific configuration
 */
export function createRateLimiter(config: RateLimitConfig, prefix?: string) {
    return async (req: NextRequest) => {
        return rateLimit(req, config, prefix);
    };
}

/**
 * IP-based identifier for rate limiting
 */
export const ipIdentifier = getDefaultIdentifier;

/**
 * User-based identifier for rate limiting (requires session)
 */
export function userIdentifier(userId?: string): (req: NextRequest) => string {
    return (req: NextRequest) => {
        if (userId) return `user:${userId}`;
        return getDefaultIdentifier(req);
    };
}

/**
 * API key-based identifier
 */
export function apiKeyIdentifier(req: NextRequest): string {
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization');
    if (apiKey) return `apikey:${apiKey.substring(0, 32)}`;
    return getDefaultIdentifier(req);
}
