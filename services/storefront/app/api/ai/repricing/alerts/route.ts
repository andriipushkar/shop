/**
 * AI Repricing Alerts API
 * Get and manage price alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { repricingEngine } from '@/lib/ai/repricing-engine';

/**
 * GET /api/ai/repricing/alerts
 * Get active price alerts
 */
export async function GET(request: NextRequest) {
  try {
    const alerts = await repricingEngine.checkPriceAlerts();

    return NextResponse.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get price alerts',
      },
      { status: 500 }
    );
  }
}
