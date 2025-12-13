/**
 * API Route: Close Shift (Generate Z-Report)
 * POST /api/admin/fiscal/shift/close
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function POST(request: NextRequest) {
  try {
    // Get cashier ID from request body or session
    const body = await request.json();
    const cashierId = body.cashierId || 'default';

    // Check if shift is open
    const status = await prroService.getShiftStatus(cashierId);
    if (!status.isOpen) {
      return NextResponse.json(
        { error: 'Немає відкритої зміни для закриття' },
        { status: 400 }
      );
    }

    // Close shift and generate Z-report
    const zReport = await prroService.closeCashierShift(cashierId);

    return NextResponse.json({
      success: true,
      zReport,
      message: 'Зміну закрито успішно. Z-звіт сформовано.',
    });
  } catch (error) {
    console.error('Error closing shift:', error);
    return NextResponse.json(
      {
        error: 'Помилка закриття зміни',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
