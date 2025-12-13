/**
 * API Route: Cash Deposit (Службове внесення)
 * POST /api/admin/fiscal/service/deposit
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

interface DepositRequest {
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: DepositRequest = await request.json();

    // Validate amount
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Невірна сума внесення' },
        { status: 400 }
      );
    }

    // Process deposit
    const result = await prroService.depositCash(body.amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Помилка службового внесення' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Службове внесення ${body.amount.toFixed(2)} грн виконано успішно`,
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    return NextResponse.json(
      {
        error: 'Помилка службового внесення',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
