/**
 * @jest-environment node
 */

// Hoisted mocks
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/db/repositories/product.repository', () => ({
    productRepository: {
        findMany: jest.fn(),
        findById: jest.fn(),
        findBySku: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateStatus: jest.fn(),
    },
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/products/route';
import { auth } from '@/lib/auth';
import { productRepository } from '@/lib/db/repositories/product.repository';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockFindMany = productRepository.findMany as jest.Mock;
const mockFindBySku = (productRepository as any).findBySku as jest.Mock;
const mockCreate = productRepository.create as jest.Mock;

describe('Admin Products API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/products', () => {
        it('should return 401 when not authenticated', async () => {
            mockAuth.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/admin/products');
            const response = await GET(request);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 401 for non-admin users', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'CUSTOMER' },
            } as any);

            const request = new NextRequest('http://localhost/api/admin/products');
            const response = await GET(request);

            expect(response.status).toBe(401);
        });

        it('should return products for admin users', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockFindMany.mockResolvedValue({
                products: [
                    { id: '1', name: 'Product 1', price: 100 },
                    { id: '2', name: 'Product 2', price: 200 },
                ],
                total: 2,
                page: 1,
                pageSize: 20,
                totalPages: 1,
            });

            const request = new NextRequest('http://localhost/api/admin/products');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.products).toHaveLength(2);
            expect(data.total).toBe(2);
        });

        it('should apply filters from query params', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'MANAGER' },
            } as any);
            mockFindMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/admin/products?search=test&status=ACTIVE&categoryId=cat-1'
            );
            await GET(request);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'test',
                    status: 'ACTIVE',
                    categoryId: 'cat-1',
                }),
                1,
                20
            );
        });

        it('should handle pagination', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockFindMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 2,
                pageSize: 50,
                totalPages: 1,
            });

            const request = new NextRequest(
                'http://localhost/api/admin/products?page=2&pageSize=50'
            );
            await GET(request);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.anything(),
                2,
                50
            );
        });
    });

    describe('POST /api/admin/products', () => {
        const validProductData = {
            sku: 'TEST-001',
            name: 'Test Product',
            nameUa: 'Тестовий продукт',
            slug: 'test-product',
            price: 99.99,
            categoryId: 'cat-1',
        };

        it('should return 401 when not authenticated', async () => {
            mockAuth.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/admin/products', {
                method: 'POST',
                body: JSON.stringify(validProductData),
            });
            const response = await POST(request);

            expect(response.status).toBe(401);
        });

        it('should return 400 for missing required fields', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);

            const request = new NextRequest('http://localhost/api/admin/products', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test' }),
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('Missing required fields');
        });

        it('should create product successfully', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            const createdProduct = { id: '1', ...validProductData };
            mockFindBySku.mockResolvedValue(null); // SKU doesn't exist
            mockCreate.mockResolvedValue(createdProduct);

            const request = new NextRequest('http://localhost/api/admin/products', {
                method: 'POST',
                body: JSON.stringify(validProductData),
            });
            const response = await POST(request);

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.id).toBe('1');
            expect(data.name).toBe('Test Product');
        });

        it('should handle repository errors', async () => {
            mockAuth.mockResolvedValue({
                user: { id: '1', role: 'ADMIN' },
            } as any);
            mockFindBySku.mockResolvedValue(null); // SKU doesn't exist
            mockCreate.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest('http://localhost/api/admin/products', {
                method: 'POST',
                body: JSON.stringify(validProductData),
            });
            const response = await POST(request);

            expect(response.status).toBe(500);
        });
    });
});
