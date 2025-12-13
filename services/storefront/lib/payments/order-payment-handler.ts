/**
 * Order Payment Handler
 * Обробка платежів та оновлення статусу замовлень
 */

import { LiqPayPaymentResponse, LiqPayStatus } from './liqpay';
import { MonobankWebhookPayload, MonobankPaymentStatus } from './monobank';
import { paymentLogger } from '../logger';

// Типи для оновлення замовлення
export interface OrderPaymentUpdate {
    orderId: string;
    status: 'paid' | 'failed' | 'refunded' | 'hold' | 'pending';
    paymentMethod: 'liqpay' | 'monobank' | 'privatbank' | 'cod';
    transactionId?: string;
    amount?: number;
    errorCode?: string;
    errorDescription?: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentHandlerResult {
    success: boolean;
    orderId: string;
    newStatus: string;
    message: string;
}

// Логування платежів
export interface PaymentLog {
    timestamp: Date;
    orderId: string;
    event: string;
    paymentMethod: string;
    status: string;
    data: Record<string, unknown>;
}

// In-memory лог для демонстрації (в production використовувати БД)
const paymentLogs: PaymentLog[] = [];

/**
 * Логування події платежу
 */
export function logPaymentEvent(
    orderId: string,
    event: string,
    paymentMethod: string,
    status: string,
    data: Record<string, unknown> = {}
): void {
    const log: PaymentLog = {
        timestamp: new Date(),
        orderId,
        event,
        paymentMethod,
        status,
        data,
    };
    paymentLogs.push(log);

    // Обмеження кількості логів в пам'яті
    if (paymentLogs.length > 10000) {
        paymentLogs.splice(0, 1000);
    }

    // Use structured logging instead of console.log
    paymentLogger.info(`${event}`, {
        orderId,
        paymentMethod,
        status,
        ...data,
    });
}

/**
 * Отримання логів платежу
 */
export function getPaymentLogs(orderId?: string): PaymentLog[] {
    if (orderId) {
        return paymentLogs.filter(log => log.orderId === orderId);
    }
    return paymentLogs.slice(-100); // Останні 100 логів
}

/**
 * Оновлення статусу замовлення в БД
 * В реальному проекті використовується Prisma
 */
export async function updateOrderPaymentStatus(
    update: OrderPaymentUpdate
): Promise<PaymentHandlerResult> {
    try {
        logPaymentEvent(
            update.orderId,
            'status_update',
            update.paymentMethod,
            update.status,
            { transactionId: update.transactionId, amount: update.amount }
        );

        // Маппінг статусу платежу на статус замовлення
        const orderStatusMap: Record<OrderPaymentUpdate['status'], {
            paymentStatus: string;
            orderStatus?: string;
        }> = {
            paid: { paymentStatus: 'PAID', orderStatus: 'CONFIRMED' },
            failed: { paymentStatus: 'FAILED' },
            refunded: { paymentStatus: 'REFUNDED', orderStatus: 'REFUNDED' },
            hold: { paymentStatus: 'PENDING', orderStatus: 'PENDING' },
            pending: { paymentStatus: 'PENDING' },
        };

        const statusMapping = orderStatusMap[update.status];

        // Симуляція оновлення БД (в реальному проекті - Prisma)
        // const result = await prisma.order.update({
        //     where: { orderNumber: update.orderId },
        //     data: {
        //         paymentStatus: statusMapping.paymentStatus,
        //         ...(statusMapping.orderStatus && { status: statusMapping.orderStatus }),
        //         paymentId: update.transactionId,
        //         updatedAt: new Date(),
        //     },
        // });

        // Створення запису про платіж
        // await prisma.payment.create({
        //     data: {
        //         orderId: update.orderId,
        //         amount: update.amount || 0,
        //         method: update.paymentMethod,
        //         status: statusMapping.paymentStatus,
        //         transactionId: update.transactionId,
        //         metadata: update.metadata,
        //     },
        // });

        // Додавання до історії замовлення
        // await prisma.orderHistory.create({
        //     data: {
        //         orderId: update.orderId,
        //         status: statusMapping.orderStatus || 'PENDING',
        //         comment: `Платіж ${update.status}: ${update.paymentMethod}`,
        //     },
        // });

        logPaymentEvent(
            update.orderId,
            'status_updated',
            update.paymentMethod,
            update.status,
            { newPaymentStatus: statusMapping.paymentStatus }
        );

        return {
            success: true,
            orderId: update.orderId,
            newStatus: statusMapping.paymentStatus,
            message: `Статус замовлення ${update.orderId} оновлено на ${statusMapping.paymentStatus}`,
        };
    } catch (error) {
        logPaymentEvent(
            update.orderId,
            'status_update_error',
            update.paymentMethod,
            'error',
            { error: error instanceof Error ? error.message : 'Unknown error' }
        );

        return {
            success: false,
            orderId: update.orderId,
            newStatus: 'error',
            message: `Помилка оновлення статусу: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Обробка callback від LiqPay
 */
export async function handleLiqPayCallback(
    payment: LiqPayPaymentResponse
): Promise<PaymentHandlerResult> {
    logPaymentEvent(
        payment.orderId,
        'liqpay_callback',
        'liqpay',
        payment.status,
        {
            paymentId: payment.paymentId,
            amount: payment.amount,
            transactionId: payment.transactionId,
        }
    );

    // Маппінг статусів LiqPay
    const statusMap: Record<LiqPayStatus, OrderPaymentUpdate['status']> = {
        success: 'paid',
        sandbox: 'paid',
        failure: 'failed',
        error: 'failed',
        reversed: 'refunded',
        refund_wait: 'pending',
        wait_accept: 'pending',
        wait_secure: 'pending',
        processing: 'pending',
        hold_wait: 'hold',
        cash_wait: 'pending',
        subscribed: 'paid',
        unsubscribed: 'pending',
    };

    const status = statusMap[payment.status] || 'pending';

    const result = await updateOrderPaymentStatus({
        orderId: payment.orderId,
        status,
        paymentMethod: 'liqpay',
        transactionId: payment.transactionId || payment.paymentId,
        amount: payment.amount,
        errorCode: payment.errorCode,
        errorDescription: payment.errorDescription,
        metadata: {
            liqpayStatus: payment.status,
            createDate: payment.createDate,
            endDate: payment.endDate,
            senderPhone: payment.senderPhone,
        },
    });

    // Відправка сповіщень
    if (status === 'paid') {
        await sendPaymentNotification(payment.orderId, 'success', 'liqpay');
    } else if (status === 'failed') {
        await sendPaymentNotification(payment.orderId, 'failed', 'liqpay');
    } else if (status === 'refunded') {
        await sendPaymentNotification(payment.orderId, 'refunded', 'liqpay');
    }

    return result;
}

/**
 * Обробка webhook від Monobank
 */
export async function handleMonobankWebhook(
    payment: MonobankWebhookPayload
): Promise<PaymentHandlerResult> {
    const orderId = payment.reference || payment.invoiceId;

    logPaymentEvent(
        orderId,
        'monobank_webhook',
        'monobank',
        payment.status,
        {
            invoiceId: payment.invoiceId,
            amount: payment.amount / 100, // Конвертація з копійок
            finalAmount: payment.finalAmount ? payment.finalAmount / 100 : undefined,
        }
    );

    // Маппінг статусів Monobank
    const statusMap: Record<MonobankPaymentStatus, OrderPaymentUpdate['status']> = {
        success: 'paid',
        failure: 'failed',
        reversed: 'refunded',
        expired: 'failed',
        created: 'pending',
        processing: 'pending',
        hold: 'hold',
    };

    const status = statusMap[payment.status] || 'pending';

    const result = await updateOrderPaymentStatus({
        orderId,
        status,
        paymentMethod: 'monobank',
        transactionId: payment.invoiceId,
        amount: payment.finalAmount ? payment.finalAmount / 100 : payment.amount / 100,
        errorCode: payment.errCode,
        errorDescription: payment.failureReason,
        metadata: {
            monobankStatus: payment.status,
            invoiceId: payment.invoiceId,
            createdDate: payment.createdDate,
            modifiedDate: payment.modifiedDate,
        },
    });

    // Відправка сповіщень
    if (status === 'paid') {
        await sendPaymentNotification(orderId, 'success', 'monobank');
    } else if (status === 'failed') {
        await sendPaymentNotification(orderId, 'failed', 'monobank');
    } else if (status === 'refunded') {
        await sendPaymentNotification(orderId, 'refunded', 'monobank');
    }

    return result;
}

/**
 * Обробка повернення коштів
 * @description Initiates refund process with payment provider and updates order status
 */
export async function handleRefund(
    orderId: string,
    paymentMethod: 'liqpay' | 'monobank',
    amount?: number,
    reason?: string
): Promise<PaymentHandlerResult> {
    logPaymentEvent(
        orderId,
        'refund_initiated',
        paymentMethod,
        'processing',
        { amount, reason }
    );

    try {
        // Call payment provider API for refund
        if (paymentMethod === 'liqpay') {
            await processLiqPayRefund(orderId, amount, reason);
        } else if (paymentMethod === 'monobank') {
            await processMonobankRefund(orderId, amount, reason);
        }

        // Update order status with transaction
        const { processRefundWithTransaction } = await import('../db/transactions');
        await processRefundWithTransaction(orderId, amount || 0, reason);

        const result = await updateOrderPaymentStatus({
            orderId,
            status: 'refunded',
            paymentMethod,
            amount,
            metadata: { refundReason: reason },
        });

        if (result.success) {
            await sendPaymentNotification(orderId, 'refunded', paymentMethod);
        }

        return result;
    } catch (error) {
        paymentLogger.error('Refund failed', error, {
            orderId,
            paymentMethod,
            amount,
            reason,
        });

        return {
            success: false,
            orderId,
            newStatus: 'error',
            message: `Refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Process LiqPay refund
 */
async function processLiqPayRefund(
    orderId: string,
    amount?: number,
    reason?: string
): Promise<void> {
    paymentLogger.info('Processing LiqPay refund', { orderId, amount, reason });

    // In production, call LiqPay API:
    // const liqpay = new LiqPay(process.env.LIQPAY_PUBLIC_KEY, process.env.LIQPAY_PRIVATE_KEY);
    // await liqpay.api('request', {
    //     action: 'refund',
    //     version: 3,
    //     order_id: orderId,
    //     amount: amount,
    // });
}

/**
 * Process Monobank refund
 */
async function processMonobankRefund(
    orderId: string,
    amount?: number,
    reason?: string
): Promise<void> {
    paymentLogger.info('Processing Monobank refund', { orderId, amount, reason });

    // In production, call Monobank API:
    // const monobank = new Monobank(process.env.MONOBANK_TOKEN);
    // await monobank.refund({
    //     invoiceId: orderId,
    //     amount: amount ? amount * 100 : undefined, // Convert to kopecks
    // });
}

/**
 * Відправка сповіщення про статус платежу
 */
async function sendPaymentNotification(
    orderId: string,
    type: 'success' | 'failed' | 'refunded',
    paymentMethod: string
): Promise<void> {
    logPaymentEvent(
        orderId,
        'notification_sent',
        paymentMethod,
        type,
        {}
    );

    // В реальному проекті тут буде:
    // 1. Отримання даних замовлення та користувача
    // 2. Відправка email через email сервіс
    // 3. Відправка SMS якщо потрібно
    // 4. Push сповіщення

    const messages: Record<string, { title: string; body: string }> = {
        success: {
            title: 'Оплата успішна',
            body: `Ваше замовлення #${orderId} успішно оплачено. Дякуємо за покупку!`,
        },
        failed: {
            title: 'Помилка оплати',
            body: `На жаль, оплата замовлення #${orderId} не пройшла. Спробуйте ще раз.`,
        },
        refunded: {
            title: 'Повернення коштів',
            body: `Кошти за замовлення #${orderId} повернено на ваш рахунок.`,
        },
    };

    const message = messages[type];

    paymentLogger.info(`Notification: ${message.title}`, {
        orderId,
        type,
        paymentMethod,
        body: message.body,
    });

    // await emailService.send({
    //     to: order.customerEmail,
    //     subject: message.title,
    //     template: `payment-${type}`,
    //     data: { orderId, ...order },
    // });
}

/**
 * Перевірка статусу платежу
 */
export async function checkPaymentStatus(
    orderId: string,
    paymentMethod: 'liqpay' | 'monobank'
): Promise<{ status: string; details: Record<string, unknown> }> {
    logPaymentEvent(
        orderId,
        'status_check',
        paymentMethod,
        'checking',
        {}
    );

    // В реальному проекті тут буде виклик API платіжної системи
    // для отримання актуального статусу

    return {
        status: 'unknown',
        details: {
            orderId,
            paymentMethod,
            message: 'Implement actual status check',
        },
    };
}

/**
 * Валідація суми платежу
 */
export function validatePaymentAmount(
    expectedAmount: number,
    receivedAmount: number,
    tolerance: number = 0.01
): boolean {
    const diff = Math.abs(expectedAmount - receivedAmount);
    return diff <= tolerance;
}

/**
 * Генерація унікального ID для платежу
 */
export function generatePaymentReference(orderId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY-${orderId}-${timestamp}-${random}`.toUpperCase();
}

// Експорт типів
export type {
    PaymentLog,
};
