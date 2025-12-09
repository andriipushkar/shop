'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function CartPage() {
    const { items, updateQuantity, removeFromCart, clearCart, totalPrice, isLoading } = useCart();

    if (isLoading) {
        return (
            <main className="min-h-screen p-8 bg-gray-50">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-500">Завантаження кошика...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-8 bg-gray-50">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Кошик</h1>

                {items.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4 opacity-30">🛒</div>
                        <p className="text-gray-500 mb-6">Ваш кошик порожній</p>
                        <Link
                            href="/"
                            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            До товарів
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl shadow-sm divide-y">
                            {items.map((item) => (
                                <div
                                    key={item.product.id}
                                    className="p-6 flex items-center gap-6"
                                >
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {item.product.image_url ? (
                                            <img
                                                src={item.product.image_url}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-3xl opacity-30">📦</span>
                                        )}
                                    </div>

                                    <div className="flex-grow">
                                        <Link
                                            href={`/product/${item.product.id}`}
                                            className="font-semibold text-gray-900 hover:text-blue-600"
                                        >
                                            {item.product.name}
                                        </Link>
                                        {item.product.sku && (
                                            <p className="text-sm text-gray-500">{item.product.sku}</p>
                                        )}
                                        <p className="text-blue-600 font-bold mt-1">
                                            {item.product.price.toFixed(2)} UAH
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                        >
                                            −
                                        </button>
                                        <span className="w-8 text-center font-medium">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">
                                            {(item.product.price * item.quantity).toFixed(2)} UAH
                                        </p>
                                        <button
                                            onClick={() => removeFromCart(item.product.id)}
                                            className="text-sm text-red-500 hover:text-red-700 mt-1"
                                        >
                                            Видалити
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-xl text-gray-600">Всього:</span>
                                <span className="text-3xl font-bold text-gray-900">
                                    {totalPrice.toFixed(2)} UAH
                                </span>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => clearCart()}
                                    className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Очистити кошик
                                </button>
                                <Link
                                    href="/checkout"
                                    className="flex-1 bg-green-600 text-white py-4 rounded-lg font-bold text-center hover:bg-green-700 transition-colors"
                                >
                                    Оформити замовлення
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
