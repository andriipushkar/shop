'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ClipboardDocumentCheckIcon,
    PlusIcon,
    PlayIcon,
    PauseIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    DocumentTextIcon,
    PrinterIcon,
    ArrowDownTrayIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    UserIcon,
    CalendarIcon,
    CubeIcon,
} from '@heroicons/react/24/outline';

type InventoryStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

interface InventoryCount {
    id: string;
    name: string;
    type: 'full' | 'partial' | 'spot';
    status: InventoryStatus;
    warehouse: string;
    zones: string[];
    startedAt?: string;
    completedAt?: string;
    scheduledAt?: string;
    assignedTo: string;
    totalProducts: number;
    countedProducts: number;
    discrepancies: number;
    createdAt: string;
}

const mockInventoryCounts: InventoryCount[] = [
    {
        id: '1',
        name: 'Повна інвентаризація Q4 2024',
        type: 'full',
        status: 'completed',
        warehouse: 'Головний склад',
        zones: ['A', 'B', 'C', 'D'],
        startedAt: '2024-01-05T08:00:00',
        completedAt: '2024-01-07T18:30:00',
        assignedTo: 'Олександр Петренко',
        totalProducts: 15420,
        countedProducts: 15420,
        discrepancies: 23,
        createdAt: '2024-01-03T10:00:00',
    },
    {
        id: '2',
        name: 'Вибіркова перевірка - Смартфони',
        type: 'partial',
        status: 'in_progress',
        warehouse: 'Головний склад',
        zones: ['A'],
        startedAt: '2024-01-15T09:00:00',
        assignedTo: 'Марія Коваленко',
        totalProducts: 850,
        countedProducts: 567,
        discrepancies: 5,
        createdAt: '2024-01-14T14:00:00',
    },
    {
        id: '3',
        name: 'Планова перевірка - Аксесуари',
        type: 'partial',
        status: 'planned',
        warehouse: 'Головний склад',
        zones: ['B'],
        scheduledAt: '2024-01-20T08:00:00',
        assignedTo: 'Іван Сидоренко',
        totalProducts: 3200,
        countedProducts: 0,
        discrepancies: 0,
        createdAt: '2024-01-10T11:00:00',
    },
    {
        id: '4',
        name: 'Точкова перевірка - Ноутбуки',
        type: 'spot',
        status: 'completed',
        warehouse: 'Головний склад',
        zones: ['A-02'],
        startedAt: '2024-01-12T14:00:00',
        completedAt: '2024-01-12T16:30:00',
        assignedTo: 'Анна Шевченко',
        totalProducts: 120,
        countedProducts: 120,
        discrepancies: 2,
        createdAt: '2024-01-12T13:00:00',
    },
];

const statusConfig: Record<InventoryStatus, { label: string; color: string; icon: React.ElementType }> = {
    planned: { label: 'Заплановано', color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
    in_progress: { label: 'В процесі', color: 'bg-yellow-100 text-yellow-700', icon: PlayIcon },
    completed: { label: 'Завершено', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
    cancelled: { label: 'Скасовано', color: 'bg-gray-100 text-gray-600', icon: PauseIcon },
};

const typeConfig: Record<string, { label: string; color: string }> = {
    full: { label: 'Повна', color: 'bg-purple-100 text-purple-700' },
    partial: { label: 'Часткова', color: 'bg-blue-100 text-blue-700' },
    spot: { label: 'Точкова', color: 'bg-green-100 text-green-700' },
};

export default function InventoryPage() {
    const [inventories, setInventories] = useState(mockInventoryCounts);
    const [filterStatus, setFilterStatus] = useState<InventoryStatus | 'all'>('all');
    const [showModal, setShowModal] = useState(false);

    const filteredInventories = inventories.filter(inv =>
        filterStatus === 'all' || inv.status === filterStatus
    );

    const stats = {
        total: inventories.length,
        inProgress: inventories.filter(i => i.status === 'in_progress').length,
        completed: inventories.filter(i => i.status === 'completed').length,
        totalDiscrepancies: inventories.reduce((sum, i) => sum + i.discrepancies, 0),
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-500">
                <Link href="/admin" className="hover:text-teal-600">Адмін</Link>
                <span className="mx-2">/</span>
                <Link href="/admin/warehouse" className="hover:text-teal-600">Склад</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Інвентаризація</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Інвентаризація</h1>
                    <p className="text-gray-600">Управління перевірками залишків на складі</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Нова інвентаризація
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <ClipboardDocumentCheckIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього перевірок</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <PlayIcon className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                            <p className="text-sm text-gray-500">В процесі</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                            <p className="text-sm text-gray-500">Завершено</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalDiscrepancies}</p>
                            <p className="text-sm text-gray-500">Розбіжностей</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-wrap gap-2">
                    {(['all', 'planned', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filterStatus === status
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {status === 'all' ? 'Всі' : statusConfig[status].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Inventories List */}
            <div className="space-y-4">
                {filteredInventories.map((inventory) => {
                    const StatusIcon = statusConfig[inventory.status].icon;
                    const progress = inventory.totalProducts > 0
                        ? Math.round((inventory.countedProducts / inventory.totalProducts) * 100)
                        : 0;

                    return (
                        <div key={inventory.id} className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-gray-900">{inventory.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[inventory.status].color}`}>
                                            {statusConfig[inventory.status].label}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig[inventory.type].color}`}>
                                            {typeConfig[inventory.type].label}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <CubeIcon className="w-4 h-4" />
                                            {inventory.warehouse}
                                        </span>
                                        <span>Зони: {inventory.zones.join(', ')}</span>
                                        <span className="flex items-center gap-1">
                                            <UserIcon className="w-4 h-4" />
                                            {inventory.assignedTo}
                                        </span>
                                        {inventory.scheduledAt && inventory.status === 'planned' && (
                                            <span className="flex items-center gap-1">
                                                <CalendarIcon className="w-4 h-4" />
                                                Заплановано: {formatDate(inventory.scheduledAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="lg:w-48">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-500">Прогрес</span>
                                        <span className="text-sm font-medium">{progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${
                                                inventory.status === 'completed' ? 'bg-green-500' : 'bg-teal-500'
                                            }`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                                        <span>{inventory.countedProducts.toLocaleString()} / {inventory.totalProducts.toLocaleString()}</span>
                                        {inventory.discrepancies > 0 && (
                                            <span className="text-red-600">{inventory.discrepancies} розбіжн.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {inventory.status === 'planned' && (
                                        <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Розпочати">
                                            <PlayIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {inventory.status === 'in_progress' && (
                                        <Link
                                            href={`/admin/warehouse/inventory/${inventory.id}`}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                                        >
                                            Продовжити
                                        </Link>
                                    )}
                                    {inventory.status === 'completed' && (
                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Звіт">
                                            <DocumentTextIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Друк">
                                        <PrinterIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Експорт">
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Нова інвентаризація</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Назва *</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                        placeholder="Планова інвентаризація..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                                            <option value="full">Повна</option>
                                            <option value="partial">Часткова</option>
                                            <option value="spot">Точкова</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Склад *</label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                                            <option>Головний склад</option>
                                            <option>Склад Харків</option>
                                            <option>Склад Одеса</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Зони для перевірки</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['A', 'B', 'C', 'D'].map((zone) => (
                                            <label key={zone} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                                <input type="checkbox" className="rounded text-teal-600" />
                                                <span>Зона {zone}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Відповідальний</label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                                        <option>Олександр Петренко</option>
                                        <option>Марія Коваленко</option>
                                        <option>Іван Сидоренко</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Запланована дата</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
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
