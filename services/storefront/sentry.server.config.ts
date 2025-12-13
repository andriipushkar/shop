import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Enable debug in development
    debug: process.env.NODE_ENV === 'development',

    // Environment
    environment: process.env.NODE_ENV,

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

    // Integrations
    integrations: [
        Sentry.prismaIntegration(),
    ],

    // Don't send events in development
    beforeSend(event) {
        if (process.env.NODE_ENV === 'development') {
            return null;
        }
        return event;
    },
});
