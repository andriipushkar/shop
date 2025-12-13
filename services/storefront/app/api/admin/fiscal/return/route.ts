/**
 * API Route: Process Return
 * POST /api/admin/fiscal/return
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService, type OrderItem } from '@/lib/fiscal/prro-service';

interface ReturnRequest {
  originalFiscalCode: string;
  items: OrderItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ReturnRequest = await request.json();

    // Validate request
    if (!body.originalFiscalCode) {
      return NextResponse.json(
        { error: 'Фіскальний код оригінального чека не вказаний' },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Товари для повернення не вказані' },
        { status: 400 }
      );
    }

    // Process return
    const result = await prroService.fiscalizeReturn(
      body.originalFiscalCode,
      body.items
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Помилка обробки повернення' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: 'Чек повернення створено успішно',
    });
  } catch (error) {
    console.error('Error processing return:', error);
    return NextResponse.json(
      {
        error: 'Помилка обробки повернення',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
