'use client';

import { Product } from '@/lib/api';
import { Product as MockProduct } from '@/lib/mock-data';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useComparison } from '@/lib/comparison-context';
import { useRecentlyViewed } from '@/lib/recently-viewed-context';
import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    ShoppingCartIcon,
    HeartIcon,
    EyeIcon,
    CheckIcon,
    ScaleIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface ProductCardProps {
    product: Product | MockProduct;
    showQuickView?: boolean;
    /** Set to true for above-the-fold images (first 4-8 products) to improve LCP */
    priority?: boolean;
}

function ProductCard({ product, showQuickView = true, priority = false }: ProductCardProps) {
    const { addToCart } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();
    const { isInComparison, toggleComparison, canAdd } = useComparison();
    const { addToRecentlyViewed } = useRecentlyViewed();
    const [added, setAdded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isWishlisted = isInWishlist(product.id);
    const isCompared = isInComparison(product.id);

    const isOutOfStock = product.stock <= 0;
    const isLowStock = product.stock > 0 && product.stock < 5;
    const hasImage = product.image_url && !imageError;

    // Use data from product if available (mock data), otherwise generate
    const mockProduct = product as MockProduct;
    const hasDiscount = !!mockProduct.oldPrice;
    const originalPrice = mockProduct.oldPrice || product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.price / originalPrice) * 100) : 0;
    const rating = mockProduct.rating?.toFixed(1) || '4.5';
    const reviewCount = mockProduct.reviewCount || 0;

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOutOfStock) return;
        addToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    const handleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url,
        });
    };

    const handleComparison = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isCompared && !canAdd) return; // Max 4 items
        toggleComparison({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url,
        });
    };

    const handleClick = () => {
        addToRecentlyViewed({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url,
        });
    };

    return (
        <Link href={`/product/${product.id}`} onClick={handleClick}>
            <div
                className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 card-hover relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Badges */}
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                    {hasDiscount && (
                        <span className="badge-sale px-2 py-1 rounded-lg text-xs font-bold">
                            -{discountPercent}%
                        </span>
                    )}
                    {isLowStock && !isOutOfStock && (
                        <span className="badge-warning px-2 py-1 rounded-lg text-xs font-semibold">
                            Залишилось {product.stock} шт
                        </span>
                    )}
                </div>

                {/* Quick Actions */}
                <div className={`absolute top-3 right-3 z-10 flex flex-col gap-2 transition-all duration-300 ${
                    isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
                }`}>
                    <button
                        onClick={handleWishlist}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isWishlisted
                                ? 'bg-red-500 text-white'
                                : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
                        } shadow-md`}
                        title={isWishlisted ? 'Видалити з бажань' : 'Додати до бажань'}
                        aria-label={isWishlisted ? 'Видалити з бажань' : 'Додати до бажань'}
                    >
                        {isWishlisted ? (
                            <HeartSolidIcon className="w-5 h-5" />
                        ) : (
                            <HeartIcon className="w-5 h-5" />
                        )}
                    </button>
                    <button
                        onClick={handleComparison}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isCompared
                                ? 'bg-teal-500 text-white'
                                : !canAdd
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-white/90 text-gray-600 hover:bg-teal-50 hover:text-teal-600'
                        } shadow-md`}
                        title={isCompared ? 'Видалити з порівняння' : canAdd ? 'Додати до порівняння' : 'Максимум 4 товари'}
                        aria-label={isCompared ? 'Видалити з порівняння' : canAdd ? 'Додати до порівняння' : 'Максимум 4 товари'}
                    >
                        <ScaleIcon className="w-5 h-5" />
                    </button>
                    {showQuickView && (
                        <button
                            className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center text-gray-600 hover:bg-teal-50 hover:text-teal-600 shadow-md transition-all duration-200"
                            title="Швидкий перегляд"
                            aria-label="Швидкий перегляд товару"
                        >
                            <EyeIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Image Container */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {hasImage ? (
                        <Image
                            src={product.image_url!}
                            alt={`${product.name} - купити в TechShop за ${product.price.toLocaleString('uk-UA')} грн`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={() => setImageError(true)}
                            priority={priority}
                            loading={priority ? undefined : 'lazy'}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                            <span className="text-7xl select-none opacity-30 group-hover:scale-110 group-hover:opacity-40 transition-all duration-300">
                                {product.sku?.charAt(0)?.toUpperCase() || '📦'}
                            </span>
                        </div>
                    )}

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-white font-bold text-lg px-4 py-2 bg-black/40 rounded-xl">
                                Немає в наявності
                            </span>
                        </div>
                    )}

                    {/* Add to Cart Button - appears on hover */}
                    {!isOutOfStock && (
                        <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent transition-all duration-300 ${
                            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                        }`}>
                            <button
                                onClick={handleAddToCart}
                                disabled={isOutOfStock}
                                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                                    added
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-white text-gray-900 hover:bg-teal-500 hover:text-white'
                                }`}
                            >
                                {added ? (
                                    <>
                                        <CheckIcon className="w-5 h-5" />
                                        <span>Додано!</span>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCartIcon className="w-5 h-5" />
                                        <span>В кошик</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                    {/* SKU & Rating */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {product.sku}
                        </span>
                        <div className="flex items-center gap-1">
                            <StarSolidIcon className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-medium text-gray-700">{rating}</span>
                            <span className="text-xs text-gray-400">({reviewCount})</span>
                        </div>
                    </div>

                    {/* Product Name */}
                    <h3 className="text-base font-semibold text-gray-900 mb-3 line-clamp-2 min-h-[48px] group-hover:text-teal-600 transition-colors">
                        {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                            {hasDiscount && (
                                <span className="text-sm text-gray-400 line-through decoration-red-400">
                                    {originalPrice.toLocaleString('uk-UA')} грн
                                </span>
                            )}
                            <div className="flex items-center gap-2">
                                <span className={`text-xl font-bold ${hasDiscount ? 'text-red-600' : 'text-teal-600'}`}>
                                    {product.price.toLocaleString('uk-UA')} <span className="text-sm font-normal">грн</span>
                                </span>
                                {hasDiscount && (
                                    <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                                        -{discountPercent}%
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Stock Status */}
                        <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                            isOutOfStock
                                ? 'bg-red-100 text-red-600'
                                : isLowStock
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-teal-100 text-teal-600'
                        }`}>
                            {isOutOfStock ? 'Немає' : isLowStock ? `${product.stock} шт` : 'В наявності'}
                        </div>
                    </div>

                    {/* Mobile Add to Cart */}
                    <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock}
                        className={`lg:hidden w-full mt-3 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                            isOutOfStock
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : added
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                    >
                        {isOutOfStock ? (
                            <span>Недоступно</span>
                        ) : added ? (
                            <>
                                <CheckIcon className="w-5 h-5" />
                                <span>Додано!</span>
                            </>
                        ) : (
                            <>
                                <ShoppingCartIcon className="w-5 h-5" />
                                <span>В кошик</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Link>
    );
}

// Memoize to prevent unnecessary re-renders when parent updates
export default memo(ProductCard, (prevProps, nextProps) => {
    return prevProps.product.id === nextProps.product.id &&
           prevProps.product.price === nextProps.product.price &&
           prevProps.product.stock === nextProps.product.stock &&
           prevProps.showQuickView === nextProps.showQuickView &&
           prevProps.priority === nextProps.priority;
});
