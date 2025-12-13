/**
 * AI Repricing Suggestions API
 * Get price suggestions and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { repricingEngine } from '@/lib/ai/repricing-engine';

/**
 * GET /api/ai/repricing/suggestions
 * Get price suggestions for a product
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

    const suggestion = await repricingEngine.calculateOptimalPrice(productId);

    return NextResponse.json({
      success: true,
      data: suggestion,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get price suggestion',
      },
      { status: 500 }
    );
  }
}
