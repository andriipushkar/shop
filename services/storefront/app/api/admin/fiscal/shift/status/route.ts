/**
 * API Route: Get Shift Status
 * GET /api/admin/fiscal/shift/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function GET(request: NextRequest) {
  try {
    // Get cashier ID from query params or session
    const { searchParams } = new URL(request.url);
    const cashierId = searchParams.get('cashierId') || 'default';

    // Get shift status
    const status = await prroService.getShiftStatus(cashierId);

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error getting shift status:', error);
    return NextResponse.json(
      {
        error: 'Помилка отримання статусу зміни',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
