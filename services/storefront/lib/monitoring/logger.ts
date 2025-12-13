// Structured logging utility

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

interface LoggerConfig {
    level: LogLevel;
    format: 'json' | 'pretty';
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const defaultConfig: LoggerConfig = {
    level: (process.env.LOG_LEVEL as LogLevel) || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    enableConsole: true,
    enableRemote: process.env.NODE_ENV === 'production',
    remoteEndpoint: process.env.LOG_ENDPOINT,
};

class Logger {
    private config: LoggerConfig;
    private context: Record<string, unknown> = {};
    private buffer: LogEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...defaultConfig, ...config };

        // Start buffer flush interval for remote logging
        if (this.config.enableRemote && typeof window !== 'undefined') {
            this.flushInterval = setInterval(() => this.flush(), 5000);
        }
    }

    // Set global context
    setContext(context: Record<string, unknown>) {
        this.context = { ...this.context, ...context };
    }

    // Clear context
    clearContext() {
        this.context = {};
    }

    // Create child logger with additional context
    child(context: Record<string, unknown>): Logger {
        const childLogger = new Logger(this.config);
        childLogger.setContext({ ...this.context, ...context });
        return childLogger;
    }

    // Log methods
    debug(message: string, context?: Record<string, unknown>) {
        this.log('debug', message, context);
    }

    info(message: string, context?: Record<string, unknown>) {
        this.log('info', message, context);
    }

    warn(message: string, context?: Record<string, unknown>) {
        this.log('warn', message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>) {
        this.log('error', message, context, error);
    }

    // Main log method
    private log(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
        error?: Error
    ) {
        // Check log level
        if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: { ...this.context, ...context },
        };

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }

        // Console output
        if (this.config.enableConsole) {
            this.outputToConsole(entry);
        }

        // Buffer for remote logging
        if (this.config.enableRemote) {
            this.buffer.push(entry);
            if (this.buffer.length >= 10) {
                this.flush();
            }
        }
    }

    // Console output
    private outputToConsole(entry: LogEntry) {
        const consoleMethods: Record<LogLevel, (...args: unknown[]) => void> = {
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error,
        };

        const method = consoleMethods[entry.level];

        if (this.config.format === 'json') {
            method(JSON.stringify(entry));
        } else {
            const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
            if (entry.error) {
                method(prefix, entry.message, entry.context, entry.error);
            } else if (entry.context && Object.keys(entry.context).length > 0) {
                method(prefix, entry.message, entry.context);
            } else {
                method(prefix, entry.message);
            }
        }
    }

    // Flush buffer to remote
    async flush() {
        if (this.buffer.length === 0 || !this.config.remoteEndpoint) {
            return;
        }

        const entries = [...this.buffer];
        this.buffer = [];

        try {
            await fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ logs: entries }),
            });
        } catch {
            // Re-add failed entries to buffer
            this.buffer = [...entries, ...this.buffer];
        }
    }

    // Cleanup
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flush();
    }
}

// Create default logger instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };
export type { LoggerConfig, LogEntry, LogLevel };

// Performance logging utilities
export function logPerformance(name: string, duration: number, metadata?: Record<string, unknown>) {
    logger.info(`Performance: ${name}`, {
        metric: 'performance',
        name,
        duration,
        ...metadata,
    });
}

export function measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
): Promise<T> {
    const start = performance.now();
    return fn().finally(() => {
        const duration = performance.now() - start;
        logPerformance(name, duration, metadata);
    });
}

// Request logging middleware (for API routes)
export function createRequestLogger() {
    return {
        logRequest(req: { method: string; url: string; headers?: Record<string, string> }) {
            logger.info('Incoming request', {
                method: req.method,
                url: req.url,
                userAgent: req.headers?.['user-agent'],
            });
        },

        logResponse(
            req: { method: string; url: string },
            res: { status: number },
            duration: number
        ) {
            logger.info('Request completed', {
                method: req.method,
                url: req.url,
                status: res.status,
                duration,
            });
        },

        logError(
            req: { method: string; url: string },
            error: Error
        ) {
            logger.error('Request failed', error, {
                method: req.method,
                url: req.url,
            });
        },
    };
}
