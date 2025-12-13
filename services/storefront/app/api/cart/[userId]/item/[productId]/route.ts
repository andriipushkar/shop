import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';

const CORE_URL = process.env.CORE_SERVICE_URL || 'http://core:8080';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; productId: string }> }
) {
    const { userId, productId } = await params;

    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}/item/${productId}`, {
            method: 'DELETE',
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to remove item' }, { status: res.status });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        apiLogger.error('Error removing from cart:', error);
        return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; productId: string }> }
) {
    const { userId, productId } = await params;

    try {
        const body = await request.json();

        const res = await fetch(`${CORE_URL}/cart/${userId}/item/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const error = await res.text();
            return NextResponse.json({ error }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        apiLogger.error('Error updating cart item:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}
