'use client';

/**
 * Client-side i18n context and hooks
 * Provides translation functions and locale management for client components
 */

import { createContext, useContext } from 'react';
import { Locale, TranslateFunction, LocaleConfig, PluralForm } from './i18n';

// Context interface
export interface I18nContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: TranslateFunction;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (value: number, currency?: string) => string;
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatRelativeTime: (date: Date | string | number) => string;
    pluralize: (count: number, forms: Partial<Record<PluralForm, string>>) => string;
    config: LocaleConfig;
    changeLanguageUrl: (locale: Locale) => string;
}

// Create context (actual provider is in I18nProvider.tsx)
export const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Hook to access the full i18n context
 * @returns I18nContextValue with all i18n utilities
 * @throws Error if used outside I18nProvider
 */
export function useI18n(): I18nContextValue {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
}

/**
 * Hook to access translation function
 * Most commonly used hook for simple translations
 * @returns Object with t function and current locale
 */
export function useTranslation(): { t: TranslateFunction; locale: Locale } {
    const { t, locale } = useI18n();
    return { t, locale };
}

/**
 * Hook to access and change current locale
 * @returns Object with locale and setLocale function
 */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void; config: LocaleConfig } {
    const { locale, setLocale, config } = useI18n();
    return { locale, setLocale, config };
}

/**
 * Hook for number formatting
 * @returns formatNumber function bound to current locale
 */
export function useNumberFormat() {
    const { formatNumber, locale } = useI18n();
    return { formatNumber, locale };
}

/**
 * Hook for currency formatting
 * @returns formatCurrency function bound to current locale
 */
export function useCurrencyFormat() {
    const { formatCurrency, locale, config } = useI18n();
    return { formatCurrency, locale, currency: config.currency };
}

/**
 * Hook for date formatting
 * @returns formatDate and formatRelativeTime functions bound to current locale
 */
export function useDateFormat() {
    const { formatDate, formatRelativeTime, locale } = useI18n();
    return { formatDate, formatRelativeTime, locale };
}

/**
 * Hook for pluralization
 * @returns pluralize function bound to current locale
 */
export function usePluralization() {
    const { pluralize, locale } = useI18n();
    return { pluralize, locale };
}
