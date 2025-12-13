import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { orderRepository } from '@/lib/db/repositories/order.repository';
import type { OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/admin/orders/[id] - Get single order
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER', 'WAREHOUSE', 'SUPPORT'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const order = await orderRepository.findById(id);

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        apiLogger.error('Error fetching order:', error);
        return NextResponse.json(
            { error: 'Failed to fetch order' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/orders/[id] - Update order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await orderRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Handle status update
        if (body.status) {
            const validStatuses: OrderStatus[] = [
                'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
                'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'
            ];
            if (!validStatuses.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }

            await orderRepository.updateStatus(
                id,
                body.status as OrderStatus,
                body.statusComment,
                session.user.id
            );
        }

        // Handle payment status update
        if (body.paymentStatus) {
            const validPaymentStatuses: PaymentStatus[] = [
                'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'
            ];
            if (!validPaymentStatuses.includes(body.paymentStatus)) {
                return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
            }

            await orderRepository.updatePaymentStatus(id, body.paymentStatus as PaymentStatus);
        }

        // Handle shipping status update
        if (body.shippingStatus) {
            const validShippingStatuses: ShippingStatus[] = [
                'PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT',
                'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'
            ];
            if (!validShippingStatuses.includes(body.shippingStatus)) {
                return NextResponse.json({ error: 'Invalid shipping status' }, { status: 400 });
            }

            await orderRepository.updateShippingStatus(
                id,
                body.shippingStatus as ShippingStatus,
                body.trackingNumber
            );
        }

        // Add admin note
        if (body.adminNote) {
            await orderRepository.addAdminNote(id, body.adminNote);
        }

        // Fetch updated order
        const order = await orderRepository.findById(id);

        return NextResponse.json(order);
    } catch (error) {
        apiLogger.error('Error updating order:', error);
        return NextResponse.json(
            { error: 'Failed to update order' },
            { status: 500 }
        );
    }
}
