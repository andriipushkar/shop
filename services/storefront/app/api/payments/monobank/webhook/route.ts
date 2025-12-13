import { NextRequest, NextResponse } from 'next/server';
import { monobank } from '@/lib/payments/monobank';
import { handleMonobankWebhook, logPaymentEvent } from '@/lib/payments/order-payment-handler';
import { validateWebhookIP } from '@/lib/security/ip-whitelist';
import { apiLogger } from '@/lib/logger';

// Кеш публічного ключа
let cachedPubKey: { keyId: string; key: string } | null = null;

/**
 * POST /api/payments/monobank/webhook
 * Webhook від Monobank після оплати
 * @description Validates IP whitelist, signature, and processes payment status updates
 */
export async function POST(request: NextRequest) {
    try {
        // IP Whitelist validation (security measure)
        const ipValidation = validateWebhookIP(request, 'monobank');
        if (!ipValidation.valid) {
            logPaymentEvent('unknown', 'webhook_ip_blocked', 'monobank', 'error', {
                ip: ipValidation.ip,
                error: ipValidation.error,
            });
            apiLogger.error(`Monobank webhook: IP blocked - ${ipValidation.ip}`);
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        const body = await request.text();
        const xSign = request.headers.get('X-Sign');

        if (!xSign) {
            logPaymentEvent('unknown', 'webhook_error', 'monobank', 'error', {
                error: 'Missing X-Sign header',
                ip: ipValidation.ip,
            });
            apiLogger.error('Monobank webhook: Missing X-Sign header');
            return NextResponse.json(
                { success: false, error: 'Missing signature' },
                { status: 401 }
            );
        }

        // Отримання публічного ключа (з кешем)
        if (!cachedPubKey) {
            try {
                cachedPubKey = await monobank.getPublicKey();
            } catch (error) {
                apiLogger.error('Failed to get Monobank public key:', error);
                logPaymentEvent('unknown', 'pubkey_error', 'monobank', 'warning', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Продовжуємо без верифікації в dev режимі
                if (process.env.NODE_ENV === 'production') {
                    return NextResponse.json(
                        { success: false, error: 'Failed to verify signature' },
                        { status: 500 }
                    );
                }
            }
        }

        // Верифікація підпису (тільки в production)
        if (process.env.NODE_ENV === 'production' && cachedPubKey) {
            if (!monobank.verifyWebhook(body, xSign, cachedPubKey.key)) {
                logPaymentEvent('unknown', 'webhook_error', 'monobank', 'error', {
                    error: 'Invalid signature',
                });
                apiLogger.error('Monobank webhook: Invalid signature');
                return NextResponse.json(
                    { success: false, error: 'Invalid signature' },
                    { status: 401 }
                );
            }
        }

        // Парсинг даних
        const payment = monobank.parseWebhook(body);

        apiLogger.info('Monobank webhook received:', {
            invoiceId: payment.invoiceId,
            status: payment.status,
            amount: monobank.fromKopecks(payment.amount),
            reference: payment.reference,
        });

        // Обробка платежу через централізований handler
        const result = await handleMonobankWebhook(payment);

        if (!result.success) {
            apiLogger.error(`Monobank payment handling failed: ${result.message}`);
            // Все одно повертаємо 200, щоб Monobank не повторював запит
        }

        apiLogger.info(`Order ${result.orderId}: ${result.message}`);

        return NextResponse.json({
            success: true,
            orderId: result.orderId,
            status: result.newStatus,
        });
    } catch (error) {
        apiLogger.error('Monobank webhook error', error);
        logPaymentEvent('unknown', 'webhook_exception', 'monobank', 'error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
