'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import {
    ArrowLeftIcon,
    ArrowsRightLeftIcon,
    PlusIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    BuildingStorefrontIcon,
    CubeIcon,
    XMarkIcon,
    TruckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface TransferItem {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    availableFrom: number;
    availableTo: number;
    quantity: number;
    locationFrom: string;
    locationTo: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
    type: string;
}

const mockWarehouses: Warehouse[] = [
    { id: '1', name: 'Головний склад', code: 'WH-001', type: 'main' },
    { id: '2', name: 'Магазин Центр', code: 'ST-001', type: 'store' },
    { id: '3', name: 'Магазин Лівий берег', code: 'ST-002', type: 'store' },
    { id: '4', name: 'Пункт видачі', code: 'PV-001', type: 'store' },
];

const mockProducts = [
    { id: 'p1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', stock: { '1': 45, '2': 12, '3': 8, '4': 3 }, locations: { '1': 'A-01-02', '2': 'A-01', '3': 'B-02', '4': 'C-01' } },
    { id: 'p2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-512', stock: { '1': 28, '2': 5, '3': 10, '4': 2 }, locations: { '1': 'A-01-03', '2': 'A-02', '3': 'B-03', '4': 'C-02' } },
    { id: 'p3', name: 'AirPods Pro 2', sku: 'APL-APP2-USBC', stock: { '1': 156, '2': 34, '3': 25, '4': 15 }, locations: { '1': 'B-02-01', '2': 'B-01', '3': 'A-01', '4': 'A-01' } },
    { id: 'p4', name: 'MacBook Air M2', sku: 'APL-MBA-M2-256', stock: { '1': 8, '2': 2, '3': 3, '4': 0 }, locations: { '1': 'C-01-01', '2': 'C-01', '3': 'C-01', '4': 'D-01' } },
    { id: 'p5', name: 'iPad Air 5', sku: 'APL-IPA5-64', stock: { '1': 23, '2': 8, '3': 5, '4': 2 }, locations: { '1': 'C-02-01', '2': 'C-02', '3': 'C-02', '4': 'D-02' } },
];

export default function NewTransferPage() {
    const [transferNumber] = useState(`TRF-${Date.now().toString(36).toUpperCase()}`);
    const [fromWarehouse, setFromWarehouse] = useState<string>('1');
    const [toWarehouse, setToWarehouse] = useState<string>('');
    const [items, setItems] = useState<TransferItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    const availableProducts = mockProducts.filter(p => {
        const available = p.stock[fromWarehouse as keyof typeof p.stock] || 0;
        return available > 0;
    });

    const filteredProducts = availableProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );

    const addProduct = (product: typeof mockProducts[0]) => {
        const availableFrom = product.stock[fromWarehouse as keyof typeof product.stock] || 0;
        const availableTo = toWarehouse ? (product.stock[toWarehouse as keyof typeof product.stock] || 0) : 0;
        const locationFrom = product.locations[fromWarehouse as keyof typeof product.locations] || '';
        const locationTo = toWarehouse ? (product.locations[toWarehouse as keyof typeof product.locations] || '') : '';

        const existingItem = items.find(i => i.productId === product.id);
        if (existingItem) {
            setItems(prev => prev.map(i =>
                i.productId === product.id ? { ...i, quantity: Math.min(i.quantity + 1, availableFrom) } : i
            ));
        } else {
            setItems(prev => [...prev, {
                id: Date.now().toString(),
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                availableFrom,
                availableTo,
                quantity: 1,
                locationFrom,
                locationTo,
            }]);
        }
        setShowProductSearch(false);
        setProductSearch('');
    };

    const updateQuantity = (id: string, quantity: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, quantity: Math.max(1, Math.min(quantity, item.availableFrom)) };
            }
            return item;
        }));
    };

    const updateLocationTo = (id: string, location: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, locationTo: location } : item
        ));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // При зміні складу-отримувача оновлюємо availableTo для всіх товарів
    const handleToWarehouseChange = (warehouseId: string) => {
        setToWarehouse(warehouseId);
        setItems(prev => prev.map(item => {
            const product = mockProducts.find(p => p.id === item.productId);
            if (product) {
                const availableTo = product.stock[warehouseId as keyof typeof product.stock] || 0;
                const locationTo = product.locations[warehouseId as keyof typeof product.locations] || '';
                return { ...item, availableTo, locationTo };
            }
            return item;
        }));
    };

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    const handleSubmit = (status: 'draft' | 'pending' | 'in_transit') => {
        if (!fromWarehouse || !toWarehouse || items.length === 0) {
            alert('Заповніть всі обов\'язкові поля');
            return;
        }

        const transfer = {
            number: transferNumber,
            fromWarehouseId: fromWarehouse,
            toWarehouseId: toWarehouse,
            items,
            notes,
            status,
            totalQuantity,
        };
        logger.info('Transfer created', { transfer });

        const statusText = {
            draft: 'збережено як чернетку',
            pending: 'створено та очікує підтвердження',
            in_transit: 'відправлено',
        };
        alert(`Переміщення ${statusText[status]}`);
    };

    const fromWarehouseName = mockWarehouses.find(w => w.id === fromWarehouse)?.name || '';
    const toWarehouseName = mockWarehouses.find(w => w.id === toWarehouse)?.name || '';

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/warehouse" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Нове переміщення</h1>
                    <p className="text-gray-500">Переміщення товарів між складами та магазинами</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleSubmit('draft')}
                        className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                        Зберегти чернетку
                    </button>
                    <button
                        onClick={() => handleSubmit('in_transit')}
                        disabled={items.length === 0 || !toWarehouse || fromWarehouse === toWarehouse}
                        className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <TruckIcon className="w-5 h-5" />
                        Відправити
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Основна інформація */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Напрямок переміщення */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Напрямок переміщення</h2>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Зі складу *</label>
                                <div className="relative">
                                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        value={fromWarehouse}
                                        onChange={(e) => {
                                            setFromWarehouse(e.target.value);
                                            setItems([]); // Очищаємо товари при зміні складу-відправника
                                        }}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none text-lg"
                                    >
                                        {mockWarehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mt-6">
                                <ArrowsRightLeftIcon className="w-8 h-8 text-purple-600" />
                            </div>

                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">На склад *</label>
                                <div className="relative">
                                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        value={toWarehouse}
                                        onChange={(e) => handleToWarehouseChange(e.target.value)}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none text-lg ${
                                            !toWarehouse ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">Оберіть склад</option>
                                        {mockWarehouses.filter(w => w.id !== fromWarehouse).map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {fromWarehouse === toWarehouse && toWarehouse && (
                            <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span>Склад-відправник та склад-отримувач не можуть бути однаковими</span>
                            </div>
                        )}
                    </div>

                    {/* Товари */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Товари для переміщення ({items.length})</h2>
                            <button
                                onClick={() => setShowProductSearch(true)}
                                disabled={!toWarehouse}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span>Додати товар</span>
                            </button>
                        </div>

                        {!toWarehouse ? (
                            <div className="py-12 text-center border-2 border-dashed border-amber-200 rounded-xl bg-amber-50">
                                <ArrowsRightLeftIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                                <p className="text-amber-700 font-medium mb-2">Оберіть склад-отримувач</p>
                                <p className="text-sm text-amber-600">Для додавання товарів необхідно обрати склад призначення</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                                <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 mb-2">Товари не додані</p>
                                <p className="text-sm text-gray-400">Оберіть товари для переміщення</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Комірка (звідки)</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Комірка (куди)</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Доступно</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Кількість</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">{item.productName}</p>
                                                    <p className="text-sm text-gray-500">{item.sku}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono">{item.locationFrom}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="text"
                                                        value={item.locationTo}
                                                        onChange={(e) => updateLocationTo(item.id, e.target.value)}
                                                        placeholder="Вкажіть"
                                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-gray-600">{item.availableFrom} шт.</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                            min="1"
                                                            max={item.availableFrom}
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
                                                            disabled={item.quantity >= item.availableFrom}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Примітки */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Примітки</h2>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Причина переміщення, додаткова інформація..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>
                </div>

                {/* Підсумок */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Підсумок переміщення</h2>

                        <div className="space-y-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <BuildingStorefrontIcon className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Звідки</p>
                                    <p className="font-medium text-gray-900">{fromWarehouseName}</p>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="p-2 bg-purple-100 rounded-full">
                                    <ArrowsRightLeftIcon className="w-5 h-5 text-purple-600" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <BuildingStorefrontIcon className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Куди</p>
                                    <p className="font-medium text-gray-900">{toWarehouseName || '—'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="py-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Позицій</span>
                                <span className="font-medium text-gray-900">{items.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-700 font-medium">Всього одиниць</span>
                                <span className="text-2xl font-bold text-gray-900">{totalQuantity} шт.</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <button
                                onClick={() => handleSubmit('in_transit')}
                                disabled={items.length === 0 || !toWarehouse || fromWarehouse === toWarehouse}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <TruckIcon className="w-5 h-5" />
                                Відправити переміщення
                            </button>
                            <button
                                onClick={() => handleSubmit('pending')}
                                disabled={items.length === 0 || !toWarehouse}
                                className="w-full px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                            >
                                Створити заявку
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Модалка пошуку товарів */}
            {showProductSearch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Додати товар для переміщення</h3>
                                <button
                                    onClick={() => setShowProductSearch(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">
                                Показано товари з наявністю на складі "{fromWarehouseName}"
                            </p>
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Пошук за назвою або SKU..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {filteredProducts.map(product => {
                                    const available = product.stock[fromWarehouse as keyof typeof product.stock] || 0;
                                    const alreadyAdded = items.find(i => i.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addProduct(product)}
                                            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors text-left"
                                        >
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <CubeIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                <p className="text-sm text-gray-500">{product.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-gray-900">{available} шт.</p>
                                                <p className="text-xs text-gray-500">доступно</p>
                                            </div>
                                            {alreadyAdded ? (
                                                <CheckIcon className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <PlusIcon className="w-6 h-6 text-teal-600" />
                                            )}
                                        </button>
                                    );
                                })}

                                {filteredProducts.length === 0 && (
                                    <div className="py-8 text-center">
                                        <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Товарів не знайдено</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
