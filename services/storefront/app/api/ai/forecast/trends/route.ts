/**
 * AI Trend Detection API
 * Detect demand trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { demandForecastingService } from '@/lib/ai/demand-forecasting';

/**
 * GET /api/ai/forecast/trends
 * Get trend analysis for a product
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

    const trends = await demandForecastingService.detectTrends(productId);

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to detect trends',
      },
      { status: 500 }
    );
  }
}
