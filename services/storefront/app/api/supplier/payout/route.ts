/**
 * Supplier Payout API
 * API виплат постачальнику
 */

import { NextRequest, NextResponse } from 'next/server';
import { Payout, PayoutRequest } from '@/lib/dropshipping/supplier-service';

// Mock database
const payouts: Map<string, Payout> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    let supplierPayouts = Array.from(payouts.values()).filter(
      p => p.supplierId === supplierId
    );

    if (status) {
      supplierPayouts = supplierPayouts.filter(p => p.status === status);
    }

    // Sort by date (newest first)
    supplierPayouts.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

    return NextResponse.json(supplierPayouts);
  } catch (error) {
    console.error('Get payouts error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання виплат' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplierId, amount } = data;

    if (!supplierId || !amount) {
      return NextResponse.json(
        { error: 'ID постачальника та сума обов\'язкові' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Сума повинна бути більше 0' },
        { status: 400 }
      );
    }

    // Check if there's already a pending payout
    const pendingPayout = Array.from(payouts.values()).find(
      p => p.supplierId === supplierId && p.status === 'pending'
    );

    if (pendingPayout) {
      return NextResponse.json(
        { error: 'У вас вже є очікуюча виплата' },
        { status: 409 }
      );
    }

    // Create payout request
    const newPayout: Payout = {
      id: `PAYOUT-${Date.now()}`,
      supplierId,
      amount,
      status: 'pending',
      requestedAt: new Date(),
      method: 'bank_transfer', // Default method
    };

    payouts.set(newPayout.id, newPayout);

    const payoutRequest: PayoutRequest = {
      id: newPayout.id,
      amount: newPayout.amount,
      status: 'pending',
      requestedAt: newPayout.requestedAt,
    };

    return NextResponse.json({
      ...payoutRequest,
      message: 'Запит на виплату створено. Очікуйте обробки.',
    }, { status: 201 });
  } catch (error) {
    console.error('Create payout error:', error);
    return NextResponse.json(
      { error: 'Помилка створення запиту на виплату' },
      { status: 500 }
    );
  }
}
