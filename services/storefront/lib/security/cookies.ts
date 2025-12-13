/**
 * Secure cookie-based token management
 * Replaces localStorage to prevent XSS attacks
 */

import { cookies } from 'next/headers';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Cookie options for security
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Set authentication tokens in HTTP-only cookies (Server-side)
 */
export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
    });
}

/**
 * Get authentication tokens from cookies (Server-side)
 */
export async function getAuthCookies(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const cookieStore = await cookies();

    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || null;
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value || null;

    return { accessToken, refreshToken };
}

/**
 * Clear authentication cookies (Server-side)
 */
export async function clearAuthCookies(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Client-side token management via API routes
 * These functions call API routes that handle cookies server-side
 */
export const clientAuth = {
    /**
     * Login and set tokens
     */
    async login(accessToken: string, refreshToken: string): Promise<void> {
        await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken, refreshToken }),
            credentials: 'include',
        });
    },

    /**
     * Logout and clear tokens
     */
    async logout(): Promise<void> {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
    },

    /**
     * Check if user has valid token
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include',
            });
            return response.ok;
        } catch {
            return false;
        }
    },
};
