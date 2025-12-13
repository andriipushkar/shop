import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { apiLogger } from '@/lib/logger';

/**
 * GET /api/recommendations/trending
 *
 * Популярні товари (trending)
 *
 * Query params:
 * - limit: кількість результатів (default: 20)
 * - period: період у днях - 7, 14, 30 (default: 7)
 * - excludeIds: ID товарів які треба виключити (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const period = parseInt(searchParams.get('period') || '7');
    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

    // Валідація періоду
    if (![7, 14, 30].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: 7, 14, or 30 days' },
        { status: 400 }
      );
    }

    const recommendations = await recommendationEngine.getTrendingProducts({
      limit,
      excludeIds,
    });

    return NextResponse.json({
      recommendations,
      meta: {
        type: 'trending',
        period,
        count: recommendations.length,
        limit,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
    });
  } catch (error) {
    apiLogger.error('Error in trending recommendations API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
