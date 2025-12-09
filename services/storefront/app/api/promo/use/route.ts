import { NextRequest, NextResponse } from 'next/server';

const OMS_URL = process.env.OMS_SERVICE_URL || 'http://oms:8081';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const res = await fetch(`${OMS_URL}/promo/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            return NextResponse.json({ success: false }, { status: res.status });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error using promo:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
