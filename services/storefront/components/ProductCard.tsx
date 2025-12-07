'use client';

import { Product } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import { useState } from 'react';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const { addToCart } = useCart();
    const [added, setAdded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const isOutOfStock = product.stock <= 0;
    const hasImage = product.image_url && !imageError;

    const handleAddToCart = () => {
        if (isOutOfStock) return;
        addToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
    };

    return (
        <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border border-gray-100">
            <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {hasImage ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <span className="text-6xl select-none opacity-20 group-hover:scale-110 transition-transform duration-300">
                        📦
                    </span>
                )}
                {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Немає в наявності</span>
                    </div>
                )}
            </div>

            <div className="p-6">
                <div className="mb-2 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        {product.sku}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                        isOutOfStock
                            ? 'bg-red-100 text-red-600'
                            : product.stock < 5
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-600'
                    }`}>
                        {isOutOfStock ? 'Немає' : `${product.stock} шт.`}
                    </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 truncate" title={product.name}>
                    {product.name}
                </h2>
                <div className="flex items-center justify-between mt-4">
                    <span className="text-2xl font-bold text-blue-600">
                        {product.price.toFixed(2)} <span className="text-sm font-normal text-gray-500">UAH</span>
                    </span>
                    <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            isOutOfStock
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : added
                                    ? 'bg-green-600 text-white'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {isOutOfStock ? 'Недоступно' : added ? 'Додано!' : 'В кошик'}
                    </button>
                </div>
            </div>
        </div>
    );
}
