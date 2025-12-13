/**
 * AI Seasonality Analysis API
 * Analyze seasonality patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { demandForecastingService } from '@/lib/ai/demand-forecasting';

/**
 * GET /api/ai/forecast/seasonality
 * Get seasonality analysis for a product
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const seasonality = await demandForecastingService.analyzeSeasonality(productId);

    return NextResponse.json({
      success: true,
      data: seasonality,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to analyze seasonality',
      },
      { status: 500 }
    );
  }
}
