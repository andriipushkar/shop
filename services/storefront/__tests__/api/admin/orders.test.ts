/**
 * @jest-environment node
 */

// Hoisted mocks
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/db/repositories/order.repository', () => ({
    orderRepository: {
        findMany: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        updateStatus: jest.fn(),
        updatePaymentStatus: jest.fn(),
        updateShippingStatus: jest.fn(),
        getOrderStats: jest.fn(),
    },
}));

// Mock transactions module (used in POST)
const mockCreateOrderWithTransaction = jest.fn();
jest.mock('@/lib/db/transactions', () => ({
    createOrderWithTransaction: mockCreateOrderWithTransaction,
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/orders/route';
import { auth } from '@/lib/auth';
import { orderRepository } from '@/lib/db/repositories/order.repository';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockFindMany = orderRepository.findMany as jest.Mock;

// Get reference to the mocked transaction function
const { createOrderWithTransaction } = require('@/lib/db/transactions');
const mockCreateWithTransaction = createOrderWithTransaction as jest.Mock;

describe('Admin Orders API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/orders', () => {
        it('should return 401 when not authenticated', async () => {
            mockAuth.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/admin/orders');
            const response = await GET(request);

            expect(response.status).toBe(401);
        });

        it('should return 401 for non-admin/manager/warehouse users', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'CUSTOMER' },
            } as any);

            const request = new NextRequest('http://localhost/api/admin/orders');
            const response = await GET(request);

            expect(response.status).toBe(401);
        });

        it('should return orders for warehouse staff', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'WAREHOUSE' },
            } as any);
            mockFindMany.mockResolvedValue({
                orders: [
                    { id: '1', orderNumber: '202401-00001', total: 500 },
                ],
                total: 1,
                page: 1,
                pageSize: 20,
                totalPages: 1,
            });

            const request = new NextRequest('http://localhost/api/admin/orders');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.orders).toHaveLength(1);
        });

        it('should filter by status', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockFindMany.mockResolvedValue({
                orders: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/admin/orders?status=PENDING&paymentStatus=PAID'
            );
            await GET(request);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'PENDING',
                    paymentStatus: 'PAID',
                }),
                1,
                20
            );
        });

        it('should filter by date range', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockFindMany.mockResolvedValue({
                orders: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/admin/orders?dateFrom=2024-01-01&dateTo=2024-12-31'
            );
            await GET(request);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateFrom: expect.any(Date),
                    dateTo: expect.any(Date),
                }),
                1,
                20
            );
        });

        it('should search orders', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'MANAGER' },
            } as any);
            mockFindMany.mockResolvedValue({
                orders: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/admin/orders?search=202401'
            );
            await GET(request);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: '202401',
                }),
                1,
                20
            );
        });
    });

    describe('POST /api/admin/orders', () => {
        const validOrderData = {
            customerEmail: 'test@example.com',
            customerPhone: '+380501234567',
            customerName: 'Test Customer',
            items: [
                {
                    productId: 'prod-1',
                    sku: 'SKU-001',
                    name: 'Product 1',
                    price: 100,
                    quantity: 2,
                },
            ],
        };

        it('should return 401 when not authenticated', async () => {
            mockAuth.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/admin/orders', {
                method: 'POST',
                body: JSON.stringify(validOrderData),
            });
            const response = await POST(request);

            expect(response.status).toBe(401);
        });

        it('should return 401 for warehouse staff (cannot create orders)', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'WAREHOUSE' },
            } as any);

            const request = new NextRequest('http://localhost/api/admin/orders', {
                method: 'POST',
                body: JSON.stringify(validOrderData),
            });
            const response = await POST(request);

            expect(response.status).toBe(401);
        });

        it('should return 400 for missing required fields', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);

            const request = new NextRequest('http://localhost/api/admin/orders', {
                method: 'POST',
                body: JSON.stringify({ customerEmail: 'test@example.com' }),
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it('should create order successfully', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            const createdOrder = {
                id: '1',
                orderNumber: '202401-00001',
                ...validOrderData,
                total: 200,
            };
            mockCreateWithTransaction.mockResolvedValue(createdOrder);

            const request = new NextRequest('http://localhost/api/admin/orders', {
                method: 'POST',
                body: JSON.stringify(validOrderData),
            });
            const response = await POST(request);

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.orderNumber).toBe('202401-00001');
        });

        it('should calculate totals correctly', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockCreateWithTransaction.mockImplementation(async (data: Record<string, unknown>) => ({
                id: '1',
                ...data,
            }));

            const orderWithMultipleItems = {
                ...validOrderData,
                items: [
                    { productId: '1', sku: 'A', name: 'A', price: 100, quantity: 2 },
                    { productId: '2', sku: 'B', name: 'B', price: 50, quantity: 3 },
                ],
                shippingCost: 50,
                discount: 25,
            };

            const request = new NextRequest('http://localhost/api/admin/orders', {
                method: 'POST',
                body: JSON.stringify(orderWithMultipleItems),
            });
            await POST(request);

            expect(mockCreateWithTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    subtotal: 350, // 100*2 + 50*3
                    total: 375, // 350 - 25 + 50
                })
            );
        });
    });
});
