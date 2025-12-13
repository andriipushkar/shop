'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useComparison } from '@/lib/comparison-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
    MagnifyingGlassIcon,
    UserIcon,
    HeartIcon,
    Bars3Icon,
    XMarkIcon,
    ChevronDownIcon,
    ShoppingCartIcon,
    PhoneIcon,
    TruckIcon,
    SparklesIcon,
    ScaleIcon,
} from '@heroicons/react/24/outline';

const categories = [
    {
        slug: 'electronics',
        name: 'Електроніка',
        icon: '💻',
        subcategories: [
            { slug: 'smartphones', name: 'Смартфони' },
            { slug: 'laptops', name: 'Ноутбуки' },
            { slug: 'tablets', name: 'Планшети' },
            { slug: 'accessories', name: 'Аксесуари' },
        ],
    },
    {
        slug: 'clothing',
        name: 'Одяг',
        icon: '👕',
        subcategories: [
            { slug: 'men', name: 'Чоловічий' },
            { slug: 'women', name: 'Жіночий' },
            { slug: 'kids', name: 'Дитячий' },
            { slug: 'shoes', name: 'Взуття' },
        ],
    },
    {
        slug: 'home',
        name: 'Дім і сад',
        icon: '🏠',
        subcategories: [
            { slug: 'furniture', name: 'Меблі' },
            { slug: 'decor', name: 'Декор' },
            { slug: 'garden', name: 'Сад' },
            { slug: 'tools', name: 'Інструменти' },
        ],
    },
    {
        slug: 'sports',
        name: 'Спорт',
        icon: '⚽',
        subcategories: [
            { slug: 'fitness', name: 'Фітнес' },
            { slug: 'outdoor', name: 'Туризм' },
            { slug: 'team-sports', name: 'Командні' },
            { slug: 'cycling', name: 'Велоспорт' },
        ],
    },
    {
        slug: 'beauty',
        name: 'Краса',
        icon: '💄',
        subcategories: [
            { slug: 'skincare', name: 'Догляд за шкірою' },
            { slug: 'makeup', name: 'Макіяж' },
            { slug: 'hair', name: 'Волосся' },
            { slug: 'perfume', name: 'Парфумерія' },
        ],
    },
];

export default function Header() {
    const router = useRouter();
    const { totalItems, totalPrice } = useCart();
    const { user, isAuthenticated } = useAuth();
    const { totalItems: wishlistCount } = useWishlist();
    const { itemCount: comparisonCount } = useComparison();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const megaMenuRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    }, [searchQuery, router]);

    const handleMouseEnter = useCallback((slug: string) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setActiveMegaMenu(slug);
    }, []);

    const handleMouseLeave = useCallback(() => {
        timeoutRef.current = setTimeout(() => {
            setActiveMegaMenu(null);
        }, 150);
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <header className="sticky top-0 z-50">
            {/* Top Bar - Promo */}
            <div className="bg-gradient-hero text-white text-sm py-2">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <TruckIcon className="w-4 h-4" />
                                <span>Безкоштовна доставка від 1000 грн</span>
                            </div>
                            <div className="hidden md:flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" />
                                <span>Знижки до -50% на нові колекції</span>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-4">
                            <a href="tel:0800123456" className="flex items-center gap-1 hover:text-teal-100 transition-colors">
                                <PhoneIcon className="w-4 h-4" />
                                <span className="font-medium">0 800 123 456</span>
                            </a>
                            <span className="text-teal-200">|</span>
                            <span className="text-teal-100">Пн-Нд: 9:00-21:00</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 gap-4">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="lg:hidden p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            aria-label={isMenuOpen ? 'Закрити меню' : 'Відкрити меню'}
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? (
                                <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                            ) : (
                                <Bars3Icon className="w-6 h-6" aria-hidden="true" />
                            )}
                        </button>

                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg shadow-teal-200">
                                <span className="text-white font-bold text-xl">M</span>
                            </div>
                            <span className="text-2xl font-bold text-gradient-primary hidden sm:block">
                                MyShop
                            </span>
                        </Link>

                        {/* Search Bar - Desktop */}
                        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl">
                            <div className={`relative w-full transition-all duration-200 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setIsSearchFocused(false)}
                                    placeholder="Шукати товари..."
                                    className={`w-full px-5 py-3 pl-12 border-2 rounded-xl transition-all duration-200 ${
                                        isSearchFocused
                                            ? 'border-teal-500 shadow-lg shadow-teal-100'
                                            : 'border-gray-200 hover:border-teal-300'
                                    }`}
                                />
                                <MagnifyingGlassIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${
                                    isSearchFocused ? 'text-teal-500' : 'text-gray-400'
                                }`} />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:shadow-teal-200 transition-all duration-200"
                                >
                                    Знайти
                                </button>
                            </div>
                        </form>

                        {/* Right Actions */}
                        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Дії користувача">
                            <LanguageSwitcher variant="compact" showFlag={true} className="hidden sm:block" />
                            <Link
                                href={isAuthenticated ? "/profile" : "/auth/login"}
                                className="hidden sm:flex flex-col items-center text-gray-600 hover:text-teal-600 transition-colors p-2 rounded-lg hover:bg-teal-50"
                                aria-label={isAuthenticated ? 'Перейти до профілю' : 'Увійти в акаунт'}
                            >
                                <UserIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="text-xs mt-1 hidden lg:block">
                                    {isAuthenticated ? user?.name?.split(' ')[0] || 'Профіль' : 'Увійти'}
                                </span>
                            </Link>
                            <Link
                                href="/comparison"
                                className="hidden sm:flex flex-col items-center text-gray-600 hover:text-teal-600 transition-colors p-2 rounded-lg hover:bg-teal-50 relative"
                                aria-label={`Порівняння товарів${comparisonCount > 0 ? ` (${comparisonCount})` : ''}`}
                            >
                                <ScaleIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="text-xs mt-1 hidden lg:block">Порівняти</span>
                                {comparisonCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" aria-hidden="true">
                                        {comparisonCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/wishlist"
                                className="hidden sm:flex flex-col items-center text-gray-600 hover:text-teal-600 transition-colors p-2 rounded-lg hover:bg-teal-50 relative"
                                aria-label={`Список бажань${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`}
                            >
                                <HeartIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="text-xs mt-1 hidden lg:block">Бажання</span>
                                {wishlistCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" aria-hidden="true">
                                        {wishlistCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/cart"
                                className="relative flex items-center gap-2 bg-gradient-primary text-white px-4 py-2.5 rounded-xl hover:shadow-lg hover:shadow-teal-200 transition-all duration-200 group"
                                aria-label={`Кошик${totalItems > 0 ? ` (${totalItems} товар${totalItems === 1 ? '' : 'ів'}, ${totalPrice.toFixed(0)} грн)` : ' (порожній)'}`}
                            >
                                <ShoppingCartIcon className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />
                                <div className="hidden sm:block text-left">
                                    <span className="text-xs text-teal-100">Кошик</span>
                                    <p className="text-sm font-semibold leading-tight">
                                        {totalPrice.toFixed(0)} грн
                                    </p>
                                </div>
                                {totalItems > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce-soft" aria-hidden="true">
                                        {totalItems}
                                    </span>
                                )}
                            </Link>
                        </nav>
                    </div>
                </div>

                {/* Category Navigation - Desktop with Mega Menu */}
                <nav className="hidden lg:block border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-1">
                            {/* All Categories Button */}
                            <div className="relative" ref={megaMenuRef}>
                                <button
                                    className="flex items-center gap-2 px-4 py-3 bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors"
                                    onMouseEnter={() => handleMouseEnter('all')}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <Bars3Icon className="w-5 h-5" />
                                    <span>Каталог</span>
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeMegaMenu === 'all' ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Mega Menu */}
                                {activeMegaMenu === 'all' && (
                                    <div
                                        className="absolute left-0 top-full w-[800px] bg-white shadow-2xl rounded-b-2xl border border-gray-100 animate-fade-in z-50"
                                        onMouseEnter={() => handleMouseEnter('all')}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="grid grid-cols-4 gap-6 p-6">
                                            {categories.map((cat) => (
                                                <div key={cat.slug} className="space-y-3">
                                                    <Link
                                                        href={`/category/${cat.slug}`}
                                                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-teal-600 transition-colors"
                                                    >
                                                        <span className="text-xl">{cat.icon}</span>
                                                        <span>{cat.name}</span>
                                                    </Link>
                                                    <ul className="space-y-2 pl-7">
                                                        {cat.subcategories.map((sub) => (
                                                            <li key={sub.slug}>
                                                                <Link
                                                                    href={`/category/${cat.slug}/${sub.slug}`}
                                                                    className="text-sm text-gray-600 hover:text-teal-600 transition-colors"
                                                                >
                                                                    {sub.name}
                                                                </Link>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-teal-50 p-4 rounded-b-2xl">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-teal-700">
                                                    <SparklesIcon className="w-5 h-5" />
                                                    <span className="font-medium">Акції та знижки</span>
                                                </div>
                                                <Link href="/sale" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
                                                    Переглянути всі →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quick Category Links */}
                            {categories.slice(0, 4).map((cat) => (
                                <Link
                                    key={cat.slug}
                                    href={`/category/${cat.slug}`}
                                    className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:text-teal-600 hover:bg-teal-50 font-medium transition-colors"
                                >
                                    <span>{cat.icon}</span>
                                    <span>{cat.name}</span>
                                </Link>
                            ))}

                            <Link
                                href="/sale"
                                className="flex items-center gap-2 px-4 py-3 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium transition-colors ml-auto"
                            >
                                <span className="badge-sale text-xs px-2 py-0.5 rounded">-50%</span>
                                <span>Розпродаж</span>
                            </Link>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Mobile Search */}
            <div className="md:hidden px-4 py-3 bg-white border-b">
                <form onSubmit={handleSearch}>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Шукати товари..."
                            className="w-full px-4 py-3 pl-11 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
                        />
                        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                </form>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden fixed inset-0 top-[140px] bg-white z-40 overflow-y-auto animate-slide-up">
                    <nav className="max-w-7xl mx-auto px-4 py-6">
                        <div className="space-y-4">
                            {categories.map((cat) => (
                                <div key={cat.slug} className="border-b border-gray-100 pb-4">
                                    <Link
                                        href={`/category/${cat.slug}`}
                                        className="flex items-center gap-3 text-lg font-semibold text-gray-900 hover:text-teal-600 py-2"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <span className="text-2xl">{cat.icon}</span>
                                        <span>{cat.name}</span>
                                    </Link>
                                    <div className="grid grid-cols-2 gap-2 pl-10 mt-2">
                                        {cat.subcategories.map((sub) => (
                                            <Link
                                                key={sub.slug}
                                                href={`/category/${cat.slug}/${sub.slug}`}
                                                className="text-gray-600 hover:text-teal-600 py-1"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                {sub.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                            <Link
                                href={isAuthenticated ? "/profile" : "/auth/login"}
                                className="flex items-center gap-3 py-3 text-gray-700 hover:text-teal-600 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <UserIcon className="w-6 h-6" />
                                <span>{isAuthenticated ? `${user?.name || 'Профіль'}` : 'Увійти / Реєстрація'}</span>
                            </Link>
                            <Link
                                href="/orders"
                                className="flex items-center gap-3 py-3 text-gray-700 hover:text-teal-600 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <TruckIcon className="w-6 h-6" />
                                <span>Мої замовлення</span>
                            </Link>
                            <Link
                                href="/tracking"
                                className="flex items-center gap-3 py-3 text-gray-700 hover:text-teal-600 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <TruckIcon className="w-6 h-6" />
                                <span>Відстежити посилку</span>
                            </Link>
                            <Link
                                href="/wishlist"
                                className="flex items-center gap-3 py-3 text-gray-700 hover:text-teal-600 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <HeartIcon className="w-6 h-6" />
                                <span>Список бажань</span>
                                {wishlistCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                        {wishlistCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/comparison"
                                className="flex items-center gap-3 py-3 text-gray-700 hover:text-teal-600 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <ScaleIcon className="w-6 h-6" />
                                <span>Порівняння товарів</span>
                                {comparisonCount > 0 && (
                                    <span className="ml-auto bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                                        {comparisonCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/sale"
                                className="flex items-center gap-3 py-3 text-orange-600 hover:text-orange-700 font-medium"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <SparklesIcon className="w-6 h-6" />
                                <span>Розпродаж -50%</span>
                            </Link>
                        </div>

                        {/* Mobile Contact */}
                        <div className="mt-6 p-4 bg-teal-50 rounded-xl">
                            <p className="text-teal-800 font-medium mb-2">Потрібна допомога?</p>
                            <a href="tel:0800123456" className="flex items-center gap-2 text-teal-600 font-semibold text-lg">
                                <PhoneIcon className="w-5 h-5" />
                                0 800 123 456
                            </a>
                            <p className="text-teal-700 text-sm mt-1">Безкоштовно по Україні</p>
                        </div>

                        {/* Mobile Language Switcher */}
                        <div className="mt-6 p-4 border-t border-gray-200">
                            <p className="text-gray-600 font-medium mb-3">Мова</p>
                            <LanguageSwitcher variant="buttons" showFlag={true} showName={true} />
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
