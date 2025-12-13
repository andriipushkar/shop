import * as Sentry from '@sentry/nextjs';
import type { ReactNode, ComponentType } from 'react';

/**
 * Sentry initialization configuration
 */
export interface SentryConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    maxBreadcrumbs?: number;
    debug?: boolean;
}

/**
 * Initialize Sentry with custom configuration
 */
export function initSentry(config?: Partial<SentryConfig>) {
    const dsn = config?.dsn || process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
        console.warn('Sentry DSN not configured. Error monitoring is disabled.');
        return;
    }

    const defaultConfig: SentryConfig = {
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.NEXT_PUBLIC_VERSION || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '1.0.0',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        maxBreadcrumbs: 50,
        debug: process.env.NODE_ENV === 'development',
    };

    const finalConfig = { ...defaultConfig, ...config };

    Sentry.init({
        dsn: finalConfig.dsn,
        environment: finalConfig.environment,
        release: finalConfig.release,
        debug: finalConfig.debug,

        // Performance monitoring
        tracesSampleRate: finalConfig.tracesSampleRate,

        // Enable profiling
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Session replay
        replaysSessionSampleRate: finalConfig.replaysSessionSampleRate,
        replaysOnErrorSampleRate: finalConfig.replaysOnErrorSampleRate,

        // Breadcrumbs
        maxBreadcrumbs: finalConfig.maxBreadcrumbs,

        // Filter sensitive data
        beforeSend(event, hint) {
            // Don't send events in test environment
            if (process.env.NODE_ENV === 'test') {
                return null;
            }

            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
                delete event.request.headers['x-api-key'];
            }

            // Remove sensitive data from body
            if (event.request?.data) {
                try {
                    const data = typeof event.request.data === 'string'
                        ? JSON.parse(event.request.data)
                        : event.request.data;

                    // Filter sensitive fields
                    const sensitiveFields = [
                        'password', 'cardNumber', 'cvv', 'cvc', 'token',
                        'apiKey', 'secret', 'privateKey', 'accessToken',
                        'refreshToken', 'sessionId', 'ssn', 'taxId'
                    ];

                    sensitiveFields.forEach(field => {
                        if (data[field]) {
                            data[field] = '[FILTERED]';
                        }
                    });

                    event.request.data = JSON.stringify(data);
                } catch (e) {
                    // If parsing fails, leave data as is
                    console.warn('Failed to parse request data for filtering:', e);
                }
            }

            // Remove sensitive query params
            if (event.request?.query_string) {
                const sensitiveParams = ['token', 'key', 'secret', 'password'];
                let queryString = event.request.query_string;

                sensitiveParams.forEach(param => {
                    const regex = new RegExp(`${param}=[^&]*`, 'gi');
                    queryString = queryString.replace(regex, `${param}=[FILTERED]`);
                });

                event.request.query_string = queryString;
            }

            // Add additional context from hint
            if (hint?.originalException) {
                const exception = hint.originalException;
                if (exception && typeof exception === 'object') {
                    event.extra = {
                        ...event.extra,
                        originalException: {
                            message: (exception as Error).message,
                            name: (exception as Error).name,
                        }
                    };
                }
            }

            return event;
        },

        // Ignore certain errors
        ignoreErrors: [
            // Browser extensions
            'top.GLOBALS',
            'canvas.contentDocument',
            'MyApp_RemoveAllHighlights',
            'atomicFindClose',

            // Browser quirks
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            'Non-Error exception captured',
            'Non-Error promise rejection captured',

            // Network errors
            /Loading chunk \d+ failed/,
            /Loading CSS chunk \d+ failed/,
            'ChunkLoadError',

            // Aborted fetches (user navigation)
            'AbortError',
            'The user aborted a request',
            'The operation was aborted',

            // Browser-specific
            'NS_ERROR_FAILURE',
            'NS_ERROR_NOT_INITIALIZED',
        ],

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration({
                // Custom routing instrumentation
                tracePropagationTargets: [
                    'localhost',
                    /^\//,
                    process.env.NEXT_PUBLIC_API_URL || '',
                ].filter(Boolean),

                // Track fetch/XHR requests
                traceFetch: true,
                traceXHR: true,
            }),
            Sentry.replayIntegration({
                maskAllText: process.env.NODE_ENV === 'production',
                blockAllMedia: process.env.NODE_ENV === 'production',
                maskAllInputs: true,

                // Privacy settings
                networkDetailAllowUrls: [
                    window.location.origin,
                    process.env.NEXT_PUBLIC_API_URL || '',
                ].filter(Boolean),
            }),
        ],
    });

    // Set initial context
    Sentry.setContext('app', {
        version: finalConfig.release,
        environment: finalConfig.environment,
        buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
    });
}

// Error tracking utilities
export function captureError(error: Error, context?: Record<string, unknown>) {
    Sentry.captureException(error, {
        extra: context,
    });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string; name?: string } | null) {
    if (user) {
        Sentry.setUser({
            id: user.id,
            email: user.email,
            username: user.name,
        });
    } else {
        Sentry.setUser(null);
    }
}

export function addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: Sentry.SeverityLevel = 'info'
) {
    Sentry.addBreadcrumb({
        category,
        message,
        data,
        level,
    });
}

// Transaction tracking for performance
export function startTransaction(name: string, op: string) {
    return Sentry.startInactiveSpan({
        name,
        op,
    });
}

// Context management
export function setContext(name: string, context: Record<string, unknown>) {
    Sentry.setContext(name, context);
}

export function setTag(key: string, value: string) {
    Sentry.setTag(key, value);
}

// Wrap async functions with error tracking
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context?: string
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            captureError(error as Error, { context, args });
            throw error;
        }
    }) as T;
}

/**
 * Performance monitoring utilities
 */
export interface PerformanceOptions {
    name: string;
    op: string;
    description?: string;
    data?: Record<string, unknown>;
}

/**
 * Start a performance transaction
 */
export function startPerformanceTransaction(options: PerformanceOptions) {
    const span = Sentry.startInactiveSpan({
        name: options.name,
        op: options.op,
        attributes: options.data,
    });

    if (options.description) {
        span?.setAttribute('description', options.description);
    }

    return span;
}

/**
 * Measure performance of a function
 */
export async function measurePerformance<T>(
    options: PerformanceOptions,
    fn: () => Promise<T> | T
): Promise<T> {
    const span = startPerformanceTransaction(options);

    try {
        const result = await fn();
        span?.setStatus({ code: 1, message: 'ok' }); // OK status
        return result;
    } catch (error) {
        span?.setStatus({ code: 2, message: 'error' }); // ERROR status
        captureError(error as Error, { operation: options.name, ...options.data });
        throw error;
    } finally {
        span?.end();
    }
}

/**
 * Track API call performance
 */
export async function trackApiCall<T>(
    endpoint: string,
    method: string,
    fn: () => Promise<T>
): Promise<T> {
    return measurePerformance(
        {
            name: `api.${method.toLowerCase()}.${endpoint}`,
            op: 'http.client',
            data: { endpoint, method },
        },
        fn
    );
}

/**
 * Track database query performance
 */
export async function trackDatabaseQuery<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
): Promise<T> {
    return measurePerformance(
        {
            name: `db.${operation}.${table}`,
            op: 'db.query',
            data: { operation, table },
        },
        fn
    );
}

/**
 * Custom Error Boundary wrapper component
 */
export interface ErrorBoundaryOptions {
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: { componentStack: string }) => void;
    showDialog?: boolean;
    dialogOptions?: Sentry.ReportDialogOptions;
    beforeCapture?: (scope: Sentry.Scope, error: Error) => void;
}

/**
 * HOC to wrap components with Sentry error boundary
 */
export function withSentryErrorBoundary<P extends object>(
    Component: ComponentType<P>,
    options?: ErrorBoundaryOptions
): ComponentType<P> {
    const WrappedComponent = Sentry.withErrorBoundary(Component, {
        fallback: options?.fallback as any,
        showDialog: options?.showDialog ?? false,
        dialogOptions: options?.dialogOptions,
        beforeCapture: (scope, error) => {
            // Add custom context
            scope.setLevel('error');
            scope.setTag('errorBoundary', 'true');

            // Call custom beforeCapture if provided
            options?.beforeCapture?.(scope, error);
        },
    });

    return WrappedComponent;
}

/**
 * User context integration
 */
export interface UserContext {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    role?: string;
    subscription?: string;
    [key: string]: unknown;
}

/**
 * Set user context with additional metadata
 */
export function setUserContext(user: UserContext | null) {
    if (user) {
        const { id, email, name, username, role, subscription, ...extra } = user;

        Sentry.setUser({
            id,
            email,
            username: username || name,
        });

        // Add additional user context as tags
        if (role) {
            Sentry.setTag('user.role', role);
        }

        if (subscription) {
            Sentry.setTag('user.subscription', subscription);
        }

        // Set extra user data
        if (Object.keys(extra).length > 0) {
            Sentry.setContext('user_metadata', extra);
        }
    } else {
        Sentry.setUser(null);
        Sentry.setContext('user_metadata', null);
    }
}

/**
 * Enhanced setUser function (backward compatible)
 */
export function setUser(user: { id: string; email?: string; name?: string } | null) {
    setUserContext(user);
}

/**
 * Business context helpers
 */
export function setBusinessContext(context: {
    cartId?: string;
    orderId?: string;
    customerId?: string;
    sessionId?: string;
    [key: string]: unknown;
}) {
    Sentry.setContext('business', context);

    // Set important IDs as tags for easier filtering
    if (context.cartId) Sentry.setTag('cart.id', context.cartId);
    if (context.orderId) Sentry.setTag('order.id', context.orderId);
    if (context.customerId) Sentry.setTag('customer.id', context.customerId);
}

/**
 * Track feature flags
 */
export function setFeatureFlags(flags: Record<string, boolean | string>) {
    Sentry.setContext('feature_flags', flags);

    // Also set as tags for quick filtering
    Object.entries(flags).forEach(([key, value]) => {
        Sentry.setTag(`feature.${key}`, String(value));
    });
}

/**
 * Flush events to Sentry immediately
 * Useful before page unload or critical errors
 */
export async function flushEvents(timeout = 2000): Promise<boolean> {
    try {
        return await Sentry.flush(timeout);
    } catch (error) {
        console.error('Failed to flush Sentry events:', error);
        return false;
    }
}

/**
 * Close Sentry client
 * Useful for cleanup in server-side rendering
 */
export async function closeSentry(timeout = 2000): Promise<boolean> {
    try {
        return await Sentry.close(timeout);
    } catch (error) {
        console.error('Failed to close Sentry client:', error);
        return false;
    }
}

/**
 * Check if Sentry is initialized and ready
 */
export function isSentryEnabled(): boolean {
    return !!Sentry.getCurrentHub().getClient();
}

// Export Sentry for direct access
export { Sentry };
