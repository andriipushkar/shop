'use client';

import { useState } from 'react';
import {
    MagnifyingGlassIcon,
    EyeIcon,
    EnvelopeIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserGroupIcon,
    ShoppingCartIcon,
    CurrencyDollarIcon,
    StarIcon,
} from '@heroicons/react/24/outline';

// Mock customers data
const customersData = [
    { id: 1, name: 'Олександр Ковальчук', email: 'o.kovalchuk@gmail.com', phone: '+380 67 123 4567', orders: 15, totalSpent: 245890, lastOrder: '10.12.2024', registered: '15.03.2023', status: 'vip' },
    { id: 2, name: 'Марія Шевченко', email: 'm.shevchenko@gmail.com', phone: '+380 50 234 5678', orders: 8, totalSpent: 89450, lastOrder: '10.12.2024', registered: '22.06.2023', status: 'active' },
    { id: 3, name: 'Андрій Петренко', email: 'a.petrenko@ukr.net', phone: '+380 63 345 6789', orders: 3, totalSpent: 34500, lastOrder: '05.12.2024', registered: '10.09.2024', status: 'active' },
    { id: 4, name: 'Наталія Бондаренко', email: 'n.bondarenko@gmail.com', phone: '+380 97 456 7890', orders: 22, totalSpent: 456780, lastOrder: '09.12.2024', registered: '03.01.2023', status: 'vip' },
    { id: 5, name: 'Віктор Мельник', email: 'v.melnyk@i.ua', phone: '+380 66 567 8901', orders: 1, totalSpent: 5999, lastOrder: '01.12.2024', registered: '28.11.2024', status: 'new' },
    { id: 6, name: 'Іван Петренко', email: 'i.petrenko@gmail.com', phone: '+380 67 678 9012', orders: 5, totalSpent: 67890, lastOrder: '08.12.2024', registered: '15.07.2024', status: 'active' },
    { id: 7, name: 'Олена Коваленко', email: 'o.kovalenko@gmail.com', phone: '+380 50 789 0123', orders: 12, totalSpent: 178900, lastOrder: '07.12.2024', registered: '20.02.2023', status: 'vip' },
    { id: 8, name: 'Сергій Ткаченко', email: 's.tkachenko@ukr.net', phone: '+380 63 890 1234', orders: 2, totalSpent: 23400, lastOrder: '03.12.2024', registered: '05.10.2024', status: 'active' },
    { id: 9, name: 'Юлія Савченко', email: 'y.savchenko@gmail.com', phone: '+380 97 901 2345', orders: 0, totalSpent: 0, lastOrder: '-', registered: '09.12.2024', status: 'new' },
    { id: 10, name: 'Дмитро Литвиненко', email: 'd.lytvynenko@ukr.net', phone: '+380 66 012 3456', orders: 7, totalSpent: 98760, lastOrder: '06.12.2024', registered: '12.04.2024', status: 'active' },
];

export default function AdminCustomersPage() {
    const [customers] = useState(customersData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredCustomers = customers.filter(customer => {
        const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            customer.phone.includes(searchQuery);
        const matchesStatus = selectedStatus === 'all' || customer.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'vip':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <StarIcon className="w-3.5 h-3.5" />
                        VIP
                    </span>
                );
            case 'active':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Активний</span>;
            case 'new':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Новий</span>;
            default:
                return null;
        }
    };

    // Stats
    const stats = {
        total: customers.length,
        vip: customers.filter(c => c.status === 'vip').length,
        totalOrders: customers.reduce((sum, c) => sum + c.orders, 0),
        totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Клієнти</h1>
                    <p className="text-gray-600">База клієнтів магазину</p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors">
                    <EnvelopeIcon className="w-5 h-5" />
                    Email розсилка
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <UserGroupIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього клієнтів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <StarIcon className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.vip}</p>
                            <p className="text-sm text-gray-500">VIP клієнтів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ShoppingCartIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                            <p className="text-sm text-gray-500">Всього замовлень</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{(stats.totalRevenue / 1000).toFixed(0)}k ₴</p>
                            <p className="text-sm text-gray-500">Загальний дохід</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за ім'ям, email або телефоном..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі статуси</option>
                        <option value="vip">VIP</option>
                        <option value="active">Активні</option>
                        <option value="new">Нові</option>
                    </select>
                </div>
            </div>

            {/* Customers table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Контакти</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Замовлень</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Витрачено</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Останнє замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedCustomers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                                <span className="text-teal-700 font-medium">
                                                    {customer.name.split(' ').map(n => n[0]).join('')}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{customer.name}</p>
                                                <p className="text-xs text-gray-500">З {customer.registered}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-900">{customer.email}</p>
                                        <p className="text-xs text-gray-500">{customer.phone}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{customer.orders}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.totalSpent.toLocaleString()} ₴</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{customer.lastOrder}</td>
                                    <td className="px-6 py-4">{getStatusBadge(customer.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <EyeIcon className="w-5 h-5" />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <EnvelopeIcon className="w-5 h-5" />
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
                        Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} з {filteredCustomers.length} клієнтів
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
