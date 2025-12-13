/**
 * Sentry Server-side Initialization
 * This module initializes Sentry for Node.js runtime
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Initialize Sentry for server-side (Node.js runtime)
 */
export function initServerSentry() {
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
        console.warn('[Sentry Server] DSN not configured. Server-side error monitoring is disabled.');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERSION || '1.0.0',

        // Server-side performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Enable profiling for performance insights
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

        // Debug mode in development
        debug: process.env.NODE_ENV === 'development',

        // Server-side specific integrations
        integrations: [
            // Prisma integration for database query tracking
            Sentry.prismaIntegration(),

            // HTTP integration for tracking outgoing requests
            Sentry.httpIntegration({
                tracing: {
                    // Don't track certain URLs
                    ignoreOutgoingRequests: [
                        /^https?:\/\/localhost/,
                        /^https?:\/\/127\.0\.0\.1/,
                        /healthcheck/,
                        /metrics/,
                    ],
                },
            }),

            // Node.js integrations
            Sentry.nodeProfilingIntegration(),
        ],

        // Filter sensitive data
        beforeSend(event, hint) {
            // Don't send events in test/development
            if (process.env.NODE_ENV !== 'production') {
                console.log('[Sentry Server] Would send error:', event.message || event.exception);
                return null;
            }

            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
                delete event.request.headers['x-api-key'];
                delete event.request.headers['x-auth-token'];
            }

            // Remove sensitive environment variables
            if (event.contexts?.runtime?.['environment']) {
                const env = event.contexts.runtime['environment'] as Record<string, unknown>;
                const sensitiveKeys = [
                    'DATABASE_URL',
                    'REDIS_URL',
                    'JWT_SECRET',
                    'API_KEY',
                    'PRIVATE_KEY',
                    'SECRET',
                    'PASSWORD',
                    'TOKEN',
                ];

                Object.keys(env).forEach(key => {
                    if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
                        env[key] = '[FILTERED]';
                    }
                });
            }

            // Add server context
            event.contexts = {
                ...event.contexts,
                server: {
                    runtime: 'nodejs',
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                },
            };

            return event;
        },

        // Breadcrumb filtering
        beforeBreadcrumb(breadcrumb) {
            // Filter out sensitive data from breadcrumbs
            if (breadcrumb.category === 'http' && breadcrumb.data) {
                // Remove sensitive headers
                if (breadcrumb.data.headers) {
                    delete breadcrumb.data.headers['authorization'];
                    delete breadcrumb.data.headers['cookie'];
                }

                // Filter sensitive query params
                if (breadcrumb.data.url && typeof breadcrumb.data.url === 'string') {
                    try {
                        const url = new URL(breadcrumb.data.url);
                        const sensitiveParams = ['token', 'key', 'secret', 'password'];

                        sensitiveParams.forEach(param => {
                            if (url.searchParams.has(param)) {
                                url.searchParams.set(param, '[FILTERED]');
                            }
                        });

                        breadcrumb.data.url = url.toString();
                    } catch {
                        // Invalid URL, leave as is
                    }
                }
            }

            return breadcrumb;
        },

        // Ignore certain errors
        ignoreErrors: [
            // Network errors
            'ECONNREFUSED',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',

            // Common non-critical errors
            'AbortError',
            'CanceledError',
            'TimeoutError',
        ],

        // Max breadcrumbs
        maxBreadcrumbs: 100,

        // Transport options
        transportOptions: {
            // Retry on network errors
            retryConfig: {
                maxRetries: 3,
                minTimeout: 1000,
                maxTimeout: 5000,
            },
        },
    });

    // Set global error handlers
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        Sentry.captureException(reason, {
            level: 'error',
            tags: {
                type: 'unhandledRejection',
            },
        });
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        Sentry.captureException(error, {
            level: 'fatal',
            tags: {
                type: 'uncaughtException',
            },
        });

        // Give Sentry time to send the error before exiting
        Sentry.flush(2000).then(() => {
            process.exit(1);
        });
    });

    console.log('[Sentry Server] Initialized successfully');
}

/**
 * Capture server-side error with additional context
 */
export function captureServerError(
    error: Error,
    context?: {
        userId?: string;
        requestId?: string;
        route?: string;
        method?: string;
        [key: string]: unknown;
    }
) {
    Sentry.captureException(error, {
        level: 'error',
        tags: {
            runtime: 'nodejs',
            route: context?.route,
            method: context?.method,
        },
        extra: context,
        user: context?.userId ? { id: context.userId } : undefined,
    });
}

/**
 * Track server-side performance
 */
export async function trackServerPerformance<T>(
    name: string,
    operation: () => Promise<T>
): Promise<T> {
    const span = Sentry.startInactiveSpan({
        name,
        op: 'function.server',
    });

    try {
        const result = await operation();
        span?.setStatus({ code: 1, message: 'ok' });
        return result;
    } catch (error) {
        span?.setStatus({ code: 2, message: 'error' });
        throw error;
    } finally {
        span?.end();
    }
}

export { Sentry };
