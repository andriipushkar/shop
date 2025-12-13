/**
 * AI Repricing History API
 * Get price change history
 */

import { NextRequest, NextResponse } from 'next/server';
import { repricingEngine } from '@/lib/ai/repricing-engine';

/**
 * GET /api/ai/repricing/history
 * Get price change history for a product
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const history = repricingEngine.getPriceHistory(productId, days);

    return NextResponse.json({
      success: true,
      data: {
        productId,
        history,
        count: history.length,
        period: `${days} days`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get price history',
      },
      { status: 500 }
    );
  }
}
