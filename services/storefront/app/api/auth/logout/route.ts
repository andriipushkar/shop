import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiLogger } from '@/lib/logger';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * POST /api/auth/logout
 * Clears authentication tokens from cookies
 */
export async function POST() {
    try {
        const cookieStore = await cookies();

        cookieStore.delete(ACCESS_TOKEN_COOKIE);
        cookieStore.delete(REFRESH_TOKEN_COOKIE);

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error clearing tokens', error);
        return NextResponse.json(
            { error: 'Failed to logout' },
            { status: 500 }
        );
    }
}
