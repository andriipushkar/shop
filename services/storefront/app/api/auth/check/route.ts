import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiLogger } from '@/lib/logger';

const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * GET /api/auth/check
 * Checks if user has a valid access token (without exposing the token)
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

        if (!accessToken) {
            return NextResponse.json(
                { authenticated: false },
                { status: 401 }
            );
        }

        // Token exists - return authenticated
        // For full validation, you would decode and verify the JWT here
        return NextResponse.json({ authenticated: true });
    } catch (error) {
        apiLogger.error('Error checking auth', error);
        return NextResponse.json(
            { authenticated: false, error: 'Check failed' },
            { status: 500 }
        );
    }
}
