'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import {
    MagnifyingGlassIcon,
    AdjustmentsHorizontalIcon,
    XMarkIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Product } from '@/lib/api';

// Mock products for search
const allProducts: Product[] = [
    { id: '1', name: 'iPhone 15 Pro Max 256GB', price: 54999, sku: 'IPHONE-15-PRO-256', stock: 15, image_url: '/products/iphone-1.jpg' },
    { id: '2', name: 'Samsung Galaxy S24 Ultra', price: 49999, sku: 'SAMSUNG-S24-ULTRA', stock: 23, image_url: '/products/samsung-1.jpg' },
    { id: '3', name: 'MacBook Pro 14" M3', price: 89999, sku: 'MACBOOK-PRO-14-M3', stock: 8, image_url: '/products/macbook-1.jpg' },
    { id: '4', name: 'Куртка зимова Premium', price: 3999, sku: 'JACKET-WINTER-PRO', stock: 45, image_url: '/products/jacket-1.jpg' },
    { id: '5', name: 'Кросівки Air Max', price: 4299, sku: 'NIKE-AIRMAX-2024', stock: 67, image_url: '/products/shoes-1.jpg' },
    { id: '6', name: 'Диван кутовий Comfort', price: 24999, sku: 'SOFA-CORNER-CMFT', stock: 3, image_url: '/products/sofa-1.jpg' },
    { id: '7', name: 'Велосипед гірський Pro', price: 15999, sku: 'BIKE-MTB-PRO', stock: 12, image_url: '/products/bike-1.jpg' },
    { id: '8', name: 'Гантелі набір 20кг', price: 2999, sku: 'DUMBBELLS-20KG', stock: 34, image_url: '/products/dumbbells-1.jpg' },
    { id: '9', name: 'Навушники Sony WH-1000XM5', price: 12999, sku: 'SONY-WH1000XM5', stock: 19, image_url: '/products/headphones-1.jpg' },
    { id: '10', name: 'Телевізор Samsung 55" OLED', price: 45999, sku: 'SAMSUNG-TV-55-OLED', stock: 7, image_url: '/products/tv-1.jpg' },
    { id: '11', name: 'Планшет iPad Pro 12.9"', price: 52999, sku: 'IPAD-PRO-129', stock: 11, image_url: '/products/ipad-1.jpg' },
    { id: '12', name: 'Годинник Apple Watch Ultra 2', price: 34999, sku: 'APPLE-WATCH-ULTRA2', stock: 25, image_url: '/products/watch-1.jpg' },
];

type SortOption = 'relevant' | 'price_asc' | 'price_desc' | 'stock';

function SearchContent() {
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    const [query, setQuery] = useState(initialQuery);
    const [inputValue, setInputValue] = useState(initialQuery);
    const [sortBy, setSortBy] = useState<SortOption>('relevant');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            setInputValue(q);
        }
    }, [searchParams]);

    const results = useMemo(() => {
        let filtered = allProducts;

        // Search filter
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(
                p =>
                    p.name.toLowerCase().includes(lowerQuery) ||
                    p.sku.toLowerCase().includes(lowerQuery)
            );
        }

        // Price filter
        filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

        // Sort
        switch (sortBy) {
            case 'price_asc':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                filtered.sort((a, b) => b.price - a.price);
                break;
            case 'stock':
                filtered.sort((a, b) => b.stock - a.stock);
                break;
            default:
                // Keep relevance order (search match quality would go here)
                break;
        }

        return filtered;
    }, [query, sortBy, priceRange]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setQuery(inputValue);
    };

    const clearFilters = () => {
        setPriceRange([0, 100000]);
    };

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Search Header */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Пошук товарів..."
                            className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-lg"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                        >
                            Знайти
                        </button>
                    </form>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {query && (
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Результати пошуку: &ldquo;{query}&rdquo;
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Знайдено {results.length} товар{results.length === 1 ? '' : results.length < 5 ? 'и' : 'ів'}
                        </p>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Filters Sidebar - Desktop */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">Фільтри</h3>
                                {(priceRange[0] > 0 || priceRange[1] < 100000) && (
                                    <button
                                        onClick={clearFilters}
                                        className="text-sm text-teal-600 hover:text-teal-700"
                                    >
                                        Скинути
                                    </button>
                                )}
                            </div>

                            {/* Price Range */}
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Ціна</h4>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={priceRange[0]}
                                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Від"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="number"
                                        value={priceRange[1]}
                                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="До"
                                    />
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <div className="flex-1">
                        {/* Toolbar */}
                        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <button
                                    onClick={() => setShowFilters(true)}
                                    className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    <AdjustmentsHorizontalIcon className="w-5 h-5" />
                                    <span>Фільтри</span>
                                </button>

                                <div className="relative">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-teal-500 focus:border-teal-500"
                                    >
                                        <option value="relevant">За релевантністю</option>
                                        <option value="price_asc">Від дешевих</option>
                                        <option value="price_desc">Від дорогих</option>
                                        <option value="stock">За наявністю</option>
                                    </select>
                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        {results.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                                <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                    Нічого не знайдено
                                </h2>
                                <p className="text-gray-500 mb-6">
                                    Спробуйте змінити пошуковий запит або скиньте фільтри
                                </p>
                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        onClick={() => {
                                            setQuery('');
                                            setInputValue('');
                                            clearFilters();
                                        }}
                                        className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Очистити пошук
                                    </button>
                                    <Link
                                        href="/"
                                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        До каталогу
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Popular Searches */}
                        {!query && (
                            <div className="mt-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Популярні запити</h2>
                                <div className="flex flex-wrap gap-2">
                                    {['iPhone', 'Samsung', 'Ноутбук', 'Навушники', 'Телевізор', 'Планшет'].map((term) => (
                                        <button
                                            key={term}
                                            onClick={() => {
                                                setInputValue(term);
                                                setQuery(term);
                                            }}
                                            className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors"
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Filters Modal */}
            {showFilters && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold text-gray-900">Фільтри</h3>
                            <button
                                onClick={() => setShowFilters(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Ціна</h4>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={priceRange[0]}
                                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Від"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="number"
                                        value={priceRange[1]}
                                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="До"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                            <div className="flex gap-3">
                                <button
                                    onClick={clearFilters}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Скинути
                                </button>
                                <button
                                    onClick={() => setShowFilters(false)}
                                    className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                >
                                    Показати ({results.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gray-50">
                <div className="bg-white border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="h-14 bg-gray-200 rounded-xl animate-pulse max-w-2xl mx-auto"></div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                                <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        }>
            <SearchContent />
        </Suspense>
    );
}
