'use client';

import { useState } from 'react';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    ClipboardDocumentIcon,
    TicketIcon,
    CalendarIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { promotions } from '@/lib/mock-data';

// Transform promotions to promo codes format
const promoCodesData = promotions.map(p => ({
    id: p.id,
    code: p.code || `PROMO${p.id}`,
    discount: p.discount,
    type: p.type === 'percentage' ? 'percent' : 'fixed',
    minOrder: p.minOrderAmount || 0,
    maxUses: p.usageLimit || null,
    usedCount: p.usedCount,
    startDate: p.startDate,
    endDate: p.endDate,
    status: !p.isActive ? 'inactive' :
        new Date(p.endDate.split('.').reverse().join('-')) < new Date() ? 'expired' :
        new Date(p.startDate.split('.').reverse().join('-')) > new Date() ? 'scheduled' : 'active',
    name: p.name,
    maxDiscount: p.maxDiscount,
}));

const ITEMS_PER_PAGE = 15;

export default function AdminPromoPage() {
    const [promoCodes] = useState(promoCodesData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredCodes = promoCodes.filter(code => {
        const matchesSearch = code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            code.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === 'all' || code.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredCodes.length / ITEMS_PER_PAGE);
    const paginatedCodes = filteredCodes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { icon: React.ElementType; className: string; label: string }> = {
            active: { icon: CheckCircleIcon, className: 'bg-green-100 text-green-800', label: 'Активний' },
            scheduled: { icon: ClockIcon, className: 'bg-blue-100 text-blue-800', label: 'Заплановано' },
            expired: { icon: XCircleIcon, className: 'bg-gray-100 text-gray-800', label: 'Завершено' },
            inactive: { icon: XCircleIcon, className: 'bg-red-100 text-red-800', label: 'Неактивний' },
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

    // Stats
    const stats = {
        active: promoCodes.filter(c => c.status === 'active').length,
        totalUsed: promoCodes.reduce((sum, c) => sum + c.usedCount, 0),
        totalSaved: promoCodes.reduce((sum, c) => {
            if (c.type === 'fixed') return sum + (c.discount * c.usedCount);
            return sum + (c.discount * c.usedCount * 10); // Approximate for percent
        }, 0),
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Промокоди</h1>
                    <p className="text-gray-600">Управління знижками та акціями</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Створити промокод
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <TicketIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                            <p className="text-sm text-gray-500">Активних промокодів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalUsed}</p>
                            <p className="text-sm text-gray-500">Використано разів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <TicketIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{(stats.totalSaved / 1000).toFixed(0)}k ₴</p>
                            <p className="text-sm text-gray-500">Зекономлено клієнтами</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за кодом..."
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
                        <option value="active">Активні</option>
                        <option value="scheduled">Заплановані</option>
                        <option value="expired">Завершені</option>
                        <option value="inactive">Неактивні</option>
                    </select>
                </div>
            </div>

            {/* Promo codes table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Промокод</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Знижка</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Мін. замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Використано</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Період дії</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedCodes.map((promo) => (
                                <tr key={promo.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <code className="px-3 py-1 bg-gray-100 rounded-lg font-mono text-sm font-medium text-gray-900">
                                                {promo.code}
                                            </code>
                                            <button
                                                onClick={() => copyCode(promo.code)}
                                                className="p-1 text-gray-400 hover:text-teal-600 transition-colors"
                                            >
                                                <ClipboardDocumentIcon className="w-4 h-4" />
                                            </button>
                                            {copiedCode === promo.code && (
                                                <span className="text-xs text-green-600">Скопійовано!</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {promo.type === 'percent' ? `${promo.discount}%` : `${promo.discount} ₴`}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {promo.minOrder.toLocaleString()} ₴
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {promo.usedCount} / {promo.maxUses || '∞'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                                            {promo.startDate} - {promo.endDate || 'Безстроково'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(promo.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                        <p className="text-sm text-gray-600">
                            Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCodes.length)} з {filteredCodes.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-10 h-10 rounded-lg font-medium ${
                                            currentPage === pageNum
                                                ? 'bg-teal-600 text-white'
                                                : 'border border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Створити промокод</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Код
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono uppercase"
                                        placeholder="MYCODE2024"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Тип знижки
                                        </label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                            <option value="percent">Відсоток (%)</option>
                                            <option value="fixed">Фіксована (₴)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Розмір знижки
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="10"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Мін. сума замовлення
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Макс. використань
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="100 (пусто = необмежено)"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Дата початку
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Дата закінчення
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Створити
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
