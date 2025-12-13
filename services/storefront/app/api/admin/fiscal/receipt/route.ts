/**
 * API Route: Create Fiscal Receipt
 * POST /api/admin/fiscal/receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService, type FiscalizeOrderRequest } from '@/lib/fiscal/prro-service';

export async function POST(request: NextRequest) {
  try {
    const body: FiscalizeOrderRequest = await request.json();

    // Validate request
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Товари не вказані' },
        { status: 400 }
      );
    }

    if (!body.payments || body.payments.length === 0) {
      return NextResponse.json(
        { error: 'Способи оплати не вказані' },
        { status: 400 }
      );
    }

    // Calculate totals
    const itemsTotal = body.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const paymentsTotal = body.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    // Validate totals match
    if (Math.abs(itemsTotal - paymentsTotal) > 0.01) {
      return NextResponse.json(
        {
          error: 'Сума товарів не відповідає сумі оплати',
          itemsTotal,
          paymentsTotal,
        },
        { status: 400 }
      );
    }

    // Fiscalize order
    const result = await prroService.fiscalizeOrder(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Помилка фіскалізації' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: 'Чек створено успішно',
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    return NextResponse.json(
      {
        error: 'Помилка створення чека',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
