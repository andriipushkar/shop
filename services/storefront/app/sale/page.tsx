'use client';

import { useState, useMemo, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import {
    FireIcon,
    ClockIcon,
    TagIcon,
    SparklesIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { products as allProducts } from '@/lib/mock-data';

// Get products with discount from mock-data
const saleProducts = allProducts
    .filter(p => p.oldPrice && p.oldPrice > p.price)
    .map(p => ({
        ...p,
        discount: Math.round(((p.oldPrice! - p.price) / p.oldPrice!) * 100),
    }))
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 100); // Show top 100 discounted products

type SortOption = 'discount' | 'price_asc' | 'price_desc' | 'ending_soon';

export default function SalePage() {
    const [sortBy, setSortBy] = useState<SortOption>('discount');
    const [selectedDiscount, setSelectedDiscount] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 59, seconds: 59 });

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev.seconds > 0) {
                    return { ...prev, seconds: prev.seconds - 1 };
                } else if (prev.minutes > 0) {
                    return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
                } else if (prev.hours > 0) {
                    return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
                }
                return { hours: 23, minutes: 59, seconds: 59 };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const filteredProducts = useMemo(() => {
        let products = [...saleProducts];

        // Filter by discount
        if (selectedDiscount) {
            products = products.filter(p => p.discount >= selectedDiscount);
        }

        // Sort
        switch (sortBy) {
            case 'discount':
                products.sort((a, b) => b.discount - a.discount);
                break;
            case 'price_asc':
                products.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                products.sort((a, b) => b.price - a.price);
                break;
            case 'ending_soon':
                products.sort((a, b) => a.stock - b.stock);
                break;
        }

        return products;
    }, [sortBy, selectedDiscount]);

    const discountFilters = [
        { value: null, label: 'Всі знижки' },
        { value: 20, label: 'Від 20%' },
        { value: 30, label: 'Від 30%' },
        { value: 40, label: 'Від 40%' },
        { value: 50, label: 'Від 50%' },
    ];

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <FireIcon className="w-8 h-8" />
                                <span className="text-xl font-semibold">Гарячі пропозиції</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold mb-4">
                                Великий розпродаж
                            </h1>
                            <p className="text-xl text-white/90 max-w-lg">
                                Знижки до 70% на тисячі товарів! Встигніть купити за найкращими цінами.
                            </p>
                        </div>

                        {/* Countdown */}
                        <div className="text-center">
                            <p className="text-white/80 mb-3 flex items-center justify-center gap-2">
                                <ClockIcon className="w-5 h-5" />
                                До кінця акції:
                            </p>
                            <div className="flex gap-3">
                                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[70px]">
                                    <span className="block text-3xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
                                    <span className="text-sm text-white/70">год</span>
                                </div>
                                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[70px]">
                                    <span className="block text-3xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
                                    <span className="text-sm text-white/70">хв</span>
                                </div>
                                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[70px]">
                                    <span className="block text-3xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
                                    <span className="text-sm text-white/70">сек</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-8 text-center">
                        <div>
                            <span className="text-2xl font-bold text-red-600">{saleProducts.length}</span>
                            <p className="text-sm text-gray-600">Товарів зі знижкою</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                        <div>
                            <span className="text-2xl font-bold text-red-600">до 70%</span>
                            <p className="text-sm text-gray-600">Максимальна знижка</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                        <div>
                            <span className="text-2xl font-bold text-teal-600">Безкоштовно</span>
                            <p className="text-sm text-gray-600">Доставка від 1000 грн</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters & Sort */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        {/* Discount Filters */}
                        <div className="flex flex-wrap gap-2">
                            {discountFilters.map((filter) => (
                                <button
                                    key={filter.label}
                                    onClick={() => setSelectedDiscount(filter.value)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                        selectedDiscount === filter.value
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <TagIcon className="w-4 h-4 inline mr-1" />
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-red-500 focus:border-red-500"
                            >
                                <option value="discount">За розміром знижки</option>
                                <option value="price_asc">Від дешевих</option>
                                <option value="price_desc">Від дорогих</option>
                                <option value="ending_soon">Закінчуються</option>
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                        <div key={product.id} className="relative">
                            {/* Discount Badge */}
                            <div className="absolute top-3 left-3 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                -{product.discount}%
                            </div>
                            {product.stock <= 5 && (
                                <div className="absolute top-3 right-3 z-10 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                    <SparklesIcon className="w-3 h-3" />
                                    Залишилось {product.stock}
                                </div>
                            )}
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <TagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Нічого не знайдено
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Спробуйте змінити фільтри
                        </p>
                        <button
                            onClick={() => setSelectedDiscount(null)}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                            Скинути фільтри
                        </button>
                    </div>
                )}

                {/* Benefits Section */}
                <section className="mt-16 grid md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <TagIcon className="w-7 h-7 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Справжні знижки</h3>
                        <p className="text-gray-600 text-sm">
                            Чесні ціни без накруток. Порівняйте з іншими магазинами!
                        </p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <ClockIcon className="w-7 h-7 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Обмежений час</h3>
                        <p className="text-gray-600 text-sm">
                            Акційні ціни діють до закінчення таймера. Поспішайте!
                        </p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                        <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <SparklesIcon className="w-7 h-7 text-teal-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Гарантія якості</h3>
                        <p className="text-gray-600 text-sm">
                            Всі товари з гарантією. 14 днів на повернення.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
