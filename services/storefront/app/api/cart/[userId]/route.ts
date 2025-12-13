import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';

const CORE_URL = process.env.CORE_SERVICE_URL || 'http://core:8080';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            return NextResponse.json([], { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        apiLogger.error('Error fetching cart:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    try {
        const body = await request.json();

        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const error = await res.text();
            return NextResponse.json({ error }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        apiLogger.error('Error adding to cart:', error);
        return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            method: 'DELETE',
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to clear cart' }, { status: res.status });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        apiLogger.error('Error clearing cart:', error);
        return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
    }
}
