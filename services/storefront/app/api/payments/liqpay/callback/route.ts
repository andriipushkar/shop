import { NextRequest, NextResponse } from 'next/server';
import { liqpay } from '@/lib/payments/liqpay';
import { handleLiqPayCallback, logPaymentEvent } from '@/lib/payments/order-payment-handler';
import { apiLogger } from '@/lib/logger';

/**
 * POST /api/payments/liqpay/callback
 * Callback від LiqPay після оплати
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const data = formData.get('data') as string;
        const signature = formData.get('signature') as string;

        if (!data || !signature) {
            logPaymentEvent('unknown', 'callback_error', 'liqpay', 'error', {
                error: 'Missing data or signature',
            });
            return NextResponse.json(
                { success: false, error: 'Missing data or signature' },
                { status: 400 }
            );
        }

        // Верифікація підпису
        if (!liqpay.verifyCallback(data, signature)) {
            logPaymentEvent('unknown', 'callback_error', 'liqpay', 'error', {
                error: 'Invalid signature',
            });
            apiLogger.error('LiqPay callback: Invalid signature');
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Парсинг даних
        const payment = liqpay.parseCallback(data);

        apiLogger.info('LiqPay callback received:', {
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
        });

        // Обробка платежу через централізований handler
        const result = await handleLiqPayCallback(payment);

        if (!result.success) {
            apiLogger.error(`LiqPay payment handling failed: ${result.message}`);
            // Все одно повертаємо 200, щоб LiqPay не повторював запит
        }

        apiLogger.info(`Order ${payment.orderId}: ${result.message}`);

        return NextResponse.json({
            success: true,
            orderId: payment.orderId,
            status: result.newStatus,
        });
    } catch (error) {
        apiLogger.error('LiqPay callback error', error);
        logPaymentEvent('unknown', 'callback_exception', 'liqpay', 'error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
