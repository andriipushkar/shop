/**
 * API Route: Daily Report
 * GET /api/admin/fiscal/reports/daily
 */

import { NextRequest, NextResponse } from 'next/server';
import { prroService } from '@/lib/fiscal/prro-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Parse date or use today
    const date = dateParam ? new Date(dateParam) : new Date();

    // Get daily report
    const report = await prroService.getDailyReport(date);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error getting daily report:', error);
    return NextResponse.json(
      {
        error: 'Помилка отримання денного звіту',
        details: error instanceof Error ? error.message : 'Невідома помилка',
      },
      { status: 500 }
    );
  }
}
