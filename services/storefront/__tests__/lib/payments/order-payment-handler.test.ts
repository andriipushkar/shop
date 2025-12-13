/**
 * Tests for Order Payment Handler
 */

import {
    updateOrderPaymentStatus,
    handleLiqPayCallback,
    handleMonobankWebhook,
    handleRefund,
    logPaymentEvent,
    getPaymentLogs,
    validatePaymentAmount,
    generatePaymentReference,
} from '@/lib/payments/order-payment-handler';
import { LiqPayPaymentResponse, LiqPayStatus } from '@/lib/payments/liqpay';
import { MonobankWebhookPayload, MonobankPaymentStatus } from '@/lib/payments/monobank';

// Mock the transactions module
jest.mock('@/lib/db/transactions', () => ({
    processRefundWithTransaction: jest.fn().mockResolvedValue({}),
}));

// Mock the logger module
jest.mock('@/lib/logger', () => ({
    paymentLogger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('Order Payment Handler', () => {
    beforeEach(() => {
        // Clear logs before each test
        jest.clearAllMocks();
    });

    describe('logPaymentEvent', () => {
        it('logs payment event correctly', () => {
            // logPaymentEvent now uses structured logger
            logPaymentEvent('order-123', 'payment_received', 'liqpay', 'success', {
                amount: 1000,
            });

            // Verify the logger was called (via mock)
            const { paymentLogger } = require('@/lib/logger');
            expect(paymentLogger.info).toHaveBeenCalled();
        });
    });

    describe('getPaymentLogs', () => {
        it('returns logs for specific order', () => {
            logPaymentEvent('order-456', 'test_event', 'liqpay', 'pending', {});
            logPaymentEvent('order-789', 'other_event', 'monobank', 'success', {});

            const logs = getPaymentLogs('order-456');

            expect(logs.length).toBeGreaterThanOrEqual(1);
            expect(logs.some(log => log.orderId === 'order-456')).toBe(true);
        });

        it('returns all recent logs when no orderId provided', () => {
            const logs = getPaymentLogs();

            expect(Array.isArray(logs)).toBe(true);
        });
    });

    describe('updateOrderPaymentStatus', () => {
        it('updates order status to paid', async () => {
            const result = await updateOrderPaymentStatus({
                orderId: 'test-order-1',
                status: 'paid',
                paymentMethod: 'liqpay',
                transactionId: 'tx-123',
                amount: 1500,
            });

            expect(result.success).toBe(true);
            expect(result.orderId).toBe('test-order-1');
            expect(result.newStatus).toBe('PAID');
        });

        it('updates order status to failed', async () => {
            const result = await updateOrderPaymentStatus({
                orderId: 'test-order-2',
                status: 'failed',
                paymentMethod: 'monobank',
                errorCode: 'DECLINED',
                errorDescription: 'Card declined',
            });

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('FAILED');
        });

        it('updates order status to refunded', async () => {
            const result = await updateOrderPaymentStatus({
                orderId: 'test-order-3',
                status: 'refunded',
                paymentMethod: 'liqpay',
            });

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('REFUNDED');
        });

        it('updates order status to hold', async () => {
            const result = await updateOrderPaymentStatus({
                orderId: 'test-order-4',
                status: 'hold',
                paymentMethod: 'monobank',
            });

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });

        it('updates order status to pending', async () => {
            const result = await updateOrderPaymentStatus({
                orderId: 'test-order-5',
                status: 'pending',
                paymentMethod: 'liqpay',
            });

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });
    });

    describe('handleLiqPayCallback', () => {
        it('handles successful payment', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-123',
                status: 'success' as LiqPayStatus,
                amount: 2000,
                currency: 'UAH',
                orderId: 'liqpay-order-1',
                description: 'Test payment',
                transactionId: 'tx-liqpay-1',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.orderId).toBe('liqpay-order-1');
            expect(result.newStatus).toBe('PAID');
        });

        it('handles sandbox payment as success', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-sandbox',
                status: 'sandbox' as LiqPayStatus,
                amount: 1000,
                currency: 'UAH',
                orderId: 'sandbox-order-1',
                description: 'Sandbox test',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PAID');
        });

        it('handles failed payment', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-failed',
                status: 'failure' as LiqPayStatus,
                amount: 500,
                currency: 'UAH',
                orderId: 'failed-order-1',
                description: 'Failed payment',
                errorCode: 'insufficient_funds',
                errorDescription: 'Insufficient funds',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('FAILED');
        });

        it('handles error status', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-error',
                status: 'error' as LiqPayStatus,
                amount: 300,
                currency: 'UAH',
                orderId: 'error-order-1',
                description: 'Error payment',
                errorCode: 'system_error',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('FAILED');
        });

        it('handles reversed payment', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-reversed',
                status: 'reversed' as LiqPayStatus,
                amount: 1200,
                currency: 'UAH',
                orderId: 'reversed-order-1',
                description: 'Reversed payment',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('REFUNDED');
        });

        it('handles processing status', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-processing',
                status: 'processing' as LiqPayStatus,
                amount: 800,
                currency: 'UAH',
                orderId: 'processing-order-1',
                description: 'Processing payment',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });

        it('handles hold_wait status', async () => {
            const payment: LiqPayPaymentResponse = {
                paymentId: 'pay-hold',
                status: 'hold_wait' as LiqPayStatus,
                amount: 2500,
                currency: 'UAH',
                orderId: 'hold-order-1',
                description: 'Hold payment',
            };

            const result = await handleLiqPayCallback(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });
    });

    describe('handleMonobankWebhook', () => {
        it('handles successful payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-123',
                status: 'success' as MonobankPaymentStatus,
                amount: 150000, // 1500 UAH in kopecks
                ccy: 980,
                reference: 'mono-order-1',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T10:01:00Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.orderId).toBe('mono-order-1');
            expect(result.newStatus).toBe('PAID');
        });

        it('handles failed payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-failed',
                status: 'failure' as MonobankPaymentStatus,
                amount: 50000,
                ccy: 980,
                reference: 'mono-failed-1',
                failureReason: 'Card declined',
                errCode: 'DECLINED',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T10:01:00Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('FAILED');
        });

        it('handles expired payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-expired',
                status: 'expired' as MonobankPaymentStatus,
                amount: 30000,
                ccy: 980,
                reference: 'mono-expired-1',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T11:00:00Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('FAILED');
        });

        it('handles reversed payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-reversed',
                status: 'reversed' as MonobankPaymentStatus,
                amount: 120000,
                ccy: 980,
                reference: 'mono-reversed-1',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T12:00:00Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('REFUNDED');
        });

        it('handles hold payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-hold',
                status: 'hold' as MonobankPaymentStatus,
                amount: 200000,
                ccy: 980,
                reference: 'mono-hold-1',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T10:00:30Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });

        it('handles processing payment', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-processing',
                status: 'processing' as MonobankPaymentStatus,
                amount: 80000,
                ccy: 980,
                reference: 'mono-processing-1',
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T10:00:15Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('PENDING');
        });

        it('uses invoiceId when reference is not provided', async () => {
            const payment: MonobankWebhookPayload = {
                invoiceId: 'inv-no-ref',
                status: 'success' as MonobankPaymentStatus,
                amount: 100000,
                ccy: 980,
                createdDate: '2024-01-15T10:00:00Z',
                modifiedDate: '2024-01-15T10:01:00Z',
            };

            const result = await handleMonobankWebhook(payment);

            expect(result.success).toBe(true);
            expect(result.orderId).toBe('inv-no-ref');
        });
    });

    describe('handleRefund', () => {
        it('handles refund for LiqPay', async () => {
            const result = await handleRefund(
                'refund-order-1',
                'liqpay',
                1500,
                'Customer requested refund'
            );

            expect(result.success).toBe(true);
            expect(result.orderId).toBe('refund-order-1');
            expect(result.newStatus).toBe('REFUNDED');
        });

        it('handles refund for Monobank', async () => {
            const result = await handleRefund(
                'refund-order-2',
                'monobank',
                2000,
                'Product defective'
            );

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('REFUNDED');
        });

        it('handles refund without amount', async () => {
            const result = await handleRefund(
                'refund-order-3',
                'liqpay'
            );

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('REFUNDED');
        });
    });

    describe('validatePaymentAmount', () => {
        it('returns true for exact match', () => {
            expect(validatePaymentAmount(1000, 1000)).toBe(true);
        });

        it('returns true within default tolerance', () => {
            expect(validatePaymentAmount(1000, 1000.005)).toBe(true);
            expect(validatePaymentAmount(1000, 999.995)).toBe(true);
        });

        it('returns false outside tolerance', () => {
            expect(validatePaymentAmount(1000, 1001)).toBe(false);
            expect(validatePaymentAmount(1000, 999)).toBe(false);
        });

        it('respects custom tolerance', () => {
            expect(validatePaymentAmount(1000, 1005, 10)).toBe(true);
            expect(validatePaymentAmount(1000, 1015, 10)).toBe(false);
        });
    });

    describe('generatePaymentReference', () => {
        it('generates reference with correct format', () => {
            const ref = generatePaymentReference('order-123');

            expect(ref).toMatch(/^PAY-ORDER-123-[A-Z0-9]+-[A-Z0-9]+$/);
        });

        it('generates unique references', () => {
            const ref1 = generatePaymentReference('order-1');
            const ref2 = generatePaymentReference('order-1');

            expect(ref1).not.toBe(ref2);
        });

        it('includes order ID in reference', () => {
            const ref = generatePaymentReference('my-order-456');

            expect(ref).toContain('MY-ORDER-456');
        });
    });
});
