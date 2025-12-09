'use client';

import { useState } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    Cog6ToothIcon,
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    PlayIcon,
    PauseIcon,
    DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

type IntegrationStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

interface Integration {
    id: string;
    name: string;
    logo: string;
    status: IntegrationStatus;
    lastSync: string | null;
    products: number;
    orders: number;
    autoSync: boolean;
    syncInterval: string;
    description: string;
}

const integrations: Integration[] = [
    {
        id: 'rozetka',
        name: 'Rozetka',
        logo: '🛒',
        status: 'connected',
        lastSync: '10.12.2024 14:30',
        products: 1245,
        orders: 89,
        autoSync: true,
        syncInterval: 'Кожні 30 хв',
        description: 'Найбільший маркетплейс України',
    },
    {
        id: 'prom',
        name: 'Prom.ua',
        logo: '🏪',
        status: 'connected',
        lastSync: '10.12.2024 14:25',
        products: 1180,
        orders: 45,
        autoSync: true,
        syncInterval: 'Кожну годину',
        description: 'Торговельний майданчик B2B та B2C',
    },
    {
        id: 'hotline',
        name: 'Hotline',
        logo: '🔥',
        status: 'connected',
        lastSync: '10.12.2024 12:00',
        products: 890,
        orders: 0,
        autoSync: true,
        syncInterval: 'Кожні 2 години',
        description: 'Порівняння цін та товарів',
    },
    {
        id: 'price',
        name: 'Price.ua',
        logo: '💰',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Порівняння цін',
    },
    {
        id: 'allo',
        name: 'Allo.ua',
        logo: '📱',
        status: 'error',
        lastSync: '09.12.2024 18:00',
        products: 456,
        orders: 12,
        autoSync: true,
        syncInterval: 'Кожні 30 хв',
        description: 'Партнерська програма Allo',
    },
    {
        id: 'epicentr',
        name: 'Епіцентр',
        logo: '🏠',
        status: 'disconnected',
        lastSync: null,
        products: 0,
        orders: 0,
        autoSync: false,
        syncInterval: '-',
        description: 'Маркетплейс товарів для дому',
    },
    {
        id: 'google_merchant',
        name: 'Google Merchant',
        logo: '🔍',
        status: 'connected',
        lastSync: '10.12.2024 13:45',
        products: 1300,
        orders: 0,
        autoSync: true,
        syncInterval: 'Кожні 4 години',
        description: 'Google Shopping реклама',
    },
    {
        id: 'facebook',
        name: 'Facebook Shop',
        logo: '📘',
        status: 'syncing',
        lastSync: '10.12.2024 14:35',
        products: 1150,
        orders: 23,
        autoSync: true,
        syncInterval: 'Кожні 2 години',
        description: 'Каталог товарів Facebook/Instagram',
    },
];

const exportFormats = [
    { id: 'yml', name: 'YML (Yandex Market)', description: 'Для Rozetka, Prom, Hotline' },
    { id: 'xml', name: 'XML (Google Merchant)', description: 'Для Google Shopping' },
    { id: 'csv', name: 'CSV', description: 'Універсальний формат' },
    { id: 'json', name: 'JSON Feed', description: 'Для Facebook/Instagram' },
];

const syncHistory = [
    { id: 1, platform: 'Rozetka', type: 'auto', date: '10.12.2024 14:30', products: 1245, status: 'success', duration: '2 хв 15 сек' },
    { id: 2, platform: 'Facebook Shop', type: 'auto', date: '10.12.2024 14:35', products: 1150, status: 'in_progress', duration: '-' },
    { id: 3, platform: 'Prom.ua', type: 'auto', date: '10.12.2024 14:25', products: 1180, status: 'success', duration: '1 хв 45 сек' },
    { id: 4, platform: 'Allo.ua', type: 'manual', date: '09.12.2024 18:00', products: 456, status: 'error', duration: '5 хв 30 сек' },
    { id: 5, platform: 'Google Merchant', type: 'auto', date: '10.12.2024 13:45', products: 1300, status: 'success', duration: '3 хв 10 сек' },
];

export default function AdminIntegrationsPage() {
    const [activeTab, setActiveTab] = useState<'marketplaces' | 'export' | 'history'>('marketplaces');
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
    const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

    const handleSync = async (platformId: string) => {
        setSyncingPlatform(platformId);
        // Simulate sync
        await new Promise(resolve => setTimeout(resolve, 3000));
        setSyncingPlatform(null);
    };

    const getStatusBadge = (status: IntegrationStatus) => {
        switch (status) {
            case 'connected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Підключено
                    </span>
                );
            case 'disconnected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Не підключено
                    </span>
                );
            case 'syncing':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        Синхронізація
                    </span>
                );
            case 'error':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        Помилка
                    </span>
                );
        }
    };

    const connectedCount = integrations.filter(i => i.status === 'connected' || i.status === 'syncing').length;
    const totalProducts = integrations.reduce((sum, i) => sum + i.products, 0);
    const totalOrders = integrations.reduce((sum, i) => sum + i.orders, 0);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Інтеграції та маркетплейси</h1>
                    <p className="text-gray-600">Синхронізація товарів з торговельними платформами</p>
                </div>
                <button
                    onClick={() => setShowConnectModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати інтеграцію
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
                            <p className="text-sm text-gray-500">Активних інтеграцій</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CloudArrowUpIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalProducts.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Товарів синхронізовано</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CloudArrowDownIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                            <p className="text-sm text-gray-500">Замовлень з маркетплейсів</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
                <div className="border-b">
                    <nav className="flex gap-8 px-6">
                        {[
                            { id: 'marketplaces', name: 'Маркетплейси' },
                            { id: 'export', name: 'Експорт фідів' },
                            { id: 'history', name: 'Історія синхронізації' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-teal-600 text-teal-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Marketplaces tab */}
                    {activeTab === 'marketplaces' && (
                        <div className="grid md:grid-cols-2 gap-4">
                            {integrations.map((integration) => (
                                <div
                                    key={integration.id}
                                    className={`border rounded-xl p-4 transition-all ${
                                        integration.status === 'connected' || integration.status === 'syncing'
                                            ? 'border-green-200 bg-green-50/30'
                                            : integration.status === 'error'
                                                ? 'border-red-200 bg-red-50/30'
                                                : 'border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                                                {integration.logo}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                                                <p className="text-xs text-gray-500">{integration.description}</p>
                                            </div>
                                        </div>
                                        {getStatusBadge(integration.status)}
                                    </div>

                                    {(integration.status === 'connected' || integration.status === 'syncing' || integration.status === 'error') && (
                                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-lg font-semibold text-gray-900">{integration.products}</p>
                                                <p className="text-xs text-gray-500">Товарів</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-lg font-semibold text-gray-900">{integration.orders}</p>
                                                <p className="text-xs text-gray-500">Замовлень</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-2">
                                                <p className="text-xs font-medium text-gray-900">{integration.syncInterval}</p>
                                                <p className="text-xs text-gray-500">Синхронізація</p>
                                            </div>
                                        </div>
                                    )}

                                    {integration.lastSync && (
                                        <p className="text-xs text-gray-500 mb-3">
                                            <ClockIcon className="w-3.5 h-3.5 inline mr-1" />
                                            Остання синхронізація: {integration.lastSync}
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        {integration.status === 'disconnected' ? (
                                            <button
                                                onClick={() => {
                                                    setSelectedIntegration(integration);
                                                    setShowConnectModal(true);
                                                }}
                                                className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                                            >
                                                Підключити
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleSync(integration.id)}
                                                    disabled={syncingPlatform === integration.id || integration.status === 'syncing'}
                                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                                                >
                                                    {syncingPlatform === integration.id || integration.status === 'syncing' ? (
                                                        <>
                                                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                            Синхронізація...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowPathIcon className="w-4 h-4" />
                                                            Синхронізувати
                                                        </>
                                                    )}
                                                </button>
                                                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                                    <Cog6ToothIcon className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Export feeds tab */}
                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <CloudArrowUpIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-blue-900">Експорт товарів</h3>
                                        <p className="text-sm text-blue-700 mt-1">
                                            Експортуйте каталог товарів у різних форматах для завантаження на маркетплейси вручну
                                            або для налаштування автоматичної синхронізації через URL фіду.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {exportFormats.map((format) => (
                                    <div key={format.id} className="border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{format.name}</h3>
                                                <p className="text-sm text-gray-500">{format.description}</p>
                                            </div>
                                            <DocumentArrowDownIcon className="w-6 h-6 text-gray-400" />
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                                    URL фіду (для автосинхронізації)
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={`https://myshop.ua/feeds/${format.id}`}
                                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600"
                                                    />
                                                    <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                                                        Копіювати
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                                                    Завантажити файл
                                                </button>
                                                <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                                                    Налаштування
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border border-gray-200 rounded-xl p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Налаштування експорту</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Категорії для експорту
                                        </label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                            <option>Всі категорії</option>
                                            <option>Електроніка</option>
                                            <option>Одяг</option>
                                            <option>Дім і сад</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Мінімальний залишок
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue="1"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                            <span className="text-sm text-gray-700">Експортувати тільки товари в наявності</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History tab */}
                    {activeTab === 'history' && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                                        <th className="pb-3">Платформа</th>
                                        <th className="pb-3">Тип</th>
                                        <th className="pb-3">Дата</th>
                                        <th className="pb-3">Товарів</th>
                                        <th className="pb-3">Тривалість</th>
                                        <th className="pb-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {syncHistory.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-3 font-medium text-gray-900">{item.platform}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    item.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {item.type === 'auto' ? 'Авто' : 'Ручна'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-sm text-gray-600">{item.date}</td>
                                            <td className="py-3 text-sm text-gray-600">{item.products}</td>
                                            <td className="py-3 text-sm text-gray-600">{item.duration}</td>
                                            <td className="py-3">
                                                {item.status === 'success' && (
                                                    <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                                        <CheckCircleIcon className="w-4 h-4" />
                                                        Успішно
                                                    </span>
                                                )}
                                                {item.status === 'error' && (
                                                    <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                                                        <XCircleIcon className="w-4 h-4" />
                                                        Помилка
                                                    </span>
                                                )}
                                                {item.status === 'in_progress' && (
                                                    <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
                                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                        В процесі
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
            </div>

            {/* Connect modal */}
            {showConnectModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => {
                            setShowConnectModal(false);
                            setSelectedIntegration(null);
                        }} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {selectedIntegration ? `Підключити ${selectedIntegration.name}` : 'Додати інтеграцію'}
                            </h3>

                            {!selectedIntegration ? (
                                <div className="space-y-3 mb-6">
                                    {integrations.filter(i => i.status === 'disconnected').map((integration) => (
                                        <button
                                            key={integration.id}
                                            onClick={() => setSelectedIntegration(integration)}
                                            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
                                        >
                                            <span className="text-2xl">{integration.logo}</span>
                                            <div>
                                                <p className="font-medium text-gray-900">{integration.name}</p>
                                                <p className="text-xs text-gray-500">{integration.description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <form className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            API ключ
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Введіть API ключ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Секретний ключ
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Введіть секретний ключ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Інтервал синхронізації
                                        </label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                            <option value="15">Кожні 15 хвилин</option>
                                            <option value="30">Кожні 30 хвилин</option>
                                            <option value="60">Кожну годину</option>
                                            <option value="120">Кожні 2 години</option>
                                            <option value="240">Кожні 4 години</option>
                                            <option value="1440">Раз на день</option>
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-sm text-gray-700">Увімкнути автоматичну синхронізацію</span>
                                    </label>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowConnectModal(false);
                                                setSelectedIntegration(null);
                                            }}
                                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Скасувати
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                        >
                                            Підключити
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
