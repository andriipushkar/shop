import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiLogger } from '@/lib/logger';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * POST /api/auth/set-token
 * Sets authentication tokens in HTTP-only cookies (XSS protection)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, refreshToken } = body;

        if (!accessToken || !refreshToken) {
            return NextResponse.json(
                { error: 'Missing tokens' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();

        cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: REFRESH_TOKEN_MAX_AGE,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error setting tokens', error);
        return NextResponse.json(
            { error: 'Failed to set tokens' },
            { status: 500 }
        );
    }
}
