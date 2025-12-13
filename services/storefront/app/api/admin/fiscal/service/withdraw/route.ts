/**
 * API Route: Cash Withdrawal (Службове винесення)
 * POST /api/admin/fiscal/service/withdraw
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

interface WithdrawRequest {
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json();

    // Validate amount
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Невірна сума винесення' },
        { status: 400 }
      );
    }

    // Process withdrawal
    const result = await prroService.withdrawCash(body.amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Помилка службового винесення' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Службове винесення ${body.amount.toFixed(2)} грн виконано успішно`,
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      {
        error: 'Помилка службового винесення',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
