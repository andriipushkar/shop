'use client';

/**
 * Language Switcher Component
 * Allows users to change the application language with visual feedback
 * Persists selection to cookies and updates the URL
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/i18n-context';
import { localeConfigs, Locale } from '@/lib/i18n/i18n';
import { i18nConfig, addLocaleToPathname, removeLocaleFromPathname } from '@/lib/i18n/i18n-config';
import { GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface LanguageSwitcherProps {
    variant?: 'dropdown' | 'compact' | 'buttons';
    showFlag?: boolean;
    showName?: boolean;
    className?: string;
}

export default function LanguageSwitcher({
    variant = 'dropdown',
    showFlag = true,
    showName = true,
    className = '',
}: LanguageSwitcherProps) {
    const { locale, setLocale, config } = useI18n();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close dropdown on Escape key
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const handleLocaleChange = async (newLocale: Locale) => {
        if (newLocale === locale) {
            setIsOpen(false);
            return;
        }

        // Update locale in context (this updates the cookie via I18nProvider)
        setLocale(newLocale);

        // Build new path with locale
        const cleanPath = removeLocaleFromPathname(pathname);
        const newPath = addLocaleToPathname(cleanPath, newLocale);

        // Navigate to new locale path
        router.push(newPath);

        setIsOpen(false);
    };

    // Compact variant (icon only with flag)
    if (variant === 'compact') {
        return (
            <div className={`relative ${className}`} ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Change language"
                    aria-expanded={isOpen}
                >
                    <GlobeAltIcon className="w-5 h-5 text-gray-600" />
                    {showFlag && <span className="text-lg">{config.flag}</span>}
                </button>

                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] z-50 animate-fade-in">
                        {i18nConfig.locales.map((loc) => {
                            const locConfig = localeConfigs[loc];
                            return (
                                <button
                                    key={loc}
                                    onClick={() => handleLocaleChange(loc)}
                                    className={`flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                        locale === loc ? 'bg-teal-50 text-teal-700' : 'text-gray-700'
                                    }`}
                                >
                                    <span className="text-xl">{locConfig.flag}</span>
                                    <span className="font-medium">{locConfig.nativeName}</span>
                                    {locale === loc && (
                                        <span className="ml-auto text-teal-600">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // Button group variant
    if (variant === 'buttons') {
        return (
            <div className={`flex gap-2 ${className}`}>
                {i18nConfig.locales.map((loc) => {
                    const locConfig = localeConfigs[loc];
                    return (
                        <button
                            key={loc}
                            onClick={() => handleLocaleChange(loc)}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                                locale === loc
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            aria-label={`Switch to ${locConfig.nativeName}`}
                            aria-pressed={locale === loc}
                        >
                            {showFlag && <span className="mr-1">{locConfig.flag}</span>}
                            {showName && <span>{locConfig.code.toUpperCase()}</span>}
                        </button>
                    );
                })}
            </div>
        );
    }

    // Default dropdown variant
    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                aria-label="Change language"
                aria-expanded={isOpen}
            >
                {showFlag && <span className="text-lg">{config.flag}</span>}
                {showName && (
                    <span className="font-medium text-gray-700">{config.nativeName}</span>
                )}
                <ChevronDownIcon
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[180px] z-50 animate-fade-in">
                    {i18nConfig.locales.map((loc) => {
                        const locConfig = localeConfigs[loc];
                        return (
                            <button
                                key={loc}
                                onClick={() => handleLocaleChange(loc)}
                                className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                    locale === loc ? 'bg-teal-50' : ''
                                }`}
                            >
                                <span className="text-xl">{locConfig.flag}</span>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-gray-900">
                                        {locConfig.nativeName}
                                    </div>
                                    <div className="text-xs text-gray-500">{locConfig.name}</div>
                                </div>
                                {locale === loc && (
                                    <svg
                                        className="w-5 h-5 text-teal-600"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
