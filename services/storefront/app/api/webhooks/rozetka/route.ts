import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

// Webhook secret for signature verification
const ROZETKA_WEBHOOK_SECRET = process.env.ROZETKA_WEBHOOK_SECRET || 'your-webhook-secret';

interface RozetkaWebhookEvent {
    event_type: string;
    event_id: string;
    timestamp: string;
    data: Record<string, unknown>;
}

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', ROZETKA_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    if (signature.length !== expectedSignature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

// Map Rozetka status to our order status
function mapRozetkaStatus(rozetkaStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
        'new': 'PENDING',
        'pending': 'PENDING',
        'processing': 'PROCESSING',
        'confirmed': 'CONFIRMED',
        'shipped': 'SHIPPED',
        'delivered': 'DELIVERED',
        'cancelled': 'CANCELLED',
        'returned': 'CANCELLED',
    };
    return statusMap[rozetkaStatus] || 'PENDING';
}

// POST /api/webhooks/rozetka - Handle Rozetka webhook events
export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-rozetka-signature') || '';

        // Verify signature in production
        if (process.env.NODE_ENV === 'production' && ROZETKA_WEBHOOK_SECRET !== 'your-webhook-secret') {
            if (!verifySignature(rawBody, signature)) {
                apiLogger.error('Invalid webhook signature');
                return NextResponse.json(
                    { success: false, error: 'Invalid signature' },
                    { status: 401 }
                );
            }
        }

        const event: RozetkaWebhookEvent = JSON.parse(rawBody);
        apiLogger.info(`Received Rozetka webhook: ${event.event_type}`, { eventId: event.event_id });

        // Process different event types
        switch (event.event_type) {
            case 'order.created':
                await handleOrderCreated(event.data);
                break;

            case 'order.status_changed':
                await handleOrderStatusChanged(event.data);
                break;

            case 'order.cancelled':
                await handleOrderCancelled(event.data);
                break;

            case 'product.moderation_passed':
                await handleProductModerationPassed(event.data);
                break;

            case 'product.moderation_failed':
                await handleProductModerationFailed(event.data);
                break;

            case 'product.price_changed':
                await handleProductPriceChanged(event.data);
                break;

            case 'message.received':
                await handleMessageReceived(event.data);
                break;

            case 'review.created':
                await handleReviewCreated(event.data);
                break;

            default:
                apiLogger.info(`Unhandled Rozetka event type: ${event.event_type}`);
        }

        return NextResponse.json({
            success: true,
            message: `Event ${event.event_type} processed`,
        });
    } catch (error) {
        apiLogger.error('Rozetka webhook error', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// Event handlers
async function handleOrderCreated(data: Record<string, unknown>) {
    apiLogger.info('New order from Rozetka', { data });

    const externalId = String(data.order_id);
    const customer = data.customer as {
        name?: string;
        phone?: string;
        email?: string;
    } || {};
    const items = data.items as Array<{
        id: string;
        external_id?: string;
        name: string;
        quantity: number;
        price: number;
    }> || [];
    const total = data.total as number || 0;
    const shipping = data.shipping as {
        method?: string;
        address?: string;
        city?: string;
        warehouse?: string;
    } || {};

    // Generate order number
    const orderNumber = `ROZETKA-${externalId}`;

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (existingOrder) {
        apiLogger.info(`Order ${orderNumber} already exists, skipping creation`);
        return;
    }

    // Find customer by email or phone
    let customerRecord = null;
    if (customer.email) {
        customerRecord = await prisma.user.findUnique({
            where: { email: customer.email },
        });
    }

    if (!customerRecord && customer.phone) {
        customerRecord = await prisma.user.findFirst({
            where: { phone: customer.phone },
        });
    }

    // Build shipping address string
    const shippingAddressStr = [shipping.city, shipping.address, shipping.warehouse].filter(Boolean).join(', ');

    // Create order with items
    const order = await prisma.order.create({
        data: {
            orderNumber,
            userId: customerRecord?.id,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod: 'rozetka',
            customerEmail: customer.email || 'marketplace@rozetka.ua',
            customerPhone: customer.phone || '',
            customerName: customer.name || 'Покупець Rozetka',
            subtotal: total,
            shippingCost: 0,
            discount: 0,
            total,
            shippingMethod: shipping.method || 'nova_poshta',
            marketplace: 'rozetka',
            externalId,
            notes: shippingAddressStr ? `Адреса доставки: ${shippingAddressStr}` : undefined,
            items: {
                create: items.map((item) => ({
                    productId: item.external_id || item.id,
                    variantId: null,
                    name: item.name,
                    sku: item.external_id || item.id,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity,
                })),
            },
        },
        include: {
            items: true,
        },
    });

    // Create order history entry
    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'PENDING',
            comment: `Замовлення створено з Rozetka. Зовнішній ID: ${externalId}`,
        },
    });

    // Create admin notification
    await createNotification({
        type: 'new_order',
        title: 'Нове замовлення з Rozetka',
        message: `Замовлення ${orderNumber} на суму ${total} грн від ${customer.name || 'Покупець'}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Order ${orderNumber} created successfully`);
}

async function handleOrderStatusChanged(data: Record<string, unknown>) {
    apiLogger.info('Order status changed', { data });

    const externalId = String(data.order_id);
    const oldStatus = data.old_status as string;
    const newStatus = data.new_status as string;
    const orderNumber = `ROZETKA-${externalId}`;

    const order = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (!order) {
        apiLogger.error(`Order ${orderNumber} not found`);
        return;
    }

    const mappedStatus = mapRozetkaStatus(newStatus);

    await prisma.order.update({
        where: { id: order.id },
        data: {
            status: mappedStatus,
            ...(mappedStatus === 'DELIVERED' ? { completedAt: new Date() } : {}),
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: mappedStatus,
            comment: `Статус змінено з "${oldStatus}" на "${newStatus}" (Rozetka)`,
        },
    });

    // Update sold count when delivered
    if (mappedStatus === 'DELIVERED') {
        const orderWithItems = await prisma.order.findUnique({
            where: { id: order.id },
            include: { items: true },
        });

        if (orderWithItems) {
            for (const item of orderWithItems.items) {
                await prisma.product.updateMany({
                    where: { id: item.productId },
                    data: {
                        soldCount: { increment: item.quantity },
                    },
                });
            }
        }
    }

    apiLogger.info(`Order ${orderNumber} status updated: ${oldStatus} -> ${newStatus}`);
}

async function handleOrderCancelled(data: Record<string, unknown>) {
    apiLogger.info('Order cancelled', { data });

    const externalId = String(data.order_id);
    const reason = data.reason as string || 'Невідома причина';
    const orderNumber = `ROZETKA-${externalId}`;

    const order = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (!order) {
        apiLogger.error(`Order ${orderNumber} not found`);
        return;
    }

    await prisma.order.update({
        where: { id: order.id },
        data: {
            status: 'CANCELLED',
            notes: `Скасовано Rozetka: ${reason}`,
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'CANCELLED',
            comment: `Замовлення скасовано на Rozetka. Причина: ${reason}`,
        },
    });

    await createNotification({
        type: 'order_cancelled',
        title: 'Замовлення скасовано',
        message: `Замовлення ${orderNumber} скасовано на Rozetka. Причина: ${reason}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'rozetka',
            reason,
        },
    });

    apiLogger.info(`Order ${orderNumber} cancelled`);
}

async function handleProductModerationPassed(data: Record<string, unknown>) {
    apiLogger.info('Product moderation passed', { data });

    const externalId = data.external_id as string;
    const rozetkaProductId = data.product_id as string;

    // Find product
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { id: externalId },
                { sku: externalId },
            ],
        },
    });

    await createNotification({
        type: 'moderation_passed',
        title: 'Товар схвалено на Rozetka',
        message: `Товар "${product?.name || externalId}" пройшов модерацію на Rozetka`,
        metadata: {
            productId: product?.id || externalId,
            rozetkaProductId,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Product ${externalId} approved on Rozetka`);
}

async function handleProductModerationFailed(data: Record<string, unknown>) {
    apiLogger.info('Product moderation failed', { data });

    const externalId = data.external_id as string;
    const reasons = data.reasons as string[] || ['Невідома причина'];

    // Find product
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { id: externalId },
                { sku: externalId },
            ],
        },
    });

    await createNotification({
        type: 'moderation_failed',
        title: 'Товар відхилено на Rozetka',
        message: `Товар "${product?.name || externalId}" не пройшов модерацію. Причини: ${reasons.join(', ')}`,
        metadata: {
            productId: product?.id || externalId,
            reasons,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Product ${externalId} rejected on Rozetka`, { reasons });
}

async function handleProductPriceChanged(data: Record<string, unknown>) {
    apiLogger.info('Product price changed', { data });

    const productId = data.product_id as string;
    const oldPrice = data.old_price as number;
    const newPrice = data.new_price as number;

    await createNotification({
        type: 'price_changed',
        title: 'Ціна змінена на Rozetka',
        message: `Ціна товару ${productId} змінена з ${oldPrice} на ${newPrice} грн (Rozetka price matching)`,
        metadata: {
            productId,
            oldPrice,
            newPrice,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Product ${productId} price changed: ${oldPrice} -> ${newPrice}`);
}

async function handleMessageReceived(data: Record<string, unknown>) {
    apiLogger.info('New message from customer', { data });

    const orderId = data.order_id as string;
    const customerId = data.customer_id as string;
    const message = data.message as string || '';

    // Find related order
    let order = null;
    if (orderId) {
        const orderNumber = `ROZETKA-${orderId}`;
        order = await prisma.order.findUnique({
            where: { orderNumber },
        });
    }

    await createNotification({
        type: 'new_message',
        title: 'Нове повідомлення з Rozetka',
        message: message.substring(0, 200),
        metadata: {
            orderId: order?.id,
            customerId,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Message received for order ${orderId}`);
}

async function handleReviewCreated(data: Record<string, unknown>) {
    apiLogger.info('New review', { data });

    const productId = data.product_id as string;
    const rating = data.rating as number;
    const comment = data.comment as string || '';
    const authorName = data.author as string || 'Покупець Rozetka';

    // Note: Review creation requires userId which marketplace reviews don't have
    // Only create notification for admin review
    await createNotification({
        type: rating <= 2 ? 'negative_review' : 'new_review',
        title: rating <= 2 ? 'Негативний відгук на Rozetka' : 'Новий відгук на Rozetka',
        message: `${rating} зірок від ${authorName}: "${comment.substring(0, 100)}"`,
        metadata: {
            productId,
            rating,
            comment,
            author: authorName,
            marketplace: 'rozetka',
        },
    });

    apiLogger.info(`Review notification created: ${rating} stars for product ${productId}`);
}

// Helper functions
async function createNotification(params: {
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}) {
    // Note: Admin notifications would need a separate AdminNotification table
    // or a system user ID. For now, just log the notification.
    apiLogger.info(`[ADMIN NOTIFICATION] ${params.type}: ${params.title} - ${params.message}`, params.metadata ? { metadata: params.metadata } : undefined);
}

// GET endpoint for webhook verification (if required by Rozetka)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const challenge = searchParams.get('challenge');

    if (challenge) {
        return NextResponse.json({ challenge });
    }

    return NextResponse.json({
        status: 'active',
        endpoint: '/api/webhooks/rozetka',
    });
}
