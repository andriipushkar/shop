import { NextResponse } from 'next/server';
import { analyticsService } from '@/lib/analytics/analytics-service';

/**
 * GET /api/admin/analytics/active-users
 * Отримання кількості активних користувачів
 */
export async function GET() {
  try {
    const count = analyticsService.getActiveUsersCount();

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to get active users count:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні кількості активних користувачів' },
      { status: 500 }
    );
  }
}
