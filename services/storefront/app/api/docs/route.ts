import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/api-docs/openapi';

/**
 * GET /api/docs
 * Повертає OpenAPI специфікацію у форматі JSON
 */
export async function GET() {
    return NextResponse.json(openApiSpec);
}
