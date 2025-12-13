/**
 * Supplier Earnings API
 * API прибутків постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { EarningsReport, SupplierOrder } from '@/lib/dropshipping/supplier-service';
import { CommissionCalculator } from '@/lib/dropshipping/commission-calculator';

// Mock database
const orders: Map<string, SupplierOrder> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!supplierId || !from || !to) {
      return NextResponse.json(
        { error: 'ID постачальника та період (from, to) обов\'язкові' },
        { status: 400 }
      );
    }

    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    // Get orders for this supplier in the period
    const supplierOrders = Array.from(orders.values()).filter(
      o => o.supplierId === supplierId &&
           o.createdAt >= periodStart &&
           o.createdAt <= periodEnd &&
           (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'delivered')
    );

    // Calculate totals
    let totalEarnings = 0;
    let totalCommission = 0;

    const breakdown: { [key: string]: { orders: number; earnings: number; commission: number } } = {};

    for (const order of supplierOrders) {
      totalEarnings += order.supplierTotal;
      totalCommission += order.platformCommission;

      // Group by date
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!breakdown[dateKey]) {
        breakdown[dateKey] = { orders: 0, earnings: 0, commission: 0 };
      }

      breakdown[dateKey].orders++;
      breakdown[dateKey].earnings += order.supplierTotal;
      breakdown[dateKey].commission += order.platformCommission;
    }

    const report: EarningsReport = {
      totalEarnings,
      totalOrders: supplierOrders.length,
      totalCommission,
      netEarnings: totalEarnings - totalCommission,
      periodStart,
      periodEnd,
      breakdown: Object.entries(breakdown).map(([date, data]) => ({
        date,
        orders: data.orders,
        earnings: data.earnings,
        commission: data.commission,
      })),
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Get earnings error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання звіту про прибутки' },
      { status: 500 }
    );
  }
}
