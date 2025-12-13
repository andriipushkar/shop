/**
 * Security Module Tests - Тести модулів безпеки
 * Тестування функцій безпеки: rate limiting, CSRF, санітизація, заголовки
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Rate Limiter Tests
describe('Rate Limiter', () => {
  // Імпортуємо функції динамічно для ізоляції
  let rateLimiter: typeof import('@/lib/security/rate-limiter');

  beforeEach(async () => {
    rateLimiter = await import('@/lib/security/rate-limiter');
    rateLimiter.clearRateLimits();
  });

  afterEach(() => {
    rateLimiter.stopCleanup();
  });

  describe('consumeRateLimit', () => {
    it('повинен дозволяти запити в межах ліміту', async () => {
      const result = await rateLimiter.consumeRateLimit('test-user', 'apiGeneral');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('повинен блокувати запити після перевищення ліміту', async () => {
      const config = rateLimiter.RATE_LIMIT_CONFIGS.apiGeneral;

      // Виконуємо максимальну кількість запитів
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.consumeRateLimit('test-user', 'apiGeneral');
      }

      // Наступний запит повинен бути заблокований
      const result = await rateLimiter.consumeRateLimit('test-user', 'apiGeneral');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('повинен розрізняти різних користувачів', async () => {
      const result1 = await rateLimiter.consumeRateLimit('user1', 'apiGeneral');
      const result2 = await rateLimiter.consumeRateLimit('user2', 'apiGeneral');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('повинен відновлювати ліміт після часового вікна', async () => {
      const shortConfig = { windowMs: 100, maxRequests: 2 };

      // Використовуємо весь ліміт
      await rateLimiter.consumeRateLimit('test-user', 'apiGeneral', shortConfig);
      await rateLimiter.consumeRateLimit('test-user', 'apiGeneral', shortConfig);

      // Чекаємо закінчення вікна
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Ліміт повинен відновитися
      const result = await rateLimiter.consumeRateLimit('test-user', 'apiGeneral', shortConfig);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('повинен повертати правильні заголовки', () => {
      const result: import('@/lib/security/rate-limiter').RateLimitResult = {
        allowed: true,
        remaining: 95,
        resetAt: new Date(Date.now() + 60000),
      };

      const headers = rateLimiter.getRateLimitHeaders(result, 'apiGeneral');

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('95');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('повинен включати Retry-After для заблокованих запитів', () => {
      const result: import('@/lib/security/rate-limiter').RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
        retryAfter: 60,
      };

      const headers = rateLimiter.getRateLimitHeaders(result, 'apiGeneral');

      expect(headers['Retry-After']).toBe('60');
    });
  });

  describe('resetRateLimit', () => {
    it('повинен скидати ліміт для користувача', async () => {
      // Використовуємо запити
      await rateLimiter.consumeRateLimit('test-user', 'apiGeneral');
      await rateLimiter.consumeRateLimit('test-user', 'apiGeneral');

      // Скидаємо
      await rateLimiter.resetRateLimit('test-user', 'apiGeneral');

      // Перевіряємо що ліміт відновився
      const status = await rateLimiter.getRateLimitStatus('test-user', 'apiGeneral');
      expect(status.remaining).toBe(rateLimiter.RATE_LIMIT_CONFIGS.apiGeneral.maxRequests - 1);
    });
  });
});

// CSRF Protection Tests
describe('CSRF Protection', () => {
  let csrf: typeof import('@/lib/security/csrf');

  beforeEach(async () => {
    csrf = await import('@/lib/security/csrf');
    csrf.clearCSRFTokens();
  });

  afterEach(() => {
    csrf.stopCSRFCleanup();
  });

  describe('generateCSRFToken', () => {
    it('повинен генерувати валідний токен', () => {
      const token = csrf.generateCSRFToken('session-123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(2);
    });

    it('повинен генерувати різні токени для різних сесій', () => {
      const token1 = csrf.generateCSRFToken('session-1');
      const token2 = csrf.generateCSRFToken('session-2');

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateCSRFToken', () => {
    it('повинен валідувати правильний токен', () => {
      const token = csrf.generateCSRFToken('session-123');
      const result = csrf.validateCSRFToken(token, 'session-123');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('повинен відхиляти токен з неправильною сесією', () => {
      const token = csrf.generateCSRFToken('session-123');
      const result = csrf.validateCSRFToken(token, 'session-456');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('повинен відхиляти невалідний токен', () => {
      const result = csrf.validateCSRFToken('invalid-token', 'session-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('повинен відхиляти відсутній токен', () => {
      const result = csrf.validateCSRFToken(null, 'session-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('CSRF token is missing');
    });
  });

  describe('consumeCSRFToken', () => {
    it('повинен видаляти токен після споживання', () => {
      const token = csrf.generateCSRFToken('session-123');

      // Перша валідація - успішна
      const result1 = csrf.consumeCSRFToken(token, 'session-123');
      expect(result1.valid).toBe(true);

      // Друга валідація - неуспішна (токен вже використаний)
      const result2 = csrf.validateCSRFToken(token, 'session-123');
      expect(result2.valid).toBe(false);
    });
  });

  describe('requiresCSRFProtection', () => {
    it('повинен вимагати CSRF для небезпечних методів', () => {
      expect(csrf.requiresCSRFProtection('POST')).toBe(true);
      expect(csrf.requiresCSRFProtection('PUT')).toBe(true);
      expect(csrf.requiresCSRFProtection('DELETE')).toBe(true);
      expect(csrf.requiresCSRFProtection('PATCH')).toBe(true);
    });

    it('не повинен вимагати CSRF для безпечних методів', () => {
      expect(csrf.requiresCSRFProtection('GET')).toBe(false);
      expect(csrf.requiresCSRFProtection('HEAD')).toBe(false);
      expect(csrf.requiresCSRFProtection('OPTIONS')).toBe(false);
    });
  });

  describe('isCSRFExempted', () => {
    it('повинен звільняти webhooks від CSRF', () => {
      expect(csrf.isCSRFExempted('/api/webhooks/stripe')).toBe(true);
      expect(csrf.isCSRFExempted('/api/payments/callback')).toBe(true);
      expect(csrf.isCSRFExempted('/api/marketplaces/webhook')).toBe(true);
    });

    it('не повинен звільняти звичайні API від CSRF', () => {
      expect(csrf.isCSRFExempted('/api/users')).toBe(false);
      expect(csrf.isCSRFExempted('/api/products')).toBe(false);
    });
  });
});

// Input Sanitizer Tests
describe('Input Sanitizer', () => {
  let sanitizer: typeof import('@/lib/security/input-sanitizer');

  beforeEach(async () => {
    sanitizer = await import('@/lib/security/input-sanitizer');
  });

  describe('escapeHtml', () => {
    it('повинен екранувати HTML спецсимволи', () => {
      const input = '<script>alert("XSS")</script>';
      const output = sanitizer.escapeHtml(input);

      expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(output).not.toContain('<script>');
    });

    it('повинен екранувати лапки', () => {
      const input = `"test" 'value'`;
      const output = sanitizer.escapeHtml(input);

      expect(output).toBe('&quot;test&quot; &#x27;value&#x27;');
    });
  });

  describe('stripHtmlTags', () => {
    it('повинен видаляти всі HTML теги', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const output = sanitizer.stripHtmlTags(input);

      expect(output).toBe('Hello World');
    });

    it('повинен видаляти небезпечні скрипти', () => {
      const input = 'Text<script>alert("XSS")</script>More text';
      const output = sanitizer.stripHtmlTags(input);

      expect(output).toBe('Textalert("XSS")More text');
      expect(output).not.toContain('<script>');
    });
  });

  describe('sanitizeUrl', () => {
    it('повинен дозволяти безпечні URL', () => {
      expect(sanitizer.sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizer.sanitizeUrl('http://example.com')).toBe('http://example.com');
      expect(sanitizer.sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('повинен блокувати небезпечні протоколи', () => {
      expect(sanitizer.sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(sanitizer.sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizer.sanitizeUrl('vbscript:msgbox')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('повинен валідувати правильні email', () => {
      expect(sanitizer.sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizer.sanitizeEmail('user.name+tag@example.co.uk')).toBe(
        'user.name+tag@example.co.uk'
      );
    });

    it('повинен відхиляти неправильні email', () => {
      expect(sanitizer.sanitizeEmail('invalid')).toBeNull();
      expect(sanitizer.sanitizeEmail('test@')).toBeNull();
      expect(sanitizer.sanitizeEmail('@example.com')).toBeNull();
      expect(sanitizer.sanitizeEmail('test..test@example.com')).toBeNull();
    });

    it('повинен нормалізувати email (lowercase)', () => {
      expect(sanitizer.sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('повинен валідувати українські номери', () => {
      expect(sanitizer.sanitizePhoneNumber('+380991234567')).toBe('+380991234567');
      expect(sanitizer.sanitizePhoneNumber('380991234567')).toBe('+380991234567');
      expect(sanitizer.sanitizePhoneNumber('0991234567')).toBe('+380991234567');
    });

    it('повинен очищати форматування', () => {
      expect(sanitizer.sanitizePhoneNumber('+38 099 123 45 67')).toBe('+380991234567');
      expect(sanitizer.sanitizePhoneNumber('(099) 123-45-67')).toBe('+380991234567');
    });

    it('повинен відхиляти неправильні номери', () => {
      expect(sanitizer.sanitizePhoneNumber('123')).toBeNull();
      expect(sanitizer.sanitizePhoneNumber('+1234567890')).toBeNull();
    });
  });

  describe('sanitizeNumber', () => {
    it('повинен валідувати числа', () => {
      expect(sanitizer.sanitizeNumber('123')).toBe(123);
      expect(sanitizer.sanitizeNumber('45.67')).toBe(45.67);
      expect(sanitizer.sanitizeNumber(100)).toBe(100);
    });

    it('повинен перевіряти межі', () => {
      expect(sanitizer.sanitizeNumber('50', { min: 0, max: 100 })).toBe(50);
      expect(sanitizer.sanitizeNumber('150', { min: 0, max: 100 })).toBeNull();
      expect(sanitizer.sanitizeNumber('-10', { min: 0 })).toBeNull();
    });

    it('повинен перевіряти цілі числа', () => {
      expect(sanitizer.sanitizeNumber('10', { integer: true })).toBe(10);
      expect(sanitizer.sanitizeNumber('10.5', { integer: true })).toBeNull();
    });

    it('повинен відхиляти некоректні числа', () => {
      expect(sanitizer.sanitizeNumber('abc')).toBeNull();
      expect(sanitizer.sanitizeNumber('NaN')).toBeNull();
      expect(sanitizer.sanitizeNumber('Infinity')).toBeNull();
    });
  });

  describe('sanitizeId', () => {
    it('повинен валідувати UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(sanitizer.sanitizeId(uuid)).toBe(uuid);
    });

    it('повинен валідувати числові ID', () => {
      expect(sanitizer.sanitizeId('123')).toBe('123');
      expect(sanitizer.sanitizeId(456)).toBe('456');
    });

    it('повинен відхиляти неправильні ID', () => {
      expect(sanitizer.sanitizeId('0')).toBeNull();
      expect(sanitizer.sanitizeId('-1')).toBeNull();
      expect(sanitizer.sanitizeId('invalid-uuid')).toBeNull();
    });
  });

  describe('removeInvisibleChars', () => {
    it('повинен видаляти контрольні символи', () => {
      const input = 'Hello\x00\x08World';
      const output = sanitizer.removeInvisibleChars(input);

      expect(output).toBe('HelloWorld');
    });

    it('повинен зберігати переноси рядків', () => {
      const input = 'Line1\nLine2\tTabbed';
      const output = sanitizer.removeInvisibleChars(input);

      expect(output).toBe('Line1\nLine2\tTabbed');
    });
  });
});

// Security Headers Tests
describe('Security Headers', () => {
  let headers: typeof import('@/lib/security/headers');

  beforeEach(async () => {
    headers = await import('@/lib/security/headers');
  });

  describe('getSecurityHeaders', () => {
    it('повинен повертати всі основні заголовки', () => {
      const securityHeaders = headers.getSecurityHeaders();

      expect(securityHeaders['Content-Security-Policy']).toBeDefined();
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(securityHeaders['Permissions-Policy']).toBeDefined();
    });

    it('повинен включати HSTS в production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const securityHeaders = headers.getSecurityHeaders();

      expect(securityHeaders['Strict-Transport-Security']).toBeDefined();
      expect(securityHeaders['Strict-Transport-Security']).toContain('max-age=');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('buildCSPHeader', () => {
    it('повинен будувати CSP заголовок', () => {
      const csp = headers.buildCSPHeader(headers.DEFAULT_CSP);

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('validateSecurityHeaders', () => {
    it('повинен валідувати повний набір заголовків', () => {
      const securityHeaders = headers.getSecurityHeaders();
      const validation = headers.validateSecurityHeaders(securityHeaders);

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
    });

    it('повинен виявляти відсутні заголовки', () => {
      const incompleteHeaders = {
        'X-Frame-Options': 'DENY',
      };
      const validation = headers.validateSecurityHeaders(incompleteHeaders);

      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.missing).toContain('Content-Security-Policy');
    });
  });
});

// Audit Log Tests
describe('Audit Log', () => {
  let auditLog: typeof import('@/lib/security/audit-log');

  beforeEach(async () => {
    auditLog = await import('@/lib/security/audit-log');
    // Mock console для тестів
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('повинен логувати подію безпеки', async () => {
      await auditLog.logSecurityEvent({
        type: auditLog.SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        ip: '127.0.0.1',
        status: 'success',
      });

      // Перевіряємо що не викинуло помилку
      expect(true).toBe(true);
    });
  });

  describe('logLoginAttempt', () => {
    it('повинен логувати успішний вхід', async () => {
      await auditLog.logLoginAttempt(true, 'user-123', 'testuser', '127.0.0.1');

      expect(true).toBe(true);
    });

    it('повинен логувати невдалий вхід', async () => {
      await auditLog.logLoginAttempt(false, undefined, 'testuser', '127.0.0.1', undefined, {
        reason: 'Invalid password',
      });

      expect(true).toBe(true);
    });
  });

  describe('logAccessDenied', () => {
    it('повинен логувати відмову в доступі', async () => {
      await auditLog.logAccessDenied('/admin', 'access', 'user-123', '127.0.0.1', 'Insufficient permissions');

      expect(true).toBe(true);
    });
  });
});
