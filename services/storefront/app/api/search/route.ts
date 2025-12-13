import { NextRequest, NextResponse } from 'next/server';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

// GET /api/search - Search products
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
        const categoryId = searchParams.get('categoryId') || undefined;
        const brandId = searchParams.get('brandId') || undefined;
        const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
        const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
        const sort = searchParams.get('sort') || 'relevance';
        const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

        if (!query || query.length < 2) {
            return NextResponse.json(
                { error: 'Search query must be at least 2 characters' },
                { status: 400 }
            );
        }

        // Build cache key
        const cacheKey = `search:${Buffer.from(JSON.stringify({ query, page, pageSize, categoryId, brandId, minPrice, maxPrice, sort, order })).toString('base64')}`;

        // Try cache first (short TTL for search)
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        // Build sort options
        const orderBy: Record<string, 'asc' | 'desc'> = {};
        if (sort === 'price') {
            orderBy.price = order;
        } else if (sort === 'name') {
            orderBy.name = order;
        } else if (sort === 'rating') {
            orderBy.rating = 'desc';
        } else if (sort === 'newest') {
            orderBy.createdAt = 'desc';
        } else if (sort === 'bestselling') {
            orderBy.soldCount = 'desc';
        } else {
            // Default: relevance (no specific sort, DB will use match score)
            orderBy.createdAt = 'desc';
        }

        const result = await productRepository.findMany(
            {
                search: query,
                status: 'ACTIVE',
                categoryId,
                brandId,
                minPrice,
                maxPrice,
            },
            page,
            pageSize,
            orderBy
        );

        const response = {
            query,
            ...result,
        };

        // Cache for 2 minutes
        await cache.set(cacheKey, response, 120);

        return NextResponse.json(response, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error searching products', error);
        return NextResponse.json(
            { error: 'Failed to search products' },
            { status: 500 }
        );
    }
}
