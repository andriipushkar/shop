'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ClipboardDocumentListIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    BuildingStorefrontIcon,
    CubeIcon,
    XMarkIcon,
    QrCodeIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    MinusCircleIcon,
    PlusCircleIcon,
    DocumentArrowDownIcon,
    PrinterIcon,
} from '@heroicons/react/24/outline';

interface InventoryItem {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    barcode: string;
    location: string;
    systemQuantity: number;
    actualQuantity: number | null;
    difference: number;
    status: 'pending' | 'counted' | 'verified';
    notes?: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

const mockWarehouses: Warehouse[] = [
    { id: '1', name: 'Головний склад', code: 'WH-001' },
    { id: '2', name: 'Магазин Центр', code: 'ST-001' },
    { id: '3', name: 'Магазин Лівий берег', code: 'ST-002' },
];

const mockProducts = [
    { id: 'p1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', barcode: '0194253401234', location: 'A-01-02', quantity: 45 },
    { id: 'p2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-512', barcode: '8806095012345', location: 'A-01-03', quantity: 28 },
    { id: 'p3', name: 'AirPods Pro 2', sku: 'APL-APP2-USBC', barcode: '0194253401111', location: 'B-02-01', quantity: 156 },
    { id: 'p4', name: 'MacBook Air M2', sku: 'APL-MBA-M2-256', barcode: '0194253402222', location: 'C-01-01', quantity: 8 },
    { id: 'p5', name: 'iPad Air 5', sku: 'APL-IPA5-64', barcode: '0194253404444', location: 'C-02-01', quantity: 23 },
    { id: 'p6', name: 'iPhone 15 Case MagSafe', sku: 'APL-CS-IP15-MS', barcode: '0194253403333', location: 'B-03-02', quantity: 89 },
    { id: 'p7', name: 'Samsung Galaxy Buds2 Pro', sku: 'SAM-GBP2', barcode: '8806095054321', location: 'D-01-01', quantity: 34 },
    { id: 'p8', name: 'Apple Watch Series 9', sku: 'APL-AW9-45', barcode: '0194253405555', location: 'E-01-01', quantity: 15 },
];

type InventoryType = 'full' | 'partial' | 'location' | 'abc';

export default function NewInventoryPage() {
    const [inventoryNumber] = useState(`INV-${Date.now().toString(36).toUpperCase()}`);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('1');
    const [inventoryType, setInventoryType] = useState<InventoryType>('full');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    const filteredProducts = mockProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode.includes(productSearch)
    );

    const initializeInventory = () => {
        let productsToCount = mockProducts;

        if (inventoryType === 'location' && selectedLocation) {
            productsToCount = mockProducts.filter(p => p.location.startsWith(selectedLocation));
        } else if (inventoryType === 'abc') {
            // Топ товари по обороту (в реальності з аналітики)
            productsToCount = mockProducts.slice(0, 5);
        }

        const inventoryItems: InventoryItem[] = productsToCount.map(p => ({
            id: Date.now().toString() + p.id,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            barcode: p.barcode,
            location: p.location,
            systemQuantity: p.quantity,
            actualQuantity: null,
            difference: 0,
            status: 'pending',
        }));

        setItems(inventoryItems);
    };

    const addProduct = (product: typeof mockProducts[0]) => {
        const existingItem = items.find(i => i.productId === product.id);
        if (!existingItem) {
            setItems(prev => [...prev, {
                id: Date.now().toString(),
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                barcode: product.barcode,
                location: product.location,
                systemQuantity: product.quantity,
                actualQuantity: null,
                difference: 0,
                status: 'pending',
            }]);
        }
        setShowProductSearch(false);
        setProductSearch('');
    };

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const product = mockProducts.find(p => p.barcode === barcodeInput);
        if (product) {
            const existingItem = items.find(i => i.productId === product.id);
            if (existingItem) {
                // Збільшуємо фактичну кількість на 1
                updateActualQuantity(existingItem.id, (existingItem.actualQuantity || 0) + 1);
            } else {
                // Додаємо новий товар і встановлюємо кількість 1
                const newItem: InventoryItem = {
                    id: Date.now().toString(),
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    barcode: product.barcode,
                    location: product.location,
                    systemQuantity: product.quantity,
                    actualQuantity: 1,
                    difference: 1 - product.quantity,
                    status: 'counted',
                };
                setItems(prev => [...prev, newItem]);
            }
        } else {
            alert('Товар з таким штрих-кодом не знайдено');
        }
        setBarcodeInput('');
    };

    const updateActualQuantity = (id: string, quantity: number | null) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const actualQty = quantity === null ? null : Math.max(0, quantity);
                return {
                    ...item,
                    actualQuantity: actualQty,
                    difference: actualQty !== null ? actualQty - item.systemQuantity : 0,
                    status: actualQty !== null ? 'counted' : 'pending',
                };
            }
            return item;
        }));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const countedItems = items.filter(i => i.status === 'counted').length;
    const pendingItems = items.filter(i => i.status === 'pending').length;
    const itemsWithDifference = items.filter(i => i.difference !== 0);
    const totalShortage = items.reduce((sum, i) => sum + (i.difference < 0 ? Math.abs(i.difference) : 0), 0);
    const totalSurplus = items.reduce((sum, i) => sum + (i.difference > 0 ? i.difference : 0), 0);

    const handleSubmit = (status: 'draft' | 'in_progress' | 'completed') => {
        const inventory = {
            number: inventoryNumber,
            warehouseId: selectedWarehouse,
            type: inventoryType,
            items,
            notes,
            status,
            countedItems,
            pendingItems,
            totalShortage,
            totalSurplus,
        };
        console.log('Inventory:', inventory);

        const statusText = {
            draft: 'збережено як чернетку',
            in_progress: 'розпочато',
            completed: 'завершено та проведено',
        };
        alert(`Інвентаризацію ${statusText[status]}`);
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/warehouse" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Нова інвентаризація</h1>
                    <p className="text-gray-500">Перевірка фактичних залишків на складі</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <PrinterIcon className="w-5 h-5 text-gray-600" />
                        <span>Друк відомості</span>
                    </button>
                    <button
                        onClick={() => handleSubmit('completed')}
                        disabled={pendingItems > 0 || items.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckIcon className="w-5 h-5" />
                        Завершити
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Основна інформація */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Налаштування інвентаризації */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Налаштування</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Склад</label>
                                <div className="relative">
                                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none"
                                    >
                                        {mockWarehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Тип інвентаризації</label>
                                <select
                                    value={inventoryType}
                                    onChange={(e) => setInventoryType(e.target.value as InventoryType)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                >
                                    <option value="full">Повна інвентаризація</option>
                                    <option value="partial">Вибіркова (обрані товари)</option>
                                    <option value="location">За комірками/зонами</option>
                                    <option value="abc">ABC-аналіз (топ товари)</option>
                                </select>
                            </div>
                        </div>

                        {inventoryType === 'location' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Зона/комірка</label>
                                <input
                                    type="text"
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value.toUpperCase())}
                                    placeholder="Наприклад: A, A-01, A-01-02"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                />
                            </div>
                        )}

                        {items.length === 0 && (
                            <button
                                onClick={initializeInventory}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
                            >
                                <ClipboardDocumentListIcon className="w-5 h-5" />
                                Сформувати відомість
                            </button>
                        )}
                    </div>

                    {/* Швидке сканування */}
                    {items.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">Швидке сканування</h2>
                                <button
                                    onClick={() => setShowScanner(!showScanner)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                        showScanner ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <QrCodeIcon className="w-5 h-5" />
                                    <span>{showScanner ? 'Вимкнути камеру' : 'Сканер'}</span>
                                </button>
                            </div>

                            <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                                <div className="flex-1 relative">
                                    <QrCodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder="Скануйте штрих-код для підрахунку (+1)"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
                                >
                                    +1
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Товари для підрахунку */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Відомість ({items.length} позицій)
                            </h2>
                            {inventoryType === 'partial' && (
                                <button
                                    onClick={() => setShowProductSearch(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    <span>Додати товар</span>
                                </button>
                            )}
                        </div>

                        {items.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                                <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 mb-2">Відомість не сформована</p>
                                <p className="text-sm text-gray-400">Оберіть тип інвентаризації та сформуйте відомість</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Комірка</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">По системі</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Фактично</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Різниця</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.map((item) => (
                                            <tr key={item.id} className={`hover:bg-gray-50 ${
                                                item.status === 'counted' && item.difference !== 0 ? 'bg-amber-50/50' : ''
                                            }`}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">{item.productName}</p>
                                                    <p className="text-sm text-gray-500">{item.sku}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-1 bg-gray-100 rounded-lg text-sm font-mono">{item.location}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-gray-600">{item.systemQuantity}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={item.actualQuantity === null ? '' : item.actualQuantity}
                                                        onChange={(e) => updateActualQuantity(item.id, e.target.value === '' ? null : parseInt(e.target.value))}
                                                        placeholder="—"
                                                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.status === 'counted' && (
                                                        <span className={`font-bold ${
                                                            item.difference === 0 ? 'text-green-600' :
                                                            item.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                                        }`}>
                                                            {item.difference > 0 ? '+' : ''}{item.difference}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.status === 'pending' ? (
                                                        <span className="flex items-center justify-center gap-1 text-gray-400">
                                                            <ClipboardDocumentListIcon className="w-4 h-4" />
                                                            <span className="text-xs">Очікує</span>
                                                        </span>
                                                    ) : item.difference === 0 ? (
                                                        <span className="flex items-center justify-center gap-1 text-green-600">
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                            <span className="text-xs">Збіг</span>
                                                        </span>
                                                    ) : item.difference > 0 ? (
                                                        <span className="flex items-center justify-center gap-1 text-blue-600">
                                                            <PlusCircleIcon className="w-4 h-4" />
                                                            <span className="text-xs">Надлишок</span>
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1 text-red-600">
                                                            <MinusCircleIcon className="w-4 h-4" />
                                                            <span className="text-xs">Нестача</span>
                                                        </span>
                                                    )}
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
                            placeholder="Примітки до інвентаризації, виявлені проблеми..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>
                </div>

                {/* Підсумок */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Прогрес</h2>

                        {/* Прогрес бар */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500">Підраховано</span>
                                <span className="font-medium">{countedItems} з {items.length}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-teal-500 rounded-full transition-all duration-300"
                                    style={{ width: items.length > 0 ? `${(countedItems / items.length) * 100}%` : '0%' }}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pb-4 border-b border-gray-100">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Очікує підрахунку</span>
                                <span className={`font-medium ${pendingItems > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                    {pendingItems}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Підраховано</span>
                                <span className="font-medium text-green-600">{countedItems}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Розбіжностей</span>
                                <span className={`font-medium ${itemsWithDifference.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {itemsWithDifference.length}
                                </span>
                            </div>
                        </div>

                        {/* Результати */}
                        {countedItems > 0 && (
                            <div className="py-4 space-y-3">
                                <h3 className="font-medium text-gray-900">Результати:</h3>
                                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                                    <span className="text-red-700">Нестача</span>
                                    <span className="font-bold text-red-700">-{totalShortage} шт.</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                                    <span className="text-blue-700">Надлишок</span>
                                    <span className="font-bold text-blue-700">+{totalSurplus} шт.</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <button
                                onClick={() => handleSubmit('completed')}
                                disabled={pendingItems > 0 || items.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckIcon className="w-5 h-5" />
                                Завершити інвентаризацію
                            </button>
                            <button
                                onClick={() => handleSubmit('draft')}
                                className="w-full px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                            >
                                Зберегти чернетку
                            </button>
                        </div>

                        {pendingItems > 0 && items.length > 0 && (
                            <div className="mt-4 flex items-start gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl text-sm">
                                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>Для завершення необхідно підрахувати всі {pendingItems} позицій</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Модалка пошуку товарів */}
            {showProductSearch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Додати товар до інвентаризації</h3>
                                <button
                                    onClick={() => setShowProductSearch(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Пошук за назвою, SKU, штрих-кодом..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {filteredProducts.map(product => {
                                    const alreadyAdded = items.some(i => i.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => !alreadyAdded && addProduct(product)}
                                            disabled={alreadyAdded}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left ${
                                                alreadyAdded ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <CubeIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                <p className="text-sm text-gray-500">{product.sku} • {product.barcode}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-gray-900">{product.quantity} шт.</p>
                                                <p className="text-xs text-gray-500">{product.location}</p>
                                            </div>
                                            {alreadyAdded ? (
                                                <CheckIcon className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <PlusIcon className="w-6 h-6 text-teal-600" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
