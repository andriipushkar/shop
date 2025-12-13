/**
 * Tests for Rate Limiting
 */

import {
  checkRateLimit,
  consumeRateLimit,
  recordRequest,
  getRateLimitStatus,
  resetRateLimit,
  isBlocked,
  getRateLimitHeaders,
  rateLimitByIP,
  rateLimitByUser,
  rateLimitByIPAndUser,
  clearRateLimits,
  RATE_LIMIT_CONFIGS,
} from '@/lib/security/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimits();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('has predefined configurations', () => {
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('login');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('checkout');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('payment');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('reviewCreate');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('search');
    });

    it('login config allows 5 requests in 15 minutes', () => {
      expect(RATE_LIMIT_CONFIGS.login.maxRequests).toBe(5);
      expect(RATE_LIMIT_CONFIGS.login.windowMs).toBe(15 * 60 * 1000);
    });
  });

  describe('checkRateLimit', () => {
    it('allows requests within limit', async () => {
      const result = await checkRateLimit('user-1', 'login');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Login allows 5, -1 for potential current
    });

    it('tracks requests correctly', async () => {
      await recordRequest('user-2', 'login');
      await recordRequest('user-2', 'login');
      await recordRequest('user-2', 'login');

      const result = await checkRateLimit('user-2', 'login');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 5 - 3 - 1 = 1
    });

    it('blocks when limit exceeded', async () => {
      const identifier = 'user-blocked';

      // Exhaust the login limit (5 requests)
      for (let i = 0; i < 5; i++) {
        await recordRequest(identifier, 'login');
      }

      const result = await checkRateLimit(identifier, 'login');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets after window expires', async () => {
      const identifier = 'user-window';

      // Use up some requests
      for (let i = 0; i < 3; i++) {
        await recordRequest(identifier, 'login');
      }

      // Advance time past the window (15 minutes + 1 second)
      jest.advanceTimersByTime(15 * 60 * 1000 + 1000);

      const result = await checkRateLimit(identifier, 'login');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Fresh window
    });
  });

  describe('consumeRateLimit', () => {
    it('records request and returns result', async () => {
      const result = await consumeRateLimit('consumer-1', 'login');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeLessThanOrEqual(5);
    });

    it('returns false when limit exceeded', async () => {
      const identifier = 'consumer-blocked';

      // Exhaust login limit (5 requests)
      for (let i = 0; i < 5; i++) {
        await consumeRateLimit(identifier, 'login');
      }

      const result = await consumeRateLimit(identifier, 'login');
      expect(result.allowed).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('returns current status', async () => {
      const identifier = 'status-user';

      await recordRequest(identifier, 'login');
      await recordRequest(identifier, 'login');

      const status = await getRateLimitStatus(identifier, 'login');
      expect(status.allowed).toBe(true);
      expect(status.resetAt).toBeInstanceOf(Date);
    });

    it('returns allowed for new identifier', async () => {
      const status = await getRateLimitStatus('new-user', 'login');
      expect(status.allowed).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('resets count for identifier', async () => {
      const identifier = 'reset-user';

      await recordRequest(identifier, 'login');
      await recordRequest(identifier, 'login');
      await recordRequest(identifier, 'login');

      await resetRateLimit(identifier, 'login');

      const status = await getRateLimitStatus(identifier, 'login');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(4); // Fresh start
    });
  });

  describe('isBlocked', () => {
    it('returns false when under limit', async () => {
      await recordRequest('block-check', 'login');
      expect(await isBlocked('block-check', 'login')).toBe(false);
    });

    it('returns true when over limit', async () => {
      const identifier = 'blocked-user';

      for (let i = 0; i < 5; i++) {
        await recordRequest(identifier, 'login');
      }

      expect(await isBlocked(identifier, 'login')).toBe(true);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('returns correct headers', async () => {
      const identifier = 'headers-user';
      await recordRequest(identifier, 'login');
      await recordRequest(identifier, 'login');

      const result = await checkRateLimit(identifier, 'login');
      const headers = getRateLimitHeaders(result, 'login');

      expect(headers['X-RateLimit-Limit']).toBe('5');
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('includes Retry-After when blocked', async () => {
      const identifier = 'retry-user';

      for (let i = 0; i < 5; i++) {
        await recordRequest(identifier, 'login');
      }

      const result = await checkRateLimit(identifier, 'login');
      const headers = getRateLimitHeaders(result, 'login');

      expect(headers['Retry-After']).toBeDefined();
      expect(parseInt(headers['Retry-After']!, 10)).toBeGreaterThan(0);
    });
  });

  describe('rateLimitByIP', () => {
    it('limits by IP address', async () => {
      const ip = '192.168.1.1';

      const result = await rateLimitByIP(ip, 'login');
      expect(result.allowed).toBe(true);
    });

    it('different IPs have separate limits', async () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Exhaust IP1's limit
      for (let i = 0; i < 5; i++) {
        await rateLimitByIP(ip1, 'login');
      }

      expect(await isBlocked(`ip:${ip1}`, 'login')).toBe(true);
      expect(await isBlocked(`ip:${ip2}`, 'login')).toBe(false);
    });
  });

  describe('rateLimitByUser', () => {
    it('limits by user ID', async () => {
      const userId = 'user-123';

      const result = await rateLimitByUser(userId, 'reviewCreate');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeLessThanOrEqual(5);
    });
  });

  describe('rateLimitByIPAndUser', () => {
    it('combines IP and user limits', async () => {
      const ip = '192.168.1.1';
      const userId = 'user-456';

      const result = await rateLimitByIPAndUser(ip, userId, 'checkout');
      expect(result.allowed).toBe(true);
    });

    it('blocks if either limit exceeded', async () => {
      const ip = '192.168.1.1';
      const userId = 'user-789';

      // Exhaust user limit (checkout allows 10)
      for (let i = 0; i < 10; i++) {
        await rateLimitByUser(userId, 'checkout');
      }

      const result = await rateLimitByIPAndUser(ip, userId, 'checkout');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Custom configuration', () => {
    it('allows custom limits', async () => {
      const result = await consumeRateLimit('custom-user', 'login', {
        maxRequests: 2,
        windowMs: 1000,
      });

      expect(result.allowed).toBe(true);
    });

    it('respects custom window', async () => {
      const identifier = 'custom-window';
      const config = { maxRequests: 5, windowMs: 500 };

      for (let i = 0; i < 5; i++) {
        await consumeRateLimit(identifier, 'login', config);
      }

      expect(await isBlocked(identifier, 'login')).toBe(true);

      // After short window, should reset
      jest.advanceTimersByTime(600);

      const result = await consumeRateLimit(identifier, 'login', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Sliding window behavior', () => {
    it('correctly implements sliding window', async () => {
      const identifier = 'sliding-user';
      const config = { maxRequests: 5, windowMs: 1000 };

      // Make 3 requests
      await consumeRateLimit(identifier, 'login', config);
      await consumeRateLimit(identifier, 'login', config);
      await consumeRateLimit(identifier, 'login', config);

      // Advance time halfway
      jest.advanceTimersByTime(500);

      // Make 2 more requests
      await consumeRateLimit(identifier, 'login', config);
      await consumeRateLimit(identifier, 'login', config);

      // Now at 5 requests in window - next should be blocked
      const blocked = await consumeRateLimit(identifier, 'login', config);
      expect(blocked.allowed).toBe(false);

      // Advance time past first requests
      jest.advanceTimersByTime(600);

      // Should allow new requests as old ones expired
      const allowed = await consumeRateLimit(identifier, 'login', config);
      expect(allowed.allowed).toBe(true);
    });
  });
});
