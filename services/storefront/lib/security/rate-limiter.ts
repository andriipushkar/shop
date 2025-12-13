/**
 * Rate Limiter - Обмеження швидкості запитів
 * Підтримка Redis для розподілених систем та in-memory для розробки
 * Використовує алгоритм sliding window для точного підрахунку
 */

import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number; // Часове вікно в мілісекундах
  maxRequests: number; // Максимальна кількість запитів за вікно
  keyGenerator?: (identifier: string) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  useRedis?: boolean; // Використовувати Redis замість пам'яті
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Секунди до повторної спроби
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  requests: number[]; // Часові мітки запитів
}

// In-memory store (для development)
const store = new Map<string, RateLimitEntry>();

// Redis client для production
let redisClient: Redis | null = null;

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Ініціалізація Redis клієнта
 */
export function initRedis(options?: {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}): void {
  if (redisClient) return;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  } else {
    redisClient = new Redis({
      host: options?.host || process.env.REDIS_HOST || 'localhost',
      port: options?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: options?.password || process.env.REDIS_PASSWORD,
      db: options?.db || parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  redisClient.on('error', (err) => {
    console.error('Redis rate limiter error:', err);
    // Fallback to in-memory on Redis errors
  });
}

/**
 * Закриття Redis з'єднання
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Перевірка доступності Redis
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

/**
 * Default rate limit configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  verificationCode: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 5,
  },

  // Checkout & Payment
  checkout: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  payment: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  orderCreate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
  },

  // Reviews & Comments
  reviewCreate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
  commentCreate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },

  // Search & Catalog
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  catalog: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
  },

  // API General
  apiGeneral: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  apiStrict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  // Admin
  adminBulk: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  adminExport: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
  },

  // Contact & Support
  contactForm: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
  supportTicket: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Start cleanup interval to remove expired entries
 */
export function startCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries older than 1 hour
      if (now - entry.windowStart > 60 * 60 * 1000) {
        store.delete(key);
      }
    }
  }, intervalMs);
}

/**
 * Stop cleanup interval
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all rate limit data
 */
export function clearRateLimits(): void {
  store.clear();
}

/**
 * Get rate limit key
 */
function getKey(identifier: string, type: RateLimitType): string {
  return `${type}:${identifier}`;
}

/**
 * Перевірка rate limit через Redis (sliding window)
 */
async function checkRateLimitRedis(
  identifier: string,
  type: RateLimitType,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redisClient || redisClient.status !== 'ready') {
    // Fallback to in-memory
    return checkRateLimitMemory(identifier, type, config);
  }

  const { windowMs, maxRequests } = config;
  const key = getKey(identifier, type);
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Використовуємо sorted set для зберігання timestamps
    const pipeline = redisClient.pipeline();

    // Видаляємо старі записи
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Отримуємо кількість поточних запитів
    pipeline.zcard(key);

    // Отримуємо найстаріший запит у вікні
    pipeline.zrange(key, 0, 0, 'WITHSCORES');

    // Встановлюємо TTL для автоматичного видалення
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    const count = (results[1][1] as number) || 0;
    const oldestScores = results[2][1] as string[];
    const oldestRequest = oldestScores.length > 0 ? parseInt(oldestScores[1]) : now;

    const remaining = Math.max(0, maxRequests - count);
    const resetAt = new Date(now + windowMs);

    if (count >= maxRequests) {
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  } catch (error) {
    console.error('Redis rate limit check error:', error);
    // Fallback to in-memory
    return checkRateLimitMemory(identifier, type, config);
  }
}

/**
 * Запис запиту до Redis
 */
async function recordRequestRedis(identifier: string, type: RateLimitType): Promise<void> {
  if (!redisClient || redisClient.status !== 'ready') {
    recordRequestMemory(identifier, type);
    return;
  }

  const key = getKey(identifier, type);
  const now = Date.now();
  const config = RATE_LIMIT_CONFIGS[type];

  try {
    await redisClient
      .pipeline()
      .zadd(key, now, `${now}:${Math.random()}`)
      .expire(key, Math.ceil(config.windowMs / 1000))
      .exec();
  } catch (error) {
    console.error('Redis rate limit record error:', error);
    recordRequestMemory(identifier, type);
  }
}

/**
 * Перевірка rate limit через пам'ять (fallback)
 */
function checkRateLimitMemory(
  identifier: string,
  type: RateLimitType,
  config: RateLimitConfig
): RateLimitResult {
  const { windowMs, maxRequests } = config;
  const key = getKey(identifier, type);
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);

  if (!entry) {
    entry = { count: 0, windowStart: now, requests: [] };
    store.set(key, entry);
  }

  // Видаляємо запити поза поточним вікном (sliding window)
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
  entry.count = entry.requests.length;

  const remaining = Math.max(0, maxRequests - entry.count);
  const resetAt = new Date(now + windowMs);

  if (entry.count >= maxRequests) {
    // Знаходимо найстаріший запит у вікні для розрахунку часу повтору
    const oldestRequest = Math.min(...entry.requests);
    const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, retryAfter),
    };
  }

  return {
    allowed: true,
    remaining: remaining - 1,
    resetAt,
  };
}

/**
 * Запис запиту в пам'ять
 */
function recordRequestMemory(identifier: string, type: RateLimitType): void {
  const key = getKey(identifier, type);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { count: 0, windowStart: now, requests: [] };
    store.set(key, entry);
  }

  entry.requests.push(now);
  entry.count = entry.requests.length;
}

/**
 * Перевірка rate limit з автовибором backend (Redis або Memory)
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const defaultConfig = RATE_LIMIT_CONFIGS[type];
  const finalConfig = { ...defaultConfig, ...config };

  if (finalConfig.useRedis !== false && isRedisAvailable()) {
    return checkRateLimitRedis(identifier, type, finalConfig);
  }

  return checkRateLimitMemory(identifier, type, finalConfig);
}

/**
 * Запис запиту (викликати після успішної перевірки)
 */
export async function recordRequest(identifier: string, type: RateLimitType): Promise<void> {
  if (isRedisAvailable()) {
    await recordRequestRedis(identifier, type);
  } else {
    recordRequestMemory(identifier, type);
  }
}

/**
 * Комбінована перевірка та запис
 */
export async function consumeRateLimit(
  identifier: string,
  type: RateLimitType,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, type, config);

  if (result.allowed) {
    await recordRequest(identifier, type);
  }

  return result;
}

/**
 * Отримати поточний статус rate limit без споживання
 */
export async function getRateLimitStatus(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, type);
}

/**
 * Скидання rate limit для конкретного ідентифікатора
 */
export async function resetRateLimit(identifier: string, type: RateLimitType): Promise<void> {
  const key = getKey(identifier, type);

  if (isRedisAvailable() && redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis reset rate limit error:', error);
    }
  }

  store.delete(key);
}

/**
 * Перевірка чи заблокований ідентифікатор
 */
export async function isBlocked(identifier: string, type: RateLimitType): Promise<boolean> {
  const result = await checkRateLimit(identifier, type);
  return !result.allowed;
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  type: RateLimitType
): Record<string, string> {
  const config = RATE_LIMIT_CONFIGS[type];

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Middleware helper для Next.js API routes
 */
export function createRateLimitMiddleware(type: RateLimitType, config?: Partial<RateLimitConfig>) {
  return async (identifier: string): Promise<{ allowed: boolean; headers: Record<string, string>; error?: string }> => {
    const result = await consumeRateLimit(identifier, type, config);
    const headers = getRateLimitHeaders(result, type);

    if (!result.allowed) {
      return {
        allowed: false,
        headers,
        error: `Забагато запитів. Спробуйте через ${result.retryAfter} секунд.`,
      };
    }

    return { allowed: true, headers };
  };
}

/**
 * Rate limiter на основі IP
 */
export async function rateLimitByIP(
  ip: string,
  type: RateLimitType,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  return consumeRateLimit(`ip:${ip}`, type, config);
}

/**
 * Rate limiter на основі користувача
 */
export async function rateLimitByUser(
  userId: string,
  type: RateLimitType,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  return consumeRateLimit(`user:${userId}`, type, config);
}

/**
 * Комбінований IP + User rate limiter (обидва повинні пройти)
 */
export async function rateLimitByIPAndUser(
  ip: string,
  userId: string | null,
  type: RateLimitType,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  // Перевіряємо IP спочатку
  const ipResult = await checkRateLimit(`ip:${ip}`, type, config);
  if (!ipResult.allowed) {
    await recordRequest(`ip:${ip}`, type);
    return ipResult;
  }

  // Перевіряємо користувача якщо авторизований
  if (userId) {
    const userResult = await checkRateLimit(`user:${userId}`, type, config);
    if (!userResult.allowed) {
      await recordRequest(`ip:${ip}`, type);
      await recordRequest(`user:${userId}`, type);
      return userResult;
    }
    await recordRequest(`user:${userId}`, type);
  }

  await recordRequest(`ip:${ip}`, type);

  return {
    allowed: true,
    remaining: Math.min(ipResult.remaining, userId ? ipResult.remaining : Infinity) - 1,
    resetAt: ipResult.resetAt,
  };
}

// Start cleanup on module load
if (typeof window === 'undefined') {
  startCleanup();
}
