/**
 * @jest-environment node
 */

// Hoisted mocks
jest.mock('@/lib/db/repositories/product.repository', () => ({
    productRepository: {
        findMany: jest.fn(),
    },
}));

jest.mock('@/lib/cache', () => ({
    cache: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/search/route';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';

const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>;
const mockCache = cache as jest.Mocked<typeof cache>;

describe('Search API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCache.get.mockResolvedValue(null);
        mockCache.set.mockResolvedValue(undefined);
    });

    describe('GET /api/search', () => {
        it('should return 400 for missing query', async () => {
            const request = new NextRequest('http://localhost/api/search');
            const response = await GET(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('at least 2 characters');
        });

        it('should return 400 for query shorter than 2 characters', async () => {
            const request = new NextRequest('http://localhost/api/search?q=a');
            const response = await GET(request);

            expect(response.status).toBe(400);
        });

        it('should search products successfully', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [
                    { id: '1', name: 'Test Product 1', price: 100 },
                    { id: '2', name: 'Test Product 2', price: 200 },
                ],
                total: 2,
                page: 1,
                pageSize: 20,
                totalPages: 1,
            });

            const request = new NextRequest('http://localhost/api/search?q=test');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.query).toBe('test');
            expect(data.products).toHaveLength(2);
        });

        it('should only search active products', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest('http://localhost/api/search?q=test');
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ACTIVE',
                    search: 'test',
                }),
                expect.any(Number),
                expect.any(Number),
                expect.anything()
            );
        });

        it('should apply filters to search', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/search?q=phone&categoryId=cat-1&minPrice=100&maxPrice=1000&brandId=brand-1'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'phone',
                    categoryId: 'cat-1',
                    brandId: 'brand-1',
                    minPrice: 100,
                    maxPrice: 1000,
                }),
                expect.any(Number),
                expect.any(Number),
                expect.anything()
            );
        });

        it('should support sorting by price', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/search?q=test&sort=price&order=asc'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Number),
                expect.any(Number),
                expect.objectContaining({
                    price: 'asc',
                })
            );
        });

        it('should support sorting by name', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/search?q=test&sort=name&order=desc'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Number),
                expect.any(Number),
                expect.objectContaining({
                    name: 'desc',
                })
            );
        });

        it('should support pagination', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 3,
                pageSize: 50,
                totalPages: 1,
            });

            const request = new NextRequest(
                'http://localhost/api/search?q=test&page=3&pageSize=50'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.anything(),
                3,
                50,
                expect.anything()
            );
        });

        it('should limit page size to 100', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 100,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/search?q=test&pageSize=500'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.anything(),
                1,
                100,
                expect.anything()
            );
        });

        it('should use cache for repeated searches', async () => {
            const cachedResult = {
                query: 'test',
                products: [{ id: '1', name: 'Cached' }],
                total: 1,
            };
            mockCache.get.mockResolvedValue(cachedResult);

            const request = new NextRequest('http://localhost/api/search?q=test');
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Cache')).toBe('HIT');
            expect(mockProductRepository.findMany).not.toHaveBeenCalled();
        });

        it('should cache results with short TTL', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest('http://localhost/api/search?q=test');
            await GET(request);

            expect(mockCache.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.anything(),
                120 // 2 minutes cache
            );
        });

        it('should handle repository errors', async () => {
            mockProductRepository.findMany.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest('http://localhost/api/search?q=test');
            const response = await GET(request);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Failed to search products');
        });
    });
});
