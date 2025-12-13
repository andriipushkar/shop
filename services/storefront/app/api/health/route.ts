import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 * Used by Docker health checks and monitoring systems
 * GET /api/health
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        server: 'ok',
        database: await checkDatabase(),
        redis: await checkRedis(),
      },
      responseTime: 0,
    };

    // Calculate response time
    health.responseTime = Date.now() - startTime;

    // If any check fails, return 503
    const allHealthy = Object.values(health.checks).every((check) => check === 'ok');

    return NextResponse.json(health, {
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<string> {
  try {
    // Import Prisma dynamically to avoid initialization issues
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

    return 'ok';
  } catch (error) {
    console.error('Database health check failed:', error);
    return 'failed';
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<string> {
  try {
    // Only check if Redis URL is configured
    if (!process.env.REDIS_URL) {
      return 'not_configured';
    }

    // Import Redis dynamically
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL);

    // Simple ping to check connection
    const result = await redis.ping();
    await redis.quit();

    return result === 'PONG' ? 'ok' : 'failed';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return 'failed';
  }
}

/**
 * HEAD request support
 */
export async function HEAD() {
  try {
    const dbCheck = await checkDatabase();
    const redisCheck = await checkRedis();

    const allHealthy = dbCheck === 'ok' && (redisCheck === 'ok' || redisCheck === 'not_configured');

    return new NextResponse(null, {
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
