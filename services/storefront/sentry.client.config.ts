import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Enable debug in development
    debug: process.env.NODE_ENV === 'development',

    // Environment
    environment: process.env.NODE_ENV,

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

    // Integrations
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
        Sentry.browserTracingIntegration(),
    ],

    // Filter out common errors
    ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        'Loading chunk',
        'ChunkLoadError',
    ],

    // Custom before send to filter sensitive data
    beforeSend(event) {
        // Don't send events in development
        if (process.env.NODE_ENV === 'development') {
            return null;
        }

        // Remove any PII from breadcrumbs
        if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
                if (breadcrumb.data?.url) {
                    // Remove query params that might contain sensitive data
                    const url = new URL(breadcrumb.data.url, 'http://localhost');
                    url.searchParams.delete('token');
                    url.searchParams.delete('password');
                    url.searchParams.delete('email');
                    breadcrumb.data.url = url.pathname + url.search;
                }
                return breadcrumb;
            });
        }

        return event;
    },
});
