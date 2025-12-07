'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { Order } from '@/lib/api';

export default function CartPage() {
    const { items, updateQuantity, removeFromCart, clearCart, totalPrice, userId } = useCart();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async () => {
        if (items.length === 0) return;

        setIsCheckingOut(true);
        setError(null);
        const createdOrders: Order[] = [];

        try {
            for (const item of items) {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        user_id: userId,
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Failed to create order for ${item.product.name}`);
                }

                const order = await res.json();
                createdOrders.push(order);
            }

            setOrders(createdOrders);
            clearCart();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to checkout');
        } finally {
            setIsCheckingOut(false);
        }
    };

    if (orders.length > 0) {
        return (
            <main className="min-h-screen p-8 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Замовлення оформлено!
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Дякуємо за покупку. Ваші замовлення:
                        </p>
                        <div className="space-y-2 mb-8">
                            {orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-gray-50 rounded-lg p-3 text-sm"
                                >
                                    <span className="font-mono text-blue-600">{order.id}</span>
                                    <span className="text-gray-500 ml-2">— {order.status}</span>
                                </div>
                            ))}
                        </div>
                        <Link
                            href="/"
                            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            Продовжити покупки
                        </Link>
                    </div>
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
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-3xl opacity-30">📦</span>
                                    </div>

                                    <div className="flex-grow">
                                        <h3 className="font-semibold text-gray-900">
                                            {item.product.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">{item.product.sku}</p>
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

                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleCheckout}
                                disabled={isCheckingOut}
                                className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isCheckingOut ? 'Оформлення...' : 'Оформити замовлення'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
