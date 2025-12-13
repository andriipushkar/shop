// Centralized i18n configuration
import { Locale, locales, defaultLocale, localeConfigs } from './i18n';

export const i18nConfig = {
    // Supported locales
    locales,

    // Default locale
    defaultLocale,

    // Locale configurations
    localeConfigs,

    // Cookie name for storing locale preference
    localeCookieName: 'NEXT_LOCALE',

    // Cookie options
    cookieOptions: {
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: '/',
        sameSite: 'lax' as const,
    },

    // URL prefix strategy
    // 'always' - always include locale in URL (/uk/products, /en/products)
    // 'as-needed' - only for non-default locales (/products for uk, /en/products for en)
    urlStrategy: 'as-needed' as 'always' | 'as-needed',

    // Locale detection priority
    // 1. URL path
    // 2. Cookie
    // 3. Accept-Language header
    // 4. Default locale
    detectionOrder: ['url', 'cookie', 'header', 'default'] as const,

    // Prefixed paths that should not be localized
    excludePaths: [
        '/api',
        '/_next',
        '/static',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
        '/manifest.json',
    ],

    // Locale-specific metadata
    metadata: {
        uk: {
            title: 'TechShop - Інтернет-магазин електроніки',
            description: 'Найкращі товари з доставкою по всій Україні. Електроніка, смартфони, ноутбуки, аксесуари.',
            keywords: ['інтернет-магазин', 'електроніка', 'смартфони', 'ноутбуки', 'техніка', 'Україна'],
            ogLocale: 'uk_UA',
        },
        en: {
            title: 'TechShop - Electronics Online Store',
            description: 'Best products with delivery. Electronics, smartphones, laptops, accessories.',
            keywords: ['online store', 'electronics', 'smartphones', 'laptops', 'tech', 'Ukraine'],
            ogLocale: 'en_US',
        },
        pl: {
            title: 'TechShop - Sklep internetowy z elektroniką',
            description: 'Najlepsze produkty z dostawą. Elektronika, smartfony, laptopy, akcesoria.',
            keywords: ['sklep internetowy', 'elektronika', 'smartfony', 'laptopy', 'technika', 'Ukraina'],
            ogLocale: 'pl_PL',
        },
        de: {
            title: 'TechShop - Online-Shop für Elektronik',
            description: 'Beste Produkte mit Lieferung. Elektronik, Smartphones, Laptops, Zubehör.',
            keywords: ['Online-Shop', 'Elektronik', 'Smartphones', 'Laptops', 'Technik', 'Ukraine'],
            ogLocale: 'de_DE',
        },
    },
} as const;

// Type helpers
export type I18nConfig = typeof i18nConfig;
export type LocaleMetadata = typeof i18nConfig.metadata[Locale];

// Helper to check if a path should be excluded from localization
export function isExcludedPath(pathname: string): boolean {
    return i18nConfig.excludePaths.some(prefix => pathname.startsWith(prefix));
}

// Helper to get locale from pathname
export function getLocaleFromPathname(pathname: string): Locale | null {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];

    if (firstSegment && i18nConfig.locales.includes(firstSegment as Locale)) {
        return firstSegment as Locale;
    }

    return null;
}

// Helper to remove locale from pathname
export function removeLocaleFromPathname(pathname: string): string {
    const locale = getLocaleFromPathname(pathname);
    if (locale) {
        return pathname.replace(`/${locale}`, '') || '/';
    }
    return pathname;
}

// Helper to add locale to pathname
export function addLocaleToPathname(pathname: string, locale: Locale): string {
    // Remove existing locale if present
    const cleanPath = removeLocaleFromPathname(pathname);

    // For 'as-needed' strategy, don't add default locale to path
    if (i18nConfig.urlStrategy === 'as-needed' && locale === i18nConfig.defaultLocale) {
        return cleanPath;
    }

    // For 'always' strategy or non-default locales, add locale prefix
    return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}

// Helper to get metadata for locale
export function getLocaleMetadata(locale: Locale) {
    return i18nConfig.metadata[locale];
}
