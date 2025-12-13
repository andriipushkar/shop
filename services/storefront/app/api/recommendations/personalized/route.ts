import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { apiLogger } from '@/lib/logger';
import { getServerSession } from 'next-auth';

/**
 * GET /api/recommendations/personalized
 *
 * Персоналізовані рекомендації для користувача
 *
 * Query params:
 * - userId: ID користувача (optional, якщо не вказано - береться з сесії)
 * - limit: кількість результатів (default: 20)
 * - excludeIds: ID товарів які треба виключити (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

    // Якщо userId не вказано, беремо з сесії
    if (!userId) {
      const session = await getServerSession();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    }

    if (!userId) {
      // Якщо немає користувача - повертаємо популярні товари
      const trending = await recommendationEngine.getTrendingProducts({
        limit,
        excludeIds,
      });

      return NextResponse.json({
        recommendations: trending,
        meta: {
          type: 'trending',
          count: trending.length,
          limit,
          message: 'Showing trending products (user not authenticated)',
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    const recommendations = await recommendationEngine.getPersonalizedRecommendations(userId, {
      limit,
      excludeIds,
    });

    return NextResponse.json({
      recommendations,
      meta: {
        userId,
        type: 'personalized',
        count: recommendations.length,
        limit,
      },
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    apiLogger.error('Error in personalized recommendations API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
