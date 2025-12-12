'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ShoppingBagIcon,
    TruckIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    MapPinIcon,
    CreditCardIcon,
    PhoneIcon,
    EnvelopeIcon,
    ArrowPathIcon,
    DocumentDuplicateIcon,
    PrinterIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

// Mock order data - same as in orders list
const mockOrders: Record<string, {
    id: string;
    date: string;
    status: string;
    total: number;
    subtotal: number;
    shipping: number;
    discount: number;
    items: { id: number; name: string; quantity: number; price: number; sku: string }[];
    delivery: { method: string; address: string; city: string; ttn: string | null };
    payment: { method: string; status: string; transactionId: string | null };
    customer: { name: string; phone: string; email: string };
    history: { date: string; status: string; description: string }[];
    notes: string | null;
}> = {
    '12350': {
        id: '12350',
        date: '2024-01-15T10:30:00',
        status: 'delivered',
        total: 65499,
        subtotal: 64998,
        shipping: 0,
        discount: -499,
        items: [
            { id: 1, name: 'iPhone 15 Pro Max 256GB', quantity: 1, price: 54999, sku: 'APL-IP15PM-256' },
            { id: 2, name: 'Apple AirPods Pro 2', quantity: 1, price: 9999, sku: 'APL-APP2-WHT' },
        ],
        delivery: {
            method: 'Нова Пошта',
            address: 'Відділення №25: вул. Хрещатик, 22',
            city: 'Київ',
            ttn: '20450000012345',
        },
        payment: {
            method: 'LiqPay',
            status: 'paid',
            transactionId: 'LP-789456123',
        },
        customer: {
            name: 'Олександр Ковальчук',
            phone: '+380 67 123 45 67',
            email: 'o.kovalchuk@gmail.com',
        },
        history: [
            { date: '2024-01-15T10:30:00', status: 'new', description: 'Замовлення створено' },
            { date: '2024-01-15T10:31:00', status: 'paid', description: 'Оплата підтверджена (LiqPay)' },
            { date: '2024-01-15T11:45:00', status: 'processing', description: 'Замовлення передано на склад' },
            { date: '2024-01-15T14:20:00', status: 'shipped', description: 'Відправлено. ТТН: 20450000012345' },
            { date: '2024-01-17T09:15:00', status: 'arrived', description: 'Прибуло у відділення' },
            { date: '2024-01-17T16:30:00', status: 'delivered', description: 'Отримано клієнтом' },
        ],
        notes: 'Будь ласка, зателефонуйте перед доставкою',
    },
    '12349': {
        id: '12349',
        date: '2024-01-10T14:20:00',
        status: 'shipped',
        total: 32999,
        subtotal: 32999,
        shipping: 0,
        discount: 0,
        items: [
            { id: 3, name: 'Samsung Galaxy S24 Ultra', quantity: 1, price: 32999, sku: 'SAM-GS24U-256' },
        ],
        delivery: {
            method: 'Нова Пошта',
            address: 'Поштомат №112: вул. Личаківська, 45',
            city: 'Львів',
            ttn: '20450000012344',
        },
        payment: {
            method: 'Готівка (COD)',
            status: 'pending',
            transactionId: null,
        },
        customer: {
            name: 'Марія Шевченко',
            phone: '+380 50 987 65 43',
            email: 'm.shevchenko@ukr.net',
        },
        history: [
            { date: '2024-01-10T14:20:00', status: 'new', description: 'Замовлення створено' },
            { date: '2024-01-10T15:00:00', status: 'processing', description: 'Замовлення підтверджено' },
            { date: '2024-01-11T10:30:00', status: 'shipped', description: 'Відправлено. ТТН: 20450000012344' },
        ],
        notes: null,
    },
};

const statusConfig = {
    new: { label: 'Нове', color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
    processing: { label: 'В обробці', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
    shipped: { label: 'Відправлено', color: 'bg-purple-100 text-purple-700', icon: TruckIcon },
    delivered: { label: 'Доставлено', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
    cancelled: { label: 'Скасовано', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
};

const timelineStatusConfig: Record<string, { color: string; bgColor: string }> = {
    new: { color: 'text-blue-600', bgColor: 'bg-blue-600' },
    paid: { color: 'text-green-600', bgColor: 'bg-green-600' },
    processing: { color: 'text-yellow-600', bgColor: 'bg-yellow-600' },
    shipped: { color: 'text-purple-600', bgColor: 'bg-purple-600' },
    arrived: { color: 'text-teal-600', bgColor: 'bg-teal-600' },
    delivered: { color: 'text-green-600', bgColor: 'bg-green-600' },
    cancelled: { color: 'text-red-600', bgColor: 'bg-red-600' },
};

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const order = mockOrders[orderId];
    const [copied, setCopied] = useState(false);

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Замовлення не знайдено</h3>
                        <p className="text-gray-500 mb-6">Замовлення #{orderId} не існує або було видалено</p>
                        <Link
                            href="/profile/orders"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            До списку замовлень
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const status = statusConfig[order.status as keyof typeof statusConfig];
    const StatusIcon = status.icon;

    const handleCopyTTN = () => {
        if (order.delivery.ttn) {
            navigator.clipboard.writeText(order.delivery.ttn);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleReorder = () => {
        alert(`Товари з замовлення #${order.id} додано до кошика`);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <nav className="text-sm text-gray-500 mb-2">
                        <Link href="/" className="hover:text-teal-600">Головна</Link>
                        <span className="mx-2">/</span>
                        <Link href="/profile" className="hover:text-teal-600">Профіль</Link>
                        <span className="mx-2">/</span>
                        <Link href="/profile/orders" className="hover:text-teal-600">Мої замовлення</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">#{order.id}</span>
                    </nav>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                Замовлення #{order.id}
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                                    <StatusIcon className="w-4 h-4" />
                                    {status.label}
                                </span>
                            </h1>
                            <p className="text-gray-600">
                                від {new Date(order.date).toLocaleDateString('uk-UA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <PrinterIcon className="w-4 h-4" />
                                Друк
                            </button>
                            {(order.status === 'delivered' || order.status === 'cancelled') && (
                                <button
                                    onClick={handleReorder}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                >
                                    <ArrowPathIcon className="w-4 h-4" />
                                    Повторити
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order items */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900">Товари</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {order.items.map((item) => (
                                    <div key={item.id} className="p-4 flex items-center gap-4">
                                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                                            <p className="text-sm text-gray-500">Артикул: {item.sku}</p>
                                            <p className="text-sm text-gray-500">Кількість: {item.quantity}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{item.price.toLocaleString()} ₴</p>
                                            {item.quantity > 1 && (
                                                <p className="text-sm text-gray-500">
                                                    {(item.price * item.quantity).toLocaleString()} ₴
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Totals */}
                            <div className="p-4 bg-gray-50 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Підсумок</span>
                                    <span className="text-gray-900">{order.subtotal.toLocaleString()} ₴</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Доставка</span>
                                    <span className="text-gray-900">
                                        {order.shipping === 0 ? 'Безкоштовно' : `${order.shipping.toLocaleString()} ₴`}
                                    </span>
                                </div>
                                {order.discount !== 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Знижка</span>
                                        <span className="text-green-600">{order.discount.toLocaleString()} ₴</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                                    <span className="text-gray-900">Всього</span>
                                    <span className="text-gray-900">{order.total.toLocaleString()} ₴</span>
                                </div>
                            </div>
                        </div>

                        {/* Order history timeline */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900">Історія замовлення</h2>
                            </div>
                            <div className="p-4">
                                <div className="relative">
                                    {order.history.map((event, index) => {
                                        const eventConfig = timelineStatusConfig[event.status] || timelineStatusConfig.new;
                                        const isLast = index === order.history.length - 1;
                                        return (
                                            <div key={index} className="flex gap-4 pb-6 last:pb-0">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full ${eventConfig.bgColor}`} />
                                                    {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                                                </div>
                                                <div className="flex-1 min-w-0 -mt-1">
                                                    <p className="font-medium text-gray-900">{event.description}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {new Date(event.date).toLocaleDateString('uk-UA', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Delivery info */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <TruckIcon className="w-5 h-5 text-gray-400" />
                                    Доставка
                                </h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <p className="text-sm text-gray-500">Спосіб</p>
                                    <p className="font-medium text-gray-900">{order.delivery.method}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Адреса</p>
                                    <p className="text-gray-900">{order.delivery.city}</p>
                                    <p className="text-gray-900">{order.delivery.address}</p>
                                </div>
                                {order.delivery.ttn && (
                                    <div>
                                        <p className="text-sm text-gray-500">Номер ТТН</p>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-teal-600">{order.delivery.ttn}</span>
                                            <button
                                                onClick={handleCopyTTN}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                                title="Копіювати"
                                            >
                                                <DocumentDuplicateIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {copied && (
                                            <p className="text-xs text-green-600 mt-1">Скопійовано!</p>
                                        )}
                                        <Link
                                            href={`/tracking?ttn=${order.delivery.ttn}`}
                                            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mt-2"
                                        >
                                            <MapPinIcon className="w-4 h-4" />
                                            Відстежити посилку
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment info */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <CreditCardIcon className="w-5 h-5 text-gray-400" />
                                    Оплата
                                </h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <p className="text-sm text-gray-500">Спосіб</p>
                                    <p className="font-medium text-gray-900">{order.payment.method}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Статус</p>
                                    <p className={`font-medium ${
                                        order.payment.status === 'paid' ? 'text-green-600' :
                                        order.payment.status === 'pending' ? 'text-yellow-600' :
                                        'text-red-600'
                                    }`}>
                                        {order.payment.status === 'paid' ? 'Сплачено' :
                                         order.payment.status === 'pending' ? 'Очікує оплати' :
                                         'Повернено'}
                                    </p>
                                </div>
                                {order.payment.transactionId && (
                                    <div>
                                        <p className="text-sm text-gray-500">ID транзакції</p>
                                        <p className="font-mono text-sm text-gray-900">{order.payment.transactionId}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer notes */}
                        {order.notes && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <h3 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                                    Примітка
                                </h3>
                                <p className="text-amber-700 text-sm">{order.notes}</p>
                            </div>
                        )}

                        {/* Contact info */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900">Контактні дані</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                        <span className="text-teal-600 font-medium">
                                            {order.customer.name.charAt(0)}
                                        </span>
                                    </div>
                                    <span className="font-medium text-gray-900">{order.customer.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                                    {order.customer.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                                    {order.customer.email}
                                </div>
                            </div>
                        </div>

                        {/* Help */}
                        <div className="bg-gray-100 rounded-xl p-4">
                            <h3 className="font-medium text-gray-900 mb-2">Потрібна допомога?</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Якщо у вас є питання щодо замовлення, зверніться до нашої служби підтримки.
                            </p>
                            <Link
                                href="/support"
                                className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                            >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                Написати в підтримку
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Back link */}
                <div className="mt-8">
                    <Link
                        href="/profile/orders"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Повернутися до списку замовлень
                    </Link>
                </div>
            </div>
        </div>
    );
}
