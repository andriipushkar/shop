'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CreditCardIcon,
    BanknotesIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';

interface PaymentTransaction {
    id: string;
    orderId: string;
    date: string;
    customer: string;
    method: 'liqpay' | 'cash' | 'cod';
    amount: number;
    commission: number;
    netAmount: number;
    status: 'success' | 'pending' | 'failed' | 'refunded';
}

const mockTransactions: PaymentTransaction[] = [
    { id: 'TRX-001', orderId: '#12350', date: '12.12.2024 15:30', customer: 'Олександр К.', method: 'liqpay', amount: 70696, commission: 1944, netAmount: 68752, status: 'success' },
    { id: 'TRX-002', orderId: '#12349', date: '12.12.2024 14:15', customer: 'Марія Ш.', method: 'cod', amount: 54999, commission: 1120, netAmount: 53879, status: 'success' },
    { id: 'TRX-003', orderId: '#12348', date: '12.12.2024 12:45', customer: 'Андрій П.', method: 'cash', amount: 15998, commission: 0, netAmount: 15998, status: 'success' },
    { id: 'TRX-004', orderId: '#12347', date: '12.12.2024 11:20', customer: 'Наталія Б.', method: 'liqpay', amount: 124995, commission: 3437, netAmount: 121558, status: 'pending' },
    { id: 'TRX-005', orderId: '#12346', date: '12.12.2024 10:00', customer: 'Віктор М.', method: 'liqpay', amount: 3999, commission: 110, netAmount: 3889, status: 'refunded' },
    { id: 'TRX-006', orderId: '#12345', date: '11.12.2024 18:30', customer: 'Іван П.', method: 'cod', amount: 67998, commission: 1380, netAmount: 66618, status: 'success' },
    { id: 'TRX-007', orderId: '#12344', date: '11.12.2024 16:45', customer: 'Олена К.', method: 'cash', amount: 23996, commission: 0, netAmount: 23996, status: 'success' },
    { id: 'TRX-008', orderId: '#12343', date: '11.12.2024 14:20', customer: 'Сергій Т.', method: 'liqpay', amount: 89999, commission: 2475, netAmount: 87524, status: 'success' },
    { id: 'TRX-009', orderId: '#12342', date: '10.12.2024 11:00', customer: 'Юлія М.', method: 'liqpay', amount: 45000, commission: 1238, netAmount: 43762, status: 'failed' },
    { id: 'TRX-010', orderId: '#12341', date: '10.12.2024 09:30', customer: 'Петро Д.', method: 'cod', amount: 32500, commission: 670, netAmount: 31830, status: 'success' },
];

const paymentMethodNames: Record<string, string> = {
    liqpay: 'LiqPay',
    cash: 'Готівка',
    cod: 'Накладений платіж',
};

export default function PaymentReportsPage() {
    const [transactions] = useState<PaymentTransaction[]>(mockTransactions);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const matchesMethod = selectedMethod === 'all' || t.method === selectedMethod;
        const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
        return matchesMethod && matchesStatus;
    });

    // Calculate stats
    const totalAmount = filteredTransactions.filter(t => t.status === 'success').reduce((sum, t) => sum + t.amount, 0);
    const totalCommission = filteredTransactions.filter(t => t.status === 'success').reduce((sum, t) => sum + t.commission, 0);
    const totalNet = filteredTransactions.filter(t => t.status === 'success').reduce((sum, t) => sum + t.netAmount, 0);
    const successCount = filteredTransactions.filter(t => t.status === 'success').length;
    const pendingCount = filteredTransactions.filter(t => t.status === 'pending').length;
    const failedCount = filteredTransactions.filter(t => t.status === 'failed').length;
    const refundedCount = filteredTransactions.filter(t => t.status === 'refunded').length;

    // Stats by method
    const byMethod = {
        liqpay: filteredTransactions.filter(t => t.method === 'liqpay' && t.status === 'success'),
        cash: filteredTransactions.filter(t => t.method === 'cash' && t.status === 'success'),
        cod: filteredTransactions.filter(t => t.method === 'cod' && t.status === 'success'),
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Успішно</span>;
            case 'pending':
                return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Очікує</span>;
            case 'failed':
                return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Помилка</span>;
            case 'refunded':
                return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Повернено</span>;
            default:
                return null;
        }
    };

    const getMethodIcon = (method: string) => {
        switch (method) {
            case 'liqpay':
                return <CreditCardIcon className="w-4 h-4" />;
            case 'cash':
                return <BanknotesIcon className="w-4 h-4" />;
            case 'cod':
                return <span className="text-xs">📦</span>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/reports"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Звіт по платежах</h1>
                        <p className="text-gray-600">Статистика та аналітика платежів</p>
                    </div>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Експорт
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Загальна сума</p>
                            <p className="text-2xl font-bold text-gray-900">{totalAmount.toLocaleString()} ₴</p>
                        </div>
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                            <ChartBarIcon className="w-6 h-6 text-teal-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-sm">
                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 font-medium">+12.5%</span>
                        <span className="text-gray-500">vs минулий місяць</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Комісії</p>
                            <p className="text-2xl font-bold text-orange-600">-{totalCommission.toLocaleString()} ₴</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <BanknotesIcon className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                        {((totalCommission / totalAmount) * 100).toFixed(2)}% від обороту
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Чистий дохід</p>
                            <p className="text-2xl font-bold text-green-600">{totalNet.toLocaleString()} ₴</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-sm">
                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 font-medium">+8.3%</span>
                        <span className="text-gray-500">vs минулий місяць</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Транзакцій</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredTransactions.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <CreditCardIcon className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-green-600">{successCount} успішних</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-yellow-600">{pendingCount} очікують</span>
                    </div>
                </div>
            </div>

            {/* Stats by Payment Method */}
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">LP</span>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">LiqPay</p>
                            <p className="text-sm text-gray-500">{byMethod.liqpay.length} транзакцій</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Сума:</span>
                            <span className="font-medium">{byMethod.liqpay.reduce((s, t) => s + t.amount, 0).toLocaleString()} ₴</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Комісія:</span>
                            <span className="font-medium text-orange-600">-{byMethod.liqpay.reduce((s, t) => s + t.commission, 0).toLocaleString()} ₴</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                            <BanknotesIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Готівка</p>
                            <p className="text-sm text-gray-500">{byMethod.cash.length} транзакцій</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Сума:</span>
                            <span className="font-medium">{byMethod.cash.reduce((s, t) => s + t.amount, 0).toLocaleString()} ₴</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Комісія:</span>
                            <span className="font-medium text-green-600">0 ₴</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-lg">📦</span>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Накладений платіж</p>
                            <p className="text-sm text-gray-500">{byMethod.cod.length} транзакцій</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Сума:</span>
                            <span className="font-medium">{byMethod.cod.reduce((s, t) => s + t.amount, 0).toLocaleString()} ₴</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Комісія НП:</span>
                            <span className="font-medium text-orange-600">-{byMethod.cod.reduce((s, t) => s + t.commission, 0).toLocaleString()} ₴</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="text-gray-400">—</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>

                    <select
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="all">Всі методи</option>
                        <option value="liqpay">LiqPay</option>
                        <option value="cash">Готівка</option>
                        <option value="cod">Накладений платіж</option>
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="all">Всі статуси</option>
                        <option value="success">Успішно</option>
                        <option value="pending">Очікує</option>
                        <option value="failed">Помилка</option>
                        <option value="refunded">Повернено</option>
                    </select>

                    <button className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                        <FunnelIcon className="w-4 h-4" />
                        Більше фільтрів
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Транзакції</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Метод</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Сума</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Комісія</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Чисто</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.map((transaction) => (
                                <tr key={transaction.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{transaction.id}</td>
                                    <td className="px-6 py-4">
                                        <Link href={`/admin/orders/${transaction.orderId.replace('#', '')}`} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                                            {transaction.orderId}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{transaction.date}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.customer}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            {getMethodIcon(transaction.method)}
                                            <span>{paymentMethodNames[transaction.method]}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                                        {transaction.amount.toLocaleString()} ₴
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        {transaction.commission > 0 ? (
                                            <span className="text-orange-600">-{transaction.commission.toLocaleString()} ₴</span>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-green-600 text-right">
                                        {transaction.netAmount.toLocaleString()} ₴
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(transaction.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary row */}
                <div className="px-6 py-4 bg-gray-50 border-t">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                            Показано {filteredTransactions.length} транзакцій
                        </span>
                        <div className="flex items-center gap-6 text-sm">
                            <span className="text-gray-500">
                                Всього: <span className="font-semibold text-gray-900">{totalAmount.toLocaleString()} ₴</span>
                            </span>
                            <span className="text-gray-500">
                                Комісії: <span className="font-semibold text-orange-600">-{totalCommission.toLocaleString()} ₴</span>
                            </span>
                            <span className="text-gray-500">
                                Чистий: <span className="font-semibold text-green-600">{totalNet.toLocaleString()} ₴</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
