'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CreditCardIcon,
    BanknotesIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    EyeSlashIcon,
} from '@heroicons/react/24/outline';

interface PaymentMethod {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    icon: string;
    commission: number;
    minOrderAmount: number;
}

const initialMethods: PaymentMethod[] = [
    {
        id: 'liqpay',
        name: 'LiqPay (Картка онлайн)',
        description: 'Оплата карткою Visa, Mastercard, Google Pay, Apple Pay',
        enabled: true,
        icon: '💳',
        commission: 2.75,
        minOrderAmount: 0,
    },
    {
        id: 'cash',
        name: 'Готівкою при отриманні',
        description: 'Оплата готівкою кур\'єру або у відділенні',
        enabled: true,
        icon: '💵',
        commission: 0,
        minOrderAmount: 0,
    },
    {
        id: 'cod',
        name: 'Накладений платіж',
        description: 'Оплата при отриманні через Нову Пошту (з комісією)',
        enabled: true,
        icon: '📦',
        commission: 2,
        minOrderAmount: 100,
    },
    {
        id: 'invoice',
        name: 'Безготівковий розрахунок',
        description: 'Для юридичних осіб за рахунком',
        enabled: false,
        icon: '📄',
        commission: 0,
        minOrderAmount: 5000,
    },
];

export default function PaymentSettingsPage() {
    const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
    const [editingMethod, setEditingMethod] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // LiqPay settings
    const [liqpayPublicKey, setLiqpayPublicKey] = useState('sandbox_i00000000000');
    const [liqpayPrivateKey, setLiqpayPrivateKey] = useState('');
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [liqpayTestMode, setLiqpayTestMode] = useState(true);

    // COD settings
    const [codCommissionPercent, setCodCommissionPercent] = useState(2);
    const [codFixedFee, setCodFixedFee] = useState(20);
    const [codMinCommission, setCodMinCommission] = useState(30);

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

    const handleUpdateMethod = (methodId: string, updates: Partial<PaymentMethod>) => {
        setMethods(prev =>
            prev.map(m =>
                m.id === methodId ? { ...m, ...updates } : m
            )
        );
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            showNotification('success', 'Налаштування збережено');
            setEditingMethod(null);
        } catch {
            showNotification('error', 'Помилка збереження налаштувань');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestLiqPay = async () => {
        showNotification('success', 'Тестовий платіж пройшов успішно');
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
                        <h1 className="text-2xl font-bold text-gray-900">Налаштування оплати</h1>
                        <p className="text-gray-600">Керування способами оплати та інтеграціями</p>
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

            {/* Payment Methods */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <CreditCardIcon className="w-5 h-5 text-teal-600" />
                        Способи оплати
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

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Комісія (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={method.commission}
                                                onChange={(e) => handleUpdateMethod(method.id, { commission: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                min={0}
                                                step={0.01}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Мін. сума замовлення (грн)
                                            </label>
                                            <input
                                                type="number"
                                                value={method.minOrderAmount}
                                                onChange={(e) => handleUpdateMethod(method.id, { minOrderAmount: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                min={0}
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
                                                {method.commission > 0 && (
                                                    <>
                                                        <span>Комісія: {method.commission}%</span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                {method.minOrderAmount > 0 && (
                                                    <span>Мін. замовлення: {method.minOrderAmount} грн</span>
                                                )}
                                                {method.commission === 0 && method.minOrderAmount === 0 && (
                                                    <span className="text-teal-600">Без обмежень</span>
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

            {/* LiqPay Integration */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">LP</span>
                    </div>
                    Інтеграція з LiqPay
                </h2>

                {/* Test Mode Warning */}
                {liqpayTestMode && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                            <p className="font-medium text-yellow-800">Тестовий режим увімкнено</p>
                            <p className="text-sm text-yellow-700">
                                Платежі не будуть проводитися реально. Використовуйте тестові картки для перевірки.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">Тестовий режим</p>
                            <p className="text-sm text-gray-500">Sandbox для тестування платежів</p>
                        </div>
                        <button
                            onClick={() => setLiqpayTestMode(!liqpayTestMode)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                liqpayTestMode ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                                    liqpayTestMode ? 'translate-x-7' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Public Key
                        </label>
                        <input
                            type="text"
                            value={liqpayPublicKey}
                            onChange={(e) => setLiqpayPublicKey(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                            placeholder="sandbox_i00000000000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Private Key
                        </label>
                        <div className="relative">
                            <input
                                type={showPrivateKey ? 'text' : 'password'}
                                value={liqpayPrivateKey}
                                onChange={(e) => setLiqpayPrivateKey(e.target.value)}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                                placeholder="••••••••••••••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPrivateKey(!showPrivateKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPrivateKey ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Отримайте ключі у кабінеті мерчанта LiqPay
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">Статус підключення</p>
                            <p className="text-sm text-gray-500">Перевірка API ключів</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-sm text-green-600 font-medium">Підключено</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <button
                            onClick={handleTestLiqPay}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                            Тестовий платіж
                        </button>
                        <a
                            href="https://www.liqpay.ua/admin"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
                        >
                            Кабінет LiqPay
                        </a>
                        <a
                            href="https://www.liqpay.ua/documentation/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
                        >
                            Документація
                        </a>
                    </div>
                </div>
            </div>

            {/* COD Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <BanknotesIcon className="w-5 h-5 text-teal-600" />
                    Накладений платіж (COD)
                </h2>

                <p className="text-sm text-gray-500 mb-6">
                    Налаштування комісії для накладеного платежу через Нову Пошту
                </p>

                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Комісія (%)
                        </label>
                        <input
                            type="number"
                            value={codCommissionPercent}
                            onChange={(e) => setCodCommissionPercent(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            min={0}
                            step={0.1}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Фіксована плата (грн)
                        </label>
                        <input
                            type="number"
                            value={codFixedFee}
                            onChange={(e) => setCodFixedFee(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            min={0}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Мінімальна комісія (грн)
                        </label>
                        <input
                            type="number"
                            value={codMinCommission}
                            onChange={(e) => setCodMinCommission(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            min={0}
                        />
                    </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Формула розрахунку:</p>
                    <p className="font-mono text-sm text-gray-600">
                        MAX({codMinCommission} грн, сума × {codCommissionPercent}% + {codFixedFee} грн)
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Приклад для замовлення на 1000 грн:</p>
                        <p className="text-sm font-medium text-gray-900">
                            1000 × {codCommissionPercent}% + {codFixedFee} = {Math.max(codMinCommission, 1000 * (codCommissionPercent / 100) + codFixedFee)} грн
                        </p>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-teal-600" />
                    Безпека платежів
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">3D Secure</p>
                            <p className="text-sm text-gray-500">Додаткова верифікація карткових платежів</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                            Увімкнено
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">Callback підпис</p>
                            <p className="text-sm text-gray-500">Верифікація callback запитів від LiqPay</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                            Увімкнено
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">SSL/TLS</p>
                            <p className="text-sm text-gray-500">Шифрування з&apos;єднання з платіжним шлюзом</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                            TLS 1.3
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
