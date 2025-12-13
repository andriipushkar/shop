/**
 * AI Scenario Simulation API
 * Run what-if simulations
 */

import { NextRequest, NextResponse } from 'next/server';
import { demandForecastingService } from '@/lib/ai/demand-forecasting';

/**
 * POST /api/ai/forecast/simulate
 * Run what-if scenario simulation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const scenario = {
      productId: body.productId,
      priceChange: body.priceChange,
      promotionDiscount: body.promotionDiscount,
      competitorAction: body.competitorAction,
    };

    const result = await demandForecastingService.simulateScenario(scenario);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run simulation',
      },
      { status: 500 }
    );
  }
}
