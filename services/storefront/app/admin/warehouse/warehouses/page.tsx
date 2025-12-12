'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    BuildingStorefrontIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    PencilIcon,
    TrashIcon,
    MapPinIcon,
    PhoneIcon,
    EnvelopeIcon,
    UserIcon,
    CheckCircleIcon,
    XCircleIcon,
    CubeIcon,
    ArrowLeftIcon,
    EllipsisVerticalIcon,
    Cog6ToothIcon,
} from '@heroicons/react/24/outline';

interface Warehouse {
    id: string;
    code: string;
    name: string;
    type: 'main' | 'store' | 'dropship' | 'supplier';
    address: {
        city: string;
        street: string;
        building: string;
    };
    phone: string;
    email: string;
    manager: string;
    priority: number;
    isActive: boolean;
    isDefault: boolean;
    acceptsOrders: boolean;
    totalProducts: number;
    totalValue: number;
    lowStockItems: number;
    createdAt: string;
}

const mockWarehouses: Warehouse[] = [
    {
        id: '1',
        code: 'WH-001',
        name: 'Головний склад',
        type: 'main',
        address: { city: 'Київ', street: 'вул. Промислова', building: '25' },
        phone: '+380 44 123 4567',
        email: 'warehouse@myshop.ua',
        manager: 'Петренко Олександр',
        priority: 1,
        isActive: true,
        isDefault: true,
        acceptsOrders: true,
        totalProducts: 3200,
        totalValue: 8500000,
        lowStockItems: 23,
        createdAt: '2023-01-15',
    },
    {
        id: '2',
        code: 'ST-001',
        name: 'Магазин "Центр"',
        type: 'store',
        address: { city: 'Київ', street: 'вул. Хрещатик', building: '15' },
        phone: '+380 44 234 5678',
        email: 'center@myshop.ua',
        manager: 'Коваленко Марія',
        priority: 2,
        isActive: true,
        isDefault: false,
        acceptsOrders: true,
        totalProducts: 450,
        totalValue: 1200000,
        lowStockItems: 8,
        createdAt: '2023-03-20',
    },
    {
        id: '3',
        code: 'ST-002',
        name: 'Магазин "Лівий берег"',
        type: 'store',
        address: { city: 'Київ', street: 'пр. Бажана', building: '8А' },
        phone: '+380 44 345 6789',
        email: 'left-bank@myshop.ua',
        manager: 'Шевченко Іван',
        priority: 3,
        isActive: true,
        isDefault: false,
        acceptsOrders: true,
        totalProducts: 380,
        totalValue: 980000,
        lowStockItems: 12,
        createdAt: '2023-05-10',
    },
    {
        id: '4',
        code: 'PV-001',
        name: 'Пункт видачі "Поштомат"',
        type: 'store',
        address: { city: 'Київ', street: 'вул. Велика Васильківська', building: '100' },
        phone: '+380 44 456 7890',
        email: 'pickup@myshop.ua',
        manager: 'Бондар Олена',
        priority: 4,
        isActive: true,
        isDefault: false,
        acceptsOrders: false,
        totalProducts: 156,
        totalValue: 420000,
        lowStockItems: 4,
        createdAt: '2023-07-01',
    },
    {
        id: '5',
        code: 'DS-001',
        name: 'Дропшипінг "TechSupply"',
        type: 'dropship',
        address: { city: 'Одеса', street: 'вул. Дерибасівська', building: '50' },
        phone: '+380 48 567 8901',
        email: 'partner@techsupply.ua',
        manager: 'Мельник Сергій',
        priority: 5,
        isActive: true,
        isDefault: false,
        acceptsOrders: true,
        totalProducts: 670,
        totalValue: 1350000,
        lowStockItems: 0,
        createdAt: '2023-09-15',
    },
    {
        id: '6',
        code: 'SP-001',
        name: 'Постачальник "Apple Ukraine"',
        type: 'supplier',
        address: { city: 'Київ', street: 'вул. Володимирська', building: '12' },
        phone: '+380 44 678 9012',
        email: 'orders@apple.ua',
        manager: 'Яковенко Наталія',
        priority: 10,
        isActive: true,
        isDefault: false,
        acceptsOrders: false,
        totalProducts: 0,
        totalValue: 0,
        lowStockItems: 0,
        createdAt: '2023-02-01',
    },
];

const typeLabels: Record<string, { label: string; color: string; bgColor: string }> = {
    main: { label: 'Головний склад', color: 'text-teal-700', bgColor: 'bg-teal-100' },
    store: { label: 'Магазин', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    dropship: { label: 'Дропшипінг', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    supplier: { label: 'Постачальник', color: 'text-amber-700', bgColor: 'bg-amber-100' },
};

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>(mockWarehouses);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [showInactive, setShowInactive] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

    const filteredWarehouses = warehouses.filter(w => {
        const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
                            w.code.toLowerCase().includes(search.toLowerCase()) ||
                            w.address.city.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || w.type === typeFilter;
        const matchesActive = showInactive || w.isActive;
        return matchesSearch && matchesType && matchesActive;
    });

    const handleDelete = (id: string) => {
        if (confirm('Ви впевнені, що хочете видалити цей склад?')) {
            setWarehouses(prev => prev.filter(w => w.id !== id));
        }
    };

    const handleToggleActive = (id: string) => {
        setWarehouses(prev => prev.map(w =>
            w.id === id ? { ...w, isActive: !w.isActive } : w
        ));
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/warehouse" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Склади та точки</h1>
                    <p className="text-gray-500">Управління складами, магазинами та партнерами</p>
                </div>
                <Link
                    href="/admin/warehouse/warehouses/new"
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span className="font-medium">Додати склад</span>
                </Link>
            </div>

            {/* Фільтри */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Пошук за назвою, кодом, містом..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                        <option value="all">Всі типи</option>
                        <option value="main">Головний склад</option>
                        <option value="store">Магазини</option>
                        <option value="dropship">Дропшипінг</option>
                        <option value="supplier">Постачальники</option>
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-600">Показати неактивні</span>
                    </label>
                </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Всього складів</p>
                    <p className="text-2xl font-bold text-gray-900">{warehouses.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Активних</p>
                    <p className="text-2xl font-bold text-green-600">{warehouses.filter(w => w.isActive).length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Загальна вартість</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {(warehouses.reduce((sum, w) => sum + w.totalValue, 0) / 1000000).toFixed(1)} млн ₴
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Критичні залишки</p>
                    <p className="text-2xl font-bold text-amber-600">
                        {warehouses.reduce((sum, w) => sum + w.lowStockItems, 0)}
                    </p>
                </div>
            </div>

            {/* Список складів */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Склад</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Тип</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Адреса</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Відповідальний</th>
                                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Товарів</th>
                                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Вартість</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Статус</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredWarehouses.map((warehouse) => (
                                <tr key={warehouse.id} className={`hover:bg-gray-50 ${!warehouse.isActive ? 'opacity-60' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${typeLabels[warehouse.type].bgColor}`}>
                                                <BuildingStorefrontIcon className={`w-5 h-5 ${typeLabels[warehouse.type].color}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{warehouse.name}</span>
                                                    {warehouse.isDefault && (
                                                        <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                                                            За замовч.
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-500">{warehouse.code}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${typeLabels[warehouse.type].bgColor} ${typeLabels[warehouse.type].color}`}>
                                            {typeLabels[warehouse.type].label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <MapPinIcon className="w-4 h-4 text-gray-400" />
                                            <span>{warehouse.address.city}, {warehouse.address.street}, {warehouse.address.building}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <UserIcon className="w-4 h-4 text-gray-400" />
                                            <span>{warehouse.manager}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="font-medium text-gray-900">{warehouse.totalProducts.toLocaleString()}</span>
                                            {warehouse.lowStockItems > 0 && (
                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                                    {warehouse.lowStockItems} крит.
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-medium text-gray-900">
                                            {(warehouse.totalValue / 1000).toFixed(0)}K ₴
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(warehouse.id)}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                warehouse.isActive
                                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                            title={warehouse.isActive ? 'Активний' : 'Неактивний'}
                                        >
                                            {warehouse.isActive ? (
                                                <CheckCircleIcon className="w-5 h-5" />
                                            ) : (
                                                <XCircleIcon className="w-5 h-5" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Link
                                                href={`/admin/warehouse/warehouses/${warehouse.id}`}
                                                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                title="Переглянути"
                                            >
                                                <CubeIcon className="w-5 h-5" />
                                            </Link>
                                            <Link
                                                href={`/admin/warehouse/warehouses/${warehouse.id}/edit`}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Редагувати"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </Link>
                                            <Link
                                                href={`/admin/warehouse/warehouses/${warehouse.id}/settings`}
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                title="Налаштування"
                                            >
                                                <Cog6ToothIcon className="w-5 h-5" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(warehouse.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Видалити"
                                                disabled={warehouse.isDefault}
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

                {filteredWarehouses.length === 0 && (
                    <div className="p-12 text-center">
                        <BuildingStorefrontIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Складів не знайдено</p>
                    </div>
                )}
            </div>
        </div>
    );
}
