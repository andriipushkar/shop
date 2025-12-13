/**
 * B2B Order API
 * POST /api/b2b/order - Place B2B order
 */

import { NextRequest, NextResponse } from 'next/server';
import { pricingService } from '@/lib/b2b/pricing';
import { creditService } from '@/lib/b2b/credit';
import type { CartItem } from '@/lib/b2b/types';

export async function POST(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const body = await request.json();
    const { items, paymentMethod, deliveryAddress, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    // Calculate cart total
    const cartTotal = pricingService.calculateB2BCart(customerId, items);

    // If payment method is credit, check credit availability
    if (paymentMethod === 'credit') {
      const creditCheck = creditService.canPlaceOrder(customerId, cartTotal.total);

      if (!creditCheck.allowed) {
        return NextResponse.json(
          { error: creditCheck.reason },
          { status: 400 }
        );
      }
    }

    // Create order
    const orderId = `ORD-${Date.now()}`;
    const order = {
      id: orderId,
      customerId,
      orderNumber: orderId,
      items: cartTotal.items,
      subtotal: cartTotal.subtotal,
      discountAmount: cartTotal.discountAmount,
      taxAmount: cartTotal.taxAmount,
      total: cartTotal.total,
      status: 'pending',
      paymentStatus: paymentMethod === 'credit' ? 'unpaid' : 'pending',
      paymentMethod,
      deliveryAddress,
      notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If credit payment, reserve credit
    if (paymentMethod === 'credit') {
      creditService.reserveCredit(customerId, orderId, cartTotal.total);
    }

    // TODO: Save order to database

    return NextResponse.json({
      success: true,
      order,
      message: 'Замовлення успішно створено'
    });
  } catch (error) {
    console.error('Error creating B2B order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
