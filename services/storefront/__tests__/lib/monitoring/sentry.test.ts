/**
 * Sentry Integration Tests
 */

import * as Sentry from '@sentry/nextjs';
import {
    initSentry,
    captureError,
    captureMessage,
    setUser,
    setUserContext,
    addBreadcrumb,
    setContext,
    setTag,
    withErrorTracking,
    measurePerformance,
    trackApiCall,
    trackDatabaseQuery,
    setBusinessContext,
    setFeatureFlags,
    isSentryEnabled,
    flushEvents,
    closeSentry,
    type SentryConfig,
    type UserContext,
} from '@/lib/monitoring/sentry';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
    setContext: jest.fn(),
    setTag: jest.fn(),
    startInactiveSpan: jest.fn(() => ({
        setAttribute: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
    })),
    withErrorBoundary: jest.fn((Component) => Component),
    getCurrentHub: jest.fn(() => ({
        getClient: jest.fn(() => ({})),
    })),
    flush: jest.fn(() => Promise.resolve(true)),
    close: jest.fn(() => Promise.resolve(true)),
    browserTracingIntegration: jest.fn(() => ({})),
    replayIntegration: jest.fn(() => ({})),
    prismaIntegration: jest.fn(() => ({})),
    httpIntegration: jest.fn(() => ({})),
    nodeProfilingIntegration: jest.fn(() => ({})),
}));

describe('Sentry Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Set default environment variables
        process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    describe('initSentry', () => {
        it('should initialize Sentry with default config', () => {
            initSentry();

            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    dsn: 'https://test@sentry.io/123',
                    environment: 'test',
                })
            );
        });

        it('should initialize Sentry with custom config', () => {
            const customConfig: Partial<SentryConfig> = {
                environment: 'production',
                tracesSampleRate: 0.5,
                debug: true,
            };

            initSentry(customConfig);

            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'production',
                    tracesSampleRate: 0.5,
                    debug: true,
                })
            );
        });

        it('should not initialize if DSN is not configured', () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            initSentry();

            expect(Sentry.init).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Sentry DSN not configured. Error monitoring is disabled.'
            );

            consoleWarnSpy.mockRestore();
        });

        it('should filter sensitive data in beforeSend', () => {
            // Set to production to test filtering (test env returns null)
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            initSentry();

            const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;

            const event: any = {
                request: {
                    headers: {
                        authorization: 'Bearer token',
                        cookie: 'session=123',
                        'x-api-key': 'secret',
                    },
                    data: JSON.stringify({
                        password: 'secret123',
                        cardNumber: '1234-5678-9012-3456',
                        normalField: 'value',
                    }),
                    query_string: 'token=secret&key=value&other=data',
                },
            };

            const result = beforeSend(event, {});

            // Restore env
            process.env.NODE_ENV = originalEnv;

            // Result should exist in production
            expect(result).not.toBeNull();

            // Should remove sensitive headers
            expect(result.request.headers).not.toHaveProperty('authorization');
            expect(result.request.headers).not.toHaveProperty('cookie');
            expect(result.request.headers).not.toHaveProperty('x-api-key');

            // Should filter sensitive data
            const data = JSON.parse(result.request.data);
            expect(data.password).toBe('[FILTERED]');
            expect(data.cardNumber).toBe('[FILTERED]');
            expect(data.normalField).toBe('value');

            // Should filter query params
            expect(result.request.query_string).toContain('token=[FILTERED]');
            expect(result.request.query_string).toContain('key=[FILTERED]');
        });

        it('should return null in test environment', () => {
            process.env.NODE_ENV = 'test';
            initSentry();

            const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;

            const event: any = { message: 'test' };
            const result = beforeSend(event, {});

            expect(result).toBeNull();
        });
    });

    describe('Error Tracking', () => {
        it('should capture error with context', () => {
            const error = new Error('Test error');
            const context = { userId: '123', action: 'test' };

            captureError(error, context);

            expect(Sentry.captureException).toHaveBeenCalledWith(error, {
                extra: context,
            });
        });

        it('should capture message with level', () => {
            const message = 'Test message';
            const level = 'warning' as Sentry.SeverityLevel;

            captureMessage(message, level);

            expect(Sentry.captureMessage).toHaveBeenCalledWith(message, level);
        });

        it('should capture message with default level', () => {
            const message = 'Test message';

            captureMessage(message);

            expect(Sentry.captureMessage).toHaveBeenCalledWith(message, 'info');
        });
    });

    describe('User Context', () => {
        it('should set basic user context', () => {
            const user = {
                id: '123',
                email: 'test@example.com',
                name: 'Test User',
            };

            setUser(user);

            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '123',
                email: 'test@example.com',
                username: 'Test User',
            });
        });

        it('should clear user context when null', () => {
            setUser(null);

            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        it('should set extended user context with metadata', () => {
            const user: UserContext = {
                id: '123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'admin',
                subscription: 'premium',
                customField: 'value',
            };

            setUserContext(user);

            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '123',
                email: 'test@example.com',
                username: 'Test User',
            });

            expect(Sentry.setTag).toHaveBeenCalledWith('user.role', 'admin');
            expect(Sentry.setTag).toHaveBeenCalledWith('user.subscription', 'premium');
            expect(Sentry.setContext).toHaveBeenCalledWith('user_metadata', {
                customField: 'value',
            });
        });
    });

    describe('Breadcrumbs', () => {
        it('should add breadcrumb with all parameters', () => {
            const category = 'navigation';
            const message = 'User navigated to page';
            const data = { page: '/home' };
            const level = 'info' as Sentry.SeverityLevel;

            addBreadcrumb(category, message, data, level);

            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                category,
                message,
                data,
                level,
            });
        });

        it('should add breadcrumb with default level', () => {
            const category = 'action';
            const message = 'Button clicked';

            addBreadcrumb(category, message);

            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                category,
                message,
                data: undefined,
                level: 'info',
            });
        });
    });

    describe('Context and Tags', () => {
        it('should set context', () => {
            const name = 'custom';
            const context = { key: 'value' };

            setContext(name, context);

            expect(Sentry.setContext).toHaveBeenCalledWith(name, context);
        });

        it('should set tag', () => {
            const key = 'environment';
            const value = 'production';

            setTag(key, value);

            expect(Sentry.setTag).toHaveBeenCalledWith(key, value);
        });

        it('should set business context', () => {
            const context = {
                cartId: 'cart-123',
                orderId: 'order-456',
                customerId: 'customer-789',
            };

            setBusinessContext(context);

            expect(Sentry.setContext).toHaveBeenCalledWith('business', context);
            expect(Sentry.setTag).toHaveBeenCalledWith('cart.id', 'cart-123');
            expect(Sentry.setTag).toHaveBeenCalledWith('order.id', 'order-456');
            expect(Sentry.setTag).toHaveBeenCalledWith('customer.id', 'customer-789');
        });

        it('should set feature flags', () => {
            const flags = {
                newCheckout: true,
                betaFeature: false,
                experimentId: 'exp-123',
            };

            setFeatureFlags(flags);

            expect(Sentry.setContext).toHaveBeenCalledWith('feature_flags', flags);
            expect(Sentry.setTag).toHaveBeenCalledWith('feature.newCheckout', 'true');
            expect(Sentry.setTag).toHaveBeenCalledWith('feature.betaFeature', 'false');
            expect(Sentry.setTag).toHaveBeenCalledWith('feature.experimentId', 'exp-123');
        });
    });

    describe('Error Tracking Wrapper', () => {
        it('should track errors in async functions', async () => {
            const error = new Error('Async error');
            const fn = jest.fn().mockRejectedValue(error);
            const context = 'test-context';

            const wrappedFn = withErrorTracking(fn, context);

            await expect(wrappedFn('arg1', 'arg2')).rejects.toThrow(error);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
            expect(Sentry.captureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    extra: {
                        context,
                        args: ['arg1', 'arg2'],
                    },
                })
            );
        });

        it('should pass through successful async calls', async () => {
            const result = { data: 'success' };
            const fn = jest.fn().mockResolvedValue(result);

            const wrappedFn = withErrorTracking(fn);

            const actualResult = await wrappedFn();

            expect(actualResult).toEqual(result);
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });
    });

    describe('Performance Monitoring', () => {
        it('should measure performance of async function', async () => {
            const result = 'success';
            const fn = jest.fn().mockResolvedValue(result);
            const mockSpan = {
                setAttribute: jest.fn(),
                setStatus: jest.fn(),
                end: jest.fn(),
            };

            (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(mockSpan);

            const actualResult = await measurePerformance(
                {
                    name: 'test-operation',
                    op: 'function',
                    description: 'Test operation',
                    data: { key: 'value' },
                },
                fn
            );

            expect(actualResult).toBe(result);
            expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
                name: 'test-operation',
                op: 'function',
                attributes: { key: 'value' },
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('description', 'Test operation');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1, message: 'ok' });
            expect(mockSpan.end).toHaveBeenCalled();
        });

        it('should handle errors in performance measurement', async () => {
            const error = new Error('Performance error');
            const fn = jest.fn().mockRejectedValue(error);
            const mockSpan = {
                setAttribute: jest.fn(),
                setStatus: jest.fn(),
                end: jest.fn(),
            };

            (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(mockSpan);

            await expect(
                measurePerformance(
                    { name: 'test-operation', op: 'function' },
                    fn
                )
            ).rejects.toThrow(error);

            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2, message: 'error' });
            expect(mockSpan.end).toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it('should track API calls', async () => {
            const result = { data: 'api response' };
            const fn = jest.fn().mockResolvedValue(result);

            await trackApiCall('/api/users', 'GET', fn);

            expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
                name: 'api.get./api/users',
                op: 'http.client',
                attributes: {
                    endpoint: '/api/users',
                    method: 'GET',
                },
            });
        });

        it('should track database queries', async () => {
            const result = [{ id: 1 }];
            const fn = jest.fn().mockResolvedValue(result);

            await trackDatabaseQuery('select', 'users', fn);

            expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
                name: 'db.select.users',
                op: 'db.query',
                attributes: {
                    operation: 'select',
                    table: 'users',
                },
            });
        });
    });

    describe('Utility Functions', () => {
        it('should check if Sentry is enabled', () => {
            const enabled = isSentryEnabled();

            expect(enabled).toBe(true);
            expect(Sentry.getCurrentHub).toHaveBeenCalled();
        });

        it('should flush events', async () => {
            const result = await flushEvents(3000);

            expect(result).toBe(true);
            expect(Sentry.flush).toHaveBeenCalledWith(3000);
        });

        it('should handle flush errors', async () => {
            (Sentry.flush as jest.Mock).mockRejectedValue(new Error('Flush error'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await flushEvents();

            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should close Sentry', async () => {
            const result = await closeSentry(3000);

            expect(result).toBe(true);
            expect(Sentry.close).toHaveBeenCalledWith(3000);
        });

        it('should handle close errors', async () => {
            (Sentry.close as jest.Mock).mockRejectedValue(new Error('Close error'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await closeSentry();

            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Integration with Browser APIs', () => {
        it('should handle window object in browser environment', () => {
            // Mock window object
            global.window = {
                location: {
                    origin: 'https://example.com',
                },
            } as any;

            initSentry();

            const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
            const replayIntegration = initCall.integrations.find(
                (i: any) => i !== null && typeof i === 'object'
            );

            expect(replayIntegration).toBeDefined();

            // Clean up
            delete (global as any).window;
        });
    });
});
