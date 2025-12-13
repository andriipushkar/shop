/**
 * AI Repricing Run API
 * Trigger repricing for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { repricingEngine } from '@/lib/ai/repricing-engine';

/**
 * POST /api/ai/repricing/run
 * Trigger repricing for one or more products
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Single product repricing
    if (body.productId) {
      const change = await repricingEngine.repriceProduct(body.productId);

      if (change) {
        return NextResponse.json({
          success: true,
          message: 'Price updated successfully',
          data: change,
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'No price change needed',
          data: null,
        });
      }
    }

    // Category repricing
    if (body.categoryId) {
      const changes = await repricingEngine.repriceCategory(body.categoryId);

      return NextResponse.json({
        success: true,
        message: `Repriced ${changes.length} products`,
        data: {
          changes,
          count: changes.length,
        },
      });
    }

    // Scheduled repricing (all products)
    if (body.scheduled) {
      const report = await repricingEngine.runScheduledRepricing();

      return NextResponse.json({
        success: true,
        message: 'Scheduled repricing completed',
        data: report,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Either productId, categoryId, or scheduled must be specified',
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run repricing',
      },
      { status: 500 }
    );
  }
}
