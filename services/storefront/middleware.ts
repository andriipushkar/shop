import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale, type Locale } from '@/lib/i18n/i18n';
import { i18nConfig, isExcludedPath, getLocaleFromPathname, removeLocaleFromPathname, addLocaleToPathname } from '@/lib/i18n/i18n-config';
import { getSecurityHeaders } from '@/lib/security/headers';
import {
  consumeRateLimit,
  RATE_LIMIT_CONFIGS,
  getRateLimitHeaders,
  type RateLimitType
} from '@/lib/security/rate-limiter';
import {
  validateCSRFToken,
  requiresCSRFProtection,
  isCSRFExempted,
  getCSRFTokenFromHeaders
} from '@/lib/security/csrf';
import {
  logAccessDenied,
  logSuspiciousActivity,
  SecurityEventType
} from '@/lib/security/audit-log';

const { auth } = NextAuth(authConfig);

/**
 * Отримання IP адреси з запиту
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

/**
 * Перевірка на підозрілу активність
 */
function detectSuspiciousActivity(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const path = request.nextUrl.pathname;

  // Підозрілі user agents
  const suspiciousUAs = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'nessus',
    'openvas',
    'metasploit',
  ];

  if (suspiciousUAs.some(ua => userAgent.toLowerCase().includes(ua))) {
    return true;
  }

  // Підозрілі шляхи
  const suspiciousPaths = [
    '/.env',
    '/.git',
    '/admin/phpMyAdmin',
    '/wp-admin',
    '/administrator',
    '/../',
    '/..%2f',
  ];

  if (suspiciousPaths.some(p => path.includes(p))) {
    return true;
  }

  return false;
}

/**
 * Визначення типу rate limit на основі шляху
 */
function getRateLimitType(pathname: string): RateLimitType {
  if (pathname.startsWith('/api/auth/signin')) return 'login';
  if (pathname.startsWith('/api/auth/signup')) return 'register';
  if (pathname.startsWith('/api/auth/reset-password')) return 'passwordReset';
  if (pathname.startsWith('/api/checkout')) return 'checkout';
  if (pathname.startsWith('/api/payment')) return 'payment';
  if (pathname.startsWith('/api/reviews')) return 'reviewCreate';
  if (pathname.startsWith('/api/search')) return 'search';
  if (pathname.startsWith('/api/admin/bulk')) return 'adminBulk';
  if (pathname.startsWith('/api/admin/export')) return 'adminExport';
  if (pathname.startsWith('/api/admin')) return 'apiStrict';

  return 'apiGeneral';
}

// Locale detection helpers
function getLocaleFromCookie(request: NextRequest): Locale | null {
    const locale = request.cookies.get(i18nConfig.localeCookieName)?.value;
    return locale && locales.includes(locale as Locale) ? (locale as Locale) : null;
}

function getLocaleFromHeader(request: NextRequest): Locale | null {
    const acceptLanguage = request.headers.get('accept-language');
    if (!acceptLanguage) return null;

    const preferredLocales = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().split('-')[0]);

    for (const lang of preferredLocales) {
        if (locales.includes(lang as Locale)) {
            return lang as Locale;
        }
    }

    return null;
}

function detectLocale(request: NextRequest, pathname: string): Locale {
    // 1. Check URL path
    const pathLocale = getLocaleFromPathname(pathname);
    if (pathLocale) return pathLocale;

    // 2. Check cookie
    const cookieLocale = getLocaleFromCookie(request);
    if (cookieLocale) return cookieLocale;

    // 3. Check Accept-Language header
    const headerLocale = getLocaleFromHeader(request);
    if (headerLocale) return headerLocale;

    // 4. Use default locale
    return defaultLocale;
}

export default auth(async (request) => {
    const { nextUrl, auth: session } = request;
    const pathname = nextUrl.pathname;
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Перевірка на підозрілу активність
    if (detectSuspiciousActivity(request)) {
        await logSuspiciousActivity(
            SecurityEventType.SUSPICIOUS_REQUEST,
            ip,
            userAgent,
            { pathname }
        );

        return new NextResponse(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Skip i18n for excluded paths
    const skipI18n = isExcludedPath(pathname);

    if (!skipI18n) {
        // Locale detection and routing
        const pathLocale = getLocaleFromPathname(pathname);
        const detectedLocale = detectLocale(request, pathname);

        // If no locale in path or different from detected locale
        if (!pathLocale) {
            // For default locale with 'as-needed' strategy, don't redirect
            if (i18nConfig.urlStrategy === 'as-needed' && detectedLocale === defaultLocale) {
                // Continue without redirect
            } else {
                // Redirect to path with locale prefix
                const cleanPath = removeLocaleFromPathname(pathname);
                const localizedPath = addLocaleToPathname(cleanPath, detectedLocale);
                const url = new URL(localizedPath, request.url);
                url.search = nextUrl.search;

                const response = NextResponse.redirect(url);
                response.cookies.set(i18nConfig.localeCookieName, detectedLocale, i18nConfig.cookieOptions);
                return response;
            }
        }
    }

    // Rate limiting для API routes
    if (pathname.startsWith('/api/')) {
        const rateLimitType = getRateLimitType(pathname);
        const userId = session?.user?.id || null;

        try {
            const rateLimitResult = await consumeRateLimit(ip, rateLimitType, { useRedis: true });

            if (!rateLimitResult.allowed) {
                await logSuspiciousActivity(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    ip,
                    userAgent,
                    { pathname, userId, retryAfter: rateLimitResult.retryAfter }
                );

                const headers = getRateLimitHeaders(rateLimitResult, rateLimitType);
                return new NextResponse(
                    JSON.stringify({
                        error: 'Забагато запитів',
                        retryAfter: rateLimitResult.retryAfter
                    }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Rate limit error:', error);
            // Продовжуємо навіть якщо rate limiting не працює
        }

        // CSRF перевірка для POST/PUT/DELETE/PATCH запитів
        if (requiresCSRFProtection(request.method) && !isCSRFExempted(pathname)) {
            const csrfToken = getCSRFTokenFromHeaders(request.headers);
            const sessionId = session?.user?.id || ip;

            const csrfResult = validateCSRFToken(csrfToken, sessionId);

            if (!csrfResult.valid) {
                await logSuspiciousActivity(
                    SecurityEventType.CSRF_VIOLATION,
                    ip,
                    userAgent,
                    { pathname, userId, error: csrfResult.error }
                );

                return new NextResponse(
                    JSON.stringify({ error: 'Невалідний CSRF токен' }),
                    {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        }
    }

    // Admin routes protection
    if (pathname.startsWith('/admin')) {
        if (!session) {
            const loginUrl = new URL('/login', nextUrl);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        const userRole = session.user?.role;
        if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
            await logAccessDenied(
                pathname,
                'access',
                session.user?.id,
                ip,
                'Insufficient permissions'
            );
            return NextResponse.redirect(new URL('/unauthorized', nextUrl));
        }
    }

    // Account routes protection
    if (pathname.startsWith('/account')) {
        if (!session) {
            const loginUrl = new URL('/login', nextUrl);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // API routes protection
    if (pathname.startsWith('/api/admin/')) {
        if (!session) {
            await logAccessDenied(pathname, 'access', undefined, ip, 'Not authenticated');

            return new NextResponse(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const userRole = session.user?.role;
        if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
            await logAccessDenied(
                pathname,
                'access',
                session.user?.id,
                ip,
                'Insufficient role'
            );

            return new NextResponse(
                JSON.stringify({ error: 'Forbidden' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    // Додавання security headers
    const response = NextResponse.next();
    const securityHeaders = getSecurityHeaders();

    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
