import { NextRequest, NextResponse } from 'next/server';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

// GET /api/products - List active products with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
        const categoryId = searchParams.get('categoryId') || undefined;
        const brandId = searchParams.get('brandId') || undefined;
        const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
        const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
        const isNew = searchParams.get('isNew') === 'true' ? true : undefined;
        const isBestseller = searchParams.get('isBestseller') === 'true' ? true : undefined;
        const isFeatured = searchParams.get('isFeatured') === 'true' ? true : undefined;
        const sort = searchParams.get('sort') || 'createdAt';
        const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

        // Build cache key
        const cacheKey = `products:${JSON.stringify({ page, pageSize, categoryId, brandId, minPrice, maxPrice, isNew, isBestseller, isFeatured, sort, order })}`;

        // Try cache first
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        // Build sort options
        const orderBy: Record<string, 'asc' | 'desc'> = {};
        const sortableFields = ['createdAt', 'price', 'name', 'soldCount', 'rating'];
        if (sortableFields.includes(sort)) {
            orderBy[sort] = order;
        } else {
            orderBy.createdAt = 'desc';
        }

        const result = await productRepository.findMany(
            {
                status: 'ACTIVE',
                categoryId,
                brandId,
                minPrice,
                maxPrice,
                isNew,
                isBestseller,
                isFeatured,
            },
            page,
            pageSize,
            orderBy
        );

        // Cache for 5 minutes
        await cache.set(cacheKey, result, 300);

        return NextResponse.json(result, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error fetching products', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
