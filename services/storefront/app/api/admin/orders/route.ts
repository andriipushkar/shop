import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { orderRepository } from '@/lib/db/repositories/order.repository';
import { parsePagination, parseEnumParam } from '@/lib/security/pagination';
import type { OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

const VALID_ORDER_STATUSES: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const;
const VALID_PAYMENT_STATUSES: readonly PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;
const VALID_SHIPPING_STATUSES: readonly ShippingStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const;

/**
 * GET /api/admin/orders - List orders with filters
 * @description Fetches paginated list of orders for admin panel
 * @param request - NextRequest with query params: page, pageSize, search, status, paymentStatus, shippingStatus, marketplace, dateFrom, dateTo
 * @returns Paginated orders list with total count
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Secure pagination with bounds validation (prevents DoS)
        const { page, pageSize } = parsePagination(
            searchParams.get('page'),
            searchParams.get('pageSize'),
            { maxPageSize: 100, defaultPageSize: 20 }
        );

        const search = searchParams.get('search') || undefined;
        const status = parseEnumParam(searchParams.get('status'), VALID_ORDER_STATUSES);
        const paymentStatus = parseEnumParam(searchParams.get('paymentStatus'), VALID_PAYMENT_STATUSES);
        const shippingStatus = parseEnumParam(searchParams.get('shippingStatus'), VALID_SHIPPING_STATUSES);
        const marketplace = searchParams.get('marketplace') || undefined;
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        const result = await orderRepository.findMany(
            {
                search,
                status,
                paymentStatus,
                shippingStatus,
                marketplace,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
            },
            page,
            pageSize
        );

        return NextResponse.json(result);
    } catch (error) {
        apiLogger.error('Error fetching orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/orders - Create order (manual)
 * @description Creates order with payment record using database transaction
 * Uses atomic transaction to prevent orphaned records
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const { customerEmail, customerPhone, customerName, items } = body;
        if (!customerEmail || !customerPhone || !customerName || !items?.length) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: { price: number; quantity: number }) =>
            sum + item.price * item.quantity, 0
        );
        const shippingCost = body.shippingCost || 0;
        const discount = body.discount || 0;
        const total = subtotal - discount + shippingCost;

        // Import transaction helper
        const { createOrderWithTransaction } = await import('@/lib/db/transactions');

        // Generate order number
        const now = new Date();
        const orderNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

        // Create order with transaction (atomic - includes order, items, payment, history)
        const order = await createOrderWithTransaction({
            orderNumber,
            customerEmail,
            customerPhone,
            customerName,
            subtotal,
            discount,
            shippingCost,
            total,
            shippingMethod: body.shippingMethod,
            paymentMethod: body.paymentMethod,
            notes: body.notes,
            userId: body.userId,
            addressId: body.addressId,
            items: items.map((item: {
                productId: string;
                variantId?: string;
                sku: string;
                name: string;
                price: number;
                quantity: number;
                discount?: number;
            }) => ({
                productId: item.productId,
                variantId: item.variantId,
                sku: item.sku,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                discount: item.discount || 0,
            })),
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        apiLogger.error('Error creating order:', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
