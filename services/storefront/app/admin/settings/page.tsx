'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    BuildingStorefrontIcon,
    CreditCardIcon,
    TruckIcon,
    BellIcon,
    ShieldCheckIcon,
    GlobeAltIcon,
    EnvelopeIcon,
    PhoneIcon,
    MapPinIcon,
    CheckIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const tabs = [
    { id: 'general', name: 'Загальні', icon: BuildingStorefrontIcon },
    { id: 'payment', name: 'Оплата', icon: CreditCardIcon },
    { id: 'delivery', name: 'Доставка', icon: TruckIcon },
    { id: 'notifications', name: 'Сповіщення', icon: BellIcon },
    { id: 'security', name: 'Безпека', icon: ShieldCheckIcon },
];

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Налаштування</h1>
                    <p className="text-gray-600">Налаштування магазину</p>
                </div>
                <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    {saved ? (
                        <>
                            <CheckIcon className="w-5 h-5" />
                            Збережено!
                        </>
                    ) : (
                        'Зберегти зміни'
                    )}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Tabs */}
                <div className="lg:w-64 flex-shrink-0">
                    <nav className="bg-white rounded-xl shadow-sm p-2 space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-teal-50 text-teal-700'
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1">
                    {activeTab === 'general' && (
                        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-semibold text-gray-900 pb-4 border-b">
                                Інформація про магазин
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва магазину
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue="MyShop"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Домен
                                    </label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
                                            https://
                                        </span>
                                        <input
                                            type="text"
                                            defaultValue="myshop.ua"
                                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Опис магазину
                                </label>
                                <textarea
                                    rows={3}
                                    defaultValue="Інтернет-магазин електроніки та аксесуарів"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                Контактна інформація
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <EnvelopeIcon className="w-4 h-4 inline mr-1" />
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        defaultValue="info@myshop.ua"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <PhoneIcon className="w-4 h-4 inline mr-1" />
                                        Телефон
                                    </label>
                                    <input
                                        type="tel"
                                        defaultValue="+380 44 123 4567"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <MapPinIcon className="w-4 h-4 inline mr-1" />
                                    Адреса
                                </label>
                                <input
                                    type="text"
                                    defaultValue="м. Київ, вул. Хрещатик, 1"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                Локалізація
                            </h3>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <GlobeAltIcon className="w-4 h-4 inline mr-1" />
                                        Мова
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option>Українська</option>
                                        <option>English</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Валюта
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option>UAH (₴)</option>
                                        <option>USD ($)</option>
                                        <option>EUR (€)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Часовий пояс
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option>UTC+2 (Київ)</option>
                                        <option>UTC+3 (Київ, літній час)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between pb-4 border-b">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Способи оплати
                                </h2>
                                <Link
                                    href="/admin/settings/payments"
                                    className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                                >
                                    Детальні налаштування
                                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { name: 'Карта онлайн (LiqPay)', enabled: true, description: 'Visa, Mastercard' },
                                    { name: 'Приват24', enabled: true, description: 'Для клієнтів ПриватБанку' },
                                    { name: 'Apple Pay / Google Pay', enabled: true, description: 'Мобільні платежі' },
                                    { name: 'Накладений платіж', enabled: true, description: 'Оплата при отриманні' },
                                    { name: 'Безготівковий рахунок', enabled: false, description: 'Для юридичних осіб' },
                                ].map((method) => (
                                    <div key={method.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{method.name}</p>
                                            <p className="text-sm text-gray-500">{method.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked={method.enabled} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                API ключі LiqPay
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Public Key
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="sandbox_xxxxxxxx"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Private Key
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••••••••••"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'delivery' && (
                        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between pb-4 border-b">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Способи доставки
                                </h2>
                                <Link
                                    href="/admin/settings/delivery"
                                    className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                                >
                                    Детальні налаштування
                                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { name: 'Нова Пошта', enabled: true, price: '50 грн' },
                                    { name: 'Нова Пошта Кур\'єр', enabled: true, price: '80 грн' },
                                    { name: 'Укрпошта', enabled: true, price: '35 грн' },
                                    { name: 'Самовивіз', enabled: true, price: 'Безкоштовно' },
                                    { name: 'Meest Express', enabled: false, price: '45 грн' },
                                ].map((method) => (
                                    <div key={method.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked={method.enabled} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                            </label>
                                            <div>
                                                <p className="font-medium text-gray-900">{method.name}</p>
                                                <p className="text-sm text-gray-500">{method.price}</p>
                                            </div>
                                        </div>
                                        <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                            Налаштувати
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                Безкоштовна доставка
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Мінімальна сума замовлення
                                    </label>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            defaultValue="1000"
                                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                        <span className="inline-flex items-center px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500 text-sm">
                                            ₴
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-semibold text-gray-900 pb-4 border-b">
                                Email сповіщення
                            </h2>

                            <div className="space-y-4">
                                {[
                                    { name: 'Нове замовлення', description: 'Сповіщення про нове замовлення', enabled: true },
                                    { name: 'Оплата отримана', description: 'Підтвердження оплати', enabled: true },
                                    { name: 'Замовлення відправлено', description: 'Сповіщення клієнту про відправку', enabled: true },
                                    { name: 'Замовлення доставлено', description: 'Сповіщення про доставку', enabled: false },
                                    { name: 'Запит на повернення', description: 'Сповіщення про повернення товару', enabled: true },
                                    { name: 'Новий відгук', description: 'Сповіщення про новий відгук', enabled: false },
                                ].map((notification) => (
                                    <div key={notification.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{notification.name}</p>
                                            <p className="text-sm text-gray-500">{notification.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked={notification.enabled} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                SMTP налаштування
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SMTP сервер
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue="smtp.gmail.com"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Порт
                                    </label>
                                    <input
                                        type="number"
                                        defaultValue="587"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email відправника
                                    </label>
                                    <input
                                        type="email"
                                        defaultValue="noreply@myshop.ua"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Пароль
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••••••••••"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-semibold text-gray-900 pb-4 border-b">
                                Безпека
                            </h2>

                            <div className="space-y-4">
                                {[
                                    { name: 'Двофакторна автентифікація', description: 'Додатковий захист акаунту', enabled: false },
                                    { name: 'SSL сертифікат', description: 'Шифрування даних', enabled: true },
                                    { name: 'Захист від DDoS', description: 'Cloudflare protection', enabled: true },
                                    { name: 'Логування дій', description: 'Запис всіх дій адміністраторів', enabled: true },
                                    { name: 'IP whitelist', description: 'Обмеження доступу по IP', enabled: false },
                                ].map((setting) => (
                                    <div key={setting.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{setting.name}</p>
                                            <p className="text-sm text-gray-500">{setting.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked={setting.enabled} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <h3 className="text-md font-semibold text-gray-900 pt-4 pb-2 border-b">
                                Зміна пароля
                            </h3>

                            <div className="max-w-md space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Поточний пароль
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Новий пароль
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Підтвердіть новий пароль
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <button className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                                    Змінити пароль
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
