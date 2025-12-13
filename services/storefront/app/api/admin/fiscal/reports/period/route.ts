/**
 * API Route: Period Report
 * GET /api/admin/fiscal/reports/period
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Validate parameters
    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: 'Не вказані дати періоду (from, to)' },
        { status: 400 }
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);

    // Validate dates
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        { error: 'Невірний формат дати' },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { error: 'Дата початку не може бути пізніше дати закінчення' },
        { status: 400 }
      );
    }

    // Get period report
    const report = await prroService.getPeriodReport(from, to);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error getting period report:', error);
    return NextResponse.json(
      {
        error: 'Помилка отримання звіту за період',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
