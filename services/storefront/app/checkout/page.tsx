'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useLoyalty } from '@/lib/loyalty-context';
import { Order } from '@/lib/api';
import NovaPoshtaSelector, { DeliverySelection } from '@/components/NovaPoshtaSelector';
import PaymentSelector, { PaymentSelection, LiqPayForm } from '@/components/PaymentSelector';
import { sendOrderConfirmation } from '@/lib/email';
import { logger } from '@/lib/logger';
import {
    ArrowLeftIcon,
    TruckIcon,
    CreditCardIcon,
    CheckIcon,
    ShieldCheckIcon,
    PhoneIcon,
    UserIcon,
    EnvelopeIcon,
    TagIcon,
    SparklesIcon,
    GiftIcon,
} from '@heroicons/react/24/outline';

function generateIdempotencyKey(userId: number, productId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${userId}-${productId}-${timestamp}-${random}`;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart, totalPrice, userId, isLoading } = useCart();
    const { account, tierConfig, earnPoints, redeemPoints } = useLoyalty();
    const currentPoints = account?.currentPoints || 0;
    const currentTier = account?.tier || 'bronze';
    const spendPoints = redeemPoints;

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    // Loyalty state
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToUse, setPointsToUse] = useState(0);

    // Delivery - using new NovaPoshtaSelector
    const [deliverySelection, setDeliverySelection] = useState<DeliverySelection>({
        type: 'warehouse',
        city: null,
        warehouse: null,
        price: 0,
    });

    // Payment - using new PaymentSelector
    const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>({
        method: 'cash',
        commission: 0,
    });

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

    // LiqPay payment state
    const [showLiqPayForm, setShowLiqPayForm] = useState(false);
    const [liqPayOrderId, setLiqPayOrderId] = useState('');

    const idempotencyKeysRef = useRef<Map<string, string>>(new Map());

    const deliveryPrice = deliverySelection.price;
    const discountAmount = totalPrice * (promoDiscount / 100);
    const commission = paymentSelection.commission;
    // Loyalty discount: 1 point = 1 UAH
    const loyaltyDiscount = usePoints ? Math.min(pointsToUse, currentPoints, totalPrice - discountAmount) : 0;
    const finalPrice = totalPrice - discountAmount - loyaltyDiscount + deliveryPrice + commission;
    // Points to earn: 1 UAH = 0.1 point * tier multiplier
    const tierMultiplier = tierConfig?.[currentTier]?.pointsMultiplier || 1;
    const pointsToEarn = Math.floor((totalPrice - discountAmount - loyaltyDiscount) * 0.1 * tierMultiplier);
    // Max points that can be used (can't exceed order total after promo)
    const maxPointsToUse = Math.min(currentPoints, Math.floor(totalPrice - discountAmount));

    const handleDeliveryChange = useCallback((selection: DeliverySelection) => {
        setDeliverySelection(selection);
    }, []);

    const handlePaymentChange = useCallback((selection: PaymentSelection) => {
        setPaymentSelection(selection);
    }, []);

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

    const getDeliveryAddress = (): string => {
        if (deliverySelection.type === 'courier') {
            return `${deliverySelection.city?.Description || ''}, ${deliverySelection.address || ''}`;
        }
        if (deliverySelection.type === 'warehouse') {
            return `${deliverySelection.city?.Description || ''}, ${deliverySelection.warehouse?.Description || ''}`;
        }
        // ukrposhta
        return `${deliverySelection.city?.Description || ''}, ${deliverySelection.address || ''}`;
    };

    const getDeliveryMethodName = (): string => {
        switch (deliverySelection.type) {
            case 'warehouse':
                return 'Нова Пошта (відділення)';
            case 'courier':
                return 'Нова Пошта (кур\'єр)';
            case 'ukrposhta':
                return 'Укрпошта';
            default:
                return 'Нова Пошта';
        }
    };

    const getPaymentMethodName = (): string => {
        switch (paymentSelection.method) {
            case 'liqpay':
                return 'Картка онлайн (LiqPay)';
            case 'cash':
                return 'Готівкою при отриманні';
            case 'cod':
                return 'Накладений платіж';
            default:
                return 'Готівкою';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
            setError('Заповніть обов\'язкові поля');
            return;
        }

        if (!deliverySelection.city) {
            setError('Оберіть місто доставки');
            return;
        }

        if (deliverySelection.type === 'warehouse' && !deliverySelection.warehouse) {
            setError('Оберіть відділення Нової Пошти');
            return;
        }

        if ((deliverySelection.type === 'courier' || deliverySelection.type === 'ukrposhta') && !deliverySelection.address) {
            setError('Вкажіть адресу доставки');
            return;
        }

        if (items.length === 0) {
            setError('Кошик порожній');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const createdOrders: Order[] = [];
        const fullAddress = getDeliveryAddress();

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
                        delivery_method: deliverySelection.type,
                        payment_method: paymentSelection.method,
                        promo_code: promoDiscount > 0 ? promoCode.trim() : '',
                        discount: promoDiscount,
                        comment: comment.trim(),
                        idempotency_key: idempotencyKey,
                        delivery_price: deliveryPrice,
                        cod_commission: commission,
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

            // Handle loyalty points
            const orderIdStr = createdOrders.map(o => o.id).join(', ');
            if (loyaltyDiscount > 0) {
                spendPoints(loyaltyDiscount, `Замовлення ${orderIdStr}`);
            }
            if (pointsToEarn > 0) {
                // earnPoints(orderId, orderAmount, description)
                earnPoints(orderIdStr, finalPrice, `Замовлення ${orderIdStr}`);
            }

            // Send order confirmation email
            if (email.trim()) {
                try {
                    await sendOrderConfirmation({
                        orderId: createdOrders.map(o => o.id).join(', '),
                        customerName: `${firstName} ${lastName}`,
                        customerEmail: email.trim(),
                        customerPhone: phone.trim(),
                        items: items.map(item => ({
                            name: item.product.name,
                            quantity: item.quantity,
                            price: item.product.price,
                        })),
                        subtotal: totalPrice,
                        deliveryPrice: deliveryPrice,
                        total: finalPrice,
                        deliveryType: deliverySelection.type,
                        deliveryAddress: fullAddress,
                        paymentMethod: getPaymentMethodName(),
                    });
                } catch (emailError) {
                    logger.error('Failed to send confirmation email', emailError);
                }
            }

            // If LiqPay payment selected, show payment form
            if (paymentSelection.method === 'liqpay') {
                setLiqPayOrderId(createdOrders.map(o => o.id).join('-'));
                setOrders(createdOrders);
                setShowLiqPayForm(true);
            } else {
                setOrders(createdOrders);
                await clearCart();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Помилка оформлення');
        } finally {
            setIsSubmitting(false);
        }
    };

    // LiqPay Payment Screen
    if (showLiqPayForm && orders.length > 0) {
        return (
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="bg-white rounded-2xl shadow-sm p-8">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CreditCardIcon className="w-8 h-8 text-green-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                Оплата замовлення
                            </h1>
                            <p className="text-gray-500">
                                Натисніть кнопку нижче для переходу до оплати
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600">Замовлення:</span>
                                <span className="font-mono text-sm">{liqPayOrderId}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">До сплати:</span>
                                <span className="text-xl font-bold text-gray-900">{finalPrice.toLocaleString()} грн</span>
                            </div>
                        </div>

                        <LiqPayForm
                            orderId={liqPayOrderId}
                            amount={finalPrice}
                            description={`Замовлення ${liqPayOrderId}`}
                            customerEmail={email}
                            customerPhone={phone}
                            customerName={`${firstName} ${lastName}`}
                        />

                        <button
                            onClick={async () => {
                                await clearCart();
                                router.push('/orders');
                            }}
                            className="w-full mt-4 py-3 text-gray-600 hover:text-gray-900 text-sm"
                        >
                            Оплатити пізніше
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // Success screen
    if (orders.length > 0 && !showLiqPayForm) {
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
                            {email && (
                                <div className="flex items-center gap-3">
                                    <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                                    <span>{email}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <TruckIcon className="w-5 h-5 text-gray-400" />
                                <span>{getDeliveryMethodName()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CreditCardIcon className="w-5 h-5 text-gray-400" />
                                <span>{getPaymentMethodName()}</span>
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

                        <div className="mt-6 pt-6 border-t">
                            <p className="text-sm text-gray-500 mb-3">
                                Після відправки ви зможете відстежити посилку:
                            </p>
                            <Link
                                href="/tracking"
                                className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
                            >
                                <TruckIcon className="w-5 h-5" />
                                Відстежити посилку за ТТН
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

                            {/* Delivery Method - Nova Poshta Selector */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <NovaPoshtaSelector
                                    cartTotal={totalPrice - discountAmount}
                                    onSelectionChange={handleDeliveryChange}
                                />
                            </div>

                            {/* Payment Method */}
                            <div className="bg-white rounded-2xl shadow-sm p-6">
                                <PaymentSelector
                                    cartTotal={totalPrice - discountAmount}
                                    deliveryPrice={deliveryPrice}
                                    onSelectionChange={handlePaymentChange}
                                />
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
                                            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                                {item.product.image_url ? (
                                                    <Image
                                                        src={item.product.image_url}
                                                        alt={item.product.name}
                                                        fill
                                                        sizes="64px"
                                                        className="object-cover"
                                                    />
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

                                {/* Loyalty Points */}
                                {currentPoints > 0 && (
                                    <div className="mb-6 pb-6 border-b">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <SparklesIcon className="w-5 h-5 text-amber-500" />
                                                <span className="font-medium text-gray-900">Бонусні бали</span>
                                            </div>
                                            <span className="text-sm text-gray-600">
                                                Доступно: <span className="font-semibold text-amber-600">{currentPoints}</span> балів
                                            </span>
                                        </div>

                                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                                            <input
                                                type="checkbox"
                                                checked={usePoints}
                                                onChange={(e) => {
                                                    setUsePoints(e.target.checked);
                                                    if (e.target.checked) {
                                                        setPointsToUse(maxPointsToUse);
                                                    } else {
                                                        setPointsToUse(0);
                                                    }
                                                }}
                                                className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                            />
                                            <span className="text-sm text-gray-700">
                                                Використати бали (1 бал = 1 грн)
                                            </span>
                                        </label>

                                        {usePoints && (
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={maxPointsToUse}
                                                    value={pointsToUse}
                                                    onChange={(e) => setPointsToUse(Number(e.target.value))}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <span className="text-sm font-semibold text-amber-600 min-w-[60px] text-right">
                                                    -{pointsToUse} грн
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Points to Earn */}
                                {pointsToEarn > 0 && (
                                    <div className="mb-6 pb-6 border-b bg-amber-50 -mx-6 px-6 py-4">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <GiftIcon className="w-5 h-5" />
                                            <span className="text-sm">
                                                За це замовлення ви отримаєте <span className="font-bold">+{pointsToEarn}</span> балів
                                                {tierMultiplier > 1 && (
                                                    <span className="text-xs ml-1">(x{tierMultiplier} {currentTier})</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}

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
                                    {loyaltyDiscount > 0 && (
                                        <div className="flex justify-between text-amber-600">
                                            <span>Бонусні бали</span>
                                            <span>-{loyaltyDiscount.toFixed(0)} грн</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-gray-600">
                                        <span>Доставка</span>
                                        <span className={deliveryPrice === 0 ? 'text-teal-600' : ''}>
                                            {deliveryPrice === 0 ? 'Безкоштовно' : `${deliveryPrice} грн`}
                                        </span>
                                    </div>
                                    {commission > 0 && (
                                        <div className="flex justify-between text-orange-600">
                                            <span>Комісія НП</span>
                                            <span>+{commission} грн</span>
                                        </div>
                                    )}
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
                                    {isSubmitting ? 'Оформлення...' : paymentSelection.method === 'liqpay' ? 'Перейти до оплати' : 'Підтвердити замовлення'}
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
