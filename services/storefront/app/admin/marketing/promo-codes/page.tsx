'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    TagIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    CalendarIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClipboardDocumentIcon,
    ChartBarIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';

type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';

interface PromoCode {
    id: string;
    code: string;
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usageCount: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
}

const mockPromoCodes: PromoCode[] = [
    {
        id: '1',
        code: 'WELCOME10',
        name: 'Знижка для нових клієнтів',
        description: '10% знижка на перше замовлення',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 500,
        maxDiscountAmount: 1000,
        usageLimit: 1000,
        usageCount: 234,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
    },
    {
        id: '2',
        code: 'SUMMER500',
        name: 'Літня акція',
        description: 'Знижка 500 грн на замовлення від 3000 грн',
        discountType: 'fixed',
        discountValue: 500,
        minOrderAmount: 3000,
        usageLimit: 500,
        usageCount: 156,
        startDate: '2024-06-01',
        endDate: '2024-08-31',
        isActive: true,
    },
    {
        id: '3',
        code: 'FREESHIP',
        name: 'Безкоштовна доставка',
        description: 'Безкоштовна доставка на будь-яке замовлення',
        discountType: 'free_shipping',
        discountValue: 0,
        usageCount: 89,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
    },
    {
        id: '4',
        code: 'BUY2GET1',
        name: 'Купи 2 отримай 1',
        description: 'При покупці 2 товарів - 3й безкоштовно',
        discountType: 'buy_x_get_y',
        discountValue: 100,
        usageCount: 45,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
    },
    {
        id: '5',
        code: 'VIP25',
        name: 'VIP знижка',
        description: '25% знижка для VIP клієнтів',
        discountType: 'percentage',
        discountValue: 25,
        minOrderAmount: 1000,
        maxDiscountAmount: 5000,
        usageCount: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
    },
    {
        id: '6',
        code: 'BLACKFRIDAY',
        name: 'Чорна п\'ятниця',
        description: '30% знижка на все',
        discountType: 'percentage',
        discountValue: 30,
        usageLimit: 2000,
        usageCount: 2000,
        startDate: '2023-11-24',
        endDate: '2023-11-26',
        isActive: false,
    },
];

const discountTypeLabels: Record<DiscountType, string> = {
    percentage: 'Відсоток',
    fixed: 'Фіксована сума',
    free_shipping: 'Безкоштовна доставка',
    buy_x_get_y: 'Купи X отримай Y',
};

const discountTypeColors: Record<DiscountType, string> = {
    percentage: 'bg-blue-100 text-blue-700',
    fixed: 'bg-green-100 text-green-700',
    free_shipping: 'bg-purple-100 text-purple-700',
    buy_x_get_y: 'bg-orange-100 text-orange-700',
};

export default function PromoCodesPage() {
    const [promoCodes, setPromoCodes] = useState(mockPromoCodes);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterType, setFilterType] = useState<DiscountType | 'all'>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const filteredCodes = promoCodes.filter(code => {
        const matchesSearch = code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            code.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && code.isActive) ||
            (filterStatus === 'inactive' && !code.isActive);
        const matchesType = filterType === 'all' || code.discountType === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    const stats = {
        total: promoCodes.length,
        active: promoCodes.filter(c => c.isActive).length,
        totalUsage: promoCodes.reduce((sum, c) => sum + c.usageCount, 0),
        avgDiscount: Math.round(promoCodes.filter(c => c.discountType === 'percentage').reduce((sum, c) => sum + c.discountValue, 0) / promoCodes.filter(c => c.discountType === 'percentage').length),
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const toggleStatus = (id: string) => {
        setPromoCodes(prev => prev.map(c =>
            c.id === id ? { ...c, isActive: !c.isActive } : c
        ));
    };

    const deleteCode = (id: string) => {
        if (confirm('Ви впевнені, що хочете видалити цей промокод?')) {
            setPromoCodes(prev => prev.filter(c => c.id !== id));
        }
    };

    const formatDiscount = (code: PromoCode) => {
        switch (code.discountType) {
            case 'percentage':
                return `${code.discountValue}%`;
            case 'fixed':
                return `${code.discountValue} ₴`;
            case 'free_shipping':
                return 'Безкоштовно';
            case 'buy_x_get_y':
                return '2+1';
            default:
                return '-';
        }
    };

    const isExpired = (endDate: string) => new Date(endDate) < new Date();

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-500">
                <Link href="/admin" className="hover:text-teal-600">Адмін</Link>
                <span className="mx-2">/</span>
                <Link href="/admin/marketing" className="hover:text-teal-600">Маркетинг</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Промокоди</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Промокоди</h1>
                    <p className="text-gray-600">Управління знижками та акціями</p>
                </div>
                <button
                    onClick={() => { setEditingCode(null); setShowModal(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Новий промокод
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <TagIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього кодів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                            <p className="text-sm text-gray-500">Активних</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ChartBarIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalUsage}</p>
                            <p className="text-sm text-gray-500">Використань</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <TagIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.avgDiscount}%</p>
                            <p className="text-sm text-gray-500">Середня знижка</p>
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
                            placeholder="Пошук за кодом або назвою..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                            <option value="all">Всі статуси</option>
                            <option value="active">Активні</option>
                            <option value="inactive">Неактивні</option>
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                            <option value="all">Всі типи</option>
                            <option value="percentage">Відсоток</option>
                            <option value="fixed">Фіксована сума</option>
                            <option value="free_shipping">Безкоштовна доставка</option>
                            <option value="buy_x_get_y">Купи X отримай Y</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Код</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Назва</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Тип</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Знижка</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Використано</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Період</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Статус</th>
                                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredCodes.map((code) => (
                                <tr key={code.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-medium">
                                                {code.code}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(code.code)}
                                                className="text-gray-400 hover:text-gray-600"
                                                title="Копіювати"
                                            >
                                                {copiedCode === code.code ? (
                                                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <ClipboardDocumentIcon className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900">{code.name}</p>
                                        <p className="text-sm text-gray-500">{code.description}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${discountTypeColors[code.discountType]}`}>
                                            {discountTypeLabels[code.discountType]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {formatDiscount(code)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{code.usageCount}</span>
                                            {code.usageLimit && (
                                                <span className="text-gray-500">/ {code.usageLimit}</span>
                                            )}
                                        </div>
                                        {code.usageLimit && (
                                            <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                                                <div
                                                    className="h-full bg-teal-500 rounded-full"
                                                    style={{ width: `${Math.min(100, (code.usageCount / code.usageLimit) * 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm">
                                            <p>{new Date(code.startDate).toLocaleDateString('uk-UA')}</p>
                                            <p className="text-gray-500">- {new Date(code.endDate).toLocaleDateString('uk-UA')}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isExpired(code.endDate) ? (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                                Закінчився
                                            </span>
                                        ) : code.isActive ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                Активний
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                                Неактивний
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => toggleStatus(code.id)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    code.isActive
                                                        ? 'text-orange-600 hover:bg-orange-50'
                                                        : 'text-green-600 hover:bg-green-50'
                                                }`}
                                                title={code.isActive ? 'Деактивувати' : 'Активувати'}
                                            >
                                                {code.isActive ? (
                                                    <XCircleIcon className="w-5 h-5" />
                                                ) : (
                                                    <CheckCircleIcon className="w-5 h-5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => { setEditingCode(code); setShowModal(true); }}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Редагувати"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => deleteCode(code.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Видалити"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredCodes.length === 0 && (
                    <div className="text-center py-12">
                        <TagIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Промокодів не знайдено</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {editingCode ? 'Редагувати промокод' : 'Новий промокод'}
                            </h3>
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Код *
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue={editingCode?.code || ''}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 uppercase"
                                            placeholder="PROMO2024"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Тип знижки *
                                        </label>
                                        <select
                                            defaultValue={editingCode?.discountType || 'percentage'}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        >
                                            <option value="percentage">Відсоток</option>
                                            <option value="fixed">Фіксована сума</option>
                                            <option value="free_shipping">Безкоштовна доставка</option>
                                            <option value="buy_x_get_y">Купи X отримай Y</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва *
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={editingCode?.name || ''}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Назва акції"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Опис
                                    </label>
                                    <textarea
                                        defaultValue={editingCode?.description || ''}
                                        rows={2}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Опис промокоду"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Розмір знижки *
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={editingCode?.discountValue || ''}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Мін. сума замовлення
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={editingCode?.minOrderAmount || ''}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Дата початку *
                                        </label>
                                        <input
                                            type="date"
                                            defaultValue={editingCode?.startDate || ''}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Дата закінчення *
                                        </label>
                                        <input
                                            type="date"
                                            defaultValue={editingCode?.endDate || ''}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ліміт використань
                                    </label>
                                    <input
                                        type="number"
                                        defaultValue={editingCode?.usageLimit || ''}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Без обмежень"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        {editingCode ? 'Зберегти' : 'Створити'}
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
