import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { productRepository } from '@/lib/db/repositories/product.repository';
import type { ProductStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/admin/products/[id] - Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const product = await productRepository.findById(id);

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        apiLogger.error('Error fetching product:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/products/[id] - Update product
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Check if product exists
        const existing = await productRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        const allowedFields = [
            'name', 'nameUa', 'slug', 'description', 'descriptionUa',
            'price', 'compareAtPrice', 'costPrice', 'status',
            'isNew', 'isBestseller', 'isFeatured',
            'weight', 'length', 'width', 'height',
            'metaTitle', 'metaDescription'
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (body.categoryId) {
            updateData.category = { connect: { id: body.categoryId } };
        }

        if (body.brandId !== undefined) {
            updateData.brand = body.brandId
                ? { connect: { id: body.brandId } }
                : { disconnect: true };
        }

        const product = await productRepository.update(id, updateData);

        return NextResponse.json(product);
    } catch (error) {
        apiLogger.error('Error updating product:', error);
        return NextResponse.json(
            { error: 'Failed to update product' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/products/[id] - Delete product
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Check if product exists
        const existing = await productRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        await productRepository.delete(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error deleting product:', error);
        return NextResponse.json(
            { error: 'Failed to delete product' },
            { status: 500 }
        );
    }
}

// POST /api/admin/products/[id]/status - Update product status
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { status } = await request.json();

        if (!['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status' },
                { status: 400 }
            );
        }

        const product = await productRepository.updateStatus(id, status as ProductStatus);

        return NextResponse.json(product);
    } catch (error) {
        apiLogger.error('Error updating product status:', error);
        return NextResponse.json(
            { error: 'Failed to update product status' },
            { status: 500 }
        );
    }
}
