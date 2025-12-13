/**
 * Next.js Instrumentation
 * This file is used to initialize monitoring and observability tools
 * for both server and edge runtime environments.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Register server-side instrumentation
 * Called once when the server starts
 */
export async function register() {
    // Only run on server-side (not in browser)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initServerSentry } = await import('./lib/monitoring/sentry-server');
        initServerSentry();
    }

    // Edge runtime initialization
    if (process.env.NEXT_RUNTIME === 'edge') {
        const { initEdgeSentry } = await import('./lib/monitoring/sentry-edge');
        initEdgeSentry();
    }
}

/**
 * Called on every request in development
 * Only runs in development mode for hot reloading
 */
export async function onRequestError(
    err: Error & { digest?: string },
    request: {
        path: string;
        method: string;
        headers: Headers;
    },
    context: {
        routerKind: 'Pages Router' | 'App Router';
        routePath?: string;
        routeType?: 'render' | 'route' | 'action' | 'middleware';
    }
) {
    // Capture error with context
    Sentry.captureException(err, {
        level: 'error',
        tags: {
            runtime: process.env.NEXT_RUNTIME,
            routerKind: context.routerKind,
            routeType: context.routeType || 'unknown',
            method: request.method,
        },
        extra: {
            digest: err.digest,
            path: request.path,
            routePath: context.routePath,
        },
        fingerprint: [
            '{{ default }}',
            request.method,
            request.path,
            err.digest || err.message,
        ],
    });
}
