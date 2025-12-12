'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    EyeIcon,
    PencilIcon,
    ArrowsRightLeftIcon,
    QrCodeIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    BuildingStorefrontIcon,
    MapPinIcon,
} from '@heroicons/react/24/outline';

interface StockItem {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    barcode: string;
    category: string;
    warehouseId: string;
    warehouseName: string;
    location: string; // Комірка
    quantity: number;
    reserved: number;
    available: number;
    minStock: number;
    maxStock: number;
    reorderPoint: number;
    costPrice: number;
    sellPrice: number;
    batchNumber?: string;
    expiryDate?: string;
    serialNumbers?: string[];
    abcClass: 'A' | 'B' | 'C';
    xyzClass: 'X' | 'Y' | 'Z';
    lastMovement: string;
    supplier: string;
    imageUrl?: string;
}

const mockStock: StockItem[] = [
    {
        id: '1', productId: 'p1', productName: 'iPhone 15 Pro 256GB Space Black', sku: 'APL-IP15P-256-SB',
        barcode: '0194253401234', category: 'Смартфони', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'A-01-02', quantity: 45, reserved: 12, available: 33, minStock: 20, maxStock: 100,
        reorderPoint: 30, costPrice: 42000, sellPrice: 54999, abcClass: 'A', xyzClass: 'X',
        lastMovement: '2024-01-15T10:30:00', supplier: 'Apple Ukraine'
    },
    {
        id: '2', productId: 'p2', productName: 'Samsung Galaxy S24 Ultra 512GB', sku: 'SAM-S24U-512',
        barcode: '8806095012345', category: 'Смартфони', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'A-01-03', quantity: 28, reserved: 5, available: 23, minStock: 15, maxStock: 50,
        reorderPoint: 20, costPrice: 48000, sellPrice: 59999, abcClass: 'A', xyzClass: 'X',
        lastMovement: '2024-01-15T09:15:00', supplier: 'Samsung Electronics'
    },
    {
        id: '3', productId: 'p3', productName: 'AirPods Pro 2 USB-C', sku: 'APL-APP2-USBC',
        barcode: '0194253401111', category: 'Аксесуари', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'B-02-01', quantity: 156, reserved: 34, available: 122, minStock: 50, maxStock: 200,
        reorderPoint: 80, costPrice: 7500, sellPrice: 10499, abcClass: 'A', xyzClass: 'X',
        lastMovement: '2024-01-15T08:45:00', supplier: 'Apple Ukraine'
    },
    {
        id: '4', productId: 'p4', productName: 'MacBook Air M2 256GB', sku: 'APL-MBA-M2-256',
        barcode: '0194253402222', category: 'Ноутбуки', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'C-01-01', quantity: 8, reserved: 2, available: 6, minStock: 10, maxStock: 30,
        reorderPoint: 15, costPrice: 38000, sellPrice: 47999, abcClass: 'B', xyzClass: 'Y',
        lastMovement: '2024-01-14T16:30:00', supplier: 'Apple Ukraine'
    },
    {
        id: '5', productId: 'p5', productName: 'iPhone 15 Pro Case MagSafe', sku: 'APL-CS-IP15P-MS',
        barcode: '0194253403333', category: 'Аксесуари', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'B-03-02', quantity: 3, reserved: 0, available: 3, minStock: 25, maxStock: 100,
        reorderPoint: 30, costPrice: 1200, sellPrice: 1999, abcClass: 'B', xyzClass: 'Y',
        lastMovement: '2024-01-13T11:00:00', supplier: 'Apple Ukraine'
    },
    {
        id: '6', productId: 'p6', productName: 'Samsung Galaxy Buds2 Pro', sku: 'SAM-GBP2',
        barcode: '8806095054321', category: 'Аксесуари', warehouseId: 'w2', warehouseName: 'Магазин Центр',
        location: 'D-01-01', quantity: 5, reserved: 1, available: 4, minStock: 10, maxStock: 40,
        reorderPoint: 15, costPrice: 5500, sellPrice: 7499, abcClass: 'B', xyzClass: 'Z',
        lastMovement: '2024-01-12T14:20:00', supplier: 'Samsung Electronics'
    },
    {
        id: '7', productId: 'p7', productName: 'Батарейки Duracell AA (8шт)', sku: 'DUR-AA-8',
        barcode: '5000394012345', category: 'Батарейки', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'E-01-01', quantity: 234, reserved: 12, available: 222, minStock: 100, maxStock: 500,
        reorderPoint: 150, costPrice: 180, sellPrice: 299, batchNumber: 'B2024-001', expiryDate: '2026-06-15',
        abcClass: 'C', xyzClass: 'X', lastMovement: '2024-01-10T09:00:00', supplier: 'Procter & Gamble'
    },
    {
        id: '8', productId: 'p8', productName: 'iPad Air 5 64GB Wi-Fi', sku: 'APL-IPA5-64-WF',
        barcode: '0194253404444', category: 'Планшети', warehouseId: 'w1', warehouseName: 'Головний склад',
        location: 'C-02-01', quantity: 0, reserved: 0, available: 0, minStock: 8, maxStock: 25,
        reorderPoint: 12, costPrice: 22000, sellPrice: 27999, abcClass: 'B', xyzClass: 'Y',
        lastMovement: '2024-01-08T10:30:00', supplier: 'Apple Ukraine'
    },
];

const warehouses = [
    { id: 'all', name: 'Всі склади' },
    { id: 'w1', name: 'Головний склад' },
    { id: 'w2', name: 'Магазин Центр' },
    { id: 'w3', name: 'Магазин Лівий берег' },
];

const categories = ['Всі категорії', 'Смартфони', 'Ноутбуки', 'Планшети', 'Аксесуари', 'Батарейки'];

type StockFilter = 'all' | 'low' | 'out' | 'overstock' | 'expiring';

function StockStatusBadge({ item }: { item: StockItem }) {
    if (item.available === 0) {
        return (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                <XCircleIcon className="w-3.5 h-3.5" />
                Немає
            </span>
        );
    }
    if (item.available <= item.minStock) {
        return (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                Критично
            </span>
        );
    }
    if (item.available > item.maxStock) {
        return (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                <ChevronUpIcon className="w-3.5 h-3.5" />
                Надлишок
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Норма
        </span>
    );
}

function ABCXYZBadge({ abc, xyz }: { abc: 'A' | 'B' | 'C'; xyz: 'X' | 'Y' | 'Z' }) {
    const abcColors = { A: 'bg-green-100 text-green-700', B: 'bg-amber-100 text-amber-700', C: 'bg-gray-100 text-gray-700' };
    const xyzColors = { X: 'bg-blue-100 text-blue-700', Y: 'bg-purple-100 text-purple-700', Z: 'bg-pink-100 text-pink-700' };
    return (
        <div className="flex gap-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${abcColors[abc]}`}>{abc}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${xyzColors[xyz]}`}>{xyz}</span>
        </div>
    );
}

export default function StockPage() {
    const [stock, setStock] = useState<StockItem[]>(mockStock);
    const [search, setSearch] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('Всі категорії');
    const [stockFilter, setStockFilter] = useState<StockFilter>('all');
    const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'value' | 'movement'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    const filteredStock = stock.filter(item => {
        const matchesSearch = item.productName.toLowerCase().includes(search.toLowerCase()) ||
                            item.sku.toLowerCase().includes(search.toLowerCase()) ||
                            item.barcode.includes(search);
        const matchesWarehouse = selectedWarehouse === 'all' || item.warehouseId === selectedWarehouse;
        const matchesCategory = selectedCategory === 'Всі категорії' || item.category === selectedCategory;

        let matchesFilter = true;
        switch (stockFilter) {
            case 'low': matchesFilter = item.available > 0 && item.available <= item.minStock; break;
            case 'out': matchesFilter = item.available === 0; break;
            case 'overstock': matchesFilter = item.available > item.maxStock; break;
            case 'expiring': matchesFilter = !!item.expiryDate && new Date(item.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); break;
        }

        return matchesSearch && matchesWarehouse && matchesCategory && matchesFilter;
    }).sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'name': comparison = a.productName.localeCompare(b.productName); break;
            case 'quantity': comparison = a.available - b.available; break;
            case 'value': comparison = (a.available * a.costPrice) - (b.available * b.costPrice); break;
            case 'movement': comparison = new Date(a.lastMovement).getTime() - new Date(b.lastMovement).getTime(); break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    const totalValue = filteredStock.reduce((sum, item) => sum + item.available * item.costPrice, 0);
    const totalItems = filteredStock.reduce((sum, item) => sum + item.available, 0);
    const lowStockCount = stock.filter(item => item.available > 0 && item.available <= item.minStock).length;
    const outOfStockCount = stock.filter(item => item.available === 0).length;

    const handleSelectAll = () => {
        if (selectedItems.length === filteredStock.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(filteredStock.map(item => item.id));
        }
    };

    const handleSelectItem = (id: string) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const exportToCSV = () => {
        const headers = ['SKU', 'Назва', 'Склад', 'Комірка', 'Кількість', 'Резерв', 'Доступно', 'Собівартість', 'Вартість'];
        const rows = filteredStock.map(item => [
            item.sku, item.productName, item.warehouseName, item.location,
            item.quantity, item.reserved, item.available, item.costPrice, item.available * item.costPrice
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `stock_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/warehouse" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Залишки товарів</h1>
                    <p className="text-gray-500">Перегляд та управління залишками по всіх складах</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5 text-gray-600" />
                        <span>Експорт</span>
                    </button>
                    <Link
                        href="/admin/warehouse/scanner"
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                    >
                        <QrCodeIcon className="w-5 h-5" />
                        <span>Сканер</span>
                    </Link>
                </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Загальна кількість</p>
                    <p className="text-2xl font-bold text-gray-900">{totalItems.toLocaleString()} шт.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-gray-500">Вартість залишків</p>
                    <p className="text-2xl font-bold text-gray-900">{(totalValue / 1000000).toFixed(2)} млн ₴</p>
                </div>
                <button
                    onClick={() => setStockFilter('low')}
                    className={`bg-white rounded-xl p-4 border text-left transition-colors ${stockFilter === 'low' ? 'border-amber-300 bg-amber-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                    <p className="text-sm text-gray-500">Критичні залишки</p>
                    <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
                </button>
                <button
                    onClick={() => setStockFilter('out')}
                    className={`bg-white rounded-xl p-4 border text-left transition-colors ${stockFilter === 'out' ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                    <p className="text-sm text-gray-500">Немає в наявності</p>
                    <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
                </button>
            </div>

            {/* Фільтри */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[300px]">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Пошук за назвою, SKU, штрих-кодом..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>
                    <select
                        value={selectedWarehouse}
                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                        {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-colors ${
                            showFilters ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <FunnelIcon className="w-5 h-5" />
                        <span>Фільтри</span>
                    </button>
                    {stockFilter !== 'all' && (
                        <button
                            onClick={() => setStockFilter('all')}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                        >
                            Скинути фільтр ✕
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                            <span className="text-sm text-gray-500 mr-2">Фільтр за статусом:</span>
                            {[
                                { value: 'all', label: 'Всі' },
                                { value: 'low', label: 'Критичні' },
                                { value: 'out', label: 'Немає в наявності' },
                                { value: 'overstock', label: 'Надлишок' },
                                { value: 'expiring', label: 'Терміни спливають' },
                            ].map(filter => (
                                <button
                                    key={filter.value}
                                    onClick={() => setStockFilter(filter.value as StockFilter)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        stockFilter === filter.value
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Масові дії */}
            {selectedItems.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                    <span className="text-teal-700 font-medium">Вибрано: {selectedItems.length} позицій</span>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-100">
                            Переміщення
                        </button>
                        <button className="px-4 py-2 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-100">
                            Інвентаризація
                        </button>
                        <button className="px-4 py-2 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-100">
                            Друк етикеток
                        </button>
                    </div>
                </div>
            )}

            {/* Таблиця */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === filteredStock.length && filteredStock.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                    />
                                </th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Товар</th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Склад / Комірка</th>
                                <th className="px-4 py-4 text-center text-sm font-medium text-gray-500">ABC/XYZ</th>
                                <th className="px-4 py-4 text-right text-sm font-medium text-gray-500 cursor-pointer" onClick={() => { setSortBy('quantity'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                                    <div className="flex items-center justify-end gap-1">
                                        Залишок
                                        {sortBy === 'quantity' && (sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-right text-sm font-medium text-gray-500">Резерв</th>
                                <th className="px-4 py-4 text-right text-sm font-medium text-gray-500">Доступно</th>
                                <th className="px-4 py-4 text-center text-sm font-medium text-gray-500">Статус</th>
                                <th className="px-4 py-4 text-right text-sm font-medium text-gray-500 cursor-pointer" onClick={() => { setSortBy('value'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                                    <div className="flex items-center justify-end gap-1">
                                        Вартість
                                        {sortBy === 'value' && (sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-center text-sm font-medium text-gray-500">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStock.map((item) => (
                                <tr key={item.id} className={`hover:bg-gray-50 ${item.available === 0 ? 'bg-red-50/50' : item.available <= item.minStock ? 'bg-amber-50/50' : ''}`}>
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => handleSelectItem(item.id)}
                                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <CubeIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 line-clamp-1">{item.productName}</p>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <span>{item.sku}</span>
                                                    {item.batchNumber && (
                                                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">Партія: {item.batchNumber}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-700">{item.warehouseName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm mt-1">
                                            <MapPinIcon className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-500 font-mono">{item.location}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <ABCXYZBadge abc={item.abcClass} xyz={item.xyzClass} />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="font-semibold text-gray-900">{item.quantity}</span>
                                        <div className="text-xs text-gray-500">мін: {item.minStock}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {item.reserved > 0 ? (
                                            <span className="text-amber-600 font-medium">{item.reserved}</span>
                                        ) : (
                                            <span className="text-gray-400">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className={`font-bold ${item.available === 0 ? 'text-red-600' : item.available <= item.minStock ? 'text-amber-600' : 'text-green-600'}`}>
                                            {item.available}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <StockStatusBadge item={item} />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="font-medium text-gray-900">
                                            {(item.available * item.costPrice / 1000).toFixed(1)}K ₴
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <Link
                                                href={`/admin/warehouse/stock/${item.id}`}
                                                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"
                                                title="Картка товару"
                                            >
                                                <EyeIcon className="w-5 h-5" />
                                            </Link>
                                            <Link
                                                href={`/admin/warehouse/stock/${item.id}/edit`}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Редагувати"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </Link>
                                            <button
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                                title="Переміщення"
                                            >
                                                <ArrowsRightLeftIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredStock.length === 0 && (
                    <div className="p-12 text-center">
                        <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Товарів не знайдено</p>
                    </div>
                )}
            </div>

            {/* Пагінація */}
            <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Показано {filteredStock.length} з {stock.length} позицій
                </p>
                <div className="flex gap-2">
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                        Попередня
                    </button>
                    <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
                        1
                    </button>
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        2
                    </button>
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        3
                    </button>
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        Наступна
                    </button>
                </div>
            </div>
        </div>
    );
}
