/**
 * Tests for IP Whitelist Security
 */

import {
    isIPWhitelisted,
    getClientIP,
    validateWebhookIP,
    createIPWhitelistMiddleware,
} from '@/lib/security/ip-whitelist';

// Mock Request for Node.js environment
class MockRequest {
    private _headers: Map<string, string>;
    url: string;

    constructor(url: string, options?: { headers?: Record<string, string> }) {
        this.url = url;
        this._headers = new Map();
        if (options?.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                this._headers.set(key.toLowerCase(), value);
            });
        }
    }

    get headers() {
        return {
            get: (name: string) => this._headers.get(name.toLowerCase()) || null,
        };
    }
}

describe('IP Whitelist Security', () => {
    // Store original env
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('isIPWhitelisted', () => {
        it('allows localhost in non-production', () => {
            process.env.NODE_ENV = 'development';
            expect(isIPWhitelisted('127.0.0.1', 'monobank')).toBe(true);
        });

        it('allows ::1 in non-production', () => {
            process.env.NODE_ENV = 'development';
            expect(isIPWhitelisted('::1', 'monobank')).toBe(true);
        });

        it('allows skipping whitelist in development with flag', () => {
            process.env.NODE_ENV = 'development';
            process.env.SKIP_IP_WHITELIST = 'true';
            expect(isIPWhitelisted('192.168.1.1', 'monobank')).toBe(true);
        });

        it('blocks unknown provider in production', () => {
            process.env.NODE_ENV = 'production';
            expect(isIPWhitelisted('192.168.1.1', 'unknown' as 'monobank')).toBe(false);
        });

        it('checks monobank IPs', () => {
            process.env.NODE_ENV = 'production';
            // This should be false since 192.168.1.1 is not in monobank whitelist
            expect(isIPWhitelisted('192.168.1.1', 'monobank')).toBe(false);
        });

        it('checks liqpay IPs', () => {
            process.env.NODE_ENV = 'production';
            expect(isIPWhitelisted('192.168.1.1', 'liqpay')).toBe(false);
        });

        it('checks all providers when type is all', () => {
            process.env.NODE_ENV = 'development';
            expect(isIPWhitelisted('127.0.0.1', 'all')).toBe(true);
        });
    });

    describe('getClientIP', () => {
        it('extracts IP from cf-connecting-ip header', () => {
            const request = new MockRequest('http://localhost', {
                headers: {
                    'cf-connecting-ip': '1.2.3.4',
                },
            });
            expect(getClientIP(request as unknown as Request)).toBe('1.2.3.4');
        });

        it('extracts first IP from x-forwarded-for header', () => {
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-forwarded-for': '5.6.7.8, 9.10.11.12',
                },
            });
            expect(getClientIP(request as unknown as Request)).toBe('5.6.7.8');
        });

        it('extracts IP from x-real-ip header', () => {
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-real-ip': '13.14.15.16',
                },
            });
            expect(getClientIP(request as unknown as Request)).toBe('13.14.15.16');
        });

        it('returns 0.0.0.0 when no IP headers present', () => {
            const request = new MockRequest('http://localhost');
            expect(getClientIP(request as unknown as Request)).toBe('0.0.0.0');
        });

        it('prefers cf-connecting-ip over other headers', () => {
            const request = new MockRequest('http://localhost', {
                headers: {
                    'cf-connecting-ip': '1.1.1.1',
                    'x-forwarded-for': '2.2.2.2',
                    'x-real-ip': '3.3.3.3',
                },
            });
            expect(getClientIP(request as unknown as Request)).toBe('1.1.1.1');
        });
    });

    describe('validateWebhookIP', () => {
        it('returns valid for allowed IPs', () => {
            process.env.NODE_ENV = 'development';
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-real-ip': '127.0.0.1',
                },
            });
            const result = validateWebhookIP(request as unknown as Request, 'monobank');
            expect(result.valid).toBe(true);
            expect(result.ip).toBe('127.0.0.1');
        });

        it('returns error with IP for blocked IPs', () => {
            process.env.NODE_ENV = 'production';
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-real-ip': '192.168.1.1',
                },
            });
            const result = validateWebhookIP(request as unknown as Request, 'monobank');
            expect(result.valid).toBe(false);
            expect(result.ip).toBe('192.168.1.1');
            expect(result.error).toContain('not in the monobank whitelist');
        });
    });

    describe('createIPWhitelistMiddleware', () => {
        it('creates middleware function', () => {
            const middleware = createIPWhitelistMiddleware('monobank');
            expect(typeof middleware).toBe('function');
        });

        it('middleware allows valid requests', () => {
            process.env.NODE_ENV = 'development';
            const middleware = createIPWhitelistMiddleware('monobank');
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-real-ip': '127.0.0.1',
                },
            });
            const result = middleware(request as unknown as Request);
            expect(result.allowed).toBe(true);
        });

        it('middleware blocks invalid requests', () => {
            process.env.NODE_ENV = 'production';
            const middleware = createIPWhitelistMiddleware('monobank');
            const request = new MockRequest('http://localhost', {
                headers: {
                    'x-real-ip': '192.168.1.1',
                },
            });
            const result = middleware(request as unknown as Request);
            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
