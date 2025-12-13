/**
 * Server-side i18n utilities
 * For use in Server Components, Server Actions, and API routes
 */

import { cookies, headers } from 'next/headers';
import {
    Locale,
    defaultLocale,
    locales,
    createTranslator,
    TranslateFunction,
    formatNumber as _formatNumber,
    formatCurrency as _formatCurrency,
    formatDate as _formatDate,
    formatRelativeTime as _formatRelativeTime,
    pluralize as _pluralize,
    PluralForm,
    localeConfigs,
    LocaleConfig,
} from './i18n';
import { getTranslations as _getTranslations } from './translations';
import { i18nConfig } from './i18n-config';

/**
 * Get locale from server request
 * Checks in order: URL, cookie, Accept-Language header
 */
export async function getServerLocale(): Promise<Locale> {
    // Try to get locale from cookie
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get(i18nConfig.localeCookieName);

    if (localeCookie?.value && locales.includes(localeCookie.value as Locale)) {
        return localeCookie.value as Locale;
    }

    // Try to get from Accept-Language header
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');

    if (acceptLanguage) {
        const preferredLocales = acceptLanguage
            .split(',')
            .map(lang => lang.split(';')[0].trim().split('-')[0]);

        for (const lang of preferredLocales) {
            if (locales.includes(lang as Locale)) {
                return lang as Locale;
            }
        }
    }

    // Fallback to default locale
    return defaultLocale;
}

/**
 * Get translations for a specific locale (server-side)
 */
export function getTranslations(locale: Locale): TranslateFunction {
    const translations = _getTranslations(locale);
    const fallbackTranslations = locale !== defaultLocale ? _getTranslations(defaultLocale) : undefined;
    return createTranslator(translations, fallbackTranslations);
}

/**
 * Get locale configuration
 */
export function getLocaleConfig(locale: Locale): LocaleConfig {
    return localeConfigs[locale];
}

/**
 * Server-side translation helper
 * Creates a translation function for the given locale
 */
export function createServerTranslator(locale: Locale) {
    const t = getTranslations(locale);
    const config = getLocaleConfig(locale);

    return {
        t,
        locale,
        config,
        formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
            _formatNumber(value, locale, options),
        formatCurrency: (value: number, currency?: string) =>
            _formatCurrency(value, locale, currency),
        formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
            _formatDate(date, locale, options),
        formatRelativeTime: (date: Date | string | number) =>
            _formatRelativeTime(date, locale),
        pluralize: (count: number, forms: Partial<Record<PluralForm, string>>) =>
            _pluralize(locale, count, forms),
    };
}

/**
 * Get server-side translator using detected locale
 */
export async function getServerTranslator() {
    const locale = await getServerLocale();
    return createServerTranslator(locale);
}

/**
 * Set locale cookie (for use in Server Actions)
 */
export async function setLocaleCookie(locale: Locale): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(i18nConfig.localeCookieName, locale, i18nConfig.cookieOptions);
}

/**
 * Delete locale cookie
 */
export async function deleteLocaleCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(i18nConfig.localeCookieName);
}

/**
 * Get locale metadata for server components
 */
export function getLocaleMetadata(locale: Locale) {
    return i18nConfig.metadata[locale];
}

/**
 * Helper to generate alternate language links for SEO
 */
export function getAlternateLanguageLinks(pathname: string, baseUrl: string) {
    return locales.map(locale => ({
        locale,
        url: `${baseUrl}/${locale}${pathname}`,
        hreflang: locale === 'en' ? 'en' : locale,
    }));
}
