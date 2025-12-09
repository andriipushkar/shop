'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    MagnifyingGlassIcon,
    EyeIcon,
    PrinterIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FunnelIcon,
    CalendarIcon,
    TruckIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

// Mock orders data
const ordersData = [
    { id: '#12350', customer: 'Олександр Ковальчук', email: 'o.kovalchuk@gmail.com', phone: '+380 67 123 4567', date: '10.12.2024 15:30', items: 3, total: 87999, status: 'processing', payment: 'paid', delivery: 'nova_poshta' },
    { id: '#12349', customer: 'Марія Шевченко', email: 'm.shevchenko@gmail.com', phone: '+380 50 234 5678', date: '10.12.2024 14:15', items: 1, total: 54999, status: 'shipped', payment: 'paid', delivery: 'nova_poshta_courier' },
    { id: '#12348', customer: 'Андрій Петренко', email: 'a.petrenko@ukr.net', phone: '+380 63 345 6789', date: '10.12.2024 12:45', items: 2, total: 15998, status: 'delivered', payment: 'paid', delivery: 'pickup' },
    { id: '#12347', customer: 'Наталія Бондаренко', email: 'n.bondarenko@gmail.com', phone: '+380 97 456 7890', date: '10.12.2024 11:20', items: 5, total: 124995, status: 'new', payment: 'pending', delivery: 'nova_poshta' },
    { id: '#12346', customer: 'Віктор Мельник', email: 'v.melnyk@i.ua', phone: '+380 66 567 8901', date: '10.12.2024 10:00', items: 1, total: 3999, status: 'cancelled', payment: 'refunded', delivery: 'ukrposhta' },
    { id: '#12345', customer: 'Іван Петренко', email: 'i.petrenko@gmail.com', phone: '+380 67 678 9012', date: '09.12.2024 18:30', items: 2, total: 67998, status: 'delivered', payment: 'paid', delivery: 'nova_poshta' },
    { id: '#12344', customer: 'Олена Коваленко', email: 'o.kovalenko@gmail.com', phone: '+380 50 789 0123', date: '09.12.2024 16:45', items: 4, total: 23996, status: 'shipped', payment: 'paid', delivery: 'nova_poshta_courier' },
    { id: '#12343', customer: 'Сергій Ткаченко', email: 's.tkachenko@ukr.net', phone: '+380 63 890 1234', date: '09.12.2024 14:20', items: 1, total: 89999, status: 'processing', payment: 'paid', delivery: 'nova_poshta' },
];

const statusOptions = [
    { value: 'all', label: 'Всі статуси' },
    { value: 'new', label: 'Нове' },
    { value: 'processing', label: 'В обробці' },
    { value: 'shipped', label: 'Відправлено' },
    { value: 'delivered', label: 'Доставлено' },
    { value: 'cancelled', label: 'Скасовано' },
];

export default function AdminOrdersPage() {
    const [orders] = useState(ordersData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            order.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { icon: React.ElementType; className: string; label: string }> = {
            new: { icon: ClockIcon, className: 'bg-blue-100 text-blue-800', label: 'Нове' },
            processing: { icon: ClockIcon, className: 'bg-yellow-100 text-yellow-800', label: 'В обробці' },
            shipped: { icon: TruckIcon, className: 'bg-purple-100 text-purple-800', label: 'Відправлено' },
            delivered: { icon: CheckCircleIcon, className: 'bg-green-100 text-green-800', label: 'Доставлено' },
            cancelled: { icon: XCircleIcon, className: 'bg-red-100 text-red-800', label: 'Скасовано' },
        };
        const config = statusConfig[status];
        if (!config) return null;
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
    };

    const getPaymentBadge = (payment: string) => {
        switch (payment) {
            case 'paid':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Сплачено</span>;
            case 'pending':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Очікує</span>;
            case 'refunded':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Повернено</span>;
            default:
                return null;
        }
    };

    const getDeliveryMethod = (delivery: string) => {
        const methods: Record<string, string> = {
            nova_poshta: 'Нова Пошта',
            nova_poshta_courier: 'Нова Пошта Кур\'єр',
            ukrposhta: 'Укрпошта',
            pickup: 'Самовивіз',
        };
        return methods[delivery] || delivery;
    };

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrders(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    const toggleAllOrders = () => {
        if (selectedOrders.length === paginatedOrders.length) {
            setSelectedOrders([]);
        } else {
            setSelectedOrders(paginatedOrders.map(o => o.id));
        }
    };

    // Stats
    const stats = {
        new: orders.filter(o => o.status === 'new').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Замовлення</h1>
                    <p className="text-gray-600">Управління замовленнями магазину</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                    onClick={() => setSelectedStatus('new')}
                    className={`p-4 rounded-xl transition-all ${selectedStatus === 'new' ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-white shadow-sm hover:shadow'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ClockIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
                            <p className="text-sm text-gray-500">Нових</p>
                        </div>
                    </div>
                </button>
                <button
                    onClick={() => setSelectedStatus('processing')}
                    className={`p-4 rounded-xl transition-all ${selectedStatus === 'processing' ? 'bg-yellow-50 ring-2 ring-yellow-500' : 'bg-white shadow-sm hover:shadow'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <ClockIcon className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-gray-900">{stats.processing}</p>
                            <p className="text-sm text-gray-500">В обробці</p>
                        </div>
                    </div>
                </button>
                <button
                    onClick={() => setSelectedStatus('shipped')}
                    className={`p-4 rounded-xl transition-all ${selectedStatus === 'shipped' ? 'bg-purple-50 ring-2 ring-purple-500' : 'bg-white shadow-sm hover:shadow'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <TruckIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-gray-900">{stats.shipped}</p>
                            <p className="text-sm text-gray-500">Відправлено</p>
                        </div>
                    </div>
                </button>
                <button
                    onClick={() => setSelectedStatus('delivered')}
                    className={`p-4 rounded-xl transition-all ${selectedStatus === 'delivered' ? 'bg-green-50 ring-2 ring-green-500' : 'bg-white shadow-sm hover:shadow'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
                            <p className="text-sm text-gray-500">Доставлено</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Filters and search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за номером, клієнтом або email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                            {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors ${
                                showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FunnelIcon className="w-5 h-5" />
                            Фільтри
                        </button>
                    </div>
                </div>

                {/* Extended filters */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Дата від</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Дата до</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Оплата</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                <option value="">Всі</option>
                                <option value="paid">Сплачено</option>
                                <option value="pending">Очікує</option>
                                <option value="refunded">Повернено</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Доставка</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                <option value="">Всі</option>
                                <option value="nova_poshta">Нова Пошта</option>
                                <option value="nova_poshta_courier">Нова Пошта Кур&apos;єр</option>
                                <option value="ukrposhta">Укрпошта</option>
                                <option value="pickup">Самовивіз</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Orders table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <input
                                        type="checkbox"
                                        checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                                        onChange={toggleAllOrders}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товарів</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сума</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Оплата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedOrders.includes(order.id)}
                                            onChange={() => toggleOrderSelection(order.id)}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900">{order.id}</p>
                                        <p className="text-xs text-gray-500">{getDeliveryMethod(order.delivery)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900">{order.customer}</p>
                                        <p className="text-xs text-gray-500">{order.phone}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{order.items}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.total.toLocaleString()} ₴</td>
                                    <td className="px-6 py-4">{getPaymentBadge(order.payment)}</td>
                                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/orders/${order.id.replace('#', '')}`}
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <EyeIcon className="w-5 h-5" />
                                            </Link>
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <PrinterIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-600">
                        Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} з {filteredOrders.length} замовлень
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`px-3.5 py-2 rounded-lg font-medium transition-colors ${
                                    currentPage === page
                                        ? 'bg-teal-600 text-white'
                                        : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
