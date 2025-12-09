'use client';

import {
    CurrencyDollarIcon,
    ShoppingCartIcon,
    UsersIcon,
    ShoppingBagIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

// Mock data
const stats = [
    {
        name: 'Продажі сьогодні',
        value: '45 280 ₴',
        change: '+12.5%',
        changeType: 'positive',
        icon: CurrencyDollarIcon,
    },
    {
        name: 'Замовлення',
        value: '156',
        change: '+8.2%',
        changeType: 'positive',
        icon: ShoppingCartIcon,
    },
    {
        name: 'Нові клієнти',
        value: '24',
        change: '-3.1%',
        changeType: 'negative',
        icon: UsersIcon,
    },
    {
        name: 'Товари на складі',
        value: '1,847',
        change: '+2.4%',
        changeType: 'positive',
        icon: ShoppingBagIcon,
    },
];

const recentOrders = [
    { id: '#12345', customer: 'Іван Петренко', date: '10.12.2024', total: '2 450 ₴', status: 'Доставлено', statusColor: 'bg-green-100 text-green-800' },
    { id: '#12344', customer: 'Марія Коваленко', date: '10.12.2024', total: '5 890 ₴', status: 'В дорозі', statusColor: 'bg-blue-100 text-blue-800' },
    { id: '#12343', customer: 'Олексій Шевченко', date: '10.12.2024', total: '1 200 ₴', status: 'Обробка', statusColor: 'bg-yellow-100 text-yellow-800' },
    { id: '#12342', customer: 'Наталія Бойко', date: '09.12.2024', total: '8 900 ₴', status: 'Доставлено', statusColor: 'bg-green-100 text-green-800' },
    { id: '#12341', customer: 'Андрій Мельник', date: '09.12.2024', total: '3 450 ₴', status: 'Скасовано', statusColor: 'bg-red-100 text-red-800' },
];

const topProducts = [
    { name: 'iPhone 15 Pro Max', sales: 45, revenue: '2 474 955 ₴', stock: 15 },
    { name: 'Samsung Galaxy S24', sales: 38, revenue: '1 899 962 ₴', stock: 23 },
    { name: 'MacBook Pro 14"', sales: 22, revenue: '1 979 978 ₴', stock: 8 },
    { name: 'Sony WH-1000XM5', sales: 67, revenue: '870 933 ₴', stock: 19 },
    { name: 'Apple Watch Ultra 2', sales: 31, revenue: '1 084 969 ₴', stock: 25 },
];

const salesByDay = [
    { day: 'Пн', sales: 45000 },
    { day: 'Вт', sales: 52000 },
    { day: 'Ср', sales: 38000 },
    { day: 'Чт', sales: 61000 },
    { day: 'Пт', sales: 55000 },
    { day: 'Сб', sales: 72000 },
    { day: 'Нд', sales: 48000 },
];

const maxSales = Math.max(...salesByDay.map(d => d.sales));

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
                    <p className="text-gray-600">Огляд вашого магазину</p>
                </div>
                <div className="flex gap-3">
                    <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                        <option>Сьогодні</option>
                        <option>Вчора</option>
                        <option>Останні 7 днів</option>
                        <option>Останні 30 днів</option>
                        <option>Цей місяць</option>
                    </select>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                                <stat.icon className="w-6 h-6 text-teal-600" />
                            </div>
                            <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                                stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {stat.changeType === 'positive' ? (
                                    <ArrowUpIcon className="w-4 h-4" />
                                ) : (
                                    <ArrowDownIcon className="w-4 h-4" />
                                )}
                                {stat.change}
                            </span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                            <p className="text-sm text-gray-500">{stat.name}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Sales chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Продажі за тиждень</h2>
                        <Link href="/admin/analytics" className="text-sm text-teal-600 hover:text-teal-700">
                            Детальніше →
                        </Link>
                    </div>
                    <div className="flex items-end justify-between gap-2 h-48">
                        {salesByDay.map((item) => (
                            <div key={item.day} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    className="w-full bg-teal-500 rounded-t-lg transition-all hover:bg-teal-600"
                                    style={{ height: `${(item.sales / maxSales) * 100}%` }}
                                />
                                <span className="text-xs text-gray-500">{item.day}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                        <span className="text-gray-500">Загалом за тиждень:</span>
                        <span className="font-semibold text-gray-900">371 000 ₴</span>
                    </div>
                </div>

                {/* Top products */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Топ товари</h2>
                        <Link href="/admin/products" className="text-sm text-teal-600 hover:text-teal-700">
                            Всі товари →
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {topProducts.slice(0, 5).map((product, index) => (
                            <div key={product.name} className="flex items-center gap-3">
                                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                    {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500">{product.sales} продажів</p>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{product.revenue}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent orders */}
            <div className="bg-white rounded-xl shadow-sm">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Останні замовлення</h2>
                    <Link href="/admin/orders" className="text-sm text-teal-600 hover:text-teal-700">
                        Всі замовлення →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сума</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{order.customer}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.total}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.statusColor}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-gray-400 hover:text-teal-600">
                                            <EyeIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
