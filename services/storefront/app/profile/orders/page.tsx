'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ShoppingBagIcon,
    TruckIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    MapPinIcon,
    CreditCardIcon,
} from '@heroicons/react/24/outline';

// Mock order data
const mockOrders = [
    {
        id: '12350',
        date: '2024-01-15T10:30:00',
        status: 'delivered',
        total: 65499,
        items: [
            { id: 1, name: 'iPhone 15 Pro Max 256GB', quantity: 1, price: 54999, image: '/products/iphone.jpg' },
            { id: 2, name: 'Apple AirPods Pro 2', quantity: 1, price: 9999, image: '/products/airpods.jpg' },
        ],
        delivery: {
            method: 'Нова Пошта',
            address: 'м. Київ, Відділення №25',
            ttn: '20450000012345',
        },
        payment: {
            method: 'LiqPay',
            status: 'paid',
        },
    },
    {
        id: '12349',
        date: '2024-01-10T14:20:00',
        status: 'shipped',
        total: 32999,
        items: [
            { id: 3, name: 'Samsung Galaxy S24 Ultra', quantity: 1, price: 32999, image: '/products/samsung.jpg' },
        ],
        delivery: {
            method: 'Нова Пошта',
            address: 'м. Львів, Поштомат №112',
            ttn: '20450000012344',
        },
        payment: {
            method: 'Готівка',
            status: 'pending',
        },
    },
    {
        id: '12348',
        date: '2024-01-05T09:15:00',
        status: 'processing',
        total: 15999,
        items: [
            { id: 4, name: 'Apple Watch Ultra 2', quantity: 1, price: 15999, image: '/products/watch.jpg' },
        ],
        delivery: {
            method: "Нова Пошта (кур'єр)",
            address: 'м. Одеса, вул. Дерибасівська, 10',
            ttn: null,
        },
        payment: {
            method: 'LiqPay',
            status: 'paid',
        },
    },
    {
        id: '12347',
        date: '2024-01-02T16:45:00',
        status: 'cancelled',
        total: 89999,
        items: [
            { id: 5, name: 'MacBook Pro 14" M3 Pro', quantity: 1, price: 89999, image: '/products/macbook.jpg' },
        ],
        delivery: {
            method: 'Нова Пошта',
            address: 'м. Харків, Відділення №45',
            ttn: null,
        },
        payment: {
            method: 'LiqPay',
            status: 'refunded',
        },
    },
    {
        id: '12346',
        date: '2023-12-28T11:30:00',
        status: 'delivered',
        total: 4999,
        items: [
            { id: 6, name: 'Чохол для iPhone 15 Pro Max', quantity: 2, price: 1499, image: '/products/case.jpg' },
            { id: 7, name: 'Захисне скло', quantity: 1, price: 999, image: '/products/glass.jpg' },
        ],
        delivery: {
            method: 'Самовивіз',
            address: 'м. Київ, ТЦ "Гулівер"',
            ttn: null,
        },
        payment: {
            method: 'Готівка',
            status: 'paid',
        },
    },
];

const statusConfig = {
    new: { label: 'Нове', color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
    processing: { label: 'В обробці', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
    shipped: { label: 'Відправлено', color: 'bg-purple-100 text-purple-700', icon: TruckIcon },
    delivered: { label: 'Доставлено', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
    cancelled: { label: 'Скасовано', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
};

const paymentStatusConfig = {
    paid: { label: 'Сплачено', color: 'text-green-600' },
    pending: { label: 'Очікує оплати', color: 'text-yellow-600' },
    refunded: { label: 'Повернено', color: 'text-red-600' },
};

export default function OrdersHistoryPage() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    const filteredOrders = mockOrders.filter(order => {
        const matchesSearch = order.id.includes(search) ||
            order.items.some(item => item.name.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleReorder = (orderId: string) => {
        // Mock reorder - would add items to cart
        alert(`Товари з замовлення #${orderId} додано до кошика`);
    };

    const handleTrack = (ttn: string) => {
        window.open(`/tracking?ttn=${ttn}`, '_blank');
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
                        <span className="text-gray-900">Мої замовлення</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-gray-900">Мої замовлення</h1>
                    <p className="text-gray-600">Історія та статус ваших замовлень</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Пошук за номером або товаром..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <FunnelIcon className="w-5 h-5 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                <option value="all">Всі статуси</option>
                                <option value="new">Нові</option>
                                <option value="processing">В обробці</option>
                                <option value="shipped">Відправлені</option>
                                <option value="delivered">Доставлені</option>
                                <option value="cancelled">Скасовані</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Orders list */}
                <div className="space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                            <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Замовлень не знайдено</h3>
                            <p className="text-gray-500 mb-6">
                                {search || statusFilter !== 'all'
                                    ? 'Спробуйте змінити параметри пошуку'
                                    : 'Ви ще не зробили жодного замовлення'}
                            </p>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                            >
                                <ShoppingBagIcon className="w-5 h-5" />
                                Перейти до покупок
                            </Link>
                        </div>
                    ) : (
                        filteredOrders.map((order) => {
                            const status = statusConfig[order.status as keyof typeof statusConfig];
                            const paymentStatus = paymentStatusConfig[order.payment.status as keyof typeof paymentStatusConfig];
                            const isExpanded = expandedOrder === order.id;
                            const StatusIcon = status.icon;

                            return (
                                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    {/* Order header */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-gray-900">
                                                    Замовлення #{order.id}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                    <StatusIcon className="w-3.5 h-3.5" />
                                                    {status.label}
                                                </span>
                                            </div>
                                            <ChevronRightIcon className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="text-sm text-gray-500">
                                                {new Date(order.date).toLocaleDateString('uk-UA', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-500">
                                                    {order.items.length} {order.items.length === 1 ? 'товар' : order.items.length < 5 ? 'товари' : 'товарів'}
                                                </span>
                                                <span className="font-semibold text-gray-900">
                                                    {order.total.toLocaleString()} ₴
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order details (expanded) */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100">
                                            {/* Items */}
                                            <div className="p-4 bg-gray-50">
                                                <h4 className="text-sm font-medium text-gray-700 mb-3">Товари</h4>
                                                <div className="space-y-3">
                                                    {order.items.map((item) => (
                                                        <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                                                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                                                <ShoppingBagIcon className="w-8 h-8 text-gray-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                                                <p className="text-sm text-gray-500">Кількість: {item.quantity}</p>
                                                            </div>
                                                            <span className="font-medium text-gray-900">
                                                                {item.price.toLocaleString()} ₴
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Delivery & Payment */}
                                            <div className="p-4 grid sm:grid-cols-2 gap-4">
                                                <div className="flex items-start gap-3">
                                                    <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Доставка</p>
                                                        <p className="text-sm text-gray-600">{order.delivery.method}</p>
                                                        <p className="text-sm text-gray-500">{order.delivery.address}</p>
                                                        {order.delivery.ttn && (
                                                            <p className="text-sm text-teal-600 mt-1">
                                                                ТТН: {order.delivery.ttn}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <CreditCardIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Оплата</p>
                                                        <p className="text-sm text-gray-600">{order.payment.method}</p>
                                                        <p className={`text-sm ${paymentStatus.color}`}>{paymentStatus.label}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="p-4 border-t border-gray-100 flex flex-wrap gap-3">
                                                {order.status === 'shipped' && order.delivery.ttn && (
                                                    <button
                                                        onClick={() => handleTrack(order.delivery.ttn!)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                                    >
                                                        <TruckIcon className="w-4 h-4" />
                                                        Відстежити
                                                    </button>
                                                )}
                                                {(order.status === 'delivered' || order.status === 'cancelled') && (
                                                    <button
                                                        onClick={() => handleReorder(order.id)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                                    >
                                                        <ArrowPathIcon className="w-4 h-4" />
                                                        Повторити замовлення
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/profile/orders/${order.id}`}
                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    Детальніше
                                                    <ChevronRightIcon className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Summary */}
                {filteredOrders.length > 0 && (
                    <div className="mt-6 text-center text-sm text-gray-500">
                        Показано {filteredOrders.length} з {mockOrders.length} замовлень
                    </div>
                )}
            </div>
        </div>
    );
}
