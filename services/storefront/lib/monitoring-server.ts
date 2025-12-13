/**
 * Server-side Monitoring Functions
 * Функції моніторингу для серверної частини
 */

import { monitoring, type HealthCheck } from './monitoring';

/**
 * Health check для бази даних
 */
export async function checkDatabase(): Promise<{ status: HealthCheck['status']; message?: string }> {
    try {
        const { prisma } = await import('@/lib/db/prisma');
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'healthy' };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Database connection failed',
        };
    }
}

/**
 * Health check для Redis
 */
export async function checkRedis(): Promise<{ status: HealthCheck['status']; message?: string }> {
    try {
        const { cache } = await import('@/lib/cache');
        await cache.set('health-check', 'ok', 10);
        const result = await cache.get('health-check');
        if (result === 'ok') {
            return { status: 'healthy' };
        }
        return { status: 'degraded', message: 'Redis read/write mismatch' };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Redis connection failed',
        };
    }
}

/**
 * Health check для зовнішніх API
 */
export function createExternalApiCheck(
    name: string,
    url: string,
    timeoutMs: number = 5000
): () => Promise<{ status: HealthCheck['status']; message?: string }> {
    return async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
                return { status: 'healthy' };
            }
            return {
                status: 'degraded',
                message: `${name} returned ${response.status}`,
            };
        } catch (error) {
            clearTimeout(timeout);
            return {
                status: 'unhealthy',
                message: error instanceof Error ? error.message : `${name} is unreachable`,
            };
        }
    };
}

/**
 * Ініціалізація серверного моніторингу
 */
export function initServerMonitoring(): void {
    monitoring.registerHealthCheck('database', checkDatabase);
    monitoring.registerHealthCheck('redis', checkRedis);
}

/**
 * Middleware для запису метрик запитів
 */
export function createRequestMetricsMiddleware() {
    return async function requestMetricsMiddleware(
        req: Request,
        handler: () => Promise<Response>
    ): Promise<Response> {
        const startTime = Date.now();
        const url = new URL(req.url);

        try {
            const response = await handler();
            const duration = Date.now() - startTime;

            monitoring.recordMetric('response_time', duration, {
                endpoint: url.pathname,
                method: req.method,
                status: response.status.toString(),
            });

            return response;
        } catch (error) {
            const duration = Date.now() - startTime;

            monitoring.recordMetric('response_time', duration, {
                endpoint: url.pathname,
                method: req.method,
                status: '500',
                error: 'true',
            });

            throw error;
        }
    };
}
