import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

// Webhook secret for signature verification
const PROM_WEBHOOK_SECRET = process.env.PROM_WEBHOOK_SECRET || 'your-prom-webhook-secret';

interface PromWebhookEvent {
    type: string;
    id: string;
    data: Record<string, unknown>;
    timestamp: number;
}

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', PROM_WEBHOOK_SECRET)
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

// Map Prom.ua status to our order status
function mapPromStatus(promStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
        'pending': 'PENDING',
        'received': 'CONFIRMED',
        'accepted': 'CONFIRMED',
        'shipped': 'SHIPPED',
        'delivered': 'DELIVERED',
        'canceled': 'CANCELLED',
        'declined': 'CANCELLED',
        'returned': 'CANCELLED',
    };
    return statusMap[promStatus] || 'PENDING';
}

// POST /api/webhooks/prom - Handle Prom.ua webhook events
export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-prom-signature') || '';

        // Verify signature in production
        if (process.env.NODE_ENV === 'production' && PROM_WEBHOOK_SECRET !== 'your-prom-webhook-secret') {
            if (!verifySignature(rawBody, signature)) {
                apiLogger.error('Invalid Prom webhook signature');
                return NextResponse.json(
                    { success: false, error: 'Invalid signature' },
                    { status: 401 }
                );
            }
        }

        const event: PromWebhookEvent = JSON.parse(rawBody);
        apiLogger.info(`Received Prom.ua webhook: ${event.type}`, { eventId: event.id });

        // Process different event types
        switch (event.type) {
            case 'order_created':
                await handleOrderCreated(event.data);
                break;

            case 'order_accepted':
                await handleOrderAccepted(event.data);
                break;

            case 'order_declined':
                await handleOrderDeclined(event.data);
                break;

            case 'order_delivered':
                await handleOrderDelivered(event.data);
                break;

            case 'order_canceled':
                await handleOrderCanceled(event.data);
                break;

            case 'order_refund':
                await handleOrderRefund(event.data);
                break;

            case 'message_received':
                await handleMessageReceived(event.data);
                break;

            case 'product_out_of_stock':
                await handleProductOutOfStock(event.data);
                break;

            case 'price_recommendation':
                await handlePriceRecommendation(event.data);
                break;

            case 'feedback_received':
                await handleFeedbackReceived(event.data);
                break;

            case 'question_asked':
                await handleQuestionAsked(event.data);
                break;

            default:
                apiLogger.info(`Unhandled Prom.ua event type: ${event.type}`);
        }

        return NextResponse.json({
            success: true,
            message: `Event ${event.type} processed`,
        });
    } catch (error) {
        apiLogger.error('Prom.ua webhook error', error);
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
    apiLogger.info('New order from Prom.ua', { data });

    const externalId = String(data.id);
    const customerFirstName = data.client_first_name as string || '';
    const customerLastName = data.client_last_name as string || '';
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const customerPhone = data.phone as string || '';
    const customerEmail = data.email as string || '';
    const products = data.products as Array<{
        id: number;
        external_id?: string;
        name: string;
        quantity: number;
        price: number;
    }> || [];
    const totalPrice = data.price as number || 0;
    const deliveryOption = data.delivery_option as { name?: string } | undefined;
    const deliveryAddress = data.delivery_address as string || '';
    const paymentOption = data.payment_option as { name?: string } | undefined;

    // Generate order number
    const orderNumber = `PROM-${externalId}`;

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (existingOrder) {
        apiLogger.info(`Order ${orderNumber} already exists, skipping creation`);
        return;
    }

    // Find or create customer
    let customer = null;
    if (customerEmail) {
        customer = await prisma.user.findUnique({
            where: { email: customerEmail },
        });
    }

    if (!customer && customerPhone) {
        customer = await prisma.user.findFirst({
            where: { phone: customerPhone },
        });
    }

    // Create order with items
    const order = await prisma.order.create({
        data: {
            orderNumber,
            userId: customer?.id,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod: paymentOption?.name || 'unknown',
            customerEmail: customerEmail || 'marketplace@prom.ua',
            customerPhone: customerPhone || '',
            customerName: customerName || 'Покупець Prom.ua',
            subtotal: totalPrice,
            shippingCost: 0,
            discount: 0,
            total: totalPrice,
            shippingMethod: deliveryOption?.name || 'unknown',
            marketplace: 'prom',
            externalId,
            notes: `Адреса доставки: ${deliveryAddress}`,
            items: {
                create: products.map((product) => ({
                    productId: product.external_id || String(product.id),
                    variantId: null,
                    name: product.name,
                    sku: product.external_id || String(product.id),
                    quantity: product.quantity,
                    price: product.price,
                    total: product.price * product.quantity,
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
            comment: `Замовлення створено з Prom.ua. Зовнішній ID: ${externalId}`,
        },
    });

    // Create admin notification
    await createNotification({
        type: 'new_order',
        title: 'Нове замовлення з Prom.ua',
        message: `Замовлення ${orderNumber} на суму ${totalPrice} грн від ${customerName}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'prom',
        },
    });

    apiLogger.info(`Order ${orderNumber} created successfully`);
}

async function handleOrderAccepted(data: Record<string, unknown>) {
    apiLogger.info('Order accepted', { data });

    const externalId = String(data.id);
    const orderNumber = `PROM-${externalId}`;

    const order = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (!order) {
        apiLogger.error(`Order ${orderNumber} not found`);
        return;
    }

    await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED' },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'CONFIRMED',
            comment: 'Замовлення прийнято на Prom.ua',
        },
    });

    apiLogger.info(`Order ${orderNumber} accepted`);
}

async function handleOrderDeclined(data: Record<string, unknown>) {
    apiLogger.info('Order declined', { data });

    const externalId = String(data.id);
    const cancellationReason = data.cancellation_reason as string || 'Невідома причина';
    const orderNumber = `PROM-${externalId}`;

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
            notes: `Відхилено: ${cancellationReason}`,
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'CANCELLED',
            comment: `Замовлення відхилено на Prom.ua. Причина: ${cancellationReason}`,
        },
    });

    await createNotification({
        type: 'order_declined',
        title: 'Замовлення відхилено',
        message: `Замовлення ${orderNumber} відхилено. Причина: ${cancellationReason}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'prom',
            reason: cancellationReason,
        },
    });

    apiLogger.info(`Order ${orderNumber} declined`);
}

async function handleOrderDelivered(data: Record<string, unknown>) {
    apiLogger.info('Order delivered', { data });

    const externalId = String(data.id);
    const deliveryDate = data.delivery_date as string;
    const orderNumber = `PROM-${externalId}`;

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
            status: 'DELIVERED',
            completedAt: deliveryDate ? new Date(deliveryDate) : new Date(),
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'DELIVERED',
            comment: `Замовлення доставлено. Дата: ${deliveryDate || new Date().toISOString()}`,
        },
    });

    // Update sold count for products
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

    apiLogger.info(`Order ${orderNumber} marked as delivered`);
}

async function handleOrderCanceled(data: Record<string, unknown>) {
    apiLogger.info('Order canceled', { data });

    const externalId = String(data.id);
    const cancellationReason = data.cancellation_reason as string || 'Невідома причина';
    const cancellationInitiator = data.cancellation_initiator as string || 'unknown';
    const orderNumber = `PROM-${externalId}`;

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
            notes: `Скасовано ${cancellationInitiator}: ${cancellationReason}`,
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: 'CANCELLED',
            comment: `Замовлення скасовано (${cancellationInitiator}). Причина: ${cancellationReason}`,
        },
    });

    await createNotification({
        type: 'order_cancelled',
        title: 'Замовлення скасовано',
        message: `Замовлення ${orderNumber} скасовано. Ініціатор: ${cancellationInitiator}. Причина: ${cancellationReason}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'prom',
            reason: cancellationReason,
            initiator: cancellationInitiator,
        },
    });

    apiLogger.info(`Order ${orderNumber} canceled`);
}

async function handleOrderRefund(data: Record<string, unknown>) {
    apiLogger.info('Order refund', { data });

    const externalId = String(data.id);
    const refundAmount = data.refund_amount as number || 0;
    const refundReason = data.refund_reason as string || 'Невідома причина';
    const orderNumber = `PROM-${externalId}`;

    const order = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (!order) {
        apiLogger.error(`Order ${orderNumber} not found`);
        return;
    }

    // Update payment status
    await prisma.order.update({
        where: { id: order.id },
        data: {
            paymentStatus: 'REFUNDED',
        },
    });

    // Create refund record
    await prisma.payment.create({
        data: {
            orderId: order.id,
            amount: -refundAmount,
            method: 'refund',
            status: 'PAID',
            metadata: {
                type: 'refund',
                reason: refundReason,
                marketplace: 'prom',
            },
        },
    });

    await prisma.orderHistory.create({
        data: {
            orderId: order.id,
            status: order.status,
            comment: `Повернення ${refundAmount} грн. Причина: ${refundReason}`,
        },
    });

    await createNotification({
        type: 'refund',
        title: 'Повернення коштів',
        message: `Повернення ${refundAmount} грн для замовлення ${orderNumber}. Причина: ${refundReason}`,
        metadata: {
            orderId: order.id,
            orderNumber,
            marketplace: 'prom',
            amount: refundAmount,
            reason: refundReason,
        },
    });

    apiLogger.info(`Refund ${refundAmount} UAH processed for order ${orderNumber}`);
}

async function handleMessageReceived(data: Record<string, unknown>) {
    apiLogger.info('New message from Prom.ua', { data });

    const chatId = data.chat_id as number;
    const messageText = data.text as string || '';
    const senderType = data.sender_type as string || 'customer';
    const orderId = data.order_id as number | undefined;

    // Find related order if exists
    let order = null;
    if (orderId) {
        const orderNumber = `PROM-${orderId}`;
        order = await prisma.order.findUnique({
            where: { orderNumber },
        });
    }

    // Create notification for admin
    await createNotification({
        type: 'new_message',
        title: 'Нове повідомлення з Prom.ua',
        message: messageText.substring(0, 200),
        metadata: {
            chatId,
            orderId: order?.id,
            marketplace: 'prom',
            senderType,
        },
    });

    apiLogger.info(`Message received from Prom.ua chat ${chatId}`);
}

async function handleProductOutOfStock(data: Record<string, unknown>) {
    apiLogger.info('Product out of stock alert', { data });

    const externalId = data.external_id as string;
    const productName = data.name as string || 'Невідомий продукт';

    // Find and update product
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { id: externalId },
                { sku: externalId },
            ],
        },
    });

    if (product) {
        await prisma.product.update({
            where: { id: product.id },
            data: {
                status: 'OUT_OF_STOCK',
            },
        });
    }

    await createNotification({
        type: 'out_of_stock',
        title: 'Товар закінчився',
        message: `Товар "${productName}" (${externalId}) закінчився на Prom.ua`,
        metadata: {
            productId: product?.id || externalId,
            productName,
            marketplace: 'prom',
        },
    });

    apiLogger.info(`Product ${externalId} marked as out of stock`);
}

async function handlePriceRecommendation(data: Record<string, unknown>) {
    apiLogger.info('Price recommendation from Prom.ua', { data });

    const externalId = data.external_id as string;
    const currentPrice = data.current_price as number;
    const recommendedPrice = data.recommended_price as number;
    const reason = data.reason as string || '';

    await createNotification({
        type: 'price_recommendation',
        title: 'Рекомендація ціни від Prom.ua',
        message: `Продукт ${externalId}: поточна ціна ${currentPrice} грн, рекомендована ${recommendedPrice} грн. ${reason}`,
        metadata: {
            productId: externalId,
            currentPrice,
            recommendedPrice,
            reason,
            marketplace: 'prom',
        },
    });

    apiLogger.info(`Price recommendation for ${externalId}: ${currentPrice} -> ${recommendedPrice}`);
}

async function handleFeedbackReceived(data: Record<string, unknown>) {
    apiLogger.info('New feedback from Prom.ua', { data });

    const orderId = data.order_id as number;
    const productId = data.product_id as number;
    const rating = data.rating as number;
    const comment = data.comment as string || '';
    const author = data.author as string || 'Анонім';

    // Note: Review creation requires userId which marketplace feedback doesn't have
    // Only create notification for admin review
    await createNotification({
        type: rating <= 2 ? 'negative_feedback' : 'new_feedback',
        title: rating <= 2 ? 'Негативний відгук на Prom.ua' : 'Новий відгук на Prom.ua',
        message: `${rating} зірок від ${author}: "${comment.substring(0, 100)}"`,
        metadata: {
            productId: String(productId),
            orderId,
            rating,
            comment,
            author,
            marketplace: 'prom',
        },
    });

    apiLogger.info(`Feedback notification created: ${rating} stars for product ${productId}`);
}

async function handleQuestionAsked(data: Record<string, unknown>) {
    apiLogger.info('New question about product', { data });

    const productId = data.product_id as number;
    const questionId = data.question_id as number;
    const questionText = data.question_text as string || '';
    const author = data.author as string || 'Анонім';

    await createNotification({
        type: 'product_question',
        title: 'Нове питання про товар',
        message: `${author}: "${questionText.substring(0, 150)}"`,
        metadata: {
            productId: String(productId),
            questionId,
            question: questionText,
            author,
            marketplace: 'prom',
        },
    });

    apiLogger.info(`Question ${questionId} saved for product ${productId}`);
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

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const verificationToken = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Verify token matches
    if (verificationToken === PROM_WEBHOOK_SECRET && challenge) {
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({
        status: 'active',
        endpoint: '/api/webhooks/prom',
    });
}
