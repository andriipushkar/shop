/**
 * Tests for CSRF Protection
 */

import {
  generateCSRFToken,
  validateCSRFToken,
  consumeCSRFToken,
  invalidateCSRFToken,
  invalidateSessionTokens,
  getCSRFTokenFromHeaders,
  getCSRFTokenFromFormData,
  createCSRFMiddleware,
  generateDoubleSubmitToken,
  validateDoubleSubmit,
  requiresCSRFProtection,
  isCSRFExempted,
  clearCSRFTokens,
} from '@/lib/security/csrf';

describe('CSRF Protection', () => {
  beforeEach(() => {
    clearCSRFTokens();
  });

  describe('generateCSRFToken', () => {
    it('generates a token with correct format', () => {
      const token = generateCSRFToken('session-123');
      expect(token).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);
    });

    it('generates unique tokens', () => {
      const token1 = generateCSRFToken('session-123');
      const token2 = generateCSRFToken('session-123');
      expect(token1).not.toBe(token2);
    });

    it('tokens contain random part and signature', () => {
      const token = generateCSRFToken('session-123');
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBe(64); // 32 bytes = 64 hex chars
      expect(parts[1].length).toBe(64); // SHA256 = 64 hex chars
    });
  });

  describe('validateCSRFToken', () => {
    it('validates a correct token', () => {
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);
      const result = validateCSRFToken(token, sessionId);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects missing token', () => {
      const result = validateCSRFToken(null, 'session-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CSRF token is missing');
    });

    it('rejects undefined token', () => {
      const result = validateCSRFToken(undefined, 'session-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CSRF token is missing');
    });

    it('rejects invalid format', () => {
      const result = validateCSRFToken('invalid-token', 'session-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid CSRF token format');
    });

    it('rejects token with wrong session', () => {
      const token = generateCSRFToken('session-123');
      const result = validateCSRFToken(token, 'different-session');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid CSRF token signature');
    });

    it('rejects tampered token', () => {
      const token = generateCSRFToken('session-123');
      const [randomPart] = token.split('.');
      const tamperedToken = `${randomPart}.tampered`;
      const result = validateCSRFToken(tamperedToken, 'session-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid CSRF token signature');
    });

    it('rejects non-existent token', () => {
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);
      clearCSRFTokens(); // Clear after generating
      const result = validateCSRFToken(token, sessionId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CSRF token not found or already used');
    });
  });

  describe('consumeCSRFToken', () => {
    it('validates and consumes token', () => {
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);

      const result1 = consumeCSRFToken(token, sessionId);
      expect(result1.valid).toBe(true);

      // Second use should fail
      const result2 = consumeCSRFToken(token, sessionId);
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('CSRF token not found or already used');
    });

    it('does not consume invalid token', () => {
      const result = consumeCSRFToken('invalid', 'session-123');
      expect(result.valid).toBe(false);
    });
  });

  describe('invalidateCSRFToken', () => {
    it('invalidates a token', () => {
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);

      invalidateCSRFToken(token);

      const result = validateCSRFToken(token, sessionId);
      expect(result.valid).toBe(false);
    });
  });

  describe('invalidateSessionTokens', () => {
    it('invalidates all tokens for a session', () => {
      const sessionId = 'session-123';
      const token1 = generateCSRFToken(sessionId);
      const token2 = generateCSRFToken(sessionId);
      const otherToken = generateCSRFToken('other-session');

      invalidateSessionTokens(sessionId);

      expect(validateCSRFToken(token1, sessionId).valid).toBe(false);
      expect(validateCSRFToken(token2, sessionId).valid).toBe(false);
      expect(validateCSRFToken(otherToken, 'other-session').valid).toBe(true);
    });
  });

  describe('getCSRFTokenFromHeaders', () => {
    it('extracts token from Headers object', () => {
      const headers = new Headers();
      headers.set('X-CSRF-Token', 'token-value');
      expect(getCSRFTokenFromHeaders(headers)).toBe('token-value');
    });

    it('extracts token from lowercase header', () => {
      const headers = new Headers();
      headers.set('x-csrf-token', 'token-value');
      expect(getCSRFTokenFromHeaders(headers)).toBe('token-value');
    });

    it('extracts token from plain object', () => {
      const headers = { 'X-CSRF-Token': 'token-value' };
      expect(getCSRFTokenFromHeaders(headers)).toBe('token-value');
    });

    it('returns null when token not present', () => {
      const headers = new Headers();
      expect(getCSRFTokenFromHeaders(headers)).toBeNull();
    });
  });

  describe('getCSRFTokenFromFormData', () => {
    it('extracts token from FormData', () => {
      const formData = new FormData();
      formData.set('_csrf', 'token-value');
      expect(getCSRFTokenFromFormData(formData)).toBe('token-value');
    });

    it('returns null when token not present', () => {
      const formData = new FormData();
      expect(getCSRFTokenFromFormData(formData)).toBeNull();
    });

    it('returns null for non-string value', () => {
      const formData = new FormData();
      const file = new File([''], 'test.txt');
      formData.set('_csrf', file);
      expect(getCSRFTokenFromFormData(formData)).toBeNull();
    });
  });

  describe('createCSRFMiddleware', () => {
    it('creates middleware that validates tokens', () => {
      const middleware = createCSRFMiddleware();
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);

      const result = middleware(token, sessionId, false);
      expect(result.valid).toBe(true);
    });

    it('single use mode consumes token', () => {
      const middleware = createCSRFMiddleware();
      const sessionId = 'session-123';
      const token = generateCSRFToken(sessionId);

      const result1 = middleware(token, sessionId, true);
      expect(result1.valid).toBe(true);

      const result2 = middleware(token, sessionId, true);
      expect(result2.valid).toBe(false);
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    describe('generateDoubleSubmitToken', () => {
      it('generates a random token', () => {
        const token = generateDoubleSubmitToken();
        expect(token).toMatch(/^[a-f0-9]{64}$/);
      });

      it('generates unique tokens', () => {
        const token1 = generateDoubleSubmitToken();
        const token2 = generateDoubleSubmitToken();
        expect(token1).not.toBe(token2);
      });
    });

    describe('validateDoubleSubmit', () => {
      it('validates matching tokens', () => {
        const token = 'same-token';
        const result = validateDoubleSubmit(token, token);
        expect(result.valid).toBe(true);
      });

      it('rejects missing cookie token', () => {
        const result = validateDoubleSubmit(null, 'header-token');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Missing CSRF tokens');
      });

      it('rejects missing header token', () => {
        const result = validateDoubleSubmit('cookie-token', null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Missing CSRF tokens');
      });

      it('rejects mismatched tokens', () => {
        const result = validateDoubleSubmit('cookie-token', 'different-token');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CSRF tokens do not match');
      });
    });
  });

  describe('requiresCSRFProtection', () => {
    it('returns false for safe methods', () => {
      expect(requiresCSRFProtection('GET')).toBe(false);
      expect(requiresCSRFProtection('HEAD')).toBe(false);
      expect(requiresCSRFProtection('OPTIONS')).toBe(false);
    });

    it('returns true for unsafe methods', () => {
      expect(requiresCSRFProtection('POST')).toBe(true);
      expect(requiresCSRFProtection('PUT')).toBe(true);
      expect(requiresCSRFProtection('DELETE')).toBe(true);
      expect(requiresCSRFProtection('PATCH')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(requiresCSRFProtection('get')).toBe(false);
      expect(requiresCSRFProtection('post')).toBe(true);
    });
  });

  describe('isCSRFExempted', () => {
    it('exempts webhook paths', () => {
      expect(isCSRFExempted('/api/webhooks/stripe')).toBe(true);
      expect(isCSRFExempted('/api/webhooks/paypal')).toBe(true);
    });

    it('exempts payment callback path', () => {
      expect(isCSRFExempted('/api/payments/callback')).toBe(true);
    });

    it('exempts marketplace webhook path', () => {
      expect(isCSRFExempted('/api/marketplaces/webhook')).toBe(true);
    });

    it('does not exempt regular paths', () => {
      expect(isCSRFExempted('/api/products')).toBe(false);
      expect(isCSRFExempted('/api/checkout')).toBe(false);
      expect(isCSRFExempted('/api/users')).toBe(false);
    });
  });
});
