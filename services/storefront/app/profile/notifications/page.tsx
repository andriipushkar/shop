'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    BellIcon,
    DevicePhoneMobileIcon,
    EnvelopeIcon,
    ShoppingBagIcon,
    TruckIcon,
    CheckCircleIcon,
    MegaphoneIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface NotificationSettings {
    email: {
        orderConfirmation: boolean;
        shippingUpdates: boolean;
        deliveryNotifications: boolean;
        promotional: boolean;
        newsletter: boolean;
    };
    sms: {
        orderConfirmation: boolean;
        shippingUpdates: boolean;
        deliveryNotifications: boolean;
        promotional: boolean;
    };
    push: {
        orderUpdates: boolean;
        promotional: boolean;
        priceDrops: boolean;
    };
}

const defaultSettings: NotificationSettings = {
    email: {
        orderConfirmation: true,
        shippingUpdates: true,
        deliveryNotifications: true,
        promotional: false,
        newsletter: false,
    },
    sms: {
        orderConfirmation: true,
        shippingUpdates: true,
        deliveryNotifications: true,
        promotional: false,
    },
    push: {
        orderUpdates: true,
        promotional: false,
        priceDrops: true,
    },
};

export default function NotificationsPage() {
    const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [phoneVerified] = useState(true);

    const handleToggle = (
        channel: keyof NotificationSettings,
        setting: string
    ) => {
        setSettings(prev => ({
            ...prev,
            [channel]: {
                ...prev[channel],
                [setting]: !prev[channel][setting as keyof typeof prev[typeof channel]],
            },
        }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSaving(false);
        setSaved(true);
    };

    const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-teal-600' : 'bg-gray-200'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <nav className="text-sm text-gray-500 mb-2">
                        <Link href="/" className="hover:text-teal-600">Головна</Link>
                        <span className="mx-2">/</span>
                        <Link href="/profile" className="hover:text-teal-600">Профіль</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">Сповіщення</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-gray-900">Налаштування сповіщень</h1>
                    <p className="text-gray-600">Керуйте тим, як ми зв&apos;язуємося з вами</p>
                </div>

                <div className="space-y-6">
                    {/* Email notifications */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Email-сповіщення</h2>
                                <p className="text-sm text-gray-500">Сповіщення на електронну пошту</p>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Підтвердження замовлення</p>
                                        <p className="text-sm text-gray-500">Деталі після оформлення замовлення</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.email.orderConfirmation}
                                    onChange={() => handleToggle('email', 'orderConfirmation')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TruckIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Оновлення доставки</p>
                                        <p className="text-sm text-gray-500">Статус та ТТН відправлення</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.email.shippingUpdates}
                                    onChange={() => handleToggle('email', 'shippingUpdates')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Сповіщення про доставку</p>
                                        <p className="text-sm text-gray-500">Коли замовлення прибуло</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.email.deliveryNotifications}
                                    onChange={() => handleToggle('email', 'deliveryNotifications')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <MegaphoneIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Акції та знижки</p>
                                        <p className="text-sm text-gray-500">Спеціальні пропозиції та промокоди</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.email.promotional}
                                    onChange={() => handleToggle('email', 'promotional')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BellIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Розсилка новин</p>
                                        <p className="text-sm text-gray-500">Новинки та огляди товарів</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.email.newsletter}
                                    onChange={() => handleToggle('email', 'newsletter')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SMS notifications */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <DevicePhoneMobileIcon className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900">SMS-сповіщення</h2>
                                    <p className="text-sm text-gray-500">Сповіщення на телефон</p>
                                </div>
                            </div>
                            {phoneVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                                    Телефон підтверджено
                                </span>
                            ) : (
                                <button className="text-sm text-teal-600 hover:text-teal-700">
                                    Підтвердити телефон
                                </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Підтвердження замовлення</p>
                                        <p className="text-sm text-gray-500">SMS з номером замовлення</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.sms.orderConfirmation}
                                    onChange={() => handleToggle('sms', 'orderConfirmation')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TruckIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Оновлення доставки</p>
                                        <p className="text-sm text-gray-500">SMS з номером ТТН</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.sms.shippingUpdates}
                                    onChange={() => handleToggle('sms', 'shippingUpdates')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Прибуття у відділення</p>
                                        <p className="text-sm text-gray-500">SMS коли посилка на місці</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.sms.deliveryNotifications}
                                    onChange={() => handleToggle('sms', 'deliveryNotifications')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <MegaphoneIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Акції та знижки</p>
                                        <p className="text-sm text-gray-500">SMS з промокодами</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.sms.promotional}
                                    onChange={() => handleToggle('sms', 'promotional')}
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-amber-50 border-t border-amber-100">
                            <p className="text-sm text-amber-800">
                                ⚠️ SMS-сповіщення можуть тарифікуватися вашим оператором
                            </p>
                        </div>
                    </div>

                    {/* Push notifications */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <BellIcon className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Push-сповіщення</h2>
                                <p className="text-sm text-gray-500">Сповіщення в браузері</p>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Оновлення замовлень</p>
                                        <p className="text-sm text-gray-500">Зміни статусу замовлення</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.push.orderUpdates}
                                    onChange={() => handleToggle('push', 'orderUpdates')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <MegaphoneIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Акційні пропозиції</p>
                                        <p className="text-sm text-gray-500">Ексклюзивні знижки</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.push.promotional}
                                    onChange={() => handleToggle('push', 'promotional')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BellIcon className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">Зниження цін</p>
                                        <p className="text-sm text-gray-500">Товари зі списку бажань</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.push.priceDrops}
                                    onChange={() => handleToggle('push', 'priceDrops')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Save button */}
                    <div className="flex items-center justify-between">
                        <div>
                            {saved && (
                                <p className="text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircleIcon className="w-4 h-4" />
                                    Налаштування збережено
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Збереження...' : 'Зберегти зміни'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
