/**
 * API Route: Open Shift
 * POST /api/admin/fiscal/shift/open
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function POST(request: NextRequest) {
  try {
    // Get cashier ID from request body or session
    const body = await request.json();
    const cashierId = body.cashierId || 'default';

    // Check if shift is already open
    const status = await prroService.getShiftStatus(cashierId);
    if (status.isOpen) {
      return NextResponse.json(
        { error: 'Зміна вже відкрита', shift: status.shift },
        { status: 400 }
      );
    }

    // Open new shift
    const shift = await prroService.openCashierShift(cashierId);

    return NextResponse.json({
      success: true,
      shift,
      message: 'Зміну відкрито успішно',
    });
  } catch (error) {
    console.error('Error opening shift:', error);
    return NextResponse.json(
      {
        error: 'Помилка відкриття зміни',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
