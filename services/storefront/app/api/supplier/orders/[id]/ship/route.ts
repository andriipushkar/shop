/**
 * Ship Supplier Order API
 * API відправки замовлення постачальником
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierOrder, TrackingInfo } from '@/lib/dropshipping/supplier-service';

// Mock database
const orders: Map<string, SupplierOrder> = new Map();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const trackingInfo: TrackingInfo = await request.json();

    const order = orders.get(orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Замовлення не знайдено' },
        { status: 404 }
      );
    }

    if (order.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Замовлення повинно бути підтверджене перед відправкою' },
        { status: 400 }
      );
    }

    if (!trackingInfo.trackingNumber) {
      return NextResponse.json(
        { error: 'Трекінг-номер обов\'язковий' },
        { status: 400 }
      );
    }

    order.status = 'shipped';
    order.trackingNumber = trackingInfo.trackingNumber;
    order.trackingUrl = trackingInfo.trackingUrl;
    orders.set(orderId, order);

    return NextResponse.json({
      ...order,
      message: 'Замовлення відправлено',
    });
  } catch (error) {
    console.error('Ship order error:', error);
    return NextResponse.json(
      { error: 'Помилка відправки замовлення' },
      { status: 500 }
    );
  }
}
