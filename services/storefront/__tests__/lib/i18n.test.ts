/**
 * Unit tests for i18n functionality
 */

import {
    createTranslator,
    formatNumber,
    formatCurrency,
    formatDate,
    getPluralForm,
    pluralize,
    detectBrowserLocale,
    getLocaleFromPath,
    addLocaleToPath,
    type Locale,
} from '@/lib/i18n/i18n';
import { getTranslations } from '@/lib/i18n/translations';
import {
    getLocaleFromPathname,
    removeLocaleFromPathname,
    addLocaleToPathname,
    isExcludedPath,
} from '@/lib/i18n/i18n-config';

describe('i18n Core Functionality', () => {
    describe('createTranslator', () => {
        it('should translate simple keys', () => {
            const translations = { hello: 'Hello', world: 'World' };
            const t = createTranslator(translations);

            expect(t('hello')).toBe('Hello');
            expect(t('world')).toBe('World');
        });

        it('should translate nested keys', () => {
            const translations = {
                common: {
                    loading: 'Loading...',
                    error: 'Error',
                },
            };
            const t = createTranslator(translations);

            expect(t('common.loading')).toBe('Loading...');
            expect(t('common.error')).toBe('Error');
        });

        it('should interpolate parameters', () => {
            const translations = {
                greeting: 'Hello, {{name}}!',
                items: 'You have {{count}} items',
            };
            const t = createTranslator(translations);

            expect(t('greeting', { name: 'John' })).toBe('Hello, John!');
            expect(t('items', { count: 5 })).toBe('You have 5 items');
        });

        it('should return key if translation not found', () => {
            const translations = { hello: 'Hello' };
            const t = createTranslator(translations);

            expect(t('missing.key')).toBe('missing.key');
        });

        it('should fallback to default locale', () => {
            const translations = { hello: 'Привіт' };
            const fallback = { hello: 'Hello', world: 'World' };
            const t = createTranslator(translations, fallback);

            expect(t('hello')).toBe('Привіт');
            expect(t('world')).toBe('World'); // Falls back
        });
    });

    describe('Number Formatting', () => {
        it('should format numbers for different locales', () => {
            expect(formatNumber(1234.56, 'en')).toBe('1,234.56');
            // Ukrainian uses non-breaking space (U+00A0) as thousands separator
            expect(formatNumber(1234.56, 'uk').replace(/\s/g, ' ')).toBe('1 234,56');
            expect(formatNumber(1234.56, 'de')).toBe('1.234,56');
        });

        it('should format with custom options', () => {
            const result = formatNumber(0.123, 'en', {
                style: 'percent',
                minimumFractionDigits: 1,
            });
            expect(result).toBe('12.3%');
        });
    });

    describe('Currency Formatting', () => {
        it('should format currency for Ukrainian locale', () => {
            const result = formatCurrency(1234.56, 'uk');
            expect(result).toContain('1');
            expect(result).toContain('234');
            expect(result).toContain('56');
        });

        it('should format currency for English locale', () => {
            const result = formatCurrency(1234.56, 'en');
            expect(result).toContain('$');
            expect(result).toContain('1,234.56');
        });

        it('should format currency for German locale', () => {
            const result = formatCurrency(1234.56, 'de');
            expect(result).toContain('€');
        });

        it('should use custom currency', () => {
            const result = formatCurrency(1234.56, 'en', 'EUR');
            expect(result).toContain('€');
        });
    });

    describe('Date Formatting', () => {
        it('should format dates for different locales', () => {
            const date = new Date('2025-01-15T12:00:00Z');

            const ukDate = formatDate(date, 'uk');
            expect(ukDate).toContain('2025');

            const enDate = formatDate(date, 'en');
            expect(enDate).toContain('2025');
        });

        it('should format with custom options', () => {
            const date = new Date('2025-01-15T12:00:00Z');
            const result = formatDate(date, 'en', {
                month: 'short',
                day: 'numeric',
            });
            expect(result).toContain('Jan');
        });
    });

    describe('Pluralization', () => {
        it('should return correct plural form for Ukrainian', () => {
            expect(getPluralForm('uk', 0)).toBe('zero');
            expect(getPluralForm('uk', 1)).toBe('one');
            expect(getPluralForm('uk', 2)).toBe('few');
            expect(getPluralForm('uk', 5)).toBe('many');
            expect(getPluralForm('uk', 21)).toBe('one');
            expect(getPluralForm('uk', 22)).toBe('few');
        });

        it('should return correct plural form for English', () => {
            expect(getPluralForm('en', 0)).toBe('zero');
            expect(getPluralForm('en', 1)).toBe('one');
            expect(getPluralForm('en', 2)).toBe('other');
            expect(getPluralForm('en', 5)).toBe('other');
        });

        it('should return correct plural form for German', () => {
            expect(getPluralForm('de', 0)).toBe('zero');
            expect(getPluralForm('de', 1)).toBe('one');
            expect(getPluralForm('de', 2)).toBe('other');
        });

        it('should pluralize correctly', () => {
            const forms = {
                zero: 'немає товарів',
                one: '{{count}} товар',
                few: '{{count}} товари',
                many: '{{count}} товарів',
            };

            expect(pluralize('uk', 0, forms)).toBe('немає товарів');
            expect(pluralize('uk', 1, forms)).toContain('товар');
            expect(pluralize('uk', 2, forms)).toContain('товари');
            expect(pluralize('uk', 5, forms)).toContain('товарів');
        });
    });

    describe('Locale Detection', () => {
        it('should detect locale from path', () => {
            expect(getLocaleFromPath('/uk/products')).toBe('uk');
            expect(getLocaleFromPath('/en/about')).toBe('en');
            expect(getLocaleFromPath('/de/cart')).toBe('de');
            expect(getLocaleFromPath('/products')).toBeNull();
        });

        it('should add locale to path', () => {
            expect(addLocaleToPath('/products', 'en')).toBe('/en/products');
            expect(addLocaleToPath('/products', 'uk')).toBe('/products'); // Default locale
            expect(addLocaleToPath('/', 'de')).toBe('/de');
        });

        it('should remove existing locale when adding new one', () => {
            const result = addLocaleToPath('/uk/products', 'en');
            expect(result).toBe('/en/products');
        });
    });

    describe('Translation Files', () => {
        it('should load Ukrainian translations', () => {
            const translations = getTranslations('uk');
            expect(translations).toBeDefined();
            expect(translations.common).toBeDefined();
        });

        it('should load English translations', () => {
            const translations = getTranslations('en');
            expect(translations).toBeDefined();
            expect(translations.common).toBeDefined();
        });

        it('should load Polish translations', () => {
            const translations = getTranslations('pl');
            expect(translations).toBeDefined();
            expect(translations.common).toBeDefined();
        });

        it('should load German translations', () => {
            const translations = getTranslations('de');
            expect(translations).toBeDefined();
            expect(translations.common).toBeDefined();
        });
    });
});

describe('i18n Config', () => {
    describe('Pathname Utilities', () => {
        it('should detect locale from pathname', () => {
            expect(getLocaleFromPathname('/uk/products')).toBe('uk');
            expect(getLocaleFromPathname('/en/about')).toBe('en');
            expect(getLocaleFromPathname('/de/cart')).toBe('de');
            expect(getLocaleFromPathname('/products')).toBeNull();
        });

        it('should remove locale from pathname', () => {
            expect(removeLocaleFromPathname('/uk/products')).toBe('/products');
            expect(removeLocaleFromPathname('/en/about/us')).toBe('/about/us');
            expect(removeLocaleFromPathname('/products')).toBe('/products');
        });

        it('should add locale to pathname', () => {
            expect(addLocaleToPathname('/products', 'en')).toBe('/en/products');
            expect(addLocaleToPathname('/products', 'de')).toBe('/de/products');
        });

        it('should handle root path', () => {
            expect(removeLocaleFromPathname('/uk')).toBe('/');
            expect(addLocaleToPathname('/', 'en')).toBe('/en');
        });
    });

    describe('Path Exclusion', () => {
        it('should exclude API paths', () => {
            expect(isExcludedPath('/api/products')).toBe(true);
            expect(isExcludedPath('/api/admin/users')).toBe(true);
        });

        it('should exclude Next.js paths', () => {
            expect(isExcludedPath('/_next/static/css/main.css')).toBe(true);
            expect(isExcludedPath('/_next/image')).toBe(true);
        });

        it('should exclude static assets', () => {
            expect(isExcludedPath('/favicon.ico')).toBe(true);
            expect(isExcludedPath('/robots.txt')).toBe(true);
            expect(isExcludedPath('/sitemap.xml')).toBe(true);
        });

        it('should not exclude regular pages', () => {
            expect(isExcludedPath('/products')).toBe(false);
            expect(isExcludedPath('/uk/about')).toBe(false);
            expect(isExcludedPath('/en/cart')).toBe(false);
        });
    });
});

describe('Translation Completeness', () => {
    const locales: Locale[] = ['uk', 'en', 'pl', 'de'];

    it('should have all required keys in all locales', () => {
        const ukTranslations = getTranslations('uk');
        const requiredSections = [
            'common',
            'navigation',
            'product',
            'cart',
            'checkout',
            'payment',
            'delivery',
            'order',
            'auth',
            'account',
            'errors',
        ];

        locales.forEach(locale => {
            const translations = getTranslations(locale);
            requiredSections.forEach(section => {
                expect(translations[section]).toBeDefined();
            });
        });
    });

    it('should have consistent structure across locales', () => {
        const ukKeys = Object.keys(getTranslations('uk'));

        locales.forEach(locale => {
            const translations = getTranslations(locale);
            const localeKeys = Object.keys(translations);

            expect(localeKeys.sort()).toEqual(ukKeys.sort());
        });
    });
});
