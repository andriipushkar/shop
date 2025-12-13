/**
 * Tests for i18n (Internationalization)
 */

import {
    Locale,
    locales,
    defaultLocale,
    localeConfigs,
    createTranslator,
    getPluralForm,
    pluralize,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    detectBrowserLocale,
    getLocaleFromPath,
    addLocaleToPath,
} from '@/lib/i18n/i18n';

import { getTranslations, translations } from '@/lib/i18n/translations';

describe('i18n', () => {
    describe('Locale Configuration', () => {
        it('has all supported locales', () => {
            expect(locales).toContain('uk');
            expect(locales).toContain('en');
            expect(locales).toContain('de');
            expect(locales).toContain('pl');
            expect(locales).toHaveLength(4);
        });

        it('has uk as default locale', () => {
            expect(defaultLocale).toBe('uk');
        });

        it('has correct config for Ukrainian', () => {
            expect(localeConfigs.uk).toEqual({
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
            });
        });

        it('has correct config for English', () => {
            expect(localeConfigs.en.code).toBe('en');
            expect(localeConfigs.en.nativeName).toBe('English');
            expect(localeConfigs.en.currency.code).toBe('USD');
            expect(localeConfigs.en.currency.symbol).toBe('$');
        });

        it('has correct config for German', () => {
            expect(localeConfigs.de.code).toBe('de');
            expect(localeConfigs.de.nativeName).toBe('Deutsch');
            expect(localeConfigs.de.currency.code).toBe('EUR');
        });

        it('has correct config for Polish', () => {
            expect(localeConfigs.pl).toEqual({
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
            });
        });
    });

    describe('Translations', () => {
        it('has translations for all locales', () => {
            expect(translations.uk).toBeDefined();
            expect(translations.en).toBeDefined();
            expect(translations.de).toBeDefined();
            expect(translations.pl).toBeDefined();
        });

        it('getTranslations returns correct translations', () => {
            const ukTranslations = getTranslations('uk');
            expect(ukTranslations).toBeDefined();
            expect(ukTranslations.common).toBeDefined();
        });

        it('getTranslations falls back to uk for unknown locale', () => {
            const fallback = getTranslations('unknown' as Locale);
            expect(fallback).toEqual(translations.uk);
        });
    });

    describe('createTranslator', () => {
        it('translates simple keys', () => {
            const t = createTranslator(translations.uk as Record<string, unknown>);
            expect(t('common.loading')).toBe('Завантаження...');
        });

        it('translates nested keys', () => {
            const t = createTranslator(translations.en as Record<string, unknown>);
            expect(t('cart.empty')).toBe('Your cart is empty');
        });

        it('interpolates parameters', () => {
            const t = createTranslator(translations.uk as Record<string, unknown>);
            expect(t('cart.itemsCount', { count: 5 })).toBe('5 товарів');
        });

        it('returns key when translation not found', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const t = createTranslator(translations.uk as Record<string, unknown>);
            expect(t('nonexistent.key')).toBe('nonexistent.key');
            consoleSpy.mockRestore();
        });

        it('uses fallback translations', () => {
            const partial = { common: { test: 'Test' } };
            const fallback = translations.uk as Record<string, unknown>;
            const t = createTranslator(partial, fallback);
            expect(t('common.loading')).toBe('Завантаження...');
        });

        it('Polish translations are complete', () => {
            const t = createTranslator(translations.pl as Record<string, unknown>);
            expect(t('common.loading')).toBe('Ładowanie...');
            expect(t('cart.title')).toBe('Koszyk');
            expect(t('checkout.title')).toBe('Składanie zamówienia');
        });
    });

    describe('Pluralization', () => {
        describe('getPluralForm', () => {
            it('returns correct form for Ukrainian', () => {
                expect(getPluralForm('uk', 0)).toBe('zero');
                expect(getPluralForm('uk', 1)).toBe('one');
                expect(getPluralForm('uk', 2)).toBe('few');
                expect(getPluralForm('uk', 5)).toBe('many');
                expect(getPluralForm('uk', 11)).toBe('many');
                expect(getPluralForm('uk', 21)).toBe('one');
                expect(getPluralForm('uk', 22)).toBe('few');
            });

            it('returns correct form for English', () => {
                expect(getPluralForm('en', 0)).toBe('zero');
                expect(getPluralForm('en', 1)).toBe('one');
                expect(getPluralForm('en', 2)).toBe('other');
                expect(getPluralForm('en', 5)).toBe('other');
            });

            it('returns correct form for German', () => {
                // German uses same rules as English (simple one/other)
                expect(getPluralForm('de', 0)).toBe('zero');
                expect(getPluralForm('de', 1)).toBe('one');
                expect(getPluralForm('de', 2)).toBe('other');
                expect(getPluralForm('de', 5)).toBe('other');
            });

            it('returns correct form for Polish', () => {
                expect(getPluralForm('pl', 0)).toBe('zero');
                expect(getPluralForm('pl', 1)).toBe('one');
                expect(getPluralForm('pl', 2)).toBe('few');
                expect(getPluralForm('pl', 5)).toBe('many');
                expect(getPluralForm('pl', 22)).toBe('few');
                expect(getPluralForm('pl', 25)).toBe('many');
            });
        });

        describe('pluralize', () => {
            it('returns correct plural form', () => {
                const forms = {
                    one: 'товар',
                    few: 'товари',
                    many: 'товарів',
                };

                expect(pluralize('uk', 1, forms)).toBe('товар');
                expect(pluralize('uk', 3, forms)).toBe('товари');
                expect(pluralize('uk', 7, forms)).toBe('товарів');
            });

            it('falls back to other form', () => {
                const forms = {
                    one: 'item',
                    other: 'items',
                };

                expect(pluralize('en', 5, forms)).toBe('items');
            });

            it('returns empty string when form not found', () => {
                expect(pluralize('uk', 1, {})).toBe('');
            });
        });
    });

    describe('Number Formatting', () => {
        it('formats numbers for Ukrainian locale', () => {
            const formatted = formatNumber(1234567.89, 'uk');
            expect(formatted).toContain('1');
            expect(formatted).toContain('234');
        });

        it('formats numbers for English locale', () => {
            const formatted = formatNumber(1234567.89, 'en');
            expect(formatted).toContain('1,234,567.89');
        });

        it('formats numbers for Polish locale', () => {
            const formatted = formatNumber(1234567.89, 'pl');
            expect(formatted).toContain('1');
        });

        it('applies custom options', () => {
            const formatted = formatNumber(0.75, 'en', { style: 'percent' });
            expect(formatted).toContain('75%');
        });
    });

    describe('Currency Formatting', () => {
        it('formats currency for Ukrainian locale', () => {
            const formatted = formatCurrency(1500, 'uk');
            expect(formatted).toContain('1');
            expect(formatted).toContain('500');
            expect(formatted).toContain('₴');
        });

        it('formats currency for English locale', () => {
            const formatted = formatCurrency(1500, 'en');
            expect(formatted).toContain('$');
            expect(formatted).toContain('1,500');
        });

        it('formats currency for Polish locale', () => {
            const formatted = formatCurrency(1500, 'pl');
            expect(formatted).toContain('1');
            expect(formatted).toContain('500');
            expect(formatted).toContain('zł');
        });

        it('uses custom currency', () => {
            const formatted = formatCurrency(100, 'uk', 'EUR');
            // May contain symbol or code depending on locale/environment
            expect(formatted).toMatch(/€|EUR/);
        });
    });

    describe('Date Formatting', () => {
        const testDate = new Date('2024-06-15T12:30:00');

        it('formats date for Ukrainian locale', () => {
            const formatted = formatDate(testDate, 'uk');
            expect(formatted).toContain('2024');
            expect(formatted).toContain('15');
        });

        it('formats date for English locale', () => {
            const formatted = formatDate(testDate, 'en');
            expect(formatted).toContain('2024');
            expect(formatted).toContain('15');
        });

        it('formats date for Polish locale', () => {
            const formatted = formatDate(testDate, 'pl');
            expect(formatted).toContain('2024');
            expect(formatted).toContain('15');
        });

        it('accepts string date', () => {
            const formatted = formatDate('2024-06-15', 'uk');
            expect(formatted).toContain('2024');
        });

        it('accepts timestamp', () => {
            const formatted = formatDate(testDate.getTime(), 'uk');
            expect(formatted).toContain('2024');
        });

        it('applies custom options', () => {
            const formatted = formatDate(testDate, 'en', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            expect(formatted).toContain('Saturday');
            expect(formatted).toContain('June');
        });
    });

    describe('Relative Time Formatting', () => {
        it('formats seconds', () => {
            const now = new Date();
            const past = new Date(now.getTime() - 30000); // 30 seconds ago
            const formatted = formatRelativeTime(past, 'uk');
            expect(formatted.length).toBeGreaterThan(0);
        });

        it('formats minutes', () => {
            const now = new Date();
            const past = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
            const formatted = formatRelativeTime(past, 'uk');
            expect(formatted.length).toBeGreaterThan(0);
        });

        it('formats hours', () => {
            const now = new Date();
            const past = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
            const formatted = formatRelativeTime(past, 'uk');
            expect(formatted.length).toBeGreaterThan(0);
        });

        it('formats days', () => {
            const now = new Date();
            const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            const formatted = formatRelativeTime(past, 'uk');
            expect(formatted.length).toBeGreaterThan(0);
        });

        it('works for Polish locale', () => {
            const now = new Date();
            const past = new Date(now.getTime() - 60000);
            const formatted = formatRelativeTime(past, 'pl');
            expect(formatted.length).toBeGreaterThan(0);
        });
    });

    describe('URL Locale Handling', () => {
        describe('getLocaleFromPath', () => {
            it('extracts locale from path', () => {
                expect(getLocaleFromPath('/uk/products')).toBe('uk');
                expect(getLocaleFromPath('/en/about')).toBe('en');
                expect(getLocaleFromPath('/pl/cart')).toBe('pl');
            });

            it('returns null for paths without locale', () => {
                expect(getLocaleFromPath('/products')).toBeNull();
                expect(getLocaleFromPath('/')).toBeNull();
            });

            it('returns null for invalid locale', () => {
                // fr is not a supported locale
                expect(getLocaleFromPath('/fr/products')).toBeNull();
            });
        });

        describe('addLocaleToPath', () => {
            it('adds locale prefix to path', () => {
                expect(addLocaleToPath('/products', 'en')).toBe('/en/products');
                expect(addLocaleToPath('/cart', 'pl')).toBe('/pl/cart');
            });

            it('does not add default locale', () => {
                expect(addLocaleToPath('/products', 'uk')).toBe('/products');
            });

            it('replaces existing locale', () => {
                expect(addLocaleToPath('/en/products', 'pl')).toBe('/pl/products');
            });

            it('handles root path', () => {
                expect(addLocaleToPath('/', 'en')).toBe('/en');
                expect(addLocaleToPath('/', 'uk')).toBe('/');
            });
        });
    });

    describe('Browser Locale Detection', () => {
        const originalNavigator = global.navigator;

        beforeEach(() => {
            // Reset navigator mock
        });

        afterEach(() => {
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true,
            });
        });

        it('returns default locale when navigator is undefined', () => {
            Object.defineProperty(global, 'navigator', {
                value: undefined,
                writable: true,
            });

            expect(detectBrowserLocale()).toBe('uk');
        });

        it('detects supported locale', () => {
            Object.defineProperty(global, 'navigator', {
                value: { language: 'en-US' },
                writable: true,
            });

            expect(detectBrowserLocale()).toBe('en');
        });

        it('returns default for unsupported locale', () => {
            Object.defineProperty(global, 'navigator', {
                value: { language: 'fr-FR' },
                writable: true,
            });

            expect(detectBrowserLocale()).toBe('uk');
        });

        it('detects Polish locale', () => {
            Object.defineProperty(global, 'navigator', {
                value: { language: 'pl-PL' },
                writable: true,
            });

            expect(detectBrowserLocale()).toBe('pl');
        });
    });

    describe('Polish Translations Content', () => {
        const pl = translations.pl as Record<string, Record<string, string>>;

        it('has common translations', () => {
            expect(pl.common.loading).toBe('Ładowanie...');
            expect(pl.common.error).toBe('Błąd');
            expect(pl.common.success).toBe('Sukces');
            expect(pl.common.cancel).toBe('Anuluj');
            expect(pl.common.save).toBe('Zapisz');
        });

        it('has navigation translations', () => {
            expect(pl.navigation.home).toBe('Strona główna');
            expect(pl.navigation.cart).toBe('Koszyk');
            expect(pl.navigation.account).toBe('Konto');
        });

        it('has product translations', () => {
            expect(pl.product.addToCart).toBe('Dodaj do koszyka');
            expect(pl.product.outOfStock).toBe('Brak w magazynie');
            expect(pl.product.inStock).toBe('Dostępny');
        });

        it('has cart translations', () => {
            expect(pl.cart.title).toBe('Koszyk');
            expect(pl.cart.empty).toBe('Koszyk jest pusty');
            expect(pl.cart.checkout).toBe('Złóż zamówienie');
        });

        it('has checkout translations', () => {
            expect(pl.checkout.title).toBe('Składanie zamówienia');
            expect(pl.checkout.firstName).toBe('Imię');
            expect(pl.checkout.lastName).toBe('Nazwisko');
        });

        it('has payment translations', () => {
            expect(pl.payment.card).toBe('Karta płatnicza');
            expect(pl.payment.cash).toBe('Płatność przy odbiorze');
        });

        it('has order status translations', () => {
            const orderStatuses = pl.order as Record<string, Record<string, string>>;
            expect(orderStatuses.statuses.pending).toBe('Oczekujące');
            expect(orderStatuses.statuses.shipped).toBe('Wysłane');
            expect(orderStatuses.statuses.delivered).toBe('Dostarczone');
        });

        it('has error translations', () => {
            expect(pl.errors.general).toBe('Coś poszło nie tak');
            expect(pl.errors.notFound).toBe('Strona nie znaleziona');
            expect(pl.errors.required).toBe('Pole wymagane');
        });

        it('has meta translations', () => {
            expect(pl.meta.title).toBe('TechShop - Sklep internetowy z elektroniką');
        });
    });
});
