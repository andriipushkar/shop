/**
 * @jest-environment node
 */

// Hoisted mocks - define mock functions first
const mockVerifyCallback = jest.fn();
const mockParseCallbackData = jest.fn();
const mockIsPaymentSuccessful = jest.fn();
const mockIsPaymentFailed = jest.fn();

jest.mock('@/lib/liqpay', () => ({
    verifyCallback: (...args: unknown[]) => mockVerifyCallback(...args),
    parseCallbackData: (data: string) => mockParseCallbackData(data),
    isPaymentSuccessful: (status: string) => mockIsPaymentSuccessful(status),
    isPaymentFailed: (status: string) => mockIsPaymentFailed(status),
}));

jest.mock('@/lib/db/prisma', () => ({
    prisma: {
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        payment: {
            upsert: jest.fn(),
        },
        orderHistory: {
            create: jest.fn(),
        },
    },
}));

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/liqpay/callback/route';
import { prisma } from '@/lib/db/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('LiqPay Callback API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/liqpay/callback', () => {
        it('should return 400 for missing data or signature', async () => {
            const formData = new FormData();
            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Missing data or signature');
        });

        it('should return 403 for invalid signature', async () => {
            mockVerifyCallback.mockReturnValue(false);

            const formData = new FormData();
            formData.append('data', 'test-data');
            formData.append('signature', 'invalid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            const response = await POST(request);

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Invalid signature');
        });

        it('should return 400 for invalid callback data', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue(null);

            const formData = new FormData();
            formData.append('data', 'invalid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid callback data');
        });

        it('should return 404 if order not found', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue({
                order_id: 'ORDER-123',
                status: 'success',
                amount: 100,
                payment_id: 12345,
            });
            mockPrisma.order.findUnique.mockResolvedValue(null);

            const formData = new FormData();
            formData.append('data', 'valid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            const response = await POST(request);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Order not found');
        });

        it('should update order status to PAID on successful payment', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue({
                order_id: 'ORDER-123',
                status: 'success',
                amount: 100,
                payment_id: 12345,
            });
            mockIsPaymentSuccessful.mockReturnValue(true);
            mockIsPaymentFailed.mockReturnValue(false);
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'order-1',
                orderNumber: 'ORDER-123',
                status: 'PENDING',
            });
            mockPrisma.order.update.mockResolvedValue({});
            mockPrisma.payment.upsert.mockResolvedValue({});
            mockPrisma.orderHistory.create.mockResolvedValue({});

            const formData = new FormData();
            formData.append('data', 'valid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mockPrisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'order-1' },
                    data: expect.objectContaining({
                        paymentStatus: 'PAID',
                        status: 'CONFIRMED',
                    }),
                })
            );
        });

        it('should update order status to FAILED on failed payment', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue({
                order_id: 'ORDER-123',
                status: 'failure',
                amount: 100,
                payment_id: 12345,
            });
            mockIsPaymentSuccessful.mockReturnValue(false);
            mockIsPaymentFailed.mockReturnValue(true);
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'order-1',
                orderNumber: 'ORDER-123',
                status: 'PENDING',
            });
            mockPrisma.order.update.mockResolvedValue({});
            mockPrisma.payment.upsert.mockResolvedValue({});
            mockPrisma.orderHistory.create.mockResolvedValue({});

            const formData = new FormData();
            formData.append('data', 'valid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            await POST(request);

            expect(mockPrisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: 'FAILED',
                    }),
                })
            );
        });

        it('should create payment record', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue({
                order_id: 'ORDER-123',
                status: 'success',
                amount: 100,
                payment_id: 12345,
            });
            mockIsPaymentSuccessful.mockReturnValue(true);
            mockIsPaymentFailed.mockReturnValue(false);
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'order-1',
                orderNumber: 'ORDER-123',
                status: 'PENDING',
            });
            mockPrisma.order.update.mockResolvedValue({});
            mockPrisma.payment.upsert.mockResolvedValue({});
            mockPrisma.orderHistory.create.mockResolvedValue({});

            const formData = new FormData();
            formData.append('data', 'valid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            await POST(request);

            expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        orderId: 'order-1',
                        amount: 100,
                        method: 'liqpay',
                    }),
                })
            );
        });

        it('should create order history entry', async () => {
            mockVerifyCallback.mockReturnValue(true);
            mockParseCallbackData.mockReturnValue({
                order_id: 'ORDER-123',
                status: 'success',
                amount: 100,
                payment_id: 12345,
            });
            mockIsPaymentSuccessful.mockReturnValue(true);
            mockIsPaymentFailed.mockReturnValue(false);
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'order-1',
                orderNumber: 'ORDER-123',
                status: 'PENDING',
            });
            mockPrisma.order.update.mockResolvedValue({});
            mockPrisma.payment.upsert.mockResolvedValue({});
            mockPrisma.orderHistory.create.mockResolvedValue({});

            const formData = new FormData();
            formData.append('data', 'valid-data');
            formData.append('signature', 'valid-signature');

            const request = new NextRequest('http://localhost/api/liqpay/callback', {
                method: 'POST',
                body: formData,
            });
            await POST(request);

            expect(mockPrisma.orderHistory.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        orderId: 'order-1',
                    }),
                })
            );
        });
    });

    describe('GET /api/liqpay/callback', () => {
        it('should redirect to orders page', async () => {
            const request = new NextRequest(
                'http://localhost/api/liqpay/callback?order_id=ORDER-123'
            );
            const response = await GET(request);

            expect(response.status).toBe(307); // redirect
            expect(response.headers.get('Location')).toContain('/orders');
            expect(response.headers.get('Location')).toContain('payment=success');
            expect(response.headers.get('Location')).toContain('order=ORDER-123');
        });

        it('should redirect without order params if no order_id', async () => {
            const request = new NextRequest('http://localhost/api/liqpay/callback');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/orders');
        });
    });
});
