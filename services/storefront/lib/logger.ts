/**
 * Structured Logger
 * Replaces console.log with structured, contextual logging
 * Supports multiple transports: console, file, Sentry, etc.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    requestId?: string;
    userId?: string;
    source?: string;
}

type LogTransport = (entry: LogEntry) => void;

// Configuration
const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};

const MIN_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_FORMAT = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');

// Transports
const transports: LogTransport[] = [];

/**
 * Console transport - outputs to console
 */
function consoleTransport(entry: LogEntry): void {
    if (LOG_FORMAT === 'json') {
        console.log(JSON.stringify(entry));
        return;
    }

    // Pretty format for development
    const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[90m',   // Gray
        info: '\x1b[36m',    // Cyan
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
        fatal: '\x1b[35m',   // Magenta
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    let output = `${color}[${entry.timestamp}] [${entry.level.toUpperCase()}]${reset} ${entry.message}`;

    if (entry.source) {
        output += ` ${'\x1b[90m'}(${entry.source})${reset}`;
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
        output += `\n  ${'\x1b[90m'}${JSON.stringify(entry.context)}${reset}`;
    }

    if (entry.error) {
        output += `\n  ${'\x1b[31m'}Error: ${entry.error.message}${reset}`;
        if (entry.error.stack && process.env.NODE_ENV !== 'production') {
            output += `\n${entry.error.stack}`;
        }
    }

    switch (entry.level) {
        case 'error':
        case 'fatal':
            console.error(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        default:
            console.log(output);
    }
}

// Add console transport by default
transports.push(consoleTransport);

/**
 * Add a custom transport
 */
export function addTransport(transport: LogTransport): void {
    transports.push(transport);
}

/**
 * Remove a transport
 */
export function removeTransport(transport: LogTransport): void {
    const index = transports.indexOf(transport);
    if (index > -1) {
        transports.splice(index, 1);
    }
}

// Request context (for async context tracking)
let currentRequestId: string | undefined;
let currentUserId: string | undefined;

/**
 * Set request context for logging
 */
export function setLogContext(requestId?: string, userId?: string): void {
    currentRequestId = requestId;
    currentUserId = userId;
}

/**
 * Clear request context
 */
export function clearLogContext(): void {
    currentRequestId = undefined;
    currentUserId = undefined;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error, source?: string): void {
    // Check if level is enabled
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LOG_LEVEL]) {
        return;
    }

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        requestId: currentRequestId,
        userId: currentUserId,
        source,
    };

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    // Send to all transports
    transports.forEach(transport => {
        try {
            transport(entry);
        } catch (e) {
            // Don't let transport errors crash the app
            console.error('Logger transport error:', e);
        }
    });
}

/**
 * Logger instance with all log methods
 */
export const logger = {
    debug: (message: string, context?: LogContext, source?: string) =>
        log('debug', message, context, undefined, source),

    info: (message: string, context?: LogContext, source?: string) =>
        log('info', message, context, undefined, source),

    warn: (message: string, context?: LogContext, source?: string) =>
        log('warn', message, context, undefined, source),

    error: (message: string, error?: Error | unknown, context?: LogContext, source?: string) =>
        log('error', message, context, error instanceof Error ? error : undefined, source),

    fatal: (message: string, error?: Error | unknown, context?: LogContext, source?: string) =>
        log('fatal', message, context, error instanceof Error ? error : undefined, source),

    /**
     * Create a child logger with preset context
     */
    child: (source: string, defaultContext?: LogContext) => ({
        debug: (message: string, context?: LogContext) =>
            log('debug', message, { ...defaultContext, ...context }, undefined, source),
        info: (message: string, context?: LogContext) =>
            log('info', message, { ...defaultContext, ...context }, undefined, source),
        warn: (message: string, context?: LogContext) =>
            log('warn', message, { ...defaultContext, ...context }, undefined, source),
        error: (message: string, error?: Error | unknown, context?: LogContext) =>
            log('error', message, { ...defaultContext, ...context }, error instanceof Error ? error : undefined, source),
        fatal: (message: string, error?: Error | unknown, context?: LogContext) =>
            log('fatal', message, { ...defaultContext, ...context }, error instanceof Error ? error : undefined, source),
    }),
};

/**
 * Create Sentry transport (if Sentry DSN is configured)
 */
export function createSentryTransport(): LogTransport | null {
    const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!sentryDsn) return null;

    // Lazy load Sentry to avoid import issues
    let Sentry: typeof import('@sentry/nextjs') | null = null;

    try {
        // Dynamic import to avoid SSR issues
        if (typeof window !== 'undefined') {
            // Browser environment
            import('@sentry/nextjs').then(module => {
                Sentry = module;
            }).catch(err => {
                console.warn('Failed to load Sentry client:', err);
            });
        }
    } catch {
        // Sentry not available
    }

    return (entry: LogEntry) => {
        // Only send error and fatal logs to Sentry
        if (entry.level !== 'error' && entry.level !== 'fatal') {
            return;
        }

        // If Sentry is not loaded yet, skip
        if (!Sentry) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Sentry Transport] Would send: ${entry.message}`);
            }
            return;
        }

        try {
            // Prepare context
            const context: Record<string, unknown> = {
                ...entry.context,
                timestamp: entry.timestamp,
                source: entry.source,
            };

            // Add request context if available
            if (entry.requestId) {
                Sentry.setTag('requestId', entry.requestId);
            }

            if (entry.userId) {
                Sentry.setUser({ id: entry.userId });
            }

            // Send to Sentry
            if (entry.error) {
                // If there's an error object, capture it as an exception
                const error = new Error(entry.error.message);
                error.name = entry.error.name;
                error.stack = entry.error.stack;

                Sentry.captureException(error, {
                    level: entry.level === 'fatal' ? 'fatal' : 'error',
                    extra: context,
                    fingerprint: [entry.source || 'logger', entry.message],
                });
            } else {
                // Otherwise, capture as a message
                Sentry.captureMessage(entry.message, {
                    level: entry.level === 'fatal' ? 'fatal' : 'error',
                    extra: context,
                    fingerprint: [entry.source || 'logger', entry.message],
                });
            }
        } catch (err) {
            // Don't let Sentry errors crash the app
            console.error('Error in Sentry transport:', err);
        }
    };
}

/**
 * Enable Sentry transport for the logger
 * Call this function to start sending error and fatal logs to Sentry
 *
 * @returns {boolean} True if Sentry transport was enabled, false otherwise
 *
 * @example
 * ```typescript
 * import { enableSentryTransport } from '@/lib/logger';
 *
 * // In your app initialization
 * if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
 *   enableSentryTransport();
 * }
 * ```
 */
export function enableSentryTransport(): boolean {
    const sentryTransport = createSentryTransport();

    if (!sentryTransport) {
        console.warn('[Logger] Sentry transport not available (DSN not configured)');
        return false;
    }

    // Check if already added
    const alreadyAdded = transports.some(t => t === sentryTransport);
    if (alreadyAdded) {
        console.warn('[Logger] Sentry transport already enabled');
        return true;
    }

    addTransport(sentryTransport);
    console.log('[Logger] Sentry transport enabled');
    return true;
}

/**
 * Disable Sentry transport for the logger
 *
 * @example
 * ```typescript
 * import { disableSentryTransport } from '@/lib/logger';
 *
 * disableSentryTransport();
 * ```
 */
export function disableSentryTransport(): void {
    // Remove all Sentry transports
    const sentryTransport = createSentryTransport();
    if (sentryTransport) {
        removeTransport(sentryTransport);
        console.log('[Logger] Sentry transport disabled');
    }
}

/**
 * Payment logger - specialized for payment events
 */
export const paymentLogger = logger.child('payment');

/**
 * API logger - specialized for API requests
 */
export const apiLogger = logger.child('api');

/**
 * Auth logger - specialized for authentication
 */
export const authLogger = logger.child('auth');

/**
 * Delivery logger - specialized for delivery services
 */
export const deliveryLogger = logger.child('delivery');

/**
 * Warehouse logger - specialized for warehouse operations
 */
export const warehouseLogger = logger.child('warehouse');

export default logger;
