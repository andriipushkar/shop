'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    CurrencyDollarIcon,
    ShoppingCartIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    ArrowDownTrayIcon,
    ChartBarIcon,
    TableCellsIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';

// Mock sales data
const dailySales = [
    { date: '2024-01-01', orders: 45, revenue: 156000, avgOrder: 3467 },
    { date: '2024-01-02', orders: 52, revenue: 189000, avgOrder: 3635 },
    { date: '2024-01-03', orders: 38, revenue: 134000, avgOrder: 3526 },
    { date: '2024-01-04', orders: 61, revenue: 223000, avgOrder: 3656 },
    { date: '2024-01-05', orders: 55, revenue: 198000, avgOrder: 3600 },
    { date: '2024-01-06', orders: 72, revenue: 267000, avgOrder: 3708 },
    { date: '2024-01-07', orders: 68, revenue: 245000, avgOrder: 3603 },
    { date: '2024-01-08', orders: 48, revenue: 167000, avgOrder: 3479 },
    { date: '2024-01-09', orders: 56, revenue: 201000, avgOrder: 3589 },
    { date: '2024-01-10', orders: 63, revenue: 234000, avgOrder: 3714 },
    { date: '2024-01-11', orders: 71, revenue: 256000, avgOrder: 3606 },
    { date: '2024-01-12', orders: 59, revenue: 212000, avgOrder: 3593 },
    { date: '2024-01-13', orders: 82, revenue: 298000, avgOrder: 3634 },
    { date: '2024-01-14', orders: 76, revenue: 278000, avgOrder: 3658 },
];

const salesByCategory = [
    { category: 'Смартфони', revenue: 2450000, orders: 89, growth: 15.2 },
    { category: 'Ноутбуки', revenue: 1890000, orders: 34, growth: 8.7 },
    { category: 'Аксесуари', revenue: 456000, orders: 234, growth: 22.4 },
    { category: 'Аудіо', revenue: 678000, orders: 156, growth: -3.2 },
    { category: 'Планшети', revenue: 534000, orders: 28, growth: 5.6 },
    { category: 'Годинники', revenue: 445000, orders: 67, growth: 18.9 },
];

const topProducts = [
    { name: 'iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', sold: 45, revenue: 2474955, stock: 23 },
    { name: 'MacBook Pro 14" M3', sku: 'APL-MBP14-M3', sold: 23, revenue: 2069977, stock: 8 },
    { name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-GS24U-256', sold: 38, revenue: 1253962, stock: 15 },
    { name: 'Apple AirPods Pro 2', sku: 'APL-APP2-WHT', sold: 89, revenue: 889911, stock: 45 },
    { name: 'Apple Watch Ultra 2', sku: 'APL-AWU2-49', sold: 34, revenue: 1189966, stock: 12 },
    { name: 'Sony WH-1000XM5', sku: 'SNY-WH1000XM5', sold: 56, revenue: 671944, stock: 28 },
];

const salesByRegion = [
    { region: 'Київ', revenue: 2890000, orders: 456, percentage: 38 },
    { region: 'Харків', revenue: 890000, orders: 134, percentage: 12 },
    { region: 'Одеса', revenue: 756000, orders: 112, percentage: 10 },
    { region: 'Дніпро', revenue: 678000, orders: 98, percentage: 9 },
    { region: 'Львів', revenue: 645000, orders: 87, percentage: 8 },
    { region: 'Інші', revenue: 1741000, orders: 267, percentage: 23 },
];

export default function SalesReportsPage() {
    const [period, setPeriod] = useState('month');
    const [view, setView] = useState<'chart' | 'table'>('chart');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Calculate totals
    const totalRevenue = dailySales.reduce((sum, day) => sum + day.revenue, 0);
    const totalOrders = dailySales.reduce((sum, day) => sum + day.orders, 0);
    const avgOrderValue = Math.round(totalRevenue / totalOrders);
    const maxRevenue = Math.max(...dailySales.map(d => d.revenue));

    // Previous period comparison (mock)
    const prevPeriodRevenue = totalRevenue * 0.88;
    const revenueGrowth = ((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue * 100).toFixed(1);

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
                        <span className="text-gray-900">Продажі</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-gray-900">Звіт по продажах</h1>
                    <p className="text-gray-600">Детальна аналітика продажів та доходу</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="week">Тиждень</option>
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
                            <CurrencyDollarIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +{revenueGrowth}%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{(totalRevenue / 1000000).toFixed(2)}M ₴</p>
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
                            <ChartBarIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            +5.8%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgOrderValue.toLocaleString()} ₴</p>
                    <p className="text-sm text-gray-500">Середній чек</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <ArrowTrendingUpIcon className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                            <ArrowTrendingDownIcon className="w-4 h-4" />
                            -2.1%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">2.8%</p>
                    <p className="text-sm text-gray-500">Конверсія</p>
                </div>
            </div>

            {/* Sales chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Динаміка продажів</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setView('chart')}
                            className={`p-2 rounded-lg ${view === 'chart' ? 'bg-teal-100 text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ChartBarIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setView('table')}
                            className={`p-2 rounded-lg ${view === 'table' ? 'bg-teal-100 text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <TableCellsIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {view === 'chart' ? (
                    <div className="flex items-end justify-between gap-1 h-64">
                        {dailySales.map((day) => (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                <div className="relative w-full group">
                                    <div
                                        className="w-full bg-teal-500 rounded-t transition-all hover:bg-teal-600"
                                        style={{ height: `${(day.revenue / maxRevenue) * 200}px` }}
                                    />
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                        <div>{new Date(day.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</div>
                                        <div>{(day.revenue / 1000).toFixed(0)}k ₴</div>
                                        <div>{day.orders} замовлень</div>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {new Date(day.date).getDate()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b">
                                    <th className="pb-3 pr-4">Дата</th>
                                    <th className="pb-3 pr-4">Замовлень</th>
                                    <th className="pb-3 pr-4">Дохід</th>
                                    <th className="pb-3">Середній чек</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {dailySales.map((day) => (
                                    <tr key={day.date}>
                                        <td className="py-3 pr-4">
                                            {new Date(day.date).toLocaleDateString('uk-UA')}
                                        </td>
                                        <td className="py-3 pr-4">{day.orders}</td>
                                        <td className="py-3 pr-4 font-medium">{day.revenue.toLocaleString()} ₴</td>
                                        <td className="py-3">{day.avgOrder.toLocaleString()} ₴</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Sales by category */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Продажі за категоріями</h2>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg"
                        >
                            <option value="all">Всі категорії</option>
                            <option value="electronics">Електроніка</option>
                            <option value="accessories">Аксесуари</option>
                        </select>
                    </div>
                    <div className="space-y-4">
                        {salesByCategory.map((cat) => (
                            <div key={cat.category}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">{cat.category}</span>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm ${cat.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {cat.growth >= 0 ? '+' : ''}{cat.growth}%
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {(cat.revenue / 1000000).toFixed(2)}M ₴
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-teal-500 h-2 rounded-full"
                                        style={{ width: `${(cat.revenue / salesByCategory[0].revenue) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{cat.orders} замовлень</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sales by region */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Продажі за регіонами</h2>
                    <div className="space-y-4">
                        {salesByRegion.map((region) => (
                            <div key={region.region} className="flex items-center gap-4">
                                <div className="w-16 text-sm text-gray-600">{region.region}</div>
                                <div className="flex-1">
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div
                                            className="bg-blue-500 h-3 rounded-full"
                                            style={{ width: `${region.percentage}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-20 text-right">
                                    <span className="text-sm font-medium text-gray-900">{region.percentage}%</span>
                                </div>
                                <div className="w-24 text-right">
                                    <span className="text-sm text-gray-600">{(region.revenue / 1000).toFixed(0)}k ₴</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top products */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Топ товарів</h2>
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="w-5 h-5 text-gray-400" />
                        <select className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg">
                            <option>За доходом</option>
                            <option>За кількістю</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b">
                                <th className="pb-3 pr-4">#</th>
                                <th className="pb-3 pr-4">Товар</th>
                                <th className="pb-3 pr-4">Артикул</th>
                                <th className="pb-3 pr-4">Продано</th>
                                <th className="pb-3 pr-4">Дохід</th>
                                <th className="pb-3">Залишок</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {topProducts.map((product, index) => (
                                <tr key={product.sku}>
                                    <td className="py-3 pr-4">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                            index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 font-medium text-gray-900">{product.name}</td>
                                    <td className="py-3 pr-4 text-sm text-gray-500 font-mono">{product.sku}</td>
                                    <td className="py-3 pr-4">{product.sold}</td>
                                    <td className="py-3 pr-4 font-medium">{product.revenue.toLocaleString()} ₴</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            product.stock < 10 ? 'bg-red-100 text-red-700' :
                                            product.stock < 20 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {product.stock} шт
                                        </span>
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
