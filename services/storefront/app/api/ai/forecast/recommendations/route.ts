/**
 * AI Purchase Recommendations API
 * Get purchase recommendations based on demand forecasting
 */

import { NextRequest, NextResponse } from 'next/server';
import { demandForecastingService } from '@/lib/ai/demand-forecasting';

/**
 * GET /api/ai/forecast/recommendations
 * Get purchase recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const supplierId = searchParams.get('supplierId');
    const urgency = searchParams.get('urgency');
    const minValue = searchParams.get('minValue');

    const filters: {
      categoryId?: string;
      supplierId?: string;
      urgency?: string;
      minValue?: number;
    } = {};

    if (categoryId) filters.categoryId = categoryId;
    if (supplierId) filters.supplierId = supplierId;
    if (urgency) filters.urgency = urgency;
    if (minValue) filters.minValue = parseFloat(minValue);

    const recommendations = await demandForecastingService.getPurchaseRecommendations(filters);

    // Calculate totals
    const totalCost = recommendations.reduce((sum, r) => sum + r.estimatedCost, 0);
    const totalRevenue = recommendations.reduce((sum, r) => sum + r.estimatedRevenue, 0);
    const avgROI = recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + r.roi, 0) / recommendations.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        summary: {
          totalProducts: recommendations.length,
          totalCost,
          totalRevenue,
          expectedProfit: totalRevenue - totalCost,
          avgROI,
          critical: recommendations.filter(r => r.urgency === 'critical').length,
          high: recommendations.filter(r => r.urgency === 'high').length,
          medium: recommendations.filter(r => r.urgency === 'medium').length,
          low: recommendations.filter(r => r.urgency === 'low').length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get purchase recommendations',
      },
      { status: 500 }
    );
  }
}
