/**
 * Retry utilities with exponential backoff
 * For resilient API calls to external services
 */

export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Initial delay in milliseconds */
    initialDelayMs: number;
    /** Maximum delay in milliseconds */
    maxDelayMs: number;
    /** Multiplier for exponential backoff */
    backoffMultiplier: number;
    /** Whether to add jitter to prevent thundering herd */
    jitter: boolean;
    /** HTTP status codes that should trigger a retry */
    retryableStatusCodes: number[];
    /** Request timeout in milliseconds */
    timeoutMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    timeoutMs: 30000,
};

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
    totalTimeMs: number;
}

/**
 * Calculate delay for next retry with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    if (config.jitter) {
        // Add random jitter of up to 50% of the delay
        const jitterRange = cappedDelay * 0.5;
        return cappedDelay + Math.random() * jitterRange;
    }

    return cappedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
    if (error instanceof Error) {
        // Network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return true;
        }
        // Timeout errors
        if (error.name === 'AbortError') {
            return true;
        }
    }

    // HTTP response errors
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        return config.retryableStatusCodes.includes(status);
    }

    return false;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
            // Add timeout wrapper
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Request timeout after ${finalConfig.timeoutMs}ms`));
                }, finalConfig.timeoutMs);
            });

            const result = await Promise.race([fn(), timeoutPromise]);

            return {
                success: true,
                data: result,
                attempts: attempt + 1,
                totalTimeMs: Date.now() - startTime,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt < finalConfig.maxRetries && isRetryableError(error, finalConfig)) {
                const delay = calculateDelay(attempt, finalConfig);
                await sleep(delay);
                continue;
            }

            // No more retries or non-retryable error
            break;
        }
    }

    return {
        success: false,
        error: lastError,
        attempts: finalConfig.maxRetries + 1,
        totalTimeMs: Date.now() - startTime,
    };
}

/**
 * Fetch with retry and timeout
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    config: Partial<RetryConfig> = {}
): Promise<Response> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

    const result = await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            if (!response.ok && finalConfig.retryableStatusCodes.includes(response.status)) {
                throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
            }

            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }, finalConfig);

    if (!result.success || !result.data) {
        throw result.error || new Error('Request failed after retries');
    }

    return result.data;
}

/**
 * Create a retry-wrapped function
 */
export function createRetryWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    config: Partial<RetryConfig> = {}
): T {
    return (async (...args: Parameters<T>) => {
        const result = await withRetry(() => fn(...args), config);
        if (!result.success) {
            throw result.error;
        }
        return result.data;
    }) as T;
}

/**
 * Circuit breaker for API calls
 */
export class CircuitBreaker {
    private failures = 0;
    private lastFailure: number | null = null;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private readonly threshold: number = 5,
        private readonly resetTimeMs: number = 60000
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - (this.lastFailure || 0) > this.resetTimeMs) {
                this.state = 'half-open';
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailure = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'open';
        }
    }

    getState(): string {
        return this.state;
    }

    reset(): void {
        this.failures = 0;
        this.lastFailure = null;
        this.state = 'closed';
    }
}
