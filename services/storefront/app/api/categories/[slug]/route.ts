import { NextRequest, NextResponse } from 'next/server';
import { categoryRepository } from '@/lib/db/repositories/category.repository';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ slug: string }>;
}

// GET /api/categories/[slug] - Get category with products
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
        const includeSubcategories = searchParams.get('includeSubcategories') === 'true';

        // Try cache for category
        const categoryCacheKey = `category:${slug}`;
        let category = await cache.get<Awaited<ReturnType<typeof categoryRepository.findBySlug>>>(categoryCacheKey);

        if (!category) {
            category = await categoryRepository.findBySlug(slug);
            if (category) {
                await cache.set(categoryCacheKey, category, 3600);
            }
        }

        if (!category) {
            return NextResponse.json(
                { error: 'Category not found' },
                { status: 404 }
            );
        }

        // Get category IDs to search (include subcategories if requested)
        let categoryIds = [category.id];
        if (includeSubcategories) {
            categoryIds = await categoryRepository.getChildrenIds(category.id);
        }

        // Get breadcrumb
        const breadcrumb = await categoryRepository.getBreadcrumb(category.id);

        // Get products
        const products = await productRepository.findMany(
            {
                categoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
                status: 'ACTIVE',
            },
            page,
            pageSize
        );

        return NextResponse.json({
            category,
            breadcrumb,
            products,
        });
    } catch (error) {
        apiLogger.error('Error fetching category', error);
        return NextResponse.json(
            { error: 'Failed to fetch category' },
            { status: 500 }
        );
    }
}
