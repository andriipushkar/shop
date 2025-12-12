'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    TruckIcon,
    CurrencyDollarIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    ArrowPathIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface DeliveryMethod {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    minPrice: number;
    pricePerKg: number;
    freeFrom: number;
    estimatedDays: string;
    icon: string;
}

const initialMethods: DeliveryMethod[] = [
    {
        id: 'nova_poshta_warehouse',
        name: 'Нова Пошта (відділення)',
        description: 'Доставка у відділення Нової Пошти',
        enabled: true,
        minPrice: 55,
        pricePerKg: 15,
        freeFrom: 1000,
        estimatedDays: '1-3',
        icon: '📦',
    },
    {
        id: 'nova_poshta_courier',
        name: 'Нова Пошта (кур\'єр)',
        description: 'Кур\'єрська доставка додому',
        enabled: true,
        minPrice: 80,
        pricePerKg: 20,
        freeFrom: 1500,
        estimatedDays: '1-2',
        icon: '🚚',
    },
    {
        id: 'ukrposhta',
        name: 'Укрпошта',
        description: 'Доставка Укрпоштою',
        enabled: true,
        minPrice: 35,
        pricePerKg: 10,
        freeFrom: 1000,
        estimatedDays: '3-7',
        icon: '📮',
    },
    {
        id: 'pickup',
        name: 'Самовивіз',
        description: 'Самовивіз з нашого магазину',
        enabled: false,
        minPrice: 0,
        pricePerKg: 0,
        freeFrom: 0,
        estimatedDays: '0',
        icon: '🏪',
    },
];

export default function DeliverySettingsPage() {
    const [methods, setMethods] = useState<DeliveryMethod[]>(initialMethods);
    const [editingMethod, setEditingMethod] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Global settings
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(1000);
    const [showFreeDeliveryBanner, setShowFreeDeliveryBanner] = useState(true);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleToggleMethod = (methodId: string) => {
        setMethods(prev =>
            prev.map(m =>
                m.id === methodId ? { ...m, enabled: !m.enabled } : m
            )
        );
    };

    const handleUpdateMethod = (methodId: string, updates: Partial<DeliveryMethod>) => {
        setMethods(prev =>
            prev.map(m =>
                m.id === methodId ? { ...m, ...updates } : m
            )
        );
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            showNotification('success', 'Налаштування збережено');
            setEditingMethod(null);
        } catch {
            showNotification('error', 'Помилка збереження налаштувань');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-xl shadow-lg ${
                    notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                    {notification.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/settings"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Налаштування доставки</h1>
                        <p className="text-gray-600">Керування способами доставки та цінами</p>
                    </div>
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                    {isSaving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    Зберегти зміни
                </button>
            </div>

            {/* Global Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-5 h-5 text-teal-600" />
                    Загальні налаштування
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Поріг безкоштовної доставки (грн)
                        </label>
                        <input
                            type="number"
                            value={freeDeliveryThreshold}
                            onChange={(e) => setFreeDeliveryThreshold(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            min={0}
                            step={100}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Замовлення від цієї суми мають безкоштовну доставку
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Показувати банер безкоштовної доставки
                        </label>
                        <button
                            onClick={() => setShowFreeDeliveryBanner(!showFreeDeliveryBanner)}
                            className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${
                                showFreeDeliveryBanner ? 'bg-teal-600' : 'bg-gray-300'
                            }`}
                        >
                            <span
                                className={`inline-block h-10 w-10 transform rounded-full bg-white shadow-md transition-transform ${
                                    showFreeDeliveryBanner ? 'translate-x-12' : 'translate-x-1'
                                }`}
                            />
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                            Банер у шапці сайту про безкоштовну доставку
                        </p>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-teal-50 rounded-lg">
                    <div className="flex items-start gap-3">
                        <InformationCircleIcon className="w-5 h-5 text-teal-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-teal-800">Текст банера:</p>
                            <p className="text-sm text-teal-700">
                                &quot;Безкоштовна доставка від {freeDeliveryThreshold.toLocaleString()} грн&quot;
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delivery Methods */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <TruckIcon className="w-5 h-5 text-teal-600" />
                        Способи доставки
                    </h2>
                </div>

                <div className="divide-y divide-gray-100">
                    {methods.map((method) => (
                        <div key={method.id} className="p-6">
                            {editingMethod === method.id ? (
                                /* Edit Mode */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{method.icon}</span>
                                            <input
                                                type="text"
                                                value={method.name}
                                                onChange={(e) => handleUpdateMethod(method.id, { name: e.target.value })}
                                                className="text-lg font-semibold text-gray-900 border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingMethod(null)}
                                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                            >
                                                Скасувати
                                            </button>
                                            <button
                                                onClick={() => setEditingMethod(null)}
                                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                            >
                                                Готово
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={method.description}
                                        onChange={(e) => handleUpdateMethod(method.id, { description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Опис"
                                    />

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Мінімальна ціна (грн)
                                            </label>
                                            <input
                                                type="number"
                                                value={method.minPrice}
                                                onChange={(e) => handleUpdateMethod(method.id, { minPrice: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                min={0}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Ціна за кг (грн)
                                            </label>
                                            <input
                                                type="number"
                                                value={method.pricePerKg}
                                                onChange={(e) => handleUpdateMethod(method.id, { pricePerKg: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                min={0}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Безкоштовно від (грн)
                                            </label>
                                            <input
                                                type="number"
                                                value={method.freeFrom}
                                                onChange={(e) => handleUpdateMethod(method.id, { freeFrom: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                min={0}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Термін (днів)
                                            </label>
                                            <input
                                                type="text"
                                                value={method.estimatedDays}
                                                onChange={(e) => handleUpdateMethod(method.id, { estimatedDays: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                placeholder="1-3"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl">{method.icon}</span>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold text-gray-900">{method.name}</h3>
                                                {method.enabled ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                                        Активний
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                                        <XCircleIcon className="w-3.5 h-3.5" />
                                                        Вимкнено
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{method.description}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                                <span>від {method.minPrice} грн</span>
                                                <span>•</span>
                                                <span>+{method.pricePerKg} грн/кг</span>
                                                <span>•</span>
                                                <span>{method.estimatedDays} дн.</span>
                                                {method.freeFrom > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-teal-600">
                                                            безкоштовно від {method.freeFrom.toLocaleString()} грн
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setEditingMethod(method.id)}
                                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleMethod(method.id)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                                method.enabled ? 'bg-teal-600' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                                                    method.enabled ? 'translate-x-7' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Nova Poshta API Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Інтеграція з Новою Поштою</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            API ключ Нової Пошти
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••••••••••••••"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Отримайте API ключ у особистому кабінеті Нової Пошти
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">Статус з&apos;єднання</p>
                            <p className="text-sm text-gray-500">Перевірка API ключа</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-sm text-green-600 font-medium">Підключено</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Відділень у базі</p>
                            <p className="text-2xl font-bold text-gray-900">23,456</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Останнє оновлення</p>
                            <p className="text-2xl font-bold text-gray-900">Сьогодні, 08:00</p>
                        </div>
                    </div>

                    <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                        Оновити базу відділень
                    </button>
                </div>
            </div>
        </div>
    );
}
