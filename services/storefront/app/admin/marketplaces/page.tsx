'use client';

import { useState } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    ShoppingBagIcon,
    CurrencyDollarIcon,
    ClockIcon,
    CogIcon,
} from '@heroicons/react/24/outline';

interface MarketplaceConnection {
    id: string;
    name: string;
    logo: string;
    isConnected: boolean;
    lastSync: string | null;
    status: 'active' | 'error' | 'syncing' | 'disconnected';
    products: number;
    orders: number;
    revenue: number;
}

interface MarketplaceOrder {
    id: string;
    externalId: string;
    marketplace: string;
    status: string;
    total: number;
    createdAt: string;
    customerName: string;
}

const mockConnections: MarketplaceConnection[] = [
    {
        id: 'rozetka',
        name: 'Rozetka',
        logo: '/images/marketplaces/rozetka.png',
        isConnected: true,
        lastSync: new Date().toISOString(),
        status: 'active',
        products: 1245,
        orders: 89,
        revenue: 456780,
    },
    {
        id: 'prom',
        name: 'Prom.ua',
        logo: '/images/marketplaces/prom.png',
        isConnected: true,
        lastSync: new Date(Date.now() - 3600000).toISOString(),
        status: 'active',
        products: 987,
        orders: 45,
        revenue: 234560,
    },
    {
        id: 'hotline',
        name: 'Hotline',
        logo: '/images/marketplaces/hotline.png',
        isConnected: false,
        lastSync: null,
        status: 'disconnected',
        products: 0,
        orders: 0,
        revenue: 0,
    },
    {
        id: 'allo',
        name: 'Allo',
        logo: '/images/marketplaces/allo.png',
        isConnected: false,
        lastSync: null,
        status: 'disconnected',
        products: 0,
        orders: 0,
        revenue: 0,
    },
];

const mockOrders: MarketplaceOrder[] = [
    {
        id: '1',
        externalId: 'RZ-123456',
        marketplace: 'rozetka',
        status: 'new',
        total: 45000,
        createdAt: new Date().toISOString(),
        customerName: 'Іван Петренко',
    },
    {
        id: '2',
        externalId: 'RZ-123455',
        marketplace: 'rozetka',
        status: 'processing',
        total: 12500,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        customerName: 'Марія Коваленко',
    },
    {
        id: '3',
        externalId: 'PR-789012',
        marketplace: 'prom',
        status: 'new',
        total: 8900,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        customerName: 'Олександр Шевченко',
    },
];

export default function MarketplacesPage() {
    const [connections, setConnections] = useState<MarketplaceConnection[]>(mockConnections);
    const [orders] = useState<MarketplaceOrder[]>(mockOrders);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'products' | 'settings'>('overview');

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('uk-UA', {
            style: 'currency',
            currency: 'UAH',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(dateString));
    };

    const handleSync = async (marketplaceId: string) => {
        setSyncing(marketplaceId);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setConnections((prev) =>
            prev.map((conn) =>
                conn.id === marketplaceId
                    ? { ...conn, lastSync: new Date().toISOString() }
                    : conn
            )
        );
        setSyncing(null);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'syncing':
                return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
            default:
                return <ExclamationTriangleIcon className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            new: 'bg-blue-100 text-blue-800',
            processing: 'bg-yellow-100 text-yellow-800',
            shipped: 'bg-purple-100 text-purple-800',
            delivered: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
        };
        const labels: Record<string, string> = {
            new: 'Новий',
            processing: 'Обробка',
            shipped: 'Відправлено',
            delivered: 'Доставлено',
            cancelled: 'Скасовано',
        };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const totalStats = {
        products: connections.reduce((sum, c) => sum + c.products, 0),
        orders: connections.reduce((sum, c) => sum + c.orders, 0),
        revenue: connections.reduce((sum, c) => sum + c.revenue, 0),
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Маркетплейси</h1>
                    <p className="text-gray-600">Керування інтеграціями з торгівельними майданчиками</p>
                </div>
                <button
                    onClick={() => connections.filter((c) => c.isConnected).forEach((c) => handleSync(c.id))}
                    disabled={syncing !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                    Синхронізувати все
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ShoppingBagIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalStats.products.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Товарів на маркетплейсах</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <ClockIcon className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalStats.orders}</p>
                            <p className="text-sm text-gray-500">Активних замовлень</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalStats.revenue)}</p>
                            <p className="text-sm text-gray-500">Дохід з маркетплейсів</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'overview', label: 'Огляд' },
                        { id: 'orders', label: 'Замовлення' },
                        { id: 'products', label: 'Товари' },
                        { id: 'settings', label: 'Налаштування' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {connections.map((connection) => (
                        <div
                            key={connection.id}
                            className={`bg-white rounded-xl shadow-sm p-6 border-2 ${
                                connection.isConnected ? 'border-green-200' : 'border-gray-200'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xl font-bold">
                                        {connection.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{connection.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            {getStatusIcon(syncing === connection.id ? 'syncing' : connection.status)}
                                            <span>
                                                {connection.isConnected
                                                    ? `Остання синхронізація: ${connection.lastSync ? formatDate(connection.lastSync) : 'ніколи'}`
                                                    : 'Не підключено'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {connection.isConnected ? (
                                    <button
                                        onClick={() => handleSync(connection.id)}
                                        disabled={syncing !== null}
                                        className="p-2 text-gray-400 hover:text-teal-600 disabled:opacity-50"
                                    >
                                        <ArrowPathIcon className={`w-5 h-5 ${syncing === connection.id ? 'animate-spin' : ''}`} />
                                    </button>
                                ) : (
                                    <button className="px-3 py-1 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">
                                        Підключити
                                    </button>
                                )}
                            </div>

                            {connection.isConnected && (
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{connection.products}</p>
                                        <p className="text-xs text-gray-500">Товарів</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{connection.orders}</p>
                                        <p className="text-xs text-gray-500">Замовлень</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{formatCurrency(connection.revenue)}</p>
                                        <p className="text-xs text-gray-500">Дохід</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Замовлення
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Маркетплейс
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Клієнт
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Сума
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Статус
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Дата
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Дії
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{order.externalId}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600 capitalize">{order.marketplace}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{order.customerName}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatCurrency(order.total)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(order.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-500">{formatDate(order.createdAt)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button className="text-teal-600 hover:text-teal-900 text-sm font-medium">
                                                Переглянути
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="text-center py-12">
                        <ShoppingBagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Керування товарами</h3>
                        <p className="text-gray-500 mb-4">
                            Синхронізуйте товари з вашого каталогу на маркетплейси
                        </p>
                        <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            Перейти до товарів
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {connections.filter((c) => c.isConnected).map((connection) => (
                        <div key={connection.id} className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold">
                                        {connection.name[0]}
                                    </div>
                                    <h3 className="font-semibold text-gray-900">{connection.name}</h3>
                                </div>
                                <CogIcon className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-3 border-b">
                                    <div>
                                        <p className="font-medium text-gray-900">Автоматична синхронізація</p>
                                        <p className="text-sm text-gray-500">Синхронізувати товари та замовлення автоматично</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between py-3 border-b">
                                    <div>
                                        <p className="font-medium text-gray-900">Сповіщення про замовлення</p>
                                        <p className="text-sm text-gray-500">Отримувати сповіщення про нові замовлення</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="font-medium text-gray-900">Синхронізація залишків</p>
                                        <p className="text-sm text-gray-500">Автоматично оновлювати залишки на маркетплейсі</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                                <button className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                                    Відключити
                                </button>
                                <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                                    Зберегти
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
