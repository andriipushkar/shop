// Internationalization (i18n) core functionality

export type Locale = 'uk' | 'en' | 'pl' | 'de';

export const locales: Locale[] = ['uk', 'en', 'pl', 'de'];
export const defaultLocale: Locale = 'uk';

export interface LocaleConfig {
    code: Locale;
    name: string;
    nativeName: string;
    flag: string;
    dir: 'ltr' | 'rtl';
    dateFormat: string;
    currency: {
        code: string;
        symbol: string;
        position: 'before' | 'after';
    };
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
    uk: {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська',
        flag: '🇺🇦',
        dir: 'ltr',
        dateFormat: 'DD.MM.YYYY',
        currency: {
            code: 'UAH',
            symbol: '₴',
            position: 'after',
        },
    },
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        dir: 'ltr',
        dateFormat: 'MM/DD/YYYY',
        currency: {
            code: 'USD',
            symbol: '$',
            position: 'before',
        },
    },
    pl: {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski',
        flag: '🇵🇱',
        dir: 'ltr',
        dateFormat: 'DD.MM.YYYY',
        currency: {
            code: 'PLN',
            symbol: 'zł',
            position: 'after',
        },
    },
    de: {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        dir: 'ltr',
        dateFormat: 'DD.MM.YYYY',
        currency: {
            code: 'EUR',
            symbol: '€',
            position: 'after',
        },
    },
};

// Translation dictionary type
export type TranslationDict = {
    [key: string]: string | TranslationDict;
};

// Nested key type
type NestedKeyOf<T> = T extends object
    ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` | K : K) : never }[keyof T]
    : never;

// Translation function
export type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

// Get nested value from object
function getNestedValue(obj: TranslationDict, path: string): string | undefined {
    const keys = path.split('.');
    let current: TranslationDict | string = obj;

    for (const key of keys) {
        if (typeof current !== 'object' || current === null) {
            return undefined;
        }
        current = current[key];
    }

    return typeof current === 'string' ? current : undefined;
}

// Interpolate parameters into string
function interpolate(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return params[key]?.toString() ?? `{{${key}}}`;
    });
}

// Create translation function
export function createTranslator(
    translations: TranslationDict,
    fallbackTranslations?: TranslationDict
): TranslateFunction {
    return (key: string, params?: Record<string, string | number>): string => {
        let value = getNestedValue(translations, key);

        // Fallback to default locale
        if (value === undefined && fallbackTranslations) {
            value = getNestedValue(fallbackTranslations, key);
        }

        // Return key if not found
        if (value === undefined) {
            console.warn(`Translation missing: ${key}`);
            return key;
        }

        // Interpolate params
        if (params) {
            return interpolate(value, params);
        }

        return value;
    };
}

// Pluralization
export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const pluralRules: Record<Locale, (n: number) => PluralForm> = {
    uk: (n: number): PluralForm => {
        const mod10 = n % 10;
        const mod100 = n % 100;

        if (n === 0) return 'zero';
        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
        return 'many';
    },
    en: (n: number): PluralForm => {
        if (n === 0) return 'zero';
        if (n === 1) return 'one';
        return 'other';
    },
    pl: (n: number): PluralForm => {
        const mod10 = n % 10;
        const mod100 = n % 100;

        if (n === 0) return 'zero';
        if (n === 1) return 'one';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
        return 'many';
    },
    de: (n: number): PluralForm => {
        if (n === 0) return 'zero';
        if (n === 1) return 'one';
        return 'other';
    },
};

export function getPluralForm(locale: Locale, count: number): PluralForm {
    return pluralRules[locale](count);
}

export function pluralize(
    locale: Locale,
    count: number,
    forms: Partial<Record<PluralForm, string>>
): string {
    const form = getPluralForm(locale, count);
    return forms[form] ?? forms.other ?? '';
}

// Number formatting
export function formatNumber(
    value: number,
    locale: Locale,
    options?: Intl.NumberFormatOptions
): string {
    const localeMap: Record<Locale, string> = {
        uk: 'uk-UA',
        en: 'en-US',
        pl: 'pl-PL',
        de: 'de-DE',
    };

    return new Intl.NumberFormat(localeMap[locale], options).format(value);
}

// Currency formatting
export function formatCurrency(
    value: number,
    locale: Locale,
    currency?: string
): string {
    const config = localeConfigs[locale];
    const currencyCode = currency || config.currency.code;

    const localeMap: Record<Locale, string> = {
        uk: 'uk-UA',
        en: 'en-US',
        pl: 'pl-PL',
        de: 'de-DE',
    };

    return new Intl.NumberFormat(localeMap[locale], {
        style: 'currency',
        currency: currencyCode,
    }).format(value);
}

// Date formatting
export function formatDate(
    date: Date | string | number,
    locale: Locale,
    options?: Intl.DateTimeFormatOptions
): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    const localeMap: Record<Locale, string> = {
        uk: 'uk-UA',
        en: 'en-US',
        pl: 'pl-PL',
        de: 'de-DE',
    };

    return new Intl.DateTimeFormat(localeMap[locale], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    }).format(dateObj);
}

// Relative time formatting
export function formatRelativeTime(
    date: Date | string | number,
    locale: Locale
): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const now = new Date();
    const diffMs = dateObj.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    const localeMap: Record<Locale, string> = {
        uk: 'uk-UA',
        en: 'en-US',
        pl: 'pl-PL',
        de: 'de-DE',
    };

    const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' });

    if (Math.abs(diffSec) < 60) {
        return rtf.format(diffSec, 'second');
    }
    if (Math.abs(diffMin) < 60) {
        return rtf.format(diffMin, 'minute');
    }
    if (Math.abs(diffHour) < 24) {
        return rtf.format(diffHour, 'hour');
    }
    if (Math.abs(diffDay) < 30) {
        return rtf.format(diffDay, 'day');
    }

    return formatDate(dateObj, locale);
}

// Detect browser locale
export function detectBrowserLocale(): Locale {
    if (typeof navigator === 'undefined') return defaultLocale;

    const browserLocale = navigator.language.split('-')[0];
    return locales.includes(browserLocale as Locale) ? (browserLocale as Locale) : defaultLocale;
}

// Get locale from URL path
export function getLocaleFromPath(path: string): Locale | null {
    const segment = path.split('/')[1];
    return locales.includes(segment as Locale) ? (segment as Locale) : null;
}

// Add locale to URL path
export function addLocaleToPath(path: string, locale: Locale): string {
    // Remove existing locale if present
    const currentLocale = getLocaleFromPath(path);
    let cleanPath = path;
    if (currentLocale) {
        cleanPath = path.replace(`/${currentLocale}`, '') || '/';
    }

    // Don't add default locale to path
    if (locale === defaultLocale) {
        return cleanPath;
    }

    return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}
