'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRecentlyViewed } from '@/lib/recently-viewed-context';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import {
    ClockIcon,
    ShoppingCartIcon,
    HeartIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';

interface RecentlyViewedProps {
    maxItems?: number;
    showClearButton?: boolean;
    title?: string;
    excludeProductId?: string;
}

export default function RecentlyViewed({
    maxItems = 8,
    showClearButton = true,
    title = 'Нещодавно переглянуті',
    excludeProductId,
}: RecentlyViewedProps) {
    const { items, clearRecentlyViewed, removeFromRecentlyViewed } = useRecentlyViewed();
    const { addToCart } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();
    const [addedToCart, setAddedToCart] = useState<string | null>(null);

    // Filter out excluded product and limit items
    const displayItems = items
        .filter(item => item.productId !== excludeProductId)
        .slice(0, maxItems);

    if (displayItems.length === 0) {
        return null;
    }

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

    return (
        <section className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClockIcon className="w-6 h-6 text-primary-600" />
                        {title}
                    </h2>
                    {showClearButton && (
                        <button
                            onClick={clearRecentlyViewed}
                            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                        >
                            Очистити історію
                        </button>
                    )}
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {displayItems.map((item) => (
                        <div
                            key={item.productId}
                            className="bg-white rounded-xl shadow-sm overflow-hidden group relative"
                        >
                            {/* Remove Button */}
                            <button
                                onClick={() => removeFromRecentlyViewed(item.productId)}
                                className="absolute top-2 right-2 z-10 w-6 h-6 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                            >
                                <XMarkIcon className="w-4 h-4 text-gray-500 hover:text-red-500" />
                            </button>

                            {/* Image */}
                            <Link href={`/product/${item.productId}`}>
                                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-4xl opacity-30">📦</span>
                                        </div>
                                    )}
                                </div>
                            </Link>

                            {/* Info */}
                            <div className="p-3">
                                <Link href={`/product/${item.productId}`}>
                                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 hover:text-primary-600 transition-colors min-h-[2.5rem]">
                                        {item.name}
                                    </h3>
                                </Link>
                                <p className="text-primary-600 font-bold mt-1">
                                    {item.price.toLocaleString()} грн
                                </p>

                                {/* Actions */}
                                <div className="flex gap-1 mt-2">
                                    <button
                                        onClick={() => handleAddToCart(item)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                                            addedToCart === item.productId
                                                ? 'bg-green-500 text-white'
                                                : 'bg-primary-600 text-white hover:bg-primary-700'
                                        }`}
                                    >
                                        <ShoppingCartIcon className="w-4 h-4" />
                                        {addedToCart === item.productId ? '✓' : 'Купити'}
                                    </button>
                                    <button
                                        onClick={() => handleToggleWishlist(item)}
                                        className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                                    >
                                        {isInWishlist(item.productId) ? (
                                            <HeartSolidIcon className="w-4 h-4 text-red-500" />
                                        ) : (
                                            <HeartIcon className="w-4 h-4 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* View All Link */}
                {items.length > maxItems && (
                    <div className="text-center mt-6">
                        <Link
                            href="/recently-viewed"
                            className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                            Показати всі ({items.length})
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
