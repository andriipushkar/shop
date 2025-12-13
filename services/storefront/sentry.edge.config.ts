import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Environment
    environment: process.env.NODE_ENV,

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

    // Don't send events in development
    beforeSend(event) {
        if (process.env.NODE_ENV === 'development') {
            return null;
        }
        return event;
    },
});
