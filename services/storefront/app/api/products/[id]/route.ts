import { NextRequest, NextResponse } from 'next/server';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/products/[id] - Get product by ID or slug
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Try cache first
        const cacheKey = `product:${id}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        // Try to find by ID first, then by slug
        const productById = await productRepository.findById(id);
        const product = productById || await productRepository.findBySlug(id);

        if (!product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        // Only return active products
        if (product.status !== 'ACTIVE') {
            return NextResponse.json(
                { error: 'Product not available' },
                { status: 404 }
            );
        }

        // Increment view count (async, don't wait)
        productRepository.incrementViewCount(product.id).catch((err) => apiLogger.error('Failed to increment view count', err));

        // Cache for 10 minutes
        await cache.set(cacheKey, product, 600);

        return NextResponse.json(product, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error fetching product', error);
        return NextResponse.json(
            { error: 'Failed to fetch product' },
            { status: 500 }
        );
    }
}
