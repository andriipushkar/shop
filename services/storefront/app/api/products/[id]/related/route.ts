import { NextRequest, NextResponse } from 'next/server';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/products/[id]/related - Get related products
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20);

        // Try cache first
        const cacheKey = `product:${id}:related:${limit}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        const products = await productRepository.getRelatedProducts(id, limit);

        // Cache for 30 minutes
        await cache.set(cacheKey, products, 1800);

        return NextResponse.json(products, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error fetching related products', error);
        return NextResponse.json(
            { error: 'Failed to fetch related products' },
            { status: 500 }
        );
    }
}
