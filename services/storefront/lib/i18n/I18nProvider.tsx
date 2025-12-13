'use client';

import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import {
    Locale,
    defaultLocale,
    localeConfigs,
    createTranslator,
    TranslateFunction,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    pluralize,
    PluralForm,
    detectBrowserLocale,
    addLocaleToPath,
} from './i18n';
import { getTranslations } from './translations';
import { I18nContext, type I18nContextValue } from './i18n-context';
import { i18nConfig } from './i18n-config';

const LOCALE_STORAGE_KEY = i18nConfig.localeCookieName;

interface I18nProviderProps {
    children: ReactNode;
    initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
    const [t, setT] = useState<TranslateFunction>(() => createTranslator(getTranslations(locale), getTranslations(defaultLocale)));

    // Initialize locale from storage or browser
    useEffect(() => {
        if (initialLocale) return;

        const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
        if (storedLocale && localeConfigs[storedLocale]) {
            setLocaleState(storedLocale);
        } else {
            const browserLocale = detectBrowserLocale();
            setLocaleState(browserLocale);
        }
    }, [initialLocale]);

    // Update translator when locale changes
    useEffect(() => {
        const translations = getTranslations(locale);
        const fallbackTranslations = locale !== defaultLocale ? getTranslations(defaultLocale) : undefined;
        setT(() => createTranslator(translations, fallbackTranslations));
    }, [locale]);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

        // Update document lang attribute
        document.documentElement.lang = newLocale;
        document.documentElement.dir = localeConfigs[newLocale].dir;

        // Track language change
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'language_change', {
                from_language: locale,
                to_language: newLocale,
            });
        }
    }, [locale]);

    const changeLanguageUrl = useCallback((newLocale: Locale): string => {
        if (typeof window === 'undefined') return '/';
        return addLocaleToPath(window.location.pathname, newLocale);
    }, []);

    const value: I18nContextValue = {
        locale,
        setLocale,
        t,
        formatNumber: (value, options) => formatNumber(value, locale, options),
        formatCurrency: (value, currency) => formatCurrency(value, locale, currency),
        formatDate: (date, options) => formatDate(date, locale, options),
        formatRelativeTime: (date) => formatRelativeTime(date, locale),
        pluralize: (count, forms) => pluralize(locale, count, forms),
        config: localeConfigs[locale],
        changeLanguageUrl,
    };

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Language selector component
interface LanguageSelectorProps {
    className?: string;
    showFlag?: boolean;
    showName?: boolean;
    variant?: 'dropdown' | 'buttons';
}

export function LanguageSelector({
    className = '',
    showFlag = true,
    showName = true,
    variant = 'dropdown',
}: LanguageSelectorProps) {
    const { locale, setLocale, config } = useI18n();
    const [isOpen, setIsOpen] = useState(false);

    const locales: Locale[] = ['uk', 'en', 'pl', 'de'];

    if (variant === 'buttons') {
        return (
            <div className={`flex gap-2 ${className}`}>
                {locales.map((loc) => {
                    const locConfig = localeConfigs[loc];
                    return (
                        <button
                            key={loc}
                            onClick={() => setLocale(loc)}
                            className={`px-3 py-1 rounded ${
                                locale === loc
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                        >
                            {showFlag && <span className="mr-1">{locConfig.flag}</span>}
                            {showName && <span>{locConfig.code.toUpperCase()}</span>}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded border hover:bg-gray-50"
            >
                {showFlag && <span>{config.flag}</span>}
                {showName && <span>{config.nativeName}</span>}
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50">
                    {locales.map((loc) => {
                        const locConfig = localeConfigs[loc];
                        return (
                            <button
                                key={loc}
                                onClick={() => {
                                    setLocale(loc);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100 ${
                                    locale === loc ? 'bg-gray-50' : ''
                                }`}
                            >
                                {showFlag && <span>{locConfig.flag}</span>}
                                {showName && <span>{locConfig.nativeName}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Trans component for JSX in translations
interface TransProps {
    i18nKey: string;
    components?: Record<string, React.ComponentType<{ children?: ReactNode }>>;
    values?: Record<string, string | number>;
}

export function Trans({ i18nKey, components = {}, values = {} }: TransProps) {
    const { t } = useI18n();
    const translation = t(i18nKey, values);

    // Parse and replace component placeholders like <Link>text</Link>
    const parts = translation.split(/(<\w+>.*?<\/\w+>)/g);

    return (
        <>
            {parts.map((part, index) => {
                const match = part.match(/<(\w+)>(.*?)<\/\w+>/);
                if (match) {
                    const [, componentName, content] = match;
                    const Component = components[componentName];
                    if (Component) {
                        return <Component key={index}>{content}</Component>;
                    }
                }
                return part;
            })}
        </>
    );
}
