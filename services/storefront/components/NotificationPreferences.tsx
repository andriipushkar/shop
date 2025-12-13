'use client';

import { useState, useEffect } from 'react';
import { notificationService, type UserNotificationPreferences } from '@/lib/notifications/push-service';
import { pushNotifications } from '@/lib/notifications/push-notifications';

export default function NotificationPreferences() {
    const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
    const [isPushEnabled, setIsPushEnabled] = useState(false);
    const [isPushSupported, setIsPushSupported] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        loadPreferences();
        checkPushSupport();
    }, []);

    const loadPreferences = async () => {
        const prefs = notificationService.getPreferences();
        setPreferences(prefs);
        const pushEnabled = await notificationService.isPushEnabled();
        setIsPushEnabled(pushEnabled);
        setIsLoading(false);
    };

    const checkPushSupport = () => {
        setIsPushSupported(pushNotifications.isSupported());
    };

    const handleChannelChange = async (
        type: keyof Omit<UserNotificationPreferences, 'quietHours'>,
        channel: keyof UserNotificationPreferences['orderStatus'],
        value: boolean
    ) => {
        if (!preferences) return;

        const updated = {
            ...preferences,
            [type]: {
                ...preferences[type],
                [channel]: value,
            },
        };

        setPreferences(updated);
        await notificationService.updateChannelPreferences(type, { [channel]: value });
        showSuccessMessage();
    };

    const handleQuietHoursChange = async (
        field: keyof UserNotificationPreferences['quietHours'],
        value: boolean | string
    ) => {
        if (!preferences) return;

        const updated = {
            ...preferences,
            quietHours: {
                ...preferences.quietHours,
                [field]: value,
            },
        };

        setPreferences(updated);
        await notificationService.updateQuietHours({ [field]: value });
        showSuccessMessage();
    };

    const handlePushToggle = async (enabled: boolean) => {
        setIsSaving(true);
        try {
            if (enabled) {
                const permission = await notificationService.requestPushPermission();
                if (permission === 'granted') {
                    const success = await notificationService.subscribeToPush();
                    if (success) {
                        setIsPushEnabled(true);
                        await loadPreferences();
                        showSuccessMessage();
                    } else {
                        alert('Не вдалося підписатися на сповіщення. Спробуйте ще раз.');
                    }
                } else {
                    alert('Для отримання push-сповіщень необхідно надати дозвіл у налаштуваннях браузера.');
                }
            } else {
                const success = await notificationService.unsubscribeFromPush();
                if (success) {
                    setIsPushEnabled(false);
                    await loadPreferences();
                    showSuccessMessage();
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const showSuccessMessage = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    if (isLoading || !preferences) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Success Message */}
            {showSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-800">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Налаштування збережено</span>
                </div>
            )}

            {/* Push Notifications Toggle */}
            {isPushSupported && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Push-сповіщення
                            </h3>
                            <p className="text-sm text-gray-600">
                                Отримуйте миттєві сповіщення у вашому браузері про важливі події
                            </p>
                        </div>
                        <button
                            onClick={() => handlePushToggle(!isPushEnabled)}
                            disabled={isSaving}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                isPushEnabled ? 'bg-blue-600' : 'bg-gray-200'
                            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    isPushEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            )}

            {/* Notification Categories */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Налаштування за категоріями
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                    Виберіть, як ви хочете отримувати сповіщення для кожного типу подій
                </p>

                <div className="space-y-6">
                    {/* Order Status */}
                    <NotificationCategory
                        title="Статус замовлення"
                        description="Сповіщення про зміни статусу ваших замовлень"
                        icon={
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        }
                        channels={preferences.orderStatus}
                        onChange={(channel, value) => handleChannelChange('orderStatus', channel, value)}
                    />

                    {/* Price Drop */}
                    <NotificationCategory
                        title="Зниження ціни"
                        description="Сповіщення про зниження цін на товари з вашого списку бажань"
                        icon={
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                            </svg>
                        }
                        channels={preferences.priceDrop}
                        onChange={(channel, value) => handleChannelChange('priceDrop', channel, value)}
                    />

                    {/* Back in Stock */}
                    <NotificationCategory
                        title="Товар в наявності"
                        description="Сповіщення, коли очікуваний товар з'явиться в наявності"
                        icon={
                            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        }
                        channels={preferences.backInStock}
                        onChange={(channel, value) => handleChannelChange('backInStock', channel, value)}
                    />

                    {/* Promotions */}
                    <NotificationCategory
                        title="Акції та знижки"
                        description="Сповіщення про нові акції, промокоди та спеціальні пропозиції"
                        icon={
                            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                            </svg>
                        }
                        channels={preferences.promotion}
                        onChange={(channel, value) => handleChannelChange('promotion', channel, value)}
                    />
                </div>
            </div>

            {/* Quiet Hours */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Режим "Не турбувати"
                        </h3>
                        <p className="text-sm text-gray-600">
                            Вимкніть сповіщення в певний час
                        </p>
                    </div>
                    <button
                        onClick={() => handleQuietHoursChange('enabled', !preferences.quietHours.enabled)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            preferences.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                preferences.quietHours.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {preferences.quietHours.enabled && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Початок
                            </label>
                            <input
                                type="time"
                                value={preferences.quietHours.start}
                                onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Кінець
                            </label>
                            <input
                                type="time"
                                value={preferences.quietHours.end}
                                onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface NotificationCategoryProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    channels: {
        email: boolean;
        push: boolean;
        sms: boolean;
    };
    onChange: (channel: 'email' | 'push' | 'sms', value: boolean) => void;
}

function NotificationCategory({ title, description, icon, channels, onChange }: NotificationCategoryProps) {
    return (
        <div className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
            <div className="flex items-start space-x-3 mb-4">
                <div className="flex-shrink-0">{icon}</div>
                <div className="flex-1">
                    <h4 className="text-base font-medium text-gray-900">{title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                </div>
            </div>

            <div className="ml-9 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={channels.email}
                        onChange={(e) => onChange('email', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Email</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={channels.push}
                        onChange={(e) => onChange('push', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Push-сповіщення</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={channels.sms}
                        onChange={(e) => onChange('sms', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">SMS</span>
                </label>
            </div>
        </div>
    );
}
