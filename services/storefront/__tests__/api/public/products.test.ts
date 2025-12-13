/**
 * @jest-environment node
 */

// Hoisted mocks
jest.mock('@/lib/db/repositories/product.repository', () => ({
    productRepository: {
        findMany: jest.fn(),
        findById: jest.fn(),
        findBySlug: jest.fn(),
        incrementViewCount: jest.fn(),
        getRelatedProducts: jest.fn(),
        getFeaturedProducts: jest.fn(),
        getBestsellers: jest.fn(),
        getNewArrivals: jest.fn(),
    },
}));

jest.mock('@/lib/cache', () => ({
    cache: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/products/route';
import { GET as GET_BY_ID } from '@/app/api/products/[id]/route';
import { GET as GET_FEATURED } from '@/app/api/products/featured/route';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';

const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>;
const mockCache = cache as jest.Mocked<typeof cache>;

describe('Public Products API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCache.get.mockResolvedValue(null);
        mockCache.set.mockResolvedValue(undefined);
        // Ensure incrementViewCount returns a Promise
        mockProductRepository.incrementViewCount.mockResolvedValue(undefined);
    });

    describe('GET /api/products', () => {
        it('should return products list', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [
                    { id: '1', name: 'Product 1', price: 100, status: 'ACTIVE' },
                    { id: '2', name: 'Product 2', price: 200, status: 'ACTIVE' },
                ],
                total: 2,
                page: 1,
                pageSize: 20,
                totalPages: 1,
            });

            const request = new NextRequest('http://localhost/api/products');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.products).toHaveLength(2);
        });

        it('should only return active products', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest('http://localhost/api/products');
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ACTIVE',
                }),
                expect.any(Number),
                expect.any(Number),
                expect.anything()
            );
        });

        it('should return cached products if available', async () => {
            const cachedProducts = {
                products: [{ id: '1', name: 'Cached Product' }],
                total: 1,
            };
            mockCache.get.mockResolvedValue(cachedProducts);

            const request = new NextRequest('http://localhost/api/products');
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Cache')).toBe('HIT');
            expect(mockProductRepository.findMany).not.toHaveBeenCalled();
        });

        it('should apply filters', async () => {
            mockProductRepository.findMany.mockResolvedValue({
                products: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/products?categoryId=cat-1&minPrice=100&maxPrice=500&brandId=brand-1'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    categoryId: 'cat-1',
                    brandId: 'brand-1',
                    minPrice: 100,
                    maxPrice: 500,
                }),
                expect.any(Number),
                expect.any(Number),
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
                'http://localhost/api/products?pageSize=500'
            );
            await GET(request);

            expect(mockProductRepository.findMany).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Number),
                100,
                expect.anything()
            );
        });
    });

    describe('GET /api/products/[id]', () => {
        it('should return product by ID', async () => {
            const product = {
                id: '1',
                name: 'Product 1',
                price: 100,
                status: 'ACTIVE',
            };
            mockProductRepository.findById.mockResolvedValue(product);

            const request = new NextRequest('http://localhost/api/products/1');
            const response = await GET_BY_ID(request, { params: Promise.resolve({ id: '1' }) });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.name).toBe('Product 1');
        });

        it('should return product by slug if ID not found', async () => {
            const product = {
                id: '1',
                slug: 'test-product',
                name: 'Product 1',
                status: 'ACTIVE',
            };
            mockProductRepository.findById.mockResolvedValue(null);
            mockProductRepository.findBySlug.mockResolvedValue(product);

            const request = new NextRequest('http://localhost/api/products/test-product');
            const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'test-product' }) });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.slug).toBe('test-product');
        });

        it('should return 404 if product not found', async () => {
            mockProductRepository.findById.mockResolvedValue(null);
            mockProductRepository.findBySlug.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/products/non-existent');
            const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'non-existent' }) });

            expect(response.status).toBe(404);
        });

        it('should return 404 for non-active products', async () => {
            const inactiveProduct = {
                id: '1',
                name: 'Inactive Product',
                status: 'DRAFT',
            };
            mockProductRepository.findById.mockResolvedValue(inactiveProduct);

            const request = new NextRequest('http://localhost/api/products/1');
            const response = await GET_BY_ID(request, { params: Promise.resolve({ id: '1' }) });

            expect(response.status).toBe(404);
        });

        it('should increment view count', async () => {
            const product = {
                id: '1',
                name: 'Product 1',
                status: 'ACTIVE',
            };
            mockProductRepository.findById.mockResolvedValue(product);
            mockProductRepository.incrementViewCount.mockResolvedValue(undefined);

            const request = new NextRequest('http://localhost/api/products/1');
            await GET_BY_ID(request, { params: Promise.resolve({ id: '1' }) });

            expect(mockProductRepository.incrementViewCount).toHaveBeenCalledWith('1');
        });
    });

    describe('GET /api/products/featured', () => {
        it('should return featured products by default', async () => {
            const featuredProducts = [
                { id: '1', name: 'Featured 1', isFeatured: true },
            ];
            mockProductRepository.getFeaturedProducts.mockResolvedValue(featuredProducts);

            const request = new NextRequest('http://localhost/api/products/featured');
            const response = await GET_FEATURED(request);

            expect(response.status).toBe(200);
            expect(mockProductRepository.getFeaturedProducts).toHaveBeenCalledWith(10);
        });

        it('should return bestsellers when type=bestsellers', async () => {
            const bestsellers = [
                { id: '1', name: 'Bestseller 1', soldCount: 100 },
            ];
            mockProductRepository.getBestsellers.mockResolvedValue(bestsellers);

            const request = new NextRequest(
                'http://localhost/api/products/featured?type=bestsellers'
            );
            const response = await GET_FEATURED(request);

            expect(response.status).toBe(200);
            expect(mockProductRepository.getBestsellers).toHaveBeenCalledWith(10);
        });

        it('should return new arrivals when type=new', async () => {
            const newArrivals = [
                { id: '1', name: 'New Product 1', isNew: true },
            ];
            mockProductRepository.getNewArrivals.mockResolvedValue(newArrivals);

            const request = new NextRequest(
                'http://localhost/api/products/featured?type=new'
            );
            const response = await GET_FEATURED(request);

            expect(response.status).toBe(200);
            expect(mockProductRepository.getNewArrivals).toHaveBeenCalledWith(10);
        });

        it('should respect limit parameter (max 50)', async () => {
            mockProductRepository.getFeaturedProducts.mockResolvedValue([]);

            const request = new NextRequest(
                'http://localhost/api/products/featured?limit=100'
            );
            await GET_FEATURED(request);

            expect(mockProductRepository.getFeaturedProducts).toHaveBeenCalledWith(50);
        });

        it('should use cache', async () => {
            const cachedProducts = [{ id: '1', name: 'Cached' }];
            mockCache.get.mockResolvedValue(cachedProducts);

            const request = new NextRequest('http://localhost/api/products/featured');
            const response = await GET_FEATURED(request);

            expect(response.headers.get('X-Cache')).toBe('HIT');
            expect(mockProductRepository.getFeaturedProducts).not.toHaveBeenCalled();
        });
    });
});
