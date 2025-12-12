'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    StarIcon,
    GiftIcon,
    ArrowUpIcon,
    ClockIcon,
    ShoppingBagIcon,
    SparklesIcon,
    TruckIcon,
    CakeIcon,
    CheckBadgeIcon,
    ChevronRightIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface Transaction {
    id: string;
    type: 'earn' | 'redeem' | 'expire' | 'bonus';
    points: number;
    description: string;
    date: string;
}

const tierConfig: Record<LoyaltyTier, { name: string; minPoints: number; color: string; bgColor: string; icon: string }> = {
    bronze: { name: 'Бронзовий', minPoints: 0, color: 'text-orange-700', bgColor: 'bg-orange-100', icon: '🥉' },
    silver: { name: 'Срібний', minPoints: 1000, color: 'text-gray-600', bgColor: 'bg-gray-200', icon: '🥈' },
    gold: { name: 'Золотий', minPoints: 5000, color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: '🥇' },
    platinum: { name: 'Платиновий', minPoints: 15000, color: 'text-purple-600', bgColor: 'bg-purple-100', icon: '💎' },
};

const mockAccount = {
    currentPoints: 2450,
    lifetimePoints: 8750,
    tier: 'silver' as LoyaltyTier,
    pointsToNextTier: 2250,
    nextTier: 'gold' as LoyaltyTier,
    expiringPoints: 350,
    expiringDate: '2024-03-15',
};

const mockTransactions: Transaction[] = [
    { id: '1', type: 'earn', points: 350, description: 'Замовлення #12350', date: '2024-01-15' },
    { id: '2', type: 'earn', points: 500, description: 'Замовлення #12345', date: '2024-01-10' },
    { id: '3', type: 'redeem', points: -200, description: 'Знижка на замовлення #12340', date: '2024-01-05' },
    { id: '4', type: 'bonus', points: 500, description: 'Бонус до дня народження', date: '2024-01-01' },
    { id: '5', type: 'earn', points: 1300, description: 'Замовлення #12330', date: '2023-12-20' },
    { id: '6', type: 'expire', points: -150, description: 'Термін дії балів закінчився', date: '2023-12-15' },
];

const benefits = [
    { tier: 'bronze', items: ['1 бал за кожну 1 грн', 'Бонус до дня народження: 100 балів'] },
    { tier: 'silver', items: ['1.25 бали за кожну 1 грн', 'Знижка 3% на всі товари', 'Бонус до дня народження: 250 балів'] },
    { tier: 'gold', items: ['1.5 бали за кожну 1 грн', 'Знижка 5% на всі товари', 'Безкоштовна доставка від 1000 грн', 'Бонус до дня народження: 500 балів', 'Ранній доступ до акцій'] },
    { tier: 'platinum', items: ['2 бали за кожну 1 грн', 'Знижка 10% на всі товари', 'Безкоштовна доставка завжди', 'Бонус до дня народження: 1000 балів', 'Ранній доступ до акцій', 'Персональний менеджер'] },
];

export default function LoyaltyPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'benefits'>('overview');

    const progress = ((mockAccount.lifetimePoints - tierConfig[mockAccount.tier].minPoints) /
        (tierConfig[mockAccount.nextTier].minPoints - tierConfig[mockAccount.tier].minPoints)) * 100;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Breadcrumb */}
                <nav className="text-sm text-gray-500 mb-6">
                    <Link href="/" className="hover:text-teal-600">Головна</Link>
                    <span className="mx-2">/</span>
                    <Link href="/profile" className="hover:text-teal-600">Профіль</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-900">Програма лояльності</span>
                </nav>

                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 mb-6 text-white">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 ${tierConfig[mockAccount.tier].bgColor} rounded-full flex items-center justify-center text-3xl`}>
                            {tierConfig[mockAccount.tier].icon}
                        </div>
                        <div>
                            <p className="text-teal-100 text-sm">Ваш рівень</p>
                            <h1 className="text-2xl font-bold">{tierConfig[mockAccount.tier].name}</h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white/10 rounded-xl p-4">
                            <p className="text-teal-100 text-sm">Доступно балів</p>
                            <p className="text-3xl font-bold">{mockAccount.currentPoints.toLocaleString()}</p>
                            <p className="text-teal-100 text-sm">≈ {Math.floor(mockAccount.currentPoints * 0.5)} ₴</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4">
                            <p className="text-teal-100 text-sm">Накопичено всього</p>
                            <p className="text-3xl font-bold">{mockAccount.lifetimePoints.toLocaleString()}</p>
                            <p className="text-teal-100 text-sm">балів</p>
                        </div>
                    </div>

                    {/* Progress to next tier */}
                    <div className="bg-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">До рівня {tierConfig[mockAccount.nextTier].name}</span>
                            <span className="text-sm font-medium">{mockAccount.pointsToNextTier.toLocaleString()} балів</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-teal-100">
                            <span>{tierConfig[mockAccount.tier].name}</span>
                            <span>{tierConfig[mockAccount.nextTier].name}</span>
                        </div>
                    </div>
                </div>

                {/* Expiring points warning */}
                {mockAccount.expiringPoints > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <ClockIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-orange-800">
                                {mockAccount.expiringPoints} балів спливають {formatDate(mockAccount.expiringDate)}
                            </p>
                            <p className="text-sm text-orange-600">
                                Використайте їх до закінчення терміну дії
                            </p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm mb-6">
                    <div className="flex border-b">
                        {[
                            { id: 'overview', name: 'Огляд', icon: StarIcon },
                            { id: 'history', name: 'Історія', icon: ClockIcon },
                            { id: 'benefits', name: 'Переваги', icon: GiftIcon },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'text-teal-600 border-b-2 border-teal-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.name}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                {/* How to earn */}
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-4">Як заробляти бали</h3>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <ShoppingBagIcon className="w-5 h-5 text-teal-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">Покупки</p>
                                                <p className="text-sm text-gray-500">1.25 бали за кожну 1 грн</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <CakeIcon className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">День народження</p>
                                                <p className="text-sm text-gray-500">250 бонусних балів</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <StarSolidIcon className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">Відгуки</p>
                                                <p className="text-sm text-gray-500">50 балів за відгук</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <SparklesIcon className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">Акції</p>
                                                <p className="text-sm text-gray-500">Подвійні бали в акційні дні</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* How to spend */}
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-4">Як використовувати бали</h3>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <p className="font-medium text-gray-900">Оплата балами</p>
                                                <p className="text-sm text-gray-500">1 бал = 0.50 ₴</p>
                                            </div>
                                            <Link
                                                href="/"
                                                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                                            >
                                                До покупок
                                            </Link>
                                        </div>
                                        <div className="border-t pt-4">
                                            <p className="text-sm text-gray-600">
                                                Ви можете оплатити до 50% вартості замовлення балами.
                                                Мінімальна кількість для списання: 100 балів.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Current tier benefits */}
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-4">Ваші переваги рівня {tierConfig[mockAccount.tier].name}</h3>
                                    <div className="space-y-2">
                                        {benefits.find(b => b.tier === mockAccount.tier)?.items.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2 text-gray-700">
                                                <CheckBadgeIcon className="w-5 h-5 text-teal-600" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4">Історія балів</h3>
                                <div className="space-y-3">
                                    {mockTransactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    transaction.type === 'earn' ? 'bg-green-100' :
                                                    transaction.type === 'bonus' ? 'bg-purple-100' :
                                                    transaction.type === 'redeem' ? 'bg-blue-100' :
                                                    'bg-gray-200'
                                                }`}>
                                                    {transaction.type === 'earn' && <ArrowUpIcon className="w-5 h-5 text-green-600" />}
                                                    {transaction.type === 'bonus' && <GiftIcon className="w-5 h-5 text-purple-600" />}
                                                    {transaction.type === 'redeem' && <ShoppingBagIcon className="w-5 h-5 text-blue-600" />}
                                                    {transaction.type === 'expire' && <ClockIcon className="w-5 h-5 text-gray-500" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{transaction.description}</p>
                                                    <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                                                </div>
                                            </div>
                                            <span className={`font-semibold ${
                                                transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {transaction.points > 0 ? '+' : ''}{transaction.points}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'benefits' && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4">Переваги рівнів</h3>
                                <div className="space-y-4">
                                    {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier) => (
                                        <div
                                            key={tier}
                                            className={`rounded-xl p-4 ${
                                                tier === mockAccount.tier
                                                    ? 'bg-teal-50 border-2 border-teal-500'
                                                    : 'bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-2xl">{tierConfig[tier].icon}</span>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900">
                                                        {tierConfig[tier].name}
                                                        {tier === mockAccount.tier && (
                                                            <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                                                                Ваш рівень
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-sm text-gray-500">
                                                        Від {tierConfig[tier].minPoints.toLocaleString()} балів
                                                    </p>
                                                </div>
                                            </div>
                                            <ul className="space-y-1">
                                                {benefits.find(b => b.tier === tier)?.items.map((item, index) => (
                                                    <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                                                        <CheckBadgeIcon className={`w-4 h-4 ${
                                                            tier === mockAccount.tier ? 'text-teal-600' : 'text-gray-400'
                                                        }`} />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Термін дії балів</p>
                        <p>Бали діють 12 місяців з моменту нарахування. Слідкуйте за строками та використовуйте їх вчасно!</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
