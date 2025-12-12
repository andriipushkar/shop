'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    EnvelopeIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    PaperAirplaneIcon,
    ClockIcon,
    ChartBarIcon,
    EyeIcon,
    DocumentDuplicateIcon,
    PlayIcon,
    PauseIcon,
    CheckCircleIcon,
    UsersIcon,
    CursorArrowRaysIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
type CampaignType = 'promotional' | 'newsletter' | 'transactional' | 'automated';

interface Campaign {
    id: string;
    name: string;
    subject: string;
    type: CampaignType;
    status: CampaignStatus;
    recipients: number;
    sent?: number;
    opened?: number;
    clicked?: number;
    scheduledAt?: string;
    sentAt?: string;
    createdAt: string;
}

const mockCampaigns: Campaign[] = [
    {
        id: '1',
        name: 'Різдвяний розпродаж',
        subject: '🎄 Знижки до -50% на все! Тільки до 25 грудня',
        type: 'promotional',
        status: 'sent',
        recipients: 15420,
        sent: 15420,
        opened: 4856,
        clicked: 1234,
        sentAt: '2024-01-10T10:00:00',
        createdAt: '2024-01-09T14:30:00',
    },
    {
        id: '2',
        name: 'Новинки тижня',
        subject: 'Нові надходження: iPhone 15, MacBook Pro та інше',
        type: 'newsletter',
        status: 'scheduled',
        recipients: 12350,
        scheduledAt: '2024-01-20T09:00:00',
        createdAt: '2024-01-15T11:20:00',
    },
    {
        id: '3',
        name: 'Покинутий кошик',
        subject: 'Ви забули щось у кошику! 🛒',
        type: 'automated',
        status: 'sending',
        recipients: 456,
        sent: 234,
        opened: 89,
        clicked: 45,
        createdAt: '2024-01-01T00:00:00',
    },
    {
        id: '4',
        name: 'Вітання з Днем народження',
        subject: '🎂 З Днем народження! Ваш подарунок всередині',
        type: 'automated',
        status: 'sending',
        recipients: 78,
        sent: 78,
        opened: 56,
        clicked: 34,
        createdAt: '2024-01-01T00:00:00',
    },
    {
        id: '5',
        name: 'Чорна п\'ятниця - тизер',
        subject: 'Готуйтесь до найбільшого розпродажу року!',
        type: 'promotional',
        status: 'draft',
        recipients: 0,
        createdAt: '2024-01-18T16:45:00',
    },
];

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
    draft: { label: 'Чернетка', color: 'bg-gray-100 text-gray-600', icon: PencilIcon },
    scheduled: { label: 'Заплановано', color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
    sending: { label: 'Відправляється', color: 'bg-yellow-100 text-yellow-700', icon: ArrowPathIcon },
    sent: { label: 'Відправлено', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
    paused: { label: 'Призупинено', color: 'bg-orange-100 text-orange-700', icon: PauseIcon },
};

const typeLabels: Record<CampaignType, string> = {
    promotional: 'Промо',
    newsletter: 'Розсилка',
    transactional: 'Транзакційна',
    automated: 'Автоматична',
};

export default function EmailCampaignsPage() {
    const [campaigns, setCampaigns] = useState(mockCampaigns);
    const [filterStatus, setFilterStatus] = useState<CampaignStatus | 'all'>('all');
    const [filterType, setFilterType] = useState<CampaignType | 'all'>('all');
    const [showModal, setShowModal] = useState(false);

    const filteredCampaigns = campaigns.filter(c => {
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchesType = filterType === 'all' || c.type === filterType;
        return matchesStatus && matchesType;
    });

    const stats = {
        totalSent: campaigns.reduce((sum, c) => sum + (c.sent || 0), 0),
        totalOpened: campaigns.reduce((sum, c) => sum + (c.opened || 0), 0),
        totalClicked: campaigns.reduce((sum, c) => sum + (c.clicked || 0), 0),
        avgOpenRate: campaigns.filter(c => c.sent).length > 0
            ? Math.round(campaigns.reduce((sum, c) => sum + ((c.opened || 0) / (c.sent || 1)) * 100, 0) / campaigns.filter(c => c.sent).length)
            : 0,
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const deleteCampaign = (id: string) => {
        if (confirm('Ви впевнені, що хочете видалити цю кампанію?')) {
            setCampaigns(prev => prev.filter(c => c.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-500">
                <Link href="/admin" className="hover:text-teal-600">Адмін</Link>
                <span className="mx-2">/</span>
                <Link href="/admin/marketing" className="hover:text-teal-600">Маркетинг</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Email-кампанії</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Email-кампанії</h1>
                    <p className="text-gray-600">Створення та управління розсилками</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Нова кампанія
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <PaperAirplaneIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalSent.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Відправлено</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <EyeIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalOpened.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Відкрито</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <CursorArrowRaysIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalClicked.toLocaleString()}</p>
                            <p className="text-sm text-gray-500">Кліків</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <ChartBarIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.avgOpenRate}%</p>
                            <p className="text-sm text-gray-500">Сер. відкриття</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-wrap gap-4">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі статуси</option>
                        <option value="draft">Чернетки</option>
                        <option value="scheduled">Заплановані</option>
                        <option value="sending">Відправляються</option>
                        <option value="sent">Відправлені</option>
                        <option value="paused">Призупинені</option>
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі типи</option>
                        <option value="promotional">Промо</option>
                        <option value="newsletter">Розсилки</option>
                        <option value="transactional">Транзакційні</option>
                        <option value="automated">Автоматичні</option>
                    </select>
                </div>
            </div>

            {/* Campaigns List */}
            <div className="space-y-4">
                {filteredCampaigns.map((campaign) => {
                    const StatusIcon = statusConfig[campaign.status].icon;
                    const openRate = campaign.sent ? Math.round((campaign.opened || 0) / campaign.sent * 100) : 0;
                    const clickRate = campaign.opened ? Math.round((campaign.clicked || 0) / campaign.opened * 100) : 0;

                    return (
                        <div key={campaign.id} className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[campaign.status].color}`}>
                                            {statusConfig[campaign.status].label}
                                        </span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                            {typeLabels[campaign.type]}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 truncate mb-2">{campaign.subject}</p>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <UsersIcon className="w-4 h-4" />
                                            {campaign.recipients.toLocaleString()} отримувачів
                                        </span>
                                        {campaign.scheduledAt && (
                                            <span className="flex items-center gap-1">
                                                <ClockIcon className="w-4 h-4" />
                                                {formatDate(campaign.scheduledAt)}
                                            </span>
                                        )}
                                        {campaign.sentAt && (
                                            <span className="flex items-center gap-1">
                                                <CheckCircleIcon className="w-4 h-4" />
                                                {formatDate(campaign.sentAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                {campaign.sent && campaign.sent > 0 && (
                                    <div className="flex gap-6">
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-gray-900">{openRate}%</p>
                                            <p className="text-xs text-gray-500">Відкриття</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-gray-900">{clickRate}%</p>
                                            <p className="text-xs text-gray-500">Кліків</p>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {campaign.status === 'draft' && (
                                        <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Відправити">
                                            <PaperAirplaneIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {campaign.status === 'sending' && (
                                        <button className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Призупинити">
                                            <PauseIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {campaign.status === 'paused' && (
                                        <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Продовжити">
                                            <PlayIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Дублювати">
                                        <DocumentDuplicateIcon className="w-5 h-5" />
                                    </button>
                                    {campaign.status === 'sent' && (
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Статистика">
                                            <ChartBarIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {campaign.status === 'draft' && (
                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Редагувати">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteCampaign(campaign.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Видалити"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredCampaigns.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <EnvelopeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Кампаній не знайдено</p>
                    </div>
                )}
            </div>

            {/* Automated Campaigns Info */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                <h3 className="font-semibold text-lg mb-2">🤖 Автоматичні кампанії</h3>
                <p className="text-purple-100 mb-4">
                    Налаштуйте автоматичні листи для покинутих кошиків, днів народження та інших тригерів
                </p>
                <Link
                    href="/admin/marketing/automations"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                >
                    Налаштувати автоматизації
                </Link>
            </div>

            {/* Create Campaign Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Нова email-кампанія</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва кампанії *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Наприклад: Літній розпродаж"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Тема листа *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Тема, яку побачать отримувачі"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Тип кампанії *
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="promotional">Промо-акція</option>
                                        <option value="newsletter">Новинна розсилка</option>
                                        <option value="transactional">Транзакційна</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Сегмент отримувачів *
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="all">Всі підписники (15 420)</option>
                                        <option value="active">Активні клієнти (8 350)</option>
                                        <option value="vip">VIP клієнти (1 234)</option>
                                        <option value="inactive">Неактивні (3 200)</option>
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Створити
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
