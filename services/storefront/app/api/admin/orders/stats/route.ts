import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { orderRepository } from '@/lib/db/repositories/order.repository';
import { apiLogger } from '@/lib/logger';

// GET /api/admin/orders/stats - Get order statistics
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        const stats = await orderRepository.getOrderStats(
            dateFrom ? new Date(dateFrom) : undefined,
            dateTo ? new Date(dateTo) : undefined
        );

        return NextResponse.json(stats);
    } catch (error) {
        apiLogger.error('Error fetching order stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch order stats' },
            { status: 500 }
        );
    }
}
