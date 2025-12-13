import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';

const OMS_URL = process.env.OMS_SERVICE_URL || 'http://oms:8081';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const res = await fetch(`${OMS_URL}/promo/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            let reason = 'invalid';
            if (res.status === 404) {
                reason = 'not_found';
            } else if (errorText.includes('inactive')) {
                reason = 'inactive';
            } else if (errorText.includes('limit')) {
                reason = 'limit_reached';
            }
            return NextResponse.json({ valid: false, discount: 0, reason }, { status: 400 });
        }

        const data = await res.json();
        return NextResponse.json({ valid: true, discount: data.discount, code: data.code });
    } catch (error) {
        apiLogger.error('Error validating promo:', error);
        return NextResponse.json({ valid: false, discount: 0, reason: 'server_error' }, { status: 500 });
    }
}
