/**
 * API Route: Get Receipt Details
 * GET /api/admin/fiscal/receipt/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const receiptId = params.id;

    // Try to get receipt by ID first
    let receipt = await prroService.getReceiptById(receiptId);

    // If not found by ID, try by fiscal code
    if (!receipt) {
      receipt = await prroService.getReceiptByFiscalCode(receiptId);
    }

    if (!receipt) {
      return NextResponse.json(
        { error: 'Чек не знайдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error('Error getting receipt:', error);
    return NextResponse.json(
      {
        error: 'Помилка отримання чека',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
