/**
 * Tests for Retry Utilities
 */

import {
    withRetry,
    fetchWithRetry,
    createRetryWrapper,
    CircuitBreaker,
    DEFAULT_RETRY_CONFIG,
} from '@/lib/utils/retry';

describe('Retry Utilities', () => {
    describe('withRetry', () => {
        it('succeeds on first attempt', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await withRetry(fn);

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attempts).toBe(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('retries on network error and succeeds', async () => {
            const networkError = new TypeError('fetch failed');
            const fn = jest.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce('success');

            const result = await withRetry(fn, {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attempts).toBe(2);
        });

        it('fails after max retries', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('always fail'));

            const result = await withRetry(fn, {
                maxRetries: 2,
                initialDelayMs: 10,
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('always fail');
            expect(result.attempts).toBe(3); // Initial + 2 retries
        });

        it('does not retry non-retryable errors', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('not retryable'));

            const result = await withRetry(fn, {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            // Generic errors are not automatically retryable
            expect(result.success).toBe(false);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('tracks total time', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await withRetry(fn);

            expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('handles timeout', async () => {
            const fn = jest.fn().mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('late'), 1000))
            );

            const result = await withRetry(fn, {
                timeoutMs: 50,
                maxRetries: 0,
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('timeout');
        }, 10000);
    });

    describe('createRetryWrapper', () => {
        it('wraps function with retry logic on network error', async () => {
            const networkError = new TypeError('fetch failed');
            const original = jest.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce('success');

            const wrapped = createRetryWrapper(original, {
                maxRetries: 1,
                initialDelayMs: 10,
            });

            const result = await wrapped();
            expect(result).toBe('success');
        });

        it('throws after max retries on network error', async () => {
            const networkError = new TypeError('fetch failed');
            const original = jest.fn().mockRejectedValue(networkError);

            const wrapped = createRetryWrapper(original, {
                maxRetries: 1,
                initialDelayMs: 10,
            });

            await expect(wrapped()).rejects.toThrow('fetch failed');
        });
    });

    describe('CircuitBreaker', () => {
        it('starts in closed state', () => {
            const breaker = new CircuitBreaker();
            expect(breaker.getState()).toBe('closed');
        });

        it('allows execution in closed state', async () => {
            const breaker = new CircuitBreaker();
            const result = await breaker.execute(() => Promise.resolve('success'));
            expect(result).toBe('success');
        });

        it('opens after threshold failures', async () => {
            const breaker = new CircuitBreaker(3);

            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(() => Promise.reject(new Error('fail')));
                } catch {
                    // Expected
                }
            }

            expect(breaker.getState()).toBe('open');
        });

        it('rejects immediately when open', async () => {
            const breaker = new CircuitBreaker(1);

            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch {
                // Opens the circuit
            }

            await expect(breaker.execute(() => Promise.resolve('success')))
                .rejects.toThrow('Circuit breaker is open');
        });

        it('transitions to half-open after reset time', async () => {
            const breaker = new CircuitBreaker(1, 50); // 50ms reset time

            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch {
                // Opens the circuit
            }

            expect(breaker.getState()).toBe('open');

            // Wait for reset time
            await new Promise(resolve => setTimeout(resolve, 60));

            // Next call should succeed (half-open allows one attempt)
            const result = await breaker.execute(() => Promise.resolve('success'));
            expect(result).toBe('success');
            expect(breaker.getState()).toBe('closed');
        });

        it('resets state manually', async () => {
            const breaker = new CircuitBreaker(1);

            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch {
                // Opens the circuit
            }

            expect(breaker.getState()).toBe('open');

            breaker.reset();

            expect(breaker.getState()).toBe('closed');
        });

        it('closes on success after half-open', async () => {
            const breaker = new CircuitBreaker(1, 10);

            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch {
                // Opens the circuit
            }

            await new Promise(resolve => setTimeout(resolve, 20));

            await breaker.execute(() => Promise.resolve('success'));

            expect(breaker.getState()).toBe('closed');
        });
    });

    describe('DEFAULT_RETRY_CONFIG', () => {
        it('has sensible defaults', () => {
            expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
            expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
            expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
            expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
            expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
            expect(DEFAULT_RETRY_CONFIG.timeoutMs).toBe(30000);
        });

        it('includes common retryable status codes', () => {
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(408); // Request Timeout
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(429); // Too Many Requests
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(500); // Internal Server Error
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(502); // Bad Gateway
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(503); // Service Unavailable
            expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(504); // Gateway Timeout
        });
    });
});
