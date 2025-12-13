import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { productRepository } from '@/lib/db/repositories/product.repository';
import { parsePagination, parseEnumParam } from '@/lib/security/pagination';
import type { ProductStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

const VALID_PRODUCT_STATUSES: readonly ProductStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'] as const;

/**
 * GET /api/admin/products - List products with filters
 * @description Fetches paginated list of products for admin panel
 * @param request - NextRequest with query params: page, pageSize, search, categoryId, brandId, status
 * @returns Paginated products list with total count
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Secure pagination with bounds validation (prevents DoS)
        const { page, pageSize } = parsePagination(
            searchParams.get('page'),
            searchParams.get('pageSize'),
            { maxPageSize: 100, defaultPageSize: 20 }
        );

        const search = searchParams.get('search') || undefined;
        const categoryId = searchParams.get('categoryId') || undefined;
        const brandId = searchParams.get('brandId') || undefined;
        const status = parseEnumParam(searchParams.get('status'), VALID_PRODUCT_STATUSES);

        const result = await productRepository.findMany(
            { search, categoryId, brandId, status },
            page,
            pageSize
        );

        return NextResponse.json(result);
    } catch (error) {
        apiLogger.error('Error fetching products:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}

// POST /api/admin/products - Create product
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Validate required fields
        const { name, nameUa, sku, slug, price, categoryId } = body;
        if (!name || !nameUa || !sku || !slug || !price || !categoryId) {
            return NextResponse.json(
                { error: 'Missing required fields: name, nameUa, sku, slug, price, categoryId' },
                { status: 400 }
            );
        }

        // Check if SKU already exists
        const existingProduct = await productRepository.findBySku(sku);
        if (existingProduct) {
            return NextResponse.json(
                { error: 'Product with this SKU already exists' },
                { status: 409 }
            );
        }

        const product = await productRepository.create({
            name,
            nameUa,
            sku,
            slug,
            price,
            compareAtPrice: body.compareAtPrice,
            costPrice: body.costPrice,
            description: body.description,
            descriptionUa: body.descriptionUa,
            status: body.status || 'DRAFT',
            isNew: body.isNew || false,
            isBestseller: body.isBestseller || false,
            isFeatured: body.isFeatured || false,
            weight: body.weight,
            length: body.length,
            width: body.width,
            height: body.height,
            metaTitle: body.metaTitle,
            metaDescription: body.metaDescription,
            category: { connect: { id: categoryId } },
            brand: body.brandId ? { connect: { id: body.brandId } } : undefined,
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        apiLogger.error('Error creating product:', error);
        return NextResponse.json(
            { error: 'Failed to create product' },
            { status: 500 }
        );
    }
}
