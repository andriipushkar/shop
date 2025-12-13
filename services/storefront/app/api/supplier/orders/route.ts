/**
 * Supplier Orders API
 * API замовлень постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierOrder, OrderFilters } from '@/lib/dropshipping/supplier-service';

// Mock database
const orders: Map<string, SupplierOrder> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    // Get all orders for this supplier
    let supplierOrders = Array.from(orders.values()).filter(
      o => o.supplierId === supplierId
    );

    // Apply filters
    const status = searchParams.get('status');
    if (status) {
      supplierOrders = supplierOrders.filter(o => o.status === status);
    }

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      supplierOrders = supplierOrders.filter(o => o.createdAt >= fromDate);
    }

    const dateTo = searchParams.get('dateTo');
    if (dateTo) {
      const toDate = new Date(dateTo);
      supplierOrders = supplierOrders.filter(o => o.createdAt <= toDate);
    }

    const search = searchParams.get('search');
    if (search) {
      const searchLower = search.toLowerCase();
      supplierOrders = supplierOrders.filter(
        o => o.id.toLowerCase().includes(searchLower) ||
             o.platformOrderId.toLowerCase().includes(searchLower) ||
             o.trackingNumber?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date (newest first)
    supplierOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(supplierOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання замовлень' },
      { status: 500 }
    );
  }
}
