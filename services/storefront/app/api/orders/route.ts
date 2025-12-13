import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';

const OMS_URL = process.env.OMS_SERVICE_URL || 'http://oms:8081';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const res = await fetch(`${OMS_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            return NextResponse.json(
                { error: errorText },
                { status: res.status }
            );
        }

        const order = await res.json();
        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        apiLogger.error('Error creating order', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
