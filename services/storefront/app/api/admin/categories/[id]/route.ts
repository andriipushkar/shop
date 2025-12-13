import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { categoryRepository } from '@/lib/db/repositories/category.repository';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/admin/categories/[id] - Get single category
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const category = await categoryRepository.findById(id);

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json(category);
    } catch (error) {
        apiLogger.error('Error fetching category:', error);
        return NextResponse.json(
            { error: 'Failed to fetch category' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/categories/[id] - Update category
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await categoryRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Check slug uniqueness if changing
        if (body.slug && body.slug !== existing.slug) {
            const slugExists = await categoryRepository.findBySlug(body.slug);
            if (slugExists) {
                return NextResponse.json(
                    { error: 'Category with this slug already exists' },
                    { status: 409 }
                );
            }
        }

        const updateData: Record<string, unknown> = {};
        const allowedFields = ['name', 'nameUa', 'slug', 'description', 'image', 'order', 'isActive'];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        // Handle parentId separately for Prisma relations
        if (body.parentId !== undefined) {
            if (body.parentId === null) {
                updateData.parent = { disconnect: true };
            } else {
                updateData.parent = { connect: { id: body.parentId } };
            }
        }

        const category = await categoryRepository.update(id, updateData);

        return NextResponse.json(category);
    } catch (error) {
        apiLogger.error('Error updating category:', error);
        return NextResponse.json(
            { error: 'Failed to update category' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/categories/[id] - Delete category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const existing = await categoryRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        await categoryRepository.delete(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error deleting category:', error);
        return NextResponse.json(
            { error: 'Failed to delete category' },
            { status: 500 }
        );
    }
}
