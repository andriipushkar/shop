/**
 * CSRF Protection
 * Token-based CSRF protection for forms and API requests
 */

import { randomBytes, createHmac } from 'crypto';

// Configuration
const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

export interface CSRFToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface CSRFValidationResult {
  valid: boolean;
  error?: string;
}

// In-memory token store (for production, use Redis or database)
const tokenStore = new Map<string, CSRFToken>();

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Create HMAC signature for token verification
 */
function signToken(token: string, sessionId: string): string {
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(`${token}:${sessionId}`);
  return hmac.digest('hex');
}

/**
 * Generate CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const randomPart = generateRandomToken();
  const signature = signToken(randomPart, sessionId);
  const token = `${randomPart}.${signature}`;

  const now = Date.now();
  tokenStore.set(token, {
    token,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY,
  });

  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  token: string | null | undefined,
  sessionId: string
): CSRFValidationResult {
  if (!token) {
    return { valid: false, error: 'CSRF token is missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid CSRF token format' };
  }

  const [randomPart, providedSignature] = parts;

  // Verify signature
  const expectedSignature = signToken(randomPart, sessionId);
  if (providedSignature !== expectedSignature) {
    return { valid: false, error: 'Invalid CSRF token signature' };
  }

  // Check token exists and not expired
  const storedToken = tokenStore.get(token);
  if (!storedToken) {
    return { valid: false, error: 'CSRF token not found or already used' };
  }

  if (Date.now() > storedToken.expiresAt) {
    tokenStore.delete(token);
    return { valid: false, error: 'CSRF token has expired' };
  }

  return { valid: true };
}

/**
 * Validate and consume CSRF token (single use)
 */
export function consumeCSRFToken(
  token: string | null | undefined,
  sessionId: string
): CSRFValidationResult {
  const result = validateCSRFToken(token, sessionId);

  if (result.valid && token) {
    tokenStore.delete(token);
  }

  return result;
}

/**
 * Invalidate a CSRF token
 */
export function invalidateCSRFToken(token: string): void {
  tokenStore.delete(token);
}

/**
 * Invalidate all tokens for a session (e.g., on logout)
 */
export function invalidateSessionTokens(sessionId: string): void {
  for (const [token] of tokenStore.entries()) {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [randomPart] = parts;
      const expectedSignature = signToken(randomPart, sessionId);
      if (parts[1] === expectedSignature) {
        tokenStore.delete(token);
      }
    }
  }
}

/**
 * Start cleanup interval for expired tokens
 */
export function startCSRFCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tokenStore.entries()) {
      if (now > value.expiresAt) {
        tokenStore.delete(key);
      }
    }
  }, intervalMs);
}

/**
 * Stop cleanup interval
 */
export function stopCSRFCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all CSRF tokens (for testing)
 */
export function clearCSRFTokens(): void {
  tokenStore.clear();
}

/**
 * Get CSRF token from request headers
 */
export function getCSRFTokenFromHeaders(headers: Headers | Record<string, string>): string | null {
  if (headers instanceof Headers) {
    return headers.get('X-CSRF-Token') || headers.get('x-csrf-token');
  }
  return headers['X-CSRF-Token'] || headers['x-csrf-token'] || null;
}

/**
 * Get CSRF token from form data
 */
export function getCSRFTokenFromFormData(formData: FormData): string | null {
  const token = formData.get('_csrf');
  return typeof token === 'string' ? token : null;
}

/**
 * Create CSRF middleware for API routes
 */
export function createCSRFMiddleware() {
  return (
    token: string | null | undefined,
    sessionId: string,
    singleUse: boolean = true
  ): CSRFValidationResult => {
    if (singleUse) {
      return consumeCSRFToken(token, sessionId);
    }
    return validateCSRFToken(token, sessionId);
  };
}

/**
 * Double Submit Cookie pattern
 * Generate token that should be stored in both cookie and form/header
 */
export function generateDoubleSubmitToken(): string {
  return generateRandomToken();
}

/**
 * Validate Double Submit Cookie pattern
 */
export function validateDoubleSubmit(
  cookieToken: string | null | undefined,
  headerToken: string | null | undefined
): CSRFValidationResult {
  if (!cookieToken || !headerToken) {
    return { valid: false, error: 'Missing CSRF tokens' };
  }

  if (cookieToken !== headerToken) {
    return { valid: false, error: 'CSRF tokens do not match' };
  }

  return { valid: true };
}

/**
 * Generate token with metadata
 */
export function generateTokenWithMetadata(sessionId: string, metadata?: Record<string, string>): {
  token: string;
  expiresAt: Date;
} {
  const token = generateCSRFToken(sessionId);
  const stored = tokenStore.get(token);

  return {
    token,
    expiresAt: new Date(stored?.expiresAt || Date.now() + TOKEN_EXPIRY),
  };
}

/**
 * CSRF protection for forms - generates hidden input HTML
 */
export function csrfInputField(token: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}" />`;
}

/**
 * Escape HTML entities for safe rendering
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Exempted paths that don't require CSRF (e.g., webhooks)
 */
const exemptedPaths = [
  '/api/webhooks/',
  '/api/payments/callback',
  '/api/marketplaces/webhook',
];

/**
 * Check if path is exempted from CSRF protection
 */
export function isCSRFExempted(path: string): boolean {
  return exemptedPaths.some(exempt => path.startsWith(exempt));
}

// Start cleanup on module load
if (typeof window === 'undefined') {
  startCSRFCleanup();
}
