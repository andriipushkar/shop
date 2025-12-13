// Monitoring module exports
export * from './sentry';
export * from './analytics';
export * from './logger';

// Combined initialization
export function initMonitoring() {
    // Initialize in browser only
    if (typeof window === 'undefined') return;

    // Import dynamically to avoid SSR issues
    Promise.all([
        import('./sentry').then(({ initSentry }) => initSentry()),
        import('./analytics').then(({ initAnalytics }) => initAnalytics()),
    ]).catch(console.error);
}

// Re-export commonly used functions
export { captureError, captureMessage, setUser } from './sentry';
export { trackEvent, trackPageView, ecommerce, userTracking, trackSearch, trackShare } from './analytics';
export { logger, logPerformance, measureAsync } from './logger';
