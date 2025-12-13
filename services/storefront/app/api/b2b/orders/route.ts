/**
 * B2B Orders API
 * GET /api/b2b/orders - Get order history
 */

import { NextRequest, NextResponse } from 'next/server';
import type { B2BOrder } from '@/lib/b2b/types';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // Mock order data - in real app, fetch from database
    const mockOrders: B2BOrder[] = [
      {
        id: 'order-1',
        customerId,
        orderNumber: 'ORD-001',
        items: [
          {
            productId: 'product-1',
            sku: 'PROD-001',
            name: 'Premium Laptop',
            quantity: 2,
            basePrice: 30000,
            customerPrice: 25000,
            lineTotal: 50000,
            appliedDiscount: 10000
          }
        ],
        subtotal: 50000,
        discountAmount: 10000,
        taxAmount: 10000,
        total: 60000,
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'credit',
        deliveryAddress: 'вул. Хрещатик 1, Київ',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'order-2',
        customerId,
        orderNumber: 'ORD-002',
        items: [
          {
            productId: 'product-2',
            sku: 'PROD-002',
            name: 'Wireless Mouse',
            quantity: 10,
            basePrice: 600,
            customerPrice: 500,
            lineTotal: 5000,
            appliedDiscount: 1000
          },
          {
            productId: 'product-3',
            sku: 'PROD-003',
            name: 'Mechanical Keyboard',
            quantity: 5,
            basePrice: 3000,
            customerPrice: 2500,
            lineTotal: 12500,
            appliedDiscount: 2500
          }
        ],
        subtotal: 17500,
        discountAmount: 3500,
        taxAmount: 3500,
        total: 21000,
        status: 'processing',
        paymentStatus: 'unpaid',
        paymentMethod: 'credit',
        deliveryAddress: 'вул. Хрещатик 1, Київ',
        notes: 'Терміново, до кінця тижня',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'order-3',
        customerId,
        orderNumber: 'ORD-003',
        items: [
          {
            productId: 'product-1',
            sku: 'PROD-001',
            name: 'Premium Laptop',
            quantity: 5,
            basePrice: 30000,
            customerPrice: 25000,
            lineTotal: 125000,
            appliedDiscount: 25000
          }
        ],
        subtotal: 125000,
        discountAmount: 25000,
        taxAmount: 25000,
        total: 150000,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'credit',
        deliveryAddress: 'вул. Хрещатик 1, Київ',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ];

    // Filter by status if provided
    let filteredOrders = mockOrders;
    if (status) {
      filteredOrders = mockOrders.filter(order => order.status === status);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    return NextResponse.json({
      orders: paginatedOrders,
      pagination: {
        page,
        limit,
        total: filteredOrders.length,
        totalPages: Math.ceil(filteredOrders.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
