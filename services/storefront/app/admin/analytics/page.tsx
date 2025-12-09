'use client';

import { useState } from 'react';
import {
    CurrencyDollarIcon,
    ShoppingCartIcon,
    UsersIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    ChartBarIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';

// Mock analytics data
const monthlyRevenue = [
    { month: 'Січ', revenue: 245000, orders: 156 },
    { month: 'Лют', revenue: 312000, orders: 198 },
    { month: 'Бер', revenue: 287000, orders: 175 },
    { month: 'Кві', revenue: 356000, orders: 223 },
    { month: 'Тра', revenue: 298000, orders: 187 },
    { month: 'Чер', revenue: 421000, orders: 267 },
    { month: 'Лип', revenue: 389000, orders: 245 },
    { month: 'Сер', revenue: 445000, orders: 289 },
    { month: 'Вер', revenue: 512000, orders: 334 },
    { month: 'Жов', revenue: 478000, orders: 312 },
    { month: 'Лис', revenue: 567000, orders: 378 },
    { month: 'Гру', revenue: 623000, orders: 412 },
];

const topCategories = [
    { name: 'Електроніка', revenue: 2450000, percentage: 45 },
    { name: 'Одяг', revenue: 890000, percentage: 16 },
    { name: 'Дім і сад', revenue: 670000, percentage: 12 },
    { name: 'Спорт', revenue: 560000, percentage: 10 },
    { name: 'Аксесуари', revenue: 450000, percentage: 8 },
    { name: 'Інше', revenue: 480000, percentage: 9 },
];

const trafficSources = [
    { source: 'Пошук Google', visits: 45678, conversions: 2.8 },
    { source: 'Прямі заходи', visits: 23456, conversions: 3.2 },
    { source: 'Facebook', visits: 12345, conversions: 1.9 },
    { source: 'Instagram', visits: 9876, conversions: 2.1 },
    { source: 'Email розсилка', visits: 5432, conversions: 4.5 },
];

const bestProducts = [
    { name: 'iPhone 15 Pro Max', sold: 145, revenue: 7974855 },
    { name: 'MacBook Pro 14"', sold: 89, revenue: 8009911 },
    { name: 'Samsung Galaxy S24', sold: 132, revenue: 6598868 },
    { name: 'AirPods Pro 2', sold: 234, revenue: 2339766 },
    { name: 'Apple Watch Ultra 2', sold: 98, revenue: 3429902 },
];

export default function AdminAnalyticsPage() {
    const [period, setPeriod] = useState('month');

    const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue));

    // Calculate totals
    const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
    const totalOrders = monthlyRevenue.reduce((sum, m) => sum + m.orders, 0);
    const avgOrderValue = Math.round(totalRevenue / totalOrders);
    const conversionRate = 2.8;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Аналітика</h1>
                    <p className="text-gray-600">Статистика та звіти магазину</p>
                </div>
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="week">Тиждень</option>
                        <option value="month">Місяць</option>
                        <option value="quarter">Квартал</option>
                        <option value="year">Рік</option>
                    </select>
                </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                            <CurrencyDollarIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +18.5%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{(totalRevenue / 1000000).toFixed(1)}M ₴</p>
                    <p className="text-sm text-gray-500">Загальний дохід</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +12.3%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalOrders.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Замовлень</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <UsersIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +8.7%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgOrderValue.toLocaleString()} ₴</p>
                    <p className="text-sm text-gray-500">Середній чек</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <ChartBarIcon className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                            <ArrowTrendingDownIcon className="w-4 h-4" />
                            -0.3%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
                    <p className="text-sm text-gray-500">Конверсія</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Revenue chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Дохід по місяцях</h2>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-teal-500 rounded"></span>
                                Дохід
                            </span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-2 h-64">
                        {monthlyRevenue.map((item) => (
                            <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                                <div className="relative w-full group">
                                    <div
                                        className="w-full bg-teal-500 rounded-t-lg transition-all hover:bg-teal-600"
                                        style={{ height: `${(item.revenue / maxRevenue) * 200}px` }}
                                    />
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                        {(item.revenue / 1000).toFixed(0)}k ₴
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500">{item.month}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Categories breakdown */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Продажі за категоріями</h2>
                    <div className="space-y-4">
                        {topCategories.map((category) => (
                            <div key={category.name}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-700">{category.name}</span>
                                    <span className="font-medium text-gray-900">{category.percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-teal-500 h-2 rounded-full"
                                        style={{ width: `${category.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Traffic sources */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Джерела трафіку</h2>
                        <EyeIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                                    <th className="pb-3">Джерело</th>
                                    <th className="pb-3">Візити</th>
                                    <th className="pb-3">Конверсія</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {trafficSources.map((source) => (
                                    <tr key={source.source}>
                                        <td className="py-3 text-sm text-gray-900">{source.source}</td>
                                        <td className="py-3 text-sm text-gray-600">{source.visits.toLocaleString()}</td>
                                        <td className="py-3">
                                            <span className={`text-sm font-medium ${
                                                source.conversions >= 3 ? 'text-green-600' : 'text-gray-600'
                                            }`}>
                                                {source.conversions}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Best selling products */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Топ продажів</h2>
                        <ShoppingCartIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-4">
                        {bestProducts.map((product, index) => (
                            <div key={product.name} className="flex items-center gap-4">
                                <span className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-medium text-teal-700">
                                    {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500">{product.sold} продано</p>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                    {(product.revenue / 1000000).toFixed(1)}M ₴
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick stats */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-6 text-white">
                <h2 className="text-lg font-semibold mb-4">Порівняння з минулим періодом</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <p className="text-teal-200 text-sm">Дохід</p>
                        <p className="text-2xl font-bold">+18.5%</p>
                        <p className="text-teal-200 text-sm">vs минулий місяць</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-sm">Замовлення</p>
                        <p className="text-2xl font-bold">+12.3%</p>
                        <p className="text-teal-200 text-sm">vs минулий місяць</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-sm">Нові клієнти</p>
                        <p className="text-2xl font-bold">+25.7%</p>
                        <p className="text-teal-200 text-sm">vs минулий місяць</p>
                    </div>
                    <div>
                        <p className="text-teal-200 text-sm">Повернення</p>
                        <p className="text-2xl font-bold">-8.2%</p>
                        <p className="text-teal-200 text-sm">vs минулий місяць</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
