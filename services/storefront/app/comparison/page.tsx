'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useComparison } from '@/lib/comparison-context';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import {
    XMarkIcon,
    ShoppingCartIcon,
    HeartIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ScaleIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, CheckIcon } from '@heroicons/react/24/solid';

// Mock product specifications for comparison
const mockProductSpecs: Record<string, Record<string, string>> = {
    'prod-1': {
        'Бренд': 'Apple',
        'Модель': 'iPhone 15 Pro Max',
        'Екран': '6.7" OLED, 2796x1290',
        'Процесор': 'A17 Pro',
        'Оперативна пам\'ять': '8 GB',
        'Вбудована пам\'ять': '256 GB',
        'Основна камера': '48 MP + 12 MP + 12 MP',
        'Фронтальна камера': '12 MP',
        'Акумулятор': '4422 mAh',
        'Операційна система': 'iOS 17',
        'SIM-карта': 'eSIM',
        'Вага': '221 г',
        'Гарантія': '12 місяців',
    },
    'prod-2': {
        'Бренд': 'Samsung',
        'Модель': 'Galaxy S24 Ultra',
        'Екран': '6.8" Dynamic AMOLED, 3120x1440',
        'Процесор': 'Snapdragon 8 Gen 3',
        'Оперативна пам\'ять': '12 GB',
        'Вбудована пам\'ять': '256 GB',
        'Основна камера': '200 MP + 50 MP + 12 MP + 10 MP',
        'Фронтальна камера': '12 MP',
        'Акумулятор': '5000 mAh',
        'Операційна система': 'Android 14',
        'SIM-карта': 'Nano-SIM + eSIM',
        'Вага': '232 г',
        'Гарантія': '12 місяців',
    },
    'prod-3': {
        'Бренд': 'Apple',
        'Модель': 'MacBook Pro 14" M3',
        'Екран': '14.2" Liquid Retina XDR',
        'Процесор': 'Apple M3 Pro',
        'Оперативна пам\'ять': '18 GB',
        'Вбудована пам\'ять': '512 GB SSD',
        'Відеокарта': 'Apple M3 Pro GPU',
        'Акумулятор': 'До 17 годин',
        'Операційна система': 'macOS Sonoma',
        'Роз\'єми': 'HDMI, SD, MagSafe 3, USB-C x3',
        'Вага': '1.6 кг',
        'Гарантія': '12 місяців',
    },
};

// Generate mock specs for products without predefined specs
function getProductSpecs(productId: string): Record<string, string> {
    if (mockProductSpecs[productId]) {
        return mockProductSpecs[productId];
    }

    // Generate random specs based on product ID
    const num = parseInt(productId.replace('prod-', '')) || 1;
    const brands = ['Samsung', 'Apple', 'Xiaomi', 'Sony', 'LG', 'Bosch', 'Philips'];

    return {
        'Бренд': brands[num % brands.length],
        'Модель': `Model ${num}`,
        'Колір': ['Чорний', 'Білий', 'Сірий', 'Синій'][num % 4],
        'Вага': `${(num * 0.3 + 0.5).toFixed(1)} кг`,
        'Розміри': `${20 + num}x${15 + num}x${5 + (num % 10)} см`,
        'Країна виробництва': ['Китай', 'В\'єтнам', 'Корея', 'Японія'][num % 4],
        'Гарантія': `${12 + (num % 24)} місяців`,
    };
}

export default function ComparisonPage() {
    const { items, removeFromComparison, clearComparison, itemCount } = useComparison();
    const { addToCart } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();
    const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [addedToCart, setAddedToCart] = useState<string | null>(null);

    const handleAddToCart = (item: typeof items[0]) => {
        addToCart({
            id: item.productId,
            name: item.name,
            price: item.price,
            sku: item.productId,
            stock: 100,
            image_url: item.image,
        });
        setAddedToCart(item.productId);
        setTimeout(() => setAddedToCart(null), 2000);
    };

    const handleToggleWishlist = (item: typeof items[0]) => {
        toggleWishlist({
            productId: item.productId,
            name: item.name,
            price: item.price,
            image: item.image,
        });
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    // Get all unique specification keys from all products
    const allSpecs = items.reduce((acc, item) => {
        const specs = getProductSpecs(item.productId);
        Object.keys(specs).forEach(key => {
            if (!acc.includes(key)) acc.push(key);
        });
        return acc;
    }, [] as string[]);

    // Check if a spec value differs between products
    const specHasDifferences = (specKey: string): boolean => {
        const values = items.map(item => getProductSpecs(item.productId)[specKey] || '-');
        return new Set(values).size > 1;
    };

    // Filter specs based on showDifferencesOnly
    const displaySpecs = showDifferencesOnly
        ? allSpecs.filter(specHasDifferences)
        : allSpecs;

    // Group specs by category
    const specCategories: Record<string, string[]> = {
        'Основні характеристики': ['Бренд', 'Модель', 'Колір', 'Країна виробництва'],
        'Екран та дисплей': ['Екран', 'Роздільна здатність'],
        'Продуктивність': ['Процесор', 'Оперативна пам\'ять', 'Вбудована пам\'ять', 'Відеокарта'],
        'Камера': ['Основна камера', 'Фронтальна камера'],
        'Живлення': ['Акумулятор'],
        'Інше': ['Операційна система', 'SIM-карта', 'Роз\'єми', 'Вага', 'Розміри', 'Гарантія'],
    };

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <ScaleIcon className="w-8 h-8 text-primary-600" />
                            Порівняння товарів
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {itemCount} з 4 товарів для порівняння
                        </p>
                    </div>

                    {items.length > 0 && (
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showDifferencesOnly}
                                    onChange={(e) => setShowDifferencesOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">Тільки відмінності</span>
                            </label>
                            <button
                                onClick={clearComparison}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                                Очистити все
                            </button>
                        </div>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ScaleIcon className="w-12 h-12 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Список порівняння порожній</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            Додавайте товари до порівняння, натискаючи на іконку порівняння на сторінці товару
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                        >
                            Перейти до каталогу
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Products Header */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr className="border-b">
                                        <th className="w-48 p-4 text-left text-sm font-medium text-gray-500 bg-gray-50 sticky left-0">
                                            Товар
                                        </th>
                                        {items.map((item) => (
                                            <th key={item.productId} className="p-4 min-w-[200px]">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => removeFromComparison(item.productId)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                    <Link href={`/product/${item.productId}`}>
                                                        <div className="aspect-square w-32 mx-auto bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                                                            {item.image ? (
                                                                <Image
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    fill
                                                                    sizes="128px"
                                                                    className="object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <span className="text-4xl opacity-30">📦</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 hover:text-primary-600">
                                                            {item.name}
                                                        </h3>
                                                    </Link>
                                                    <p className="text-lg font-bold text-primary-600 mt-2">
                                                        {item.price.toLocaleString()} грн
                                                    </p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={() => handleAddToCart(item)}
                                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                                                                addedToCart === item.productId
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-primary-600 text-white hover:bg-primary-700'
                                                            }`}
                                                        >
                                                            {addedToCart === item.productId ? (
                                                                <CheckIcon className="w-4 h-4" />
                                                            ) : (
                                                                <ShoppingCartIcon className="w-4 h-4" />
                                                            )}
                                                            {addedToCart === item.productId ? 'Додано!' : 'Купити'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleWishlist(item)}
                                                            className="p-2 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                                                        >
                                                            {isInWishlist(item.productId) ? (
                                                                <HeartSolidIcon className="w-5 h-5 text-red-500" />
                                                            ) : (
                                                                <HeartIcon className="w-5 h-5 text-gray-400" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                        {/* Add more products placeholder */}
                                        {items.length < 4 && (
                                            <th className="p-4 min-w-[200px]">
                                                <Link
                                                    href="/"
                                                    className="block border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                                                >
                                                    <PlusIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                                    <p className="text-sm text-gray-500">Додати товар</p>
                                                </Link>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(specCategories).map(([category, categorySpecs]) => {
                                        const visibleSpecs = categorySpecs.filter(spec => displaySpecs.includes(spec));
                                        if (visibleSpecs.length === 0) return null;

                                        const isCollapsed = collapsedSections.includes(category);

                                        return (
                                            <React.Fragment key={category}>
                                                {/* Category Header */}
                                                <tr className="bg-gray-50">
                                                    <td
                                                        colSpan={items.length + 2}
                                                        className="px-4 py-3 cursor-pointer sticky left-0"
                                                        onClick={() => toggleSection(category)}
                                                    >
                                                        <div className="flex items-center gap-2 font-semibold text-gray-900">
                                                            {isCollapsed ? (
                                                                <ChevronDownIcon className="w-5 h-5" />
                                                            ) : (
                                                                <ChevronUpIcon className="w-5 h-5" />
                                                            )}
                                                            {category}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Specs Rows */}
                                                {!isCollapsed && visibleSpecs.map((spec) => (
                                                    <tr key={spec} className="border-b hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-sm text-gray-600 bg-white sticky left-0">
                                                            {spec}
                                                        </td>
                                                        {items.map((item) => {
                                                            const specs = getProductSpecs(item.productId);
                                                            const value = specs[spec] || '-';
                                                            const hasDiff = specHasDifferences(spec);

                                                            return (
                                                                <td
                                                                    key={item.productId}
                                                                    className={`px-4 py-3 text-sm text-center ${
                                                                        hasDiff ? 'font-medium text-gray-900' : 'text-gray-600'
                                                                    }`}
                                                                >
                                                                    {value}
                                                                </td>
                                                            );
                                                        })}
                                                        {items.length < 4 && <td></td>}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tips */}
                {items.length > 0 && items.length < 4 && (
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-blue-800 text-sm">
                            <strong>Порада:</strong> Ви можете додати до {4 - items.length} товар{items.length === 3 ? '' : 'и'} для більш детального порівняння.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}

