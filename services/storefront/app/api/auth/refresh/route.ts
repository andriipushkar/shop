import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiLogger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
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
 * POST /api/auth/refresh
 * Refreshes authentication tokens using the refresh token from cookies
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { error: 'No refresh token' },
                { status: 401 }
            );
        }

        // Call backend to refresh tokens
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            // Clear invalid tokens
            cookieStore.delete(ACCESS_TOKEN_COOKIE);
            cookieStore.delete(REFRESH_TOKEN_COOKIE);

            return NextResponse.json(
                { error: 'Token refresh failed' },
                { status: 401 }
            );
        }

        const data = await response.json();

        // Set new tokens in cookies
        cookieStore.set(ACCESS_TOKEN_COOKIE, data.accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        cookieStore.set(REFRESH_TOKEN_COOKIE, data.refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: REFRESH_TOKEN_MAX_AGE,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error refreshing tokens', error);
        return NextResponse.json(
            { error: 'Failed to refresh tokens' },
            { status: 500 }
        );
    }
}
