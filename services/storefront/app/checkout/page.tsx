'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { Order } from '@/lib/api';
import {
    ArrowLeftIcon,
    TruckIcon,
    BuildingStorefrontIcon,
    CreditCardIcon,
    BanknotesIcon,
    CheckIcon,
    ShieldCheckIcon,
    ClockIcon,
    MapPinIcon,
    PhoneIcon,
    UserIcon,
    EnvelopeIcon,
    TagIcon,
} from '@heroicons/react/24/outline';

// Delivery options
const deliveryOptions = [
    {
        id: 'nova_poshta',
        name: 'Нова Пошта',
        description: 'Доставка у відділення',
        price: 0,
        freeFrom: 1000,
        time: '1-3 дні',
        icon: '🚚',
    },
    {
        id: 'nova_poshta_courier',
        name: 'Нова Пошта Кур\'єр',
        description: 'Доставка за адресою',
        price: 70,
        freeFrom: 2000,
        time: '1-2 дні',
        icon: '🏃',
    },
    {
        id: 'ukrposhta',
        name: 'Укрпошта',
        description: 'Економна доставка',
        price: 45,
        freeFrom: 1500,
        time: '3-7 днів',
        icon: '📮',
    },
    {
        id: 'pickup',
        name: 'Самовивіз',
        description: 'м. Київ, вул. Хрещатик, 1',
        price: 0,
        freeFrom: 0,
        time: 'Сьогодні',
        icon: '🏪',
    },
];

// Payment options
const paymentOptions = [
    {
        id: 'card_online',
        name: 'Картка онлайн',
        description: 'Visa, Mastercard, Google Pay, Apple Pay',
        icon: CreditCardIcon,
    },
    {
        id: 'liqpay',
        name: 'LiqPay',
        description: 'Оплата через LiqPay',
        icon: CreditCardIcon,
    },
    {
        id: 'privat24',
        name: 'Приват24',
        description: 'Оплата через Приват24',
        icon: CreditCardIcon,
    },
    {
        id: 'cash',
        name: 'Накладений платіж',
        description: 'Оплата при отриманні',
        icon: BanknotesIcon,
    },
];

function generateIdempotencyKey(userId: number, productId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${userId}-${productId}-${timestamp}-${random}`;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart, totalPrice, userId, isLoading } = useCart();

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    // Delivery
    const [deliveryMethod, setDeliveryMethod] = useState('nova_poshta');
    const [city, setCity] = useState('');
    const [warehouse, setWarehouse] = useState('');
    const [address, setAddress] = useState('');

    // Payment
    const [paymentMethod, setPaymentMethod] = useState('card_online');

    // Promo
    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');
    const [promoSuccess, setPromoSuccess] = useState('');
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    // Submit state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [error, setError] = useState('');
    const [comment, setComment] = useState('');

    const idempotencyKeysRef = useRef<Map<string, string>>(new Map());

    const selectedDelivery = deliveryOptions.find(d => d.id === deliveryMethod);
    const deliveryPrice = selectedDelivery && totalPrice >= selectedDelivery.freeFrom ? 0 : (selectedDelivery?.price || 0);
    const discountAmount = totalPrice * (promoDiscount / 100);
    const finalPrice = totalPrice - discountAmount + deliveryPrice;

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
                setPromoSuccess(`Знижка ${data.discount}% застосована!`);
            } else {
                const errorMessages: Record<string, string> = {
                    not_found: 'Промокод не знайдено',
                    inactive: 'Промокод деактивовано',
                    limit_reached: 'Ліміт використань вичерпано',
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

        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
            setError('Заповніть обов\'язкові поля');
            return;
        }

        if (deliveryMethod !== 'pickup' && !city.trim()) {
            setError('Вкажіть місто доставки');
            return;
        }

        if (items.length === 0) {
            setError('Кошик порожній');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const createdOrders: Order[] = [];
        const fullAddress = deliveryMethod === 'pickup'
            ? 'Самовивіз: м. Київ, вул. Хрещатик, 1'
            : deliveryMethod.includes('courier')
                ? `${city}, ${address}`
                : `${city}, ${warehouse}`;

        try {
            for (const item of items) {
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
                        customer_name: `${firstName} ${lastName}`,
                        phone: phone.trim(),
                        email: email.trim(),
                        address: fullAddress,
                        delivery_method: deliveryMethod,
                        payment_method: paymentMethod,
                        promo_code: promoDiscount > 0 ? promoCode.trim() : '',
                        discount: promoDiscount,
                        comment: comment.trim(),
                        idempotency_key: idempotencyKey,
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Не вдалося створити замовлення для ${item.product.name}`);
                }

                const order = await res.json();
                createdOrders.push(order);
            }

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
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckIcon className="w-10 h-10 text-teal-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Замовлення оформлено!
                        </h1>
                        <p className="text-gray-500 mb-8">
                            Дякуємо за покупку. Ми зв&apos;яжемося з вами найближчим часом.
                        </p>

                        <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left space-y-3">
                            <div className="flex items-center gap-3">
                                <UserIcon className="w-5 h-5 text-gray-400" />
                                <span>{firstName} {lastName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <PhoneIcon className="w-5 h-5 text-gray-400" />
                                <span>{phone}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <TruckIcon className="w-5 h-5 text-gray-400" />
                                <span>{selectedDelivery?.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CreditCardIcon className="w-5 h-5 text-gray-400" />
                                <span>{paymentOptions.find(p => p.id === paymentMethod)?.name}</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <p className="text-sm text-gray-500">Номери замовлень:</p>
                            {orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-teal-50 rounded-lg p-3 text-sm"
                                >
                                    <span className="font-mono text-teal-700 font-semibold">{order.id}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/"
                                className="bg-teal-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                            >
                                Продовжити покупки
                            </Link>
                            <Link
                                href="/orders"
                                className="bg-gray-100 text-gray-700 px-8 py-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
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
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-500">Завантаження...</p>
                </div>
            </main>
        );
    }

    // Empty cart
    if (items.length === 0) {
        return (
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4 opacity-30">🛒</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Кошик порожній</h2>
                        <p className="text-gray-500 mb-8">Додайте товари, щоб оформити замовлення</p>
                        <Link
                            href="/"
                            className="inline-block bg-teal-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                        >
                            Перейти до каталогу
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/cart" className="inline-flex items-center gap-2 text-gray-600 hover:text-teal-600 mb-4">
                        <ArrowLeftIcon className="w-4 h-4" />
                        Назад до кошика
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Оформлення замовлення</h1>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Left Column - Forms */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Contact Info */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <UserIcon className="w-6 h-6 text-teal-600" />
                                    Контактні дані
                                </h2>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Ім&apos;я *
                                        </label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Іван"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Прізвище *
                                        </label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Петренко"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Телефон *
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+380 99 123 45 67"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="email@example.com"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Method */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <TruckIcon className="w-6 h-6 text-teal-600" />
                                    Спосіб доставки
                                </h2>

                                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                                    {deliveryOptions.map((option) => (
                                        <label
                                            key={option.id}
                                            className={`relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                                deliveryMethod === option.id
                                                    ? 'border-teal-500 bg-teal-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="delivery"
                                                value={option.id}
                                                checked={deliveryMethod === option.id}
                                                onChange={(e) => setDeliveryMethod(e.target.value)}
                                                className="sr-only"
                                            />
                                            <span className="text-2xl">{option.icon}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-gray-900">{option.name}</span>
                                                    {option.price === 0 || totalPrice >= option.freeFrom ? (
                                                        <span className="text-teal-600 text-sm font-medium">Безкоштовно</span>
                                                    ) : (
                                                        <span className="text-gray-600 text-sm">{option.price} грн</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {option.time}
                                                </div>
                                            </div>
                                            {deliveryMethod === option.id && (
                                                <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                                                    <CheckIcon className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>

                                {/* Delivery Address Fields */}
                                {deliveryMethod !== 'pickup' && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Місто *
                                            </label>
                                            <input
                                                type="text"
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)}
                                                placeholder="Київ"
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                                required
                                            />
                                        </div>
                                        {deliveryMethod.includes('courier') ? (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Адреса доставки *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={address}
                                                    onChange={(e) => setAddress(e.target.value)}
                                                    placeholder="вул. Хрещатик, 1, кв. 10"
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                                    required
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Відділення / Поштомат *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={warehouse}
                                                    onChange={(e) => setWarehouse(e.target.value)}
                                                    placeholder="Відділення №1"
                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {deliveryMethod === 'pickup' && (
                                    <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-xl">
                                        <MapPinIcon className="w-5 h-5 text-teal-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-gray-900">Адреса самовивозу</p>
                                            <p className="text-sm text-gray-600">м. Київ, вул. Хрещатик, 1</p>
                                            <p className="text-sm text-gray-500 mt-1">Пн-Пт: 9:00-20:00, Сб-Нд: 10:00-18:00</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Method */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <CreditCardIcon className="w-6 h-6 text-teal-600" />
                                    Спосіб оплати
                                </h2>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {paymentOptions.map((option) => (
                                        <label
                                            key={option.id}
                                            className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                                paymentMethod === option.id
                                                    ? 'border-teal-500 bg-teal-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment"
                                                value={option.id}
                                                checked={paymentMethod === option.id}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="sr-only"
                                            />
                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                                <option.icon className="w-5 h-5 text-gray-600" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold text-gray-900">{option.name}</span>
                                                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                                            </div>
                                            {paymentMethod === option.id && (
                                                <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                                                    <CheckIcon className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Comment */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">Коментар до замовлення</h2>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Додаткові побажання..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Right Column - Order Summary */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Ваше замовлення</h2>

                                {/* Products */}
                                <div className="space-y-4 mb-6">
                                    {items.map((item) => (
                                        <div key={item.product.id} className="flex gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {item.product.image_url ? (
                                                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-2xl opacity-30">📦</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 text-sm line-clamp-2">{item.product.name}</p>
                                                <p className="text-gray-500 text-sm mt-1">{item.quantity} шт.</p>
                                            </div>
                                            <p className="font-semibold text-gray-900 whitespace-nowrap">
                                                {(item.product.price * item.quantity).toFixed(0)} грн
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Promo Code */}
                                <div className="mb-6 pb-6 border-b">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={(e) => {
                                                    setPromoCode(e.target.value.toUpperCase());
                                                    setPromoError('');
                                                    setPromoSuccess('');
                                                }}
                                                placeholder="Промокод"
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm uppercase"
                                                disabled={promoDiscount > 0}
                                            />
                                        </div>
                                        {promoDiscount > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPromoCode('');
                                                    setPromoDiscount(0);
                                                    setPromoSuccess('');
                                                }}
                                                className="px-4 py-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium hover:bg-red-200"
                                            >
                                                ✕
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={validatePromo}
                                                disabled={isValidatingPromo || !promoCode.trim()}
                                                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                                            >
                                                OK
                                            </button>
                                        )}
                                    </div>
                                    {promoError && <p className="text-red-500 text-sm mt-2">{promoError}</p>}
                                    {promoSuccess && <p className="text-teal-600 text-sm mt-2">{promoSuccess}</p>}
                                </div>

                                {/* Totals */}
                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Товари</span>
                                        <span>{totalPrice.toFixed(0)} грн</span>
                                    </div>
                                    {promoDiscount > 0 && (
                                        <div className="flex justify-between text-teal-600">
                                            <span>Знижка ({promoDiscount}%)</span>
                                            <span>-{discountAmount.toFixed(0)} грн</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-gray-600">
                                        <span>Доставка</span>
                                        <span className={deliveryPrice === 0 ? 'text-teal-600' : ''}>
                                            {deliveryPrice === 0 ? 'Безкоштовно' : `${deliveryPrice} грн`}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-4 border-t border-b mb-6">
                                    <span className="text-lg font-semibold text-gray-900">До сплати</span>
                                    <span className="text-2xl font-bold text-teal-600">{finalPrice.toFixed(0)} грн</span>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm">
                                        {error}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Оформлення...' : 'Підтвердити замовлення'}
                                </button>

                                {/* Security Info */}
                                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
                                    <ShieldCheckIcon className="w-4 h-4" />
                                    <span>Безпечна оплата</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
