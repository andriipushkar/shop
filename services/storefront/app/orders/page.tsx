'use client';

import { useEffect, useState } from 'react';
import { Order, getOrders } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import Link from 'next/link';
import Image from 'next/image';

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    NEW: { label: 'Новий', color: 'bg-blue-100 text-blue-700', icon: '🆕' },
    PROCESSING: { label: 'В обробці', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
    DELIVERED: { label: 'Доставлено', color: 'bg-green-100 text-green-700', icon: '✅' },
};

export default function OrdersPage() {
    const { userId } = useCart();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrders() {
            if (userId === 0) return;

            setLoading(true);
            const data = await getOrders(userId);
            setOrders(data);
            setLoading(false);
        }

        fetchOrders();
    }, [userId]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
                        ← Повернутись до товарів
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Мої замовлення</h1>
                    <p className="text-gray-600 mt-2">Історія ваших замовлень</p>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                        <div className="text-6xl mb-4">📦</div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Замовлень поки немає
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Перегляньте наші товари та зробіть перше замовлення
                        </p>
                        <Link
                            href="/"
                            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Переглянути товари
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => {
                            const status = statusConfig[order.status] || statusConfig.NEW;
                            const product = order.product;

                            return (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
                                >
                                    <div className="p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm text-gray-500">Замовлення</span>
                                                    <span className="font-mono font-medium text-gray-900">
                                                        {order.id}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-gray-500">
                                                    {formatDate(order.created_at)}
                                                </span>
                                            </div>
                                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                                                <span>{status.icon}</span>
                                                <span>{status.label}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                            {product?.image_url ? (
                                                <div className="w-16 h-16 relative rounded-lg overflow-hidden flex-shrink-0">
                                                    <Image
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        fill
                                                        sizes="64px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                                                    📦
                                                </div>
                                            )}
                                            <div className="flex-grow">
                                                <h3 className="font-semibold text-gray-900">
                                                    {product?.name || 'Товар'}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    Кількість: {order.quantity} шт.
                                                </p>
                                            </div>
                                            {product && (
                                                <div className="text-right">
                                                    <div className="font-bold text-lg text-gray-900">
                                                        {(product.price * order.quantity).toFixed(2)} грн
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {product.price.toFixed(2)} грн × {order.quantity}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
