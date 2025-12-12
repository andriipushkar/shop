'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    UsersIcon,
    UserPlusIcon,
    ArrowPathIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    ArrowDownTrayIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    ShoppingCartIcon,
    HeartIcon,
} from '@heroicons/react/24/outline';

// Mock cohort data
const cohortData = [
    { month: 'Січ 2024', acquired: 456, month1: 32, month2: 24, month3: 18, month4: 15, month5: 12, month6: 10 },
    { month: 'Лют 2024', acquired: 523, month1: 35, month2: 26, month3: 20, month4: 16, month5: 13, month6: null },
    { month: 'Бер 2024', acquired: 489, month1: 33, month2: 25, month3: 19, month4: 15, month5: null, month6: null },
    { month: 'Кві 2024', acquired: 567, month1: 36, month2: 27, month3: 21, month4: null, month5: null, month6: null },
    { month: 'Тра 2024', acquired: 534, month1: 34, month2: 25, month3: null, month4: null, month5: null, month6: null },
    { month: 'Чер 2024', acquired: 612, month1: 38, month2: null, month3: null, month4: null, month5: null, month6: null },
];

const customerSegments = [
    { name: 'VIP клієнти', count: 234, revenue: 4560000, avgOrders: 8.5, color: 'bg-purple-500' },
    { name: 'Активні покупці', count: 1234, revenue: 3890000, avgOrders: 3.2, color: 'bg-teal-500' },
    { name: 'Разові покупці', count: 3456, revenue: 2340000, avgOrders: 1.0, color: 'bg-blue-500' },
    { name: 'Неактивні', count: 2345, revenue: 890000, avgOrders: 0.5, color: 'bg-gray-400' },
    { name: 'Ризик відтоку', count: 567, revenue: 234000, avgOrders: 0.2, color: 'bg-red-500' },
];

const customerLifetime = [
    { months: '0-3', customers: 2345, ltv: 1200, retention: 45 },
    { months: '3-6', customers: 1567, ltv: 2800, retention: 62 },
    { months: '6-12', customers: 1234, ltv: 4500, retention: 71 },
    { months: '12-24', customers: 890, ltv: 7800, retention: 78 },
    { months: '24+', customers: 456, ltv: 12500, retention: 85 },
];

const topCustomers = [
    { name: 'Олександр К.', email: 'alex.k@gmail.com', orders: 23, revenue: 456000, lastOrder: '2024-01-14' },
    { name: 'Марія Ш.', email: 'm.shev@ukr.net', orders: 19, revenue: 389000, lastOrder: '2024-01-12' },
    { name: 'Андрій П.', email: 'a.petrov@gmail.com', orders: 17, revenue: 345000, lastOrder: '2024-01-10' },
    { name: 'Ірина М.', email: 'i.m@gmail.com', orders: 15, revenue: 298000, lastOrder: '2024-01-13' },
    { name: 'Сергій К.', email: 's.koval@gmail.com', orders: 14, revenue: 267000, lastOrder: '2024-01-11' },
];

const acquisitionChannels = [
    { channel: 'Органічний пошук', customers: 2345, percentage: 35, growth: 12.5 },
    { channel: 'Пряме посилання', customers: 1567, percentage: 23, growth: 8.2 },
    { channel: 'Facebook Ads', customers: 1234, percentage: 18, growth: -3.4 },
    { channel: 'Google Ads', customers: 890, percentage: 13, growth: 15.7 },
    { channel: 'Instagram', customers: 567, percentage: 8, growth: 22.3 },
    { channel: 'Реферали', customers: 234, percentage: 3, growth: 5.8 },
];

export default function CustomerAnalyticsPage() {
    const [period, setPeriod] = useState('quarter');

    // Calculate totals
    const totalCustomers = customerSegments.reduce((sum, s) => sum + s.count, 0);
    const newCustomers = 612; // From last month
    const avgLTV = 3450; // Average lifetime value
    const churnRate = 4.2; // Monthly churn rate

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <nav className="text-sm text-gray-500 mb-1">
                        <Link href="/admin" className="hover:text-teal-600">Адмін</Link>
                        <span className="mx-2">/</span>
                        <Link href="/admin/reports" className="hover:text-teal-600">Звіти</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">Клієнти</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-gray-900">Аналітика клієнтів</h1>
                    <p className="text-gray-600">Когортний аналіз та поведінка клієнтів</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="month">Місяць</option>
                            <option value="quarter">Квартал</option>
                            <option value="year">Рік</option>
                        </select>
                    </div>
                    <button className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Експорт
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                            <UsersIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +8.5%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalCustomers.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Всього клієнтів</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <UserPlusIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +14.6%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{newCustomers}</p>
                    <p className="text-sm text-gray-500">Нових за місяць</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +6.2%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgLTV.toLocaleString()} ₴</p>
                    <p className="text-sm text-gray-500">Середній LTV</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <ArrowPathIcon className="w-6 h-6 text-red-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                            <ArrowTrendingDownIcon className="w-4 h-4" />
                            -0.8%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{churnRate}%</p>
                    <p className="text-sm text-gray-500">Відтік клієнтів</p>
                </div>
            </div>

            {/* Cohort analysis */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Когортний аналіз (Retention)</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                                <th className="pb-3 pr-4">Когорта</th>
                                <th className="pb-3 pr-4">Нових</th>
                                <th className="pb-3 pr-4 text-center">Місяць 1</th>
                                <th className="pb-3 pr-4 text-center">Місяць 2</th>
                                <th className="pb-3 pr-4 text-center">Місяць 3</th>
                                <th className="pb-3 pr-4 text-center">Місяць 4</th>
                                <th className="pb-3 pr-4 text-center">Місяць 5</th>
                                <th className="pb-3 text-center">Місяць 6</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cohortData.map((cohort) => (
                                <tr key={cohort.month}>
                                    <td className="py-3 pr-4 font-medium text-gray-900">{cohort.month}</td>
                                    <td className="py-3 pr-4">{cohort.acquired}</td>
                                    {[cohort.month1, cohort.month2, cohort.month3, cohort.month4, cohort.month5, cohort.month6].map((retention, idx) => (
                                        <td key={idx} className="py-3 pr-4 text-center">
                                            {retention !== null ? (
                                                <span
                                                    className="inline-block px-2 py-1 rounded text-xs font-medium"
                                                    style={{
                                                        backgroundColor: `rgba(20, 184, 166, ${retention / 100})`,
                                                        color: retention > 20 ? 'white' : 'inherit',
                                                    }}
                                                >
                                                    {retention}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                    * Відсоток клієнтів, які зробили повторну покупку в зазначеному місяці
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Customer segments */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Сегменти клієнтів</h2>
                    <div className="space-y-4">
                        {customerSegments.map((segment) => (
                            <div key={segment.name} className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${segment.color}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-gray-900">{segment.name}</span>
                                        <span className="text-sm text-gray-600">{segment.count.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${segment.color}`}
                                            style={{ width: `${(segment.count / totalCustomers) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                                        <span>{(segment.revenue / 1000000).toFixed(1)}M ₴ доходу</span>
                                        <span>~{segment.avgOrders} замовлень</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Customer lifetime value */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">LTV за терміном</h2>
                    <div className="space-y-4">
                        {customerLifetime.map((tier) => (
                            <div key={tier.months} className="flex items-center gap-4">
                                <div className="w-16 text-sm text-gray-600">{tier.months}</div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-900">
                                            {tier.ltv.toLocaleString()} ₴
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {tier.customers.toLocaleString()} клієнтів
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div
                                            className="bg-purple-500 h-3 rounded-full"
                                            style={{ width: `${(tier.ltv / 12500) * 100}%` }}
                                        />
                                    </div>
                                    <div className="text-right mt-1">
                                        <span className="text-xs text-green-600">
                                            Retention: {tier.retention}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Top customers */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Топ клієнтів</h2>
                        <HeartIcon className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="space-y-4">
                        {topCustomers.map((customer, index) => (
                            <div key={customer.email} className="flex items-center gap-4">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                                    <p className="text-sm text-gray-500 truncate">{customer.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">{customer.revenue.toLocaleString()} ₴</p>
                                    <p className="text-xs text-gray-500">{customer.orders} замовлень</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Acquisition channels */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Канали залучення</h2>
                        <ChartBarIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-4">
                        {acquisitionChannels.map((channel) => (
                            <div key={channel.channel}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">{channel.channel}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${channel.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {channel.growth >= 0 ? '+' : ''}{channel.growth}%
                                        </span>
                                        <span className="text-sm text-gray-600">{channel.percentage}%</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full"
                                        style={{ width: `${channel.percentage}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {channel.customers.toLocaleString()} клієнтів
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <h2 className="text-lg font-semibold mb-4">💡 Ключові інсайти</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-purple-200 text-sm">Найкращий канал</p>
                        <p className="text-lg font-semibold">Instagram</p>
                        <p className="text-purple-200 text-sm">+22.3% росту</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-purple-200 text-sm">Retention покращився</p>
                        <p className="text-lg font-semibold">+3.2%</p>
                        <p className="text-purple-200 text-sm">vs минулий квартал</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-purple-200 text-sm">Потребують уваги</p>
                        <p className="text-lg font-semibold">567 клієнтів</p>
                        <p className="text-purple-200 text-sm">Ризик відтоку</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
