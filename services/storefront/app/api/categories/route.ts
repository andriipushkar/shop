import { NextRequest, NextResponse } from 'next/server';
import { categoryRepository } from '@/lib/db/repositories/category.repository';
import { cache } from '@/lib/cache';
import { apiLogger } from '@/lib/logger';

// GET /api/categories - Get category tree or flat list
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tree = searchParams.get('tree') !== 'false';

        // Try cache first
        const cacheKey = `categories:${tree ? 'tree' : 'flat'}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'X-Cache': 'HIT' },
            });
        }

        let categories;

        if (tree) {
            categories = await categoryRepository.getTree();
        } else {
            categories = await categoryRepository.findAll(false);
        }

        // Cache for 1 hour
        await cache.set(cacheKey, categories, 3600);

        return NextResponse.json(categories, {
            headers: { 'X-Cache': 'MISS' },
        });
    } catch (error) {
        apiLogger.error('Error fetching categories', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}
