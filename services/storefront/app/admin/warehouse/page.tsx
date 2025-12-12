'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    BuildingStorefrontIcon,
    CubeIcon,
    ArrowsRightLeftIcon,
    ClipboardDocumentListIcon,
    TruckIcon,
    ExclamationTriangleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    BellAlertIcon,
    QrCodeIcon,
    PlusIcon,
    ArrowPathIcon,
    EyeIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

// Типи даних
interface WarehouseStats {
    totalWarehouses: number;
    totalProducts: number;
    totalValue: number;
    lowStockItems: number;
    pendingReceipts: number;
    pendingShipments: number;
    pendingTransfers: number;
    expiringItems: number;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
    type: 'main' | 'store' | 'dropship';
    totalItems: number;
    totalValue: number;
    lowStock: number;
    isActive: boolean;
}

interface RecentMovement {
    id: string;
    type: 'receipt' | 'shipment' | 'transfer' | 'adjustment' | 'return';
    productName: string;
    quantity: number;
    warehouse: string;
    timestamp: string;
    user: string;
}

interface Alert {
    id: string;
    type: 'low_stock' | 'expiring' | 'overstock' | 'pending_receipt';
    message: string;
    severity: 'warning' | 'danger' | 'info';
    productId?: string;
    warehouseId?: string;
    timestamp: string;
}

interface TopProduct {
    id: string;
    name: string;
    sku: string;
    totalStock: number;
    reserved: number;
    turnoverRate: number;
    abcClass: 'A' | 'B' | 'C';
}

// Мок дані
const mockStats: WarehouseStats = {
    totalWarehouses: 5,
    totalProducts: 4856,
    totalValue: 12450000,
    lowStockItems: 47,
    pendingReceipts: 12,
    pendingShipments: 34,
    pendingTransfers: 8,
    expiringItems: 15,
};

const mockWarehouses: Warehouse[] = [
    { id: '1', name: 'Головний склад', code: 'WH-001', type: 'main', totalItems: 3200, totalValue: 8500000, lowStock: 23, isActive: true },
    { id: '2', name: 'Магазин Центр', code: 'ST-001', type: 'store', totalItems: 450, totalValue: 1200000, lowStock: 8, isActive: true },
    { id: '3', name: 'Магазин Лівий берег', code: 'ST-002', type: 'store', totalItems: 380, totalValue: 980000, lowStock: 12, isActive: true },
    { id: '4', name: 'Пункт видачі', code: 'PV-001', type: 'store', totalItems: 156, totalValue: 420000, lowStock: 4, isActive: true },
    { id: '5', name: 'Дропшипінг партнер', code: 'DS-001', type: 'dropship', totalItems: 670, totalValue: 1350000, lowStock: 0, isActive: true },
];

const mockMovements: RecentMovement[] = [
    { id: '1', type: 'receipt', productName: 'iPhone 15 Pro 256GB', quantity: 50, warehouse: 'Головний склад', timestamp: '2024-01-15T10:30:00', user: 'Олександр К.' },
    { id: '2', type: 'shipment', productName: 'Samsung Galaxy S24', quantity: 5, warehouse: 'Магазин Центр', timestamp: '2024-01-15T10:15:00', user: 'Марія С.' },
    { id: '3', type: 'transfer', productName: 'AirPods Pro 2', quantity: 20, warehouse: 'Головний склад → Магазин Центр', timestamp: '2024-01-15T09:45:00', user: 'Іван П.' },
    { id: '4', type: 'return', productName: 'MacBook Air M2', quantity: 1, warehouse: 'Магазин Лівий берег', timestamp: '2024-01-15T09:30:00', user: 'Олена М.' },
    { id: '5', type: 'adjustment', productName: 'Чохол iPhone 15', quantity: -3, warehouse: 'Головний склад', timestamp: '2024-01-15T09:00:00', user: 'Олександр К.' },
];

const mockAlerts: Alert[] = [
    { id: '1', type: 'low_stock', message: 'iPhone 15 Pro 128GB - залишилось 3 шт. (мін. 10)', severity: 'danger', timestamp: '2024-01-15T10:00:00' },
    { id: '2', type: 'low_stock', message: 'Samsung Galaxy Buds - залишилось 5 шт. (мін. 15)', severity: 'warning', timestamp: '2024-01-15T09:30:00' },
    { id: '3', type: 'expiring', message: 'Батарейки Duracell AA - термін до 2024-02-15', severity: 'warning', timestamp: '2024-01-15T09:00:00' },
    { id: '4', type: 'pending_receipt', message: 'Очікується поставка від "Apple Ukraine" - 150 позицій', severity: 'info', timestamp: '2024-01-15T08:00:00' },
    { id: '5', type: 'overstock', message: 'Чохли iPhone 14 - надлишок 250 шт.', severity: 'info', timestamp: '2024-01-14T18:00:00' },
];

const mockTopProducts: TopProduct[] = [
    { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', totalStock: 145, reserved: 23, turnoverRate: 8.5, abcClass: 'A' },
    { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-256', totalStock: 89, reserved: 12, turnoverRate: 6.2, abcClass: 'A' },
    { id: '3', name: 'AirPods Pro 2', sku: 'APL-APP2', totalStock: 234, reserved: 45, turnoverRate: 12.3, abcClass: 'A' },
    { id: '4', name: 'MacBook Air M2', sku: 'APL-MBA-M2', totalStock: 56, reserved: 8, turnoverRate: 3.1, abcClass: 'B' },
    { id: '5', name: 'iPad Air 5', sku: 'APL-IPA5-64', totalStock: 78, reserved: 15, turnoverRate: 4.5, abcClass: 'B' },
];

// Компоненти
function StatCard({ title, value, icon: Icon, change, changeType, href, color }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    href?: string;
    color: string;
}) {
    const content = (
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                    {change && (
                        <div className={`flex items-center gap-1 mt-2 text-sm ${
                            changeType === 'up' ? 'text-green-600' :
                            changeType === 'down' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                            {changeType === 'up' && <ArrowTrendingUpIcon className="w-4 h-4" />}
                            {changeType === 'down' && <ArrowTrendingDownIcon className="w-4 h-4" />}
                            <span>{change}</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}

function QuickAction({ title, description, icon: Icon, href, color }: {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    color: string;
}) {
    return (
        <Link href={href} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group">
            <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </Link>
    );
}

function MovementTypeIcon({ type }: { type: string }) {
    switch (type) {
        case 'receipt':
            return <div className="p-2 bg-green-100 rounded-lg"><ArrowTrendingDownIcon className="w-4 h-4 text-green-600" /></div>;
        case 'shipment':
            return <div className="p-2 bg-blue-100 rounded-lg"><TruckIcon className="w-4 h-4 text-blue-600" /></div>;
        case 'transfer':
            return <div className="p-2 bg-purple-100 rounded-lg"><ArrowsRightLeftIcon className="w-4 h-4 text-purple-600" /></div>;
        case 'return':
            return <div className="p-2 bg-orange-100 rounded-lg"><ArrowPathIcon className="w-4 h-4 text-orange-600" /></div>;
        case 'adjustment':
            return <div className="p-2 bg-gray-100 rounded-lg"><ClipboardDocumentListIcon className="w-4 h-4 text-gray-600" /></div>;
        default:
            return null;
    }
}

function AlertSeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
        case 'danger':
            return <XCircleIcon className="w-5 h-5 text-red-500" />;
        case 'warning':
            return <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />;
        case 'info':
            return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
        default:
            return null;
    }
}

function ABCBadge({ abcClass }: { abcClass: 'A' | 'B' | 'C' }) {
    const colors = {
        'A': 'bg-green-100 text-green-700',
        'B': 'bg-amber-100 text-amber-700',
        'C': 'bg-gray-100 text-gray-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[abcClass]}`}>
            {abcClass}
        </span>
    );
}

export default function WarehouseDashboard() {
    const [stats] = useState<WarehouseStats>(mockStats);
    const [warehouses] = useState<Warehouse[]>(mockWarehouses);
    const [movements] = useState<RecentMovement[]>(mockMovements);
    const [alerts] = useState<Alert[]>(mockAlerts);
    const [topProducts] = useState<TopProduct[]>(mockTopProducts);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Симуляція завантаження
        setTimeout(() => setIsLoading(false), 500);
    }, []);

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Управління складом</h1>
                    <p className="text-gray-500 mt-1">Омніканальна система WMS для інтернет-магазину та роздрібних точок</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/warehouse/analytics"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <ChartBarIcon className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">Аналітика</span>
                    </Link>
                    <Link
                        href="/admin/warehouse/pos"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <BuildingStorefrontIcon className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">Каса</span>
                    </Link>
                    <Link
                        href="/admin/warehouse/scanner"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <QrCodeIcon className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">Сканер</span>
                    </Link>
                    <Link
                        href="/admin/warehouse/receipt/new"
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span className="font-medium">Приймання</span>
                    </Link>
                </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Всього товарів"
                    value={stats.totalProducts.toLocaleString()}
                    icon={CubeIcon}
                    change="+124 за тиждень"
                    changeType="up"
                    href="/admin/warehouse/stock"
                    color="bg-teal-500"
                />
                <StatCard
                    title="Вартість залишків"
                    value={`${(stats.totalValue / 1000000).toFixed(1)} млн ₴`}
                    icon={ChartBarIcon}
                    change="+5.2% за місяць"
                    changeType="up"
                    href="/admin/warehouse/reports"
                    color="bg-blue-500"
                />
                <StatCard
                    title="Критичні залишки"
                    value={stats.lowStockItems}
                    icon={ExclamationTriangleIcon}
                    change="потребують поповнення"
                    changeType="neutral"
                    href="/admin/warehouse/stock?filter=low"
                    color="bg-amber-500"
                />
                <StatCard
                    title="Очікується поставок"
                    value={stats.pendingReceipts}
                    icon={TruckIcon}
                    change="на цьому тижні"
                    changeType="neutral"
                    href="/admin/warehouse/receipts"
                    color="bg-purple-500"
                />
            </div>

            {/* Швидкі дії */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Швидкі дії</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickAction
                        title="Приймання товару"
                        description="Оприбуткування від постачальника"
                        icon={ArrowTrendingDownIcon}
                        href="/admin/warehouse/receipt/new"
                        color="bg-green-500"
                    />
                    <QuickAction
                        title="Відвантаження"
                        description="Відправка замовлень"
                        icon={TruckIcon}
                        href="/admin/warehouse/shipment/new"
                        color="bg-blue-500"
                    />
                    <QuickAction
                        title="Переміщення"
                        description="Між складами та магазинами"
                        icon={ArrowsRightLeftIcon}
                        href="/admin/warehouse/transfer/new"
                        color="bg-purple-500"
                    />
                    <QuickAction
                        title="Інвентаризація"
                        description="Перевірка залишків"
                        icon={ClipboardDocumentListIcon}
                        href="/admin/warehouse/inventory/new"
                        color="bg-amber-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Склади */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Склади та магазини</h2>
                            <Link href="/admin/warehouse/warehouses" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                Всі склади →
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {warehouses.map((warehouse) => (
                                <Link
                                    key={warehouse.id}
                                    href={`/admin/warehouse/warehouses/${warehouse.id}`}
                                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${
                                            warehouse.type === 'main' ? 'bg-teal-100' :
                                            warehouse.type === 'store' ? 'bg-blue-100' : 'bg-purple-100'
                                        }`}>
                                            <BuildingStorefrontIcon className={`w-5 h-5 ${
                                                warehouse.type === 'main' ? 'text-teal-600' :
                                                warehouse.type === 'store' ? 'text-blue-600' : 'text-purple-600'
                                            }`} />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{warehouse.name}</h3>
                                            <p className="text-sm text-gray-500">{warehouse.code} • {warehouse.totalItems.toLocaleString()} позицій</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{(warehouse.totalValue / 1000).toFixed(0)}K ₴</p>
                                            <p className="text-xs text-gray-500">вартість</p>
                                        </div>
                                        {warehouse.lowStock > 0 && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
                                                <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-medium text-amber-700">{warehouse.lowStock}</span>
                                            </div>
                                        )}
                                        <EyeIcon className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Сповіщення */}
                <div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <BellAlertIcon className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Сповіщення</h2>
                            </div>
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                {alerts.filter(a => a.severity === 'danger').length} критичних
                            </span>
                        </div>
                        <div className="space-y-3">
                            {alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-3 rounded-xl border ${
                                        alert.severity === 'danger' ? 'bg-red-50 border-red-100' :
                                        alert.severity === 'warning' ? 'bg-amber-50 border-amber-100' :
                                        'bg-blue-50 border-blue-100'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <AlertSeverityIcon severity={alert.severity} />
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-900">{alert.message}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(alert.timestamp).toLocaleString('uk-UA')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link
                            href="/admin/warehouse/alerts"
                            className="block mt-4 text-center text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                            Всі сповіщення →
                        </Link>
                    </div>
                </div>
            </div>

            {/* Останні рухи та топ товари */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Останні рухи */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Останні рухи</h2>
                        <Link href="/admin/warehouse/movements" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Всі рухи →
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {movements.map((movement) => (
                            <div key={movement.id} className="flex items-center gap-4">
                                <MovementTypeIcon type={movement.type} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{movement.productName}</p>
                                    <p className="text-sm text-gray-500">{movement.warehouse}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-semibold ${
                                        movement.type === 'receipt' || movement.type === 'return' ? 'text-green-600' :
                                        movement.type === 'shipment' ? 'text-blue-600' :
                                        movement.type === 'transfer' ? 'text-purple-600' :
                                        movement.quantity < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                        {movement.quantity > 0 ? '+' : ''}{movement.quantity} шт.
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(movement.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Топ товари */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Топ товари (ABC аналіз)</h2>
                        <Link href="/admin/warehouse/reports/abc" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Повний звіт →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                                    <th className="pb-3 font-medium">Товар</th>
                                    <th className="pb-3 font-medium text-center">ABC</th>
                                    <th className="pb-3 font-medium text-right">Залишок</th>
                                    <th className="pb-3 font-medium text-right">Оборот</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {topProducts.map((product) => (
                                    <tr key={product.id} className="border-b border-gray-50 last:border-0">
                                        <td className="py-3">
                                            <p className="font-medium text-gray-900">{product.name}</p>
                                            <p className="text-xs text-gray-500">{product.sku}</p>
                                        </td>
                                        <td className="py-3 text-center">
                                            <ABCBadge abcClass={product.abcClass} />
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className="font-medium">{product.totalStock}</span>
                                            {product.reserved > 0 && (
                                                <span className="text-gray-400 ml-1">({product.reserved})</span>
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className={`font-medium ${
                                                product.turnoverRate > 6 ? 'text-green-600' :
                                                product.turnoverRate > 3 ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                                {product.turnoverRate}x
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Статус операцій */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/admin/warehouse/receipts" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Очікується приймань</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingReceipts}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ClockIcon className="w-5 h-5 text-amber-500" />
                            <span className="text-sm text-amber-600 font-medium">Очікують</span>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/warehouse/shipments" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">До відвантаження</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingShipments}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <TruckIcon className="w-5 h-5 text-blue-500" />
                            <span className="text-sm text-blue-600 font-medium">Готові</span>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/warehouse/transfers" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Переміщень в дорозі</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingTransfers}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ArrowsRightLeftIcon className="w-5 h-5 text-purple-500" />
                            <span className="text-sm text-purple-600 font-medium">В процесі</span>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
