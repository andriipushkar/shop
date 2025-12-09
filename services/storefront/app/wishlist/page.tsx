'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import {
    HeartIcon,
    ShoppingCartIcon,
    TrashIcon,
    ShareIcon,
    BellIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { Product } from '@/lib/api';

// Mock wishlist items
const mockWishlistItems: (Product & { addedAt: string; priceDropped?: boolean })[] = [
    { id: '1', name: 'iPhone 15 Pro Max 256GB', price: 54999, sku: 'IPHONE-15-PRO-256', stock: 15, image_url: '/products/iphone-1.jpg', addedAt: '2024-01-15' },
    { id: '2', name: 'Samsung Galaxy S24 Ultra', price: 49999, sku: 'SAMSUNG-S24-ULTRA', stock: 23, image_url: '/products/samsung-1.jpg', addedAt: '2024-01-14', priceDropped: true },
    { id: '3', name: 'MacBook Pro 14" M3', price: 89999, sku: 'MACBOOK-PRO-14-M3', stock: 8, image_url: '/products/macbook-1.jpg', addedAt: '2024-01-10' },
    { id: '4', name: 'Навушники Sony WH-1000XM5', price: 12999, sku: 'SONY-WH1000XM5', stock: 0, image_url: '/products/headphones-1.jpg', addedAt: '2024-01-08' },
];

export default function WishlistPage() {
    const { addToCart } = useCart();
    const [wishlist, setWishlist] = useState<typeof mockWishlistItems>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [addedToCart, setAddedToCart] = useState<string | null>(null);

    useEffect(() => {
        // Simulate loading wishlist
        setTimeout(() => {
            setWishlist(mockWishlistItems);
            setIsLoading(false);
        }, 500);
    }, []);

    const removeFromWishlist = (productId: string) => {
        setWishlist(prev => prev.filter(item => item.id !== productId));
    };

    const handleAddToCart = (product: Product) => {
        addToCart(product);
        setAddedToCart(product.id);
        setTimeout(() => setAddedToCart(null), 2000);
    };

    const addAllToCart = () => {
        wishlist.filter(item => item.stock > 0).forEach(item => {
            addToCart(item);
        });
        setAddedToCart('all');
        setTimeout(() => setAddedToCart(null), 2000);
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-48"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white rounded-xl p-4">
                                    <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <HeartSolidIcon className="w-8 h-8 text-red-500" />
                            Список бажань
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {wishlist.length} товар{wishlist.length === 1 ? '' : wishlist.length < 5 ? 'и' : 'ів'}
                        </p>
                    </div>

                    {wishlist.length > 0 && (
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <ShareIcon className="w-5 h-5" />
                                Поділитися
                            </button>
                            <button
                                onClick={addAllToCart}
                                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                            >
                                <ShoppingCartIcon className="w-5 h-5" />
                                {addedToCart === 'all' ? 'Додано!' : 'Додати все в кошик'}
                            </button>
                        </div>
                    )}
                </div>

                {wishlist.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <HeartIcon className="w-12 h-12 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Список бажань порожній</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            Додавайте товари до списку бажань, натискаючи на серце на сторінці товару
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                        >
                            Перейти до каталогу
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Notification Settings */}
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-8 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <BellIcon className="w-6 h-6 text-teal-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Сповіщення про зниження ціни</p>
                                    <p className="text-sm text-gray-600">Отримуйте сповіщення, коли ціна на товар знизиться</p>
                                </div>
                            </div>
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {wishlist.map((item) => (
                                <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden group">
                                    {/* Image */}
                                    <div className="relative aspect-square bg-gray-100">
                                        <Link href={`/product/${item.id}`}>
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="text-6xl opacity-30">📦</span>
                                                </div>
                                            )}
                                        </Link>

                                        {/* Badges */}
                                        {item.priceDropped && (
                                            <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                Ціна знизилась!
                                            </div>
                                        )}
                                        {item.stock === 0 && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium">
                                                    Немає в наявності
                                                </span>
                                            </div>
                                        )}

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => removeFromWishlist(item.id)}
                                            className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors"
                                        >
                                            <HeartSolidIcon className="w-5 h-5 text-red-500" />
                                        </button>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <Link href={`/product/${item.id}`}>
                                            <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-teal-600 transition-colors">
                                                {item.name}
                                            </h3>
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-1">Код: {item.sku}</p>
                                        <p className="text-lg font-bold text-teal-600 mt-2">
                                            {item.price.toLocaleString()} грн
                                        </p>

                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => handleAddToCart(item)}
                                                disabled={item.stock === 0}
                                                className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                                                    item.stock === 0
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : addedToCart === item.id
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-teal-600 text-white hover:bg-teal-700'
                                                }`}
                                            >
                                                <ShoppingCartIcon className="w-5 h-5" />
                                                {addedToCart === item.id ? 'Додано!' : 'В кошик'}
                                            </button>
                                            <button
                                                onClick={() => removeFromWishlist(item.id)}
                                                className="p-3 border border-gray-300 rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
