'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { Order } from '@/lib/api';

// Generate unique idempotency key for order
function generateIdempotencyKey(userId: number, productId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${userId}-${productId}-${timestamp}-${random}`;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart, totalPrice, userId, isLoading } = useCart();

    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');
    const [promoSuccess, setPromoSuccess] = useState('');
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [error, setError] = useState('');
    const idempotencyKeysRef = useRef<Map<string, string>>(new Map());

    const discountAmount = totalPrice * (promoDiscount / 100);
    const finalPrice = totalPrice - discountAmount;

    const validatePromo = async () => {
        if (!promoCode.trim()) return;

        setIsValidatingPromo(true);
        setPromoError('');
        setPromoSuccess('');

        try {
            const res = await fetch('/api/promo/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: promoCode.trim() }),
            });

            const data = await res.json();

            if (data.valid) {
                setPromoDiscount(data.discount);
                setPromoSuccess(`Промокод застосовано! Знижка ${data.discount}%`);
            } else {
                const errorMessages: Record<string, string> = {
                    not_found: 'Промокод не знайдено',
                    inactive: 'Промокод деактивовано',
                    limit_reached: 'Ліміт використань промокоду вичерпано',
                    invalid: 'Недійсний промокод',
                    server_error: 'Помилка сервера',
                };
                setPromoError(errorMessages[data.reason] || 'Недійсний промокод');
                setPromoDiscount(0);
            }
        } catch {
            setPromoError('Помилка перевірки промокоду');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phone.trim() || !address.trim()) {
            setError('Заповніть всі поля');
            return;
        }

        if (items.length === 0) {
            setError('Кошик порожній');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const createdOrders: Order[] = [];

        try {
            for (const item of items) {
                // Get or create idempotency key for this item
                let idempotencyKey = idempotencyKeysRef.current.get(item.product.id);
                if (!idempotencyKey) {
                    idempotencyKey = generateIdempotencyKey(userId, item.product.id);
                    idempotencyKeysRef.current.set(item.product.id, idempotencyKey);
                }

                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        user_id: userId,
                        phone: phone.trim(),
                        address: address.trim(),
                        promo_code: promoDiscount > 0 ? promoCode.trim() : '',
                        discount: promoDiscount,
                        idempotency_key: idempotencyKey,
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Не вдалося створити замовлення для ${item.product.name}`);
                }

                const order = await res.json();
                createdOrders.push(order);
            }

            // Mark promo code as used
            if (promoDiscount > 0 && promoCode.trim()) {
                await fetch('/api/promo/use', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: promoCode.trim() }),
                });
            }

            setOrders(createdOrders);
            await clearCart();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Помилка оформлення');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Success screen
    if (orders.length > 0) {
        return (
            <main className="min-h-screen p-8 bg-gray-50">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Замовлення оформлено!
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Дякуємо за покупку. Ми зв&apos;яжемося з вами найближчим часом.
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                            <p className="text-sm text-gray-500 mb-2">Контактні дані:</p>
                            <p className="font-medium">{phone}</p>
                            <p className="text-gray-600">{address}</p>
                        </div>

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

                        {promoDiscount > 0 && (
                            <p className="text-green-600 mb-4">
                                Застосовано знижку {promoDiscount}%
                            </p>
                        )}

                        <div className="flex gap-4 justify-center">
                            <Link
                                href="/"
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Продовжити покупки
                            </Link>
                            <Link
                                href="/orders"
                                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Мої замовлення
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <main className="min-h-screen p-8 bg-gray-50">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-500">Завантаження...</p>
                </div>
            </main>
        );
    }

    // Empty cart
    if (items.length === 0) {
        return (
            <main className="min-h-screen p-8 bg-gray-50">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4 opacity-30">🛒</div>
                        <p className="text-gray-500 mb-6">Кошик порожній</p>
                        <Link
                            href="/"
                            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            До товарів
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-8 bg-gray-50">
            <div className="max-w-2xl mx-auto">
                <Link href="/cart" className="text-blue-600 hover:underline mb-4 inline-block">
                    ← Назад до кошика
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Оформлення замовлення</h1>

                <form onSubmit={handleSubmit}>
                    {/* Order Summary */}
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4">Ваше замовлення</h2>
                        <div className="divide-y">
                            {items.map((item) => (
                                <div key={item.product.id} className="py-3 flex justify-between">
                                    <div>
                                        <span className="font-medium">{item.product.name}</span>
                                        <span className="text-gray-500 ml-2">× {item.quantity}</span>
                                    </div>
                                    <span className="font-medium">
                                        {(item.product.price * item.quantity).toFixed(2)} UAH
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t pt-3 mt-3">
                            <div className="flex justify-between text-lg">
                                <span>Підсумок:</span>
                                <span className="font-bold">{totalPrice.toFixed(2)} UAH</span>
                            </div>
                            {promoDiscount > 0 && (
                                <>
                                    <div className="flex justify-between text-green-600">
                                        <span>Знижка ({promoDiscount}%):</span>
                                        <span>-{discountAmount.toFixed(2)} UAH</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold mt-2">
                                        <span>До сплати:</span>
                                        <span>{finalPrice.toFixed(2)} UAH</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4">Контактні дані</h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Номер телефону *
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+380991234567"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Адреса доставки *
                            </label>
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Місто, вулиця, номер будинку, квартира..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Promo Code */}
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4">Промокод</h2>

                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={promoCode}
                                onChange={(e) => {
                                    setPromoCode(e.target.value.toUpperCase());
                                    setPromoError('');
                                    setPromoSuccess('');
                                }}
                                placeholder="Введіть промокод"
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
                                disabled={promoDiscount > 0}
                            />
                            {promoDiscount > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPromoCode('');
                                        setPromoDiscount(0);
                                        setPromoSuccess('');
                                    }}
                                    className="px-6 py-3 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                                >
                                    Скасувати
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={validatePromo}
                                    disabled={isValidatingPromo || !promoCode.trim()}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    {isValidatingPromo ? '...' : 'Застосувати'}
                                </button>
                            )}
                        </div>

                        {promoError && (
                            <p className="text-red-500 text-sm mt-2">{promoError}</p>
                        )}
                        {promoSuccess && (
                            <p className="text-green-600 text-sm mt-2">{promoSuccess}</p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Оформлення...' : `Підтвердити замовлення • ${(promoDiscount > 0 ? finalPrice : totalPrice).toFixed(2)} UAH`}
                    </button>
                </form>
            </div>
        </main>
    );
}
