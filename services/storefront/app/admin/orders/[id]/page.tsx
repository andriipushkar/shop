'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    PrinterIcon,
    TruckIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    MapPinIcon,
    PhoneIcon,
    EnvelopeIcon,
    UserIcon,
    CreditCardIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

// Mock order data
const orderData = {
    id: '#12350',
    date: '10.12.2024 15:30',
    status: 'processing',
    payment: {
        status: 'paid',
        method: 'LiqPay',
        date: '10.12.2024 15:35',
    },
    customer: {
        name: 'Олександр Ковальчук',
        email: 'o.kovalchuk@gmail.com',
        phone: '+380 67 123 4567',
        isRegistered: true,
        ordersCount: 5,
    },
    delivery: {
        method: 'Нова Пошта',
        type: 'Відділення',
        city: 'Київ',
        address: 'Відділення №25, вул. Хрещатик, 22',
        trackingNumber: '20450000012345',
        estimatedDate: '12.12.2024',
    },
    items: [
        { id: 1, name: 'iPhone 15 Pro Max 256GB', sku: 'IPHONE-15-PRO-256', price: 54999, quantity: 1, image: '/products/iphone.jpg' },
        { id: 2, name: 'Apple AirPods Pro 2', sku: 'AIRPODS-PRO-2', price: 9999, quantity: 2, image: '/products/airpods.jpg' },
        { id: 3, name: 'Чохол для iPhone 15 Pro Max', sku: 'CASE-IPHONE-15-PRO', price: 699, quantity: 1, image: '/products/case.jpg' },
    ],
    subtotal: 75696,
    discount: 5000,
    discountCode: 'WINTER2024',
    shipping: 0,
    total: 70696,
    notes: 'Будь ласка, зателефонуйте перед доставкою',
    history: [
        { date: '10.12.2024 15:30', event: 'Замовлення створено', user: 'Клієнт' },
        { date: '10.12.2024 15:35', event: 'Оплата підтверджена', user: 'Система' },
        { date: '10.12.2024 16:00', event: 'Замовлення прийнято в обробку', user: 'Адмін' },
    ],
};

const statusSteps = [
    { id: 'new', name: 'Нове', icon: ClockIcon },
    { id: 'processing', name: 'В обробці', icon: ClockIcon },
    { id: 'shipped', name: 'Відправлено', icon: TruckIcon },
    { id: 'delivered', name: 'Доставлено', icon: CheckCircleIcon },
];

export default function OrderDetailPage() {
    const [order] = useState(orderData);
    const [newStatus, setNewStatus] = useState(order.status);

    const currentStatusIndex = statusSteps.findIndex(s => s.id === order.status);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'processing': return 'bg-yellow-100 text-yellow-800';
            case 'shipped': return 'bg-purple-100 text-purple-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'new': return 'Нове';
            case 'processing': return 'В обробці';
            case 'shipped': return 'Відправлено';
            case 'delivered': return 'Доставлено';
            case 'cancelled': return 'Скасовано';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/orders"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">Замовлення {order.id}</h1>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                            </span>
                        </div>
                        <p className="text-gray-600">{order.date}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <PrinterIcon className="w-5 h-5" />
                        Друк
                    </button>
                    <button className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <DocumentTextIcon className="w-5 h-5" />
                        Накладна
                    </button>
                </div>
            </div>

            {/* Status timeline */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Статус замовлення</h2>
                <div className="flex items-center justify-between">
                    {statusSteps.map((step, index) => (
                        <div key={step.id} className="flex-1 flex items-center">
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    index <= currentStatusIndex
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-gray-200 text-gray-400'
                                }`}>
                                    <step.icon className="w-5 h-5" />
                                </div>
                                <span className={`mt-2 text-sm font-medium ${
                                    index <= currentStatusIndex ? 'text-teal-600' : 'text-gray-400'
                                }`}>
                                    {step.name}
                                </span>
                            </div>
                            {index < statusSteps.length - 1 && (
                                <div className={`flex-1 h-1 mx-4 rounded ${
                                    index < currentStatusIndex ? 'bg-teal-600' : 'bg-gray-200'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Status change */}
                <div className="mt-6 pt-6 border-t flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Змінити статус:</label>
                    <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="new">Нове</option>
                        <option value="processing">В обробці</option>
                        <option value="shipped">Відправлено</option>
                        <option value="delivered">Доставлено</option>
                        <option value="cancelled">Скасовано</option>
                    </select>
                    <button className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors">
                        Оновити
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Order items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-900">Товари</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 p-6">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <span className="text-gray-400 text-xs">IMG</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{item.name}</p>
                                        <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-900">{item.price.toLocaleString()} ₴</p>
                                        <p className="text-sm text-gray-500">x {item.quantity}</p>
                                    </div>
                                    <div className="text-right w-24">
                                        <p className="font-semibold text-gray-900">
                                            {(item.price * item.quantity).toLocaleString()} ₴
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Підсумок</span>
                                <span className="text-gray-900">{order.subtotal.toLocaleString()} ₴</span>
                            </div>
                            {order.discount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Знижка ({order.discountCode})</span>
                                    <span className="text-red-600">-{order.discount.toLocaleString()} ₴</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Доставка</span>
                                <span className="text-gray-900">
                                    {order.shipping === 0 ? 'Безкоштовно' : `${order.shipping.toLocaleString()} ₴`}
                                </span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                                <span className="text-gray-900">Всього</span>
                                <span className="text-gray-900">{order.total.toLocaleString()} ₴</span>
                            </div>
                        </div>
                    </div>

                    {/* Order history */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-900">Історія замовлення</h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {order.history.map((event, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="w-2 h-2 mt-2 bg-teal-600 rounded-full" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{event.event}</p>
                                            <p className="text-xs text-gray-500">{event.date} • {event.user}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add note */}
                            <div className="mt-6 pt-6 border-t">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Додати коментар
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Введіть коментар..."
                                    />
                                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                                        Додати
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer info */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-gray-400" />
                            Клієнт
                        </h3>
                        <div className="space-y-3">
                            <p className="font-medium text-gray-900">{order.customer.name}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <EnvelopeIcon className="w-4 h-4" />
                                {order.customer.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <PhoneIcon className="w-4 h-4" />
                                {order.customer.phone}
                            </div>
                            <div className="pt-3 border-t">
                                <p className="text-sm text-gray-500">
                                    Всього замовлень: <span className="font-medium text-gray-900">{order.customer.ordersCount}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Delivery info */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <TruckIcon className="w-5 h-5 text-gray-400" />
                            Доставка
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-500">Спосіб</p>
                                <p className="font-medium text-gray-900">{order.delivery.method}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Адреса</p>
                                <p className="font-medium text-gray-900">{order.delivery.city}</p>
                                <p className="text-sm text-gray-600">{order.delivery.address}</p>
                            </div>
                            {order.delivery.trackingNumber && (
                                <div>
                                    <p className="text-sm text-gray-500">ТТН</p>
                                    <p className="font-medium text-teal-600">{order.delivery.trackingNumber}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-gray-500">Очікувана дата</p>
                                <p className="font-medium text-gray-900">{order.delivery.estimatedDate}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment info */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CreditCardIcon className="w-5 h-5 text-gray-400" />
                            Оплата
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Статус</span>
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                    Сплачено
                                </span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Спосіб</p>
                                <p className="font-medium text-gray-900">{order.payment.method}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Дата оплати</p>
                                <p className="font-medium text-gray-900">{order.payment.date}</p>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <div className="bg-yellow-50 rounded-xl p-6">
                            <h3 className="font-semibold text-yellow-800 mb-2">Примітка від клієнта</h3>
                            <p className="text-sm text-yellow-700">{order.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
                        <button className="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                            <XCircleIcon className="w-5 h-5" />
                            Скасувати замовлення
                        </button>
                        <button className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                            Повернення коштів
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
