/**
 * Database Transaction utilities
 * Ensures atomic operations for critical business logic
 */

import { prisma } from './prisma';
import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../logger';

const dbLogger = logger.child('database');

// Transaction client type
type TransactionClient = Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Execute a function within a database transaction
 * Automatically handles commit/rollback
 */
export async function withTransaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }
): Promise<T> {
    const startTime = Date.now();

    try {
        const result = await prisma.$transaction(fn, {
            maxWait: options?.maxWait || 5000,
            timeout: options?.timeout || 10000,
            isolationLevel: options?.isolationLevel || Prisma.TransactionIsolationLevel.ReadCommitted,
        });

        dbLogger.debug('Transaction completed', {
            durationMs: Date.now() - startTime,
        });

        return result;
    } catch (error) {
        dbLogger.error('Transaction failed', error, {
            durationMs: Date.now() - startTime,
        });
        throw error;
    }
}

/**
 * Order creation with transaction (atomic)
 * Creates order, order items, and payment record in single transaction
 */
export interface CreateOrderData {
    orderNumber: string;
    customerEmail: string;
    customerPhone: string;
    customerName: string;
    subtotal: number;
    discount: number;
    shippingCost: number;
    total: number;
    shippingMethod?: string;
    paymentMethod?: string;
    notes?: string;
    userId?: string;
    addressId?: string;
    items: {
        productId: string;
        variantId?: string;
        sku: string;
        name: string;
        price: number;
        quantity: number;
        discount?: number;
    }[];
}

export async function createOrderWithTransaction(data: CreateOrderData) {
    return withTransaction(async (tx) => {
        // 1. Create the order
        const order = await tx.order.create({
            data: {
                orderNumber: data.orderNumber,
                customerEmail: data.customerEmail,
                customerPhone: data.customerPhone,
                customerName: data.customerName,
                subtotal: data.subtotal,
                discount: data.discount,
                shippingCost: data.shippingCost,
                total: data.total,
                shippingMethod: data.shippingMethod,
                paymentMethod: data.paymentMethod,
                notes: data.notes,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                user: data.userId ? { connect: { id: data.userId } } : undefined,
                address: data.addressId ? { connect: { id: data.addressId } } : undefined,
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        variantId: item.variantId,
                        sku: item.sku,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        discount: item.discount || 0,
                        total: item.price * item.quantity - (item.discount || 0),
                    })),
                },
            },
            include: {
                items: true,
            },
        });

        // 2. Create payment record
        await tx.payment.create({
            data: {
                id: `payment-${order.id}`,
                orderId: order.id,
                amount: data.total,
                method: data.paymentMethod || 'pending',
                status: 'PENDING',
            },
        });

        // 3. Create order history entry
        await tx.orderHistory.create({
            data: {
                orderId: order.id,
                status: 'PENDING',
                comment: 'Замовлення створено',
            },
        });

        // 4. Update product stock (decrease)
        for (const item of data.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    stock: {
                        decrement: item.quantity,
                    },
                },
            });
        }

        dbLogger.info('Order created with transaction', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            total: data.total,
            itemCount: data.items.length,
        });

        return order;
    });
}

/**
 * Cancel order with transaction (atomic)
 * Updates order status and restores product stock
 */
export async function cancelOrderWithTransaction(orderId: string, reason?: string) {
    return withTransaction(async (tx) => {
        // 1. Get order with items
        const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        if (order.status === 'CANCELLED') {
            throw new Error('Order is already cancelled');
        }

        if (order.status === 'DELIVERED') {
            throw new Error('Cannot cancel delivered order');
        }

        // 2. Update order status
        const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : 'CANCELLED',
            },
        });

        // 3. Restore product stock
        for (const item of order.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    stock: {
                        increment: item.quantity,
                    },
                },
            });
        }

        // 4. Create history entry
        await tx.orderHistory.create({
            data: {
                orderId: order.id,
                status: 'CANCELLED',
                comment: reason || 'Замовлення скасовано',
            },
        });

        dbLogger.info('Order cancelled with transaction', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            reason,
        });

        return updatedOrder;
    });
}

/**
 * Process refund with transaction (atomic)
 */
export async function processRefundWithTransaction(
    orderId: string,
    amount: number,
    reason?: string
) {
    return withTransaction(async (tx) => {
        // 1. Get order
        const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { payments: true },
        });

        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        if (order.paymentStatus !== 'PAID') {
            throw new Error('Order is not paid, cannot refund');
        }

        // 2. Update order payment status
        await tx.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: 'REFUNDED',
            },
        });

        // 3. Create refund payment record
        const refund = await tx.payment.create({
            data: {
                id: `refund-${orderId}-${Date.now()}`,
                orderId: order.id,
                amount: -amount,
                method: 'refund',
                status: 'PAID',
                metadata: {
                    type: 'refund',
                    reason,
                    originalPaymentId: order.payments[0]?.id,
                },
            },
        });

        // 4. Create history entry
        await tx.orderHistory.create({
            data: {
                orderId: order.id,
                status: order.status,
                comment: `Повернення коштів: ${amount} грн. ${reason || ''}`,
            },
        });

        dbLogger.info('Refund processed with transaction', {
            orderId: order.id,
            amount,
            reason,
        });

        return refund;
    });
}

/**
 * Batch update with transaction
 */
export async function batchUpdateWithTransaction<T>(
    operations: Array<() => Promise<T>>
): Promise<T[]> {
    return withTransaction(async (tx) => {
        const results: T[] = [];

        for (const operation of operations) {
            const result = await operation();
            results.push(result);
        }

        return results;
    });
}
