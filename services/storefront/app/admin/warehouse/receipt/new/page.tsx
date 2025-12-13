'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import {
    ArrowLeftIcon,
    PlusIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    QrCodeIcon,
    CheckIcon,
    DocumentTextIcon,
    TruckIcon,
    BuildingStorefrontIcon,
    CalendarIcon,
    UserIcon,
    CubeIcon,
    XMarkIcon,
    PhotoIcon,
    PrinterIcon,
    HashtagIcon,
} from '@heroicons/react/24/outline';

interface ReceiptItem {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    barcode: string;
    quantity: number;
    expectedQuantity?: number;
    costPrice: number;
    location: string;
    batchNumber?: string;
    expiryDate?: string;
    serialNumbers?: string[];
    damaged?: number;
    notes?: string;
}

interface Supplier {
    id: string;
    name: string;
    code: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

const mockSuppliers: Supplier[] = [
    { id: '1', name: 'Apple Ukraine', code: 'SUP-001' },
    { id: '2', name: 'Samsung Electronics', code: 'SUP-002' },
    { id: '3', name: 'Xiaomi Ukraine', code: 'SUP-003' },
    { id: '4', name: 'Procter & Gamble', code: 'SUP-004' },
];

const mockWarehouses: Warehouse[] = [
    { id: '1', name: 'Головний склад', code: 'WH-001' },
    { id: '2', name: 'Магазин Центр', code: 'ST-001' },
    { id: '3', name: 'Магазин Лівий берег', code: 'ST-002' },
];

const mockProducts = [
    { id: 'p1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', barcode: '0194253401234', costPrice: 42000, defaultLocation: 'A-01-02' },
    { id: 'p2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-512', barcode: '8806095012345', costPrice: 48000, defaultLocation: 'A-01-03' },
    { id: 'p3', name: 'AirPods Pro 2', sku: 'APL-APP2-USBC', barcode: '0194253401111', costPrice: 7500, defaultLocation: 'B-02-01' },
    { id: 'p4', name: 'MacBook Air M2', sku: 'APL-MBA-M2-256', barcode: '0194253402222', costPrice: 38000, defaultLocation: 'C-01-01' },
    { id: 'p5', name: 'iPad Air 5', sku: 'APL-IPA5-64', barcode: '0194253404444', costPrice: 22000, defaultLocation: 'C-02-01' },
];

export default function NewReceiptPage() {
    const [receiptNumber, setReceiptNumber] = useState(`REC-${Date.now().toString(36).toUpperCase()}`);
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('1');
    const [documentNumber, setDocumentNumber] = useState('');
    const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<ReceiptItem[]>([]);
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

    const addProduct = (product: typeof mockProducts[0]) => {
        const existingItem = items.find(i => i.productId === product.id);
        if (existingItem) {
            setItems(prev => prev.map(i =>
                i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setItems(prev => [...prev, {
                id: Date.now().toString(),
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                barcode: product.barcode,
                quantity: 1,
                costPrice: product.costPrice,
                location: product.defaultLocation,
            }]);
        }
        setShowProductSearch(false);
        setProductSearch('');
    };

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const product = mockProducts.find(p => p.barcode === barcodeInput);
        if (product) {
            addProduct(product);
        } else {
            alert('Товар з таким штрих-кодом не знайдено');
        }
        setBarcodeInput('');
    };

    const updateItem = (id: string, field: keyof ReceiptItem, value: number | string | string[] | undefined) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

    const handleSubmit = (status: 'draft' | 'completed') => {
        const receipt = {
            number: receiptNumber,
            supplierId: selectedSupplier,
            warehouseId: selectedWarehouse,
            documentNumber,
            documentDate,
            items,
            notes,
            status,
            totalQuantity,
            totalValue,
        };
        logger.info('Receipt created', { receipt });
        alert(`Приймання ${status === 'draft' ? 'збережено як чернетку' : 'проведено'}`);
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/warehouse" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Нове приймання товару</h1>
                    <p className="text-gray-500">Оприбуткування товарів від постачальника</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <PrinterIcon className="w-5 h-5 text-gray-600" />
                        <span>Друк</span>
                    </button>
                    <button
                        onClick={() => handleSubmit('draft')}
                        className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                        Зберегти чернетку
                    </button>
                    <button
                        onClick={() => handleSubmit('completed')}
                        disabled={items.length === 0 || !selectedSupplier}
                        className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckIcon className="w-5 h-5" />
                        Провести
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Основна інформація */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Шапка документа */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Інформація про документ</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Номер приймання</label>
                                <div className="relative">
                                    <DocumentTextIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={receiptNumber}
                                        onChange={(e) => setReceiptNumber(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Дата документа</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="date"
                                        value={documentDate}
                                        onChange={(e) => setDocumentDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Постачальник *</label>
                                <div className="relative">
                                    <TruckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        value={selectedSupplier}
                                        onChange={(e) => setSelectedSupplier(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none"
                                        required
                                    >
                                        <option value="">Оберіть постачальника</option>
                                        {mockSuppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Склад *</label>
                                <div className="relative">
                                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none"
                                        required
                                    >
                                        {mockWarehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Номер накладної постачальника</label>
                                <input
                                    type="text"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    placeholder="Наприклад: ВН-001234"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Швидке додавання по штрих-коду */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Швидке додавання</h2>
                            <button
                                onClick={() => setShowScanner(!showScanner)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                    showScanner ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <QrCodeIcon className="w-5 h-5" />
                                <span>{showScanner ? 'Вимкнути камеру' : 'Сканер камери'}</span>
                            </button>
                        </div>

                        {showScanner && (
                            <div className="mb-4 bg-gray-900 rounded-xl aspect-video flex items-center justify-center">
                                <div className="text-center text-white">
                                    <PhotoIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm opacity-75">Камера сканера</p>
                                    <p className="text-xs opacity-50 mt-1">Наведіть на штрих-код товару</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                            <div className="flex-1 relative">
                                <QrCodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    placeholder="Введіть або скануйте штрих-код..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
                            >
                                Додати
                            </button>
                        </form>
                    </div>

                    {/* Товари */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Товари ({items.length})</h2>
                            <button
                                onClick={() => setShowProductSearch(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span>Додати товар</span>
                            </button>
                        </div>

                        {items.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                                <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 mb-2">Товари не додані</p>
                                <p className="text-sm text-gray-400">Скануйте штрих-код або додайте товар вручну</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Комірка</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Партія</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Серійні</th>
                                            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Кількість</th>
                                            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Ціна</th>
                                            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Сума</th>
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
                                                    <input
                                                        type="text"
                                                        value={item.location}
                                                        onChange={(e) => updateItem(item.id, 'location', e.target.value)}
                                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="text"
                                                        value={item.batchNumber || ''}
                                                        onChange={(e) => updateItem(item.id, 'batchNumber', e.target.value)}
                                                        placeholder="—"
                                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            const serials = prompt(`Введіть серійні номери для ${item.productName} (по одному на рядок):`, (item.serialNumbers || []).join('\n'));
                                                            if (serials !== null) {
                                                                const serialList = serials.split('\n').map(s => s.trim()).filter(s => s);
                                                                updateItem(item.id, 'serialNumbers', serialList);
                                                            }
                                                        }}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                                                            item.serialNumbers && item.serialNumbers.length > 0
                                                                ? 'bg-teal-100 text-teal-700'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                    >
                                                        <HashtagIcon className="w-4 h-4" />
                                                        {item.serialNumbers && item.serialNumbers.length > 0 ? item.serialNumbers.length : '—'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                            min="1"
                                                        />
                                                        <button
                                                            onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.costPrice}
                                                        onChange={(e) => updateItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)}
                                                        className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                    {(item.quantity * item.costPrice).toLocaleString()} ₴
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
                            placeholder="Додаткова інформація про приймання..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>
                </div>

                {/* Підсумок */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Підсумок</h2>

                        <div className="space-y-3 pb-4 border-b border-gray-100">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Позицій</span>
                                <span className="font-medium text-gray-900">{items.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Загальна кількість</span>
                                <span className="font-medium text-gray-900">{totalQuantity} шт.</span>
                            </div>
                        </div>

                        <div className="py-4">
                            <div className="flex justify-between">
                                <span className="text-gray-700 font-medium">Загальна сума</span>
                                <span className="text-2xl font-bold text-gray-900">{totalValue.toLocaleString()} ₴</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <button
                                onClick={() => handleSubmit('completed')}
                                disabled={items.length === 0 || !selectedSupplier}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckIcon className="w-5 h-5" />
                                Провести приймання
                            </button>
                            <button
                                onClick={() => handleSubmit('draft')}
                                className="w-full px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                            >
                                Зберегти чернетку
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
                                <h3 className="text-lg font-semibold text-gray-900">Додати товар</h3>
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
                                {filteredProducts.map(product => (
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
                                            <p className="text-sm text-gray-500">{product.sku} • {product.barcode}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{product.costPrice.toLocaleString()} ₴</p>
                                            <p className="text-xs text-gray-500">собівартість</p>
                                        </div>
                                        <PlusIcon className="w-6 h-6 text-teal-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
