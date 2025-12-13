import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { apiLogger } from '@/lib/logger';

/**
 * GET /api/recommendations/history
 *
 * Рекомендації на основі переглянутих товарів
 *
 * Query params:
 * - productIds: ID переглянутих товарів (comma-separated, required)
 * - limit: кількість результатів (default: 10)
 * - excludeIds: ID товарів які треба виключити (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdsParam = searchParams.get('productIds');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

    // Валідація
    if (!productIdsParam) {
      return NextResponse.json(
        { error: 'productIds is required (comma-separated list)' },
        { status: 400 }
      );
    }

    const viewedProductIds = productIdsParam.split(',').filter(Boolean);

    if (viewedProductIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one productId is required' },
        { status: 400 }
      );
    }

    const recommendations = await recommendationEngine.getRecommendationsFromHistory(
      viewedProductIds,
      {
        limit,
        excludeIds,
      }
    );

    return NextResponse.json({
      recommendations,
      meta: {
        type: 'history',
        viewedCount: viewedProductIds.length,
        count: recommendations.length,
        limit,
      },
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    apiLogger.error('Error in history recommendations API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
