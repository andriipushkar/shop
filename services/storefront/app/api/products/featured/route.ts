import { NextRequest, NextResponse } from 'next/server';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

// GET /api/products/featured - Get featured, bestsellers, new arrivals
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'featured';
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

        // Try cache first
        const cacheKey = `products:${type}:${limit}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        let products;

        switch (type) {
            case 'bestsellers':
                products = await productRepository.getBestsellers(limit);
                break;
            case 'new':
                products = await productRepository.getNewArrivals(limit);
                break;
            case 'featured':
            default:
                products = await productRepository.getFeaturedProducts(limit);
                break;
        }

        // Cache for 15 minutes
        await cache.set(cacheKey, products, 900);

        return NextResponse.json(products, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error fetching featured products', error);
        return NextResponse.json(
            { error: 'Failed to fetch featured products' },
            { status: 500 }
        );
    }
}
