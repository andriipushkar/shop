/**
 * AI Demand Forecasting API Routes
 * API endpoints for demand forecasting
 */

import { NextRequest, NextResponse } from 'next/server';
import { demandForecastingService } from '@/lib/ai/demand-forecasting';

/**
 * GET /api/ai/forecast
 * Get demand forecast for a product or category
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const categoryId = searchParams.get('categoryId');
    const days = parseInt(searchParams.get('days') || '30');

    if (productId) {
      // Single product forecast
      const forecast = await demandForecastingService.forecastDemand(productId, days);

      return NextResponse.json({
        success: true,
        data: forecast,
      });
    } else if (categoryId) {
      // Category forecast
      const forecasts = await demandForecastingService.forecastCategory(categoryId, days);

      return NextResponse.json({
        success: true,
        data: {
          categoryId,
          forecasts: Object.fromEntries(forecasts),
          count: forecasts.size,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Either productId or categoryId is required',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate forecast',
      },
      { status: 500 }
    );
  }
}
