/**
 * Confirm Supplier Order API
 * API підтвердження замовлення постачальником
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierOrder } from '@/lib/dropshipping/supplier-service';

// Mock database
const orders: Map<string, SupplierOrder> = new Map();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    const order = orders.get(orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Замовлення не знайдено' },
        { status: 404 }
      );
    }

    if (order.status !== 'new') {
      return NextResponse.json(
        { error: 'Замовлення вже оброблено' },
        { status: 400 }
      );
    }

    order.status = 'confirmed';
    orders.set(orderId, order);

    return NextResponse.json({
      ...order,
      message: 'Замовлення підтверджено',
    });
  } catch (error) {
    console.error('Confirm order error:', error);
    return NextResponse.json(
      { error: 'Помилка підтвердження замовлення' },
      { status: 500 }
    );
  }
}
