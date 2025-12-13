import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { apiLogger } from '@/lib/logger';

/**
 * GET /api/recommendations
 *
 * Query params:
 * - productId: ID товару для пошуку схожих (required for type=similar or type=bought-together)
 * - type: similar | bought-together | hybrid (default: similar)
 * - limit: кількість результатів (default: 10)
 * - excludeIds: ID товарів які треба виключити (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const type = searchParams.get('type') || 'similar';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

    // Валідація
    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    let recommendations;

    switch (type) {
      case 'similar':
        recommendations = await recommendationEngine.getSimilarProducts(productId, {
          limit,
          excludeIds,
          includeReasons: true,
        });
        break;

      case 'bought-together':
        recommendations = await recommendationEngine.getFrequentlyBoughtTogether(productId, {
          limit,
          excludeIds,
        });
        break;

      case 'hybrid':
        recommendations = await recommendationEngine.getHybridRecommendations(productId, {
          limit,
          excludeIds,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: similar, bought-together, or hybrid' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      recommendations,
      meta: {
        productId,
        type,
        count: recommendations.length,
        limit,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    apiLogger.error('Error in recommendations API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
