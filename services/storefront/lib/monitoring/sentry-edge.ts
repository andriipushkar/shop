/**
 * Sentry Edge Runtime Initialization
 * This module initializes Sentry for Edge runtime (middleware, edge functions)
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Initialize Sentry for Edge runtime
 */
export function initEdgeSentry() {
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
        console.warn('[Sentry Edge] DSN not configured. Edge runtime error monitoring is disabled.');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERSION || '1.0.0',

        // Performance monitoring for edge
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Debug mode in development
        debug: process.env.NODE_ENV === 'development',

        // Edge-specific configuration
        integrations: [
            // HTTP integration for edge
            Sentry.httpIntegration({
                tracing: {
                    ignoreOutgoingRequests: [
                        /healthcheck/,
                        /metrics/,
                    ],
                },
            }),
        ],

        // Filter sensitive data
        beforeSend(event) {
            // Don't send events in test/development
            if (process.env.NODE_ENV !== 'production') {
                console.log('[Sentry Edge] Would send error:', event.message || event.exception);
                return null;
            }

            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
                delete event.request.headers['x-api-key'];
            }

            // Add edge context
            event.contexts = {
                ...event.contexts,
                runtime: {
                    name: 'edge',
                    version: process.env.VERCEL_REGION || 'unknown',
                },
            };

            return event;
        },

        // Ignore certain errors
        ignoreErrors: [
            'AbortError',
            'CanceledError',
            'TimeoutError',
        ],

        // Max breadcrumbs (smaller for edge)
        maxBreadcrumbs: 50,
    });

    console.log('[Sentry Edge] Initialized successfully');
}

/**
 * Capture edge runtime error
 */
export function captureEdgeError(
    error: Error,
    context?: {
        path?: string;
        method?: string;
        [key: string]: unknown;
    }
) {
    Sentry.captureException(error, {
        level: 'error',
        tags: {
            runtime: 'edge',
            path: context?.path,
            method: context?.method,
        },
        extra: context,
    });
}

export { Sentry };
