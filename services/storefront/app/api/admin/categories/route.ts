import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { categoryRepository } from '@/lib/db/repositories/category.repository';
import { apiLogger } from '@/lib/logger';

// GET /api/admin/categories - List all categories
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const tree = searchParams.get('tree') === 'true';
        const includeInactive = searchParams.get('includeInactive') === 'true';

        if (tree) {
            const categories = await categoryRepository.getTree();
            return NextResponse.json(categories);
        }

        const categories = await categoryRepository.findAll(includeInactive);
        return NextResponse.json(categories);
    } catch (error) {
        apiLogger.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}

// POST /api/admin/categories - Create category
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const { name, nameUa, slug } = body;
        if (!name || !nameUa || !slug) {
            return NextResponse.json(
                { error: 'Missing required fields: name, nameUa, slug' },
                { status: 400 }
            );
        }

        // Check if slug already exists
        const existing = await categoryRepository.findBySlug(slug);
        if (existing) {
            return NextResponse.json(
                { error: 'Category with this slug already exists' },
                { status: 409 }
            );
        }

        const category = await categoryRepository.create({
            name,
            nameUa,
            slug,
            description: body.description,
            image: body.image,
            order: body.order || 0,
            isActive: body.isActive ?? true,
            ...(body.parentId ? { parent: { connect: { id: body.parentId } } } : {}),
        });

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        apiLogger.error('Error creating category:', error);
        return NextResponse.json(
            { error: 'Failed to create category' },
            { status: 500 }
        );
    }
}
