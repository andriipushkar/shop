'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CubeIcon,
    MapPinIcon,
    BuildingStorefrontIcon,
    ClockIcon,
    ArrowsRightLeftIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    PencilIcon,
    PrinterIcon,
    QrCodeIcon,
    TagIcon,
    TruckIcon,
    ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

// Мок даних товару
const mockProductDetails = {
    id: '1',
    name: 'iPhone 15 Pro 256GB Space Black',
    sku: 'APL-IP15P-256-SB',
    barcode: '0194253401234',
    category: 'Смартфони',
    brand: 'Apple',
    description: 'Флагманський смартфон Apple з чіпом A17 Pro, титановим корпусом та покращеною камерою.',
    costPrice: 42000,
    sellPrice: 54999,
    weight: 0.187,
    dimensions: '146.6 x 70.6 x 8.25 мм',
    supplier: 'Apple Ukraine',
    minStock: 20,
    maxStock: 100,
    reorderPoint: 30,
    abcClass: 'A' as const,
    xyzClass: 'X' as const,
    imageUrl: null,
    createdAt: '2023-09-22',
    updatedAt: '2024-01-15',
};

const mockStockByWarehouse = [
    { warehouseId: '1', warehouseName: 'Головний склад', location: 'A-01-02', quantity: 45, reserved: 12, available: 33 },
    { warehouseId: '2', warehouseName: 'Магазин Центр', location: 'A-01', quantity: 8, reserved: 2, available: 6 },
    { warehouseId: '3', warehouseName: 'Магазин Лівий берег', location: 'B-02', quantity: 5, reserved: 0, available: 5 },
];

const mockMovements = [
    { id: '1', type: 'receipt', date: '2024-01-15 10:30', quantity: 20, document: 'REC-001234', warehouse: 'Головний склад', user: 'Іван Петренко' },
    { id: '2', type: 'sale', date: '2024-01-15 09:15', quantity: -2, document: 'ORD-2024-1234', warehouse: 'Магазин Центр', user: 'Марія Коваль' },
    { id: '3', type: 'transfer', date: '2024-01-14 16:00', quantity: -5, document: 'TRF-001122', warehouse: 'Головний склад → Магазин Центр', user: 'Олег Сидоренко' },
    { id: '4', type: 'sale', date: '2024-01-14 14:30', quantity: -1, document: 'ORD-2024-1230', warehouse: 'Головний склад', user: 'Іван Петренко' },
    { id: '5', type: 'receipt', date: '2024-01-10 11:00', quantity: 50, document: 'REC-001200', warehouse: 'Головний склад', user: 'Іван Петренко' },
];

const mockSerialNumbers = [
    { serial: 'F2LXK1234567', status: 'available', warehouse: 'Головний склад', location: 'A-01-02' },
    { serial: 'F2LXK1234568', status: 'reserved', warehouse: 'Головний склад', location: 'A-01-02', order: 'ORD-2024-1235' },
    { serial: 'F2LXK1234569', status: 'sold', warehouse: 'Магазин Центр', soldDate: '2024-01-14' },
    { serial: 'F2LXK1234570', status: 'available', warehouse: 'Магазин Центр', location: 'A-01' },
];

type TabType = 'overview' | 'stock' | 'movements' | 'serials';

export default function StockDetailPage() {
    const params = useParams();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const product = mockProductDetails;

    const totalQuantity = mockStockByWarehouse.reduce((sum, w) => sum + w.quantity, 0);
    const totalReserved = mockStockByWarehouse.reduce((sum, w) => sum + w.reserved, 0);
    const totalAvailable = mockStockByWarehouse.reduce((sum, w) => sum + w.available, 0);
    const totalValue = totalQuantity * product.costPrice;

    const getMovementTypeInfo = (type: string) => {
        switch (type) {
            case 'receipt': return { label: 'Приймання', color: 'text-green-600 bg-green-50', icon: TruckIcon };
            case 'sale': return { label: 'Продаж', color: 'text-blue-600 bg-blue-50', icon: TagIcon };
            case 'transfer': return { label: 'Переміщення', color: 'text-purple-600 bg-purple-50', icon: ArrowsRightLeftIcon };
            case 'writeoff': return { label: 'Списання', color: 'text-red-600 bg-red-50', icon: ArchiveBoxIcon };
            default: return { label: type, color: 'text-gray-600 bg-gray-50', icon: DocumentTextIcon };
        }
    };

    const tabs = [
        { id: 'overview', label: 'Огляд', icon: CubeIcon },
        { id: 'stock', label: 'Залишки', icon: BuildingStorefrontIcon },
        { id: 'movements', label: 'Історія', icon: ClockIcon },
        { id: 'serials', label: 'Серійні номери', icon: QrCodeIcon },
    ];

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-start gap-4 mb-8">
                <Link href="/admin/warehouse/stock" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                            product.abcClass === 'A' ? 'bg-green-100 text-green-700' :
                            product.abcClass === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                        }`}>{product.abcClass}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                            product.xyzClass === 'X' ? 'bg-blue-100 text-blue-700' :
                            product.xyzClass === 'Y' ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'
                        }`}>{product.xyzClass}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>SKU: <span className="font-mono text-gray-700">{product.sku}</span></span>
                        <span>Штрих-код: <span className="font-mono text-gray-700">{product.barcode}</span></span>
                        <span>{product.category}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <PrinterIcon className="w-5 h-5 text-gray-600" />
                        <span>Етикетка</span>
                    </button>
                    <Link
                        href={`/admin/warehouse/stock/${params.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                    >
                        <PencilIcon className="w-5 h-5" />
                        <span>Редагувати</span>
                    </Link>
                </div>
            </div>

            {/* Швидка статистика */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-sm text-gray-500">Загальна кількість</div>
                    <div className="text-2xl font-bold text-gray-900">{totalQuantity}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-sm text-gray-500">Зарезервовано</div>
                    <div className="text-2xl font-bold text-amber-600">{totalReserved}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-sm text-gray-500">Доступно</div>
                    <div className={`text-2xl font-bold ${totalAvailable <= product.minStock ? 'text-red-600' : 'text-green-600'}`}>
                        {totalAvailable}
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-sm text-gray-500">Собівартість</div>
                    <div className="text-2xl font-bold text-gray-900">{product.costPrice.toLocaleString()} ₴</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-sm text-gray-500">Вартість залишків</div>
                    <div className="text-2xl font-bold text-gray-900">{(totalValue / 1000000).toFixed(2)} млн ₴</div>
                </div>
            </div>

            {/* Попередження */}
            {totalAvailable <= product.minStock && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                    <div>
                        <span className="font-medium text-red-800">Критичний рівень запасу!</span>
                        <span className="text-red-700 ml-2">Залишилось {totalAvailable} шт. (мінімум: {product.minStock})</span>
                    </div>
                    <Link
                        href="/admin/warehouse/receipt/new"
                        className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                        Створити замовлення
                    </Link>
                </div>
            )}

            {/* Табси */}
            <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white text-teal-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Контент табів */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Інформація про товар</h3>
                        <dl className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Категорія</dt>
                                <dd className="font-medium text-gray-900">{product.category}</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Бренд</dt>
                                <dd className="font-medium text-gray-900">{product.brand}</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Постачальник</dt>
                                <dd className="font-medium text-gray-900">{product.supplier}</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Вага</dt>
                                <dd className="font-medium text-gray-900">{product.weight} кг</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Розміри</dt>
                                <dd className="font-medium text-gray-900">{product.dimensions}</dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-gray-500">Ціна продажу</dt>
                                <dd className="font-bold text-teal-600">{product.sellPrice.toLocaleString()} ₴</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Налаштування запасів</h3>
                        <dl className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Мінімальний запас</dt>
                                <dd className="font-medium text-gray-900">{product.minStock} шт.</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Максимальний запас</dt>
                                <dd className="font-medium text-gray-900">{product.maxStock} шт.</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">Точка перезамовлення</dt>
                                <dd className="font-medium text-gray-900">{product.reorderPoint} шт.</dd>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <dt className="text-gray-500">ABC-клас</dt>
                                <dd className="font-medium text-gray-900">{product.abcClass} (високий оборот)</dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-gray-500">XYZ-клас</dt>
                                <dd className="font-medium text-gray-900">{product.xyzClass} (стабільний попит)</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Склад</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Комірка</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Кількість</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Резерв</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Доступно</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mockStockByWarehouse.map(stock => (
                                <tr key={stock.warehouseId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
                                            <span className="font-medium text-gray-900">{stock.warehouseName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-3 py-1 bg-gray-100 rounded-lg font-mono text-sm">{stock.location}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-semibold">{stock.quantity}</td>
                                    <td className="px-6 py-4 text-center text-amber-600">{stock.reserved}</td>
                                    <td className="px-6 py-4 text-center font-bold text-green-600">{stock.available}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                            Перемістити
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                            <tr>
                                <td className="px-6 py-4 font-semibold text-gray-900">Всього</td>
                                <td></td>
                                <td className="px-6 py-4 text-center font-bold text-gray-900">{totalQuantity}</td>
                                <td className="px-6 py-4 text-center font-bold text-amber-600">{totalReserved}</td>
                                <td className="px-6 py-4 text-center font-bold text-green-600">{totalAvailable}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {activeTab === 'movements' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Дата</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Тип</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Документ</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Склад</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Кількість</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Користувач</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mockMovements.map(movement => {
                                const typeInfo = getMovementTypeInfo(movement.type);
                                const Icon = typeInfo.icon;
                                return (
                                    <tr key={movement.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-600">{movement.date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${typeInfo.color}`}>
                                                <Icon className="w-4 h-4" />
                                                {typeInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm text-teal-600 hover:underline cursor-pointer">
                                                {movement.document}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{movement.warehouse}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{movement.user}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'serials' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-600">{mockSerialNumbers.length} серійних номерів</span>
                        <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                            + Додати серійний номер
                        </button>
                    </div>
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Серійний номер</th>
                                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Статус</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Склад</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Деталі</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mockSerialNumbers.map(sn => (
                                <tr key={sn.serial} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-medium text-gray-900">{sn.serial}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium ${
                                            sn.status === 'available' ? 'bg-green-100 text-green-700' :
                                            sn.status === 'reserved' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {sn.status === 'available' && <CheckCircleIcon className="w-4 h-4" />}
                                            {sn.status === 'available' ? 'Доступний' :
                                             sn.status === 'reserved' ? 'Зарезервований' : 'Продано'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{sn.warehouse}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {sn.location && `Комірка: ${sn.location}`}
                                        {sn.order && <span className="text-teal-600 font-mono">{sn.order}</span>}
                                        {sn.soldDate && `Продано: ${sn.soldDate}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
