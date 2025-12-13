/**
 * B2B Prices API
 * GET /api/b2b/prices - Get prices for authenticated B2B customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { pricingService } from '@/lib/b2b/pricing';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const searchParams = request.nextUrl.searchParams;
    const productIds = searchParams.get('productIds')?.split(',') || [];

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: 'No product IDs provided' },
        { status: 400 }
      );
    }

    const prices = productIds.map(productId => {
      try {
        const price = pricingService.getCustomerPrice(productId, customerId);
        const productPrice = pricingService.getProductPrices(productId);

        return {
          productId,
          customerPrice: price,
          retail: productPrice.retail,
          savings: productPrice.retail - price,
          savingsPercent: ((productPrice.retail - price) / productPrice.retail * 100).toFixed(2)
        };
      } catch (error) {
        return {
          productId,
          error: 'Product not found'
        };
      }
    });

    const tier = pricingService.getCustomerTier(customerId);

    return NextResponse.json({
      customerId,
      tier,
      prices
    });
  } catch (error) {
    console.error('Error fetching B2B prices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
