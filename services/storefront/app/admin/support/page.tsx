'use client';

import { useState } from 'react';
import {
    MagnifyingGlassIcon,
    ChatBubbleLeftRightIcon,
    EnvelopeIcon,
    PhoneIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    UserIcon,
    PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high';

interface Ticket {
    id: number;
    subject: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    category: string;
    message: string;
    date: string;
    status: TicketStatus;
    priority: TicketPriority;
    assignee: string | null;
    messages: { from: 'customer' | 'support'; text: string; date: string }[];
}

const ticketsData: Ticket[] = [
    {
        id: 1001,
        subject: 'Проблема з доставкою',
        customerName: 'Олександр Ковальчук',
        customerEmail: 'o.kovalchuk@gmail.com',
        customerPhone: '+380 67 123 4567',
        category: 'Доставка',
        message: 'Замовлення #12345 досі не доставлено, хоча минуло вже 5 днів. Прошу розібратися з ситуацією.',
        date: '10.12.2024 15:30',
        status: 'new',
        priority: 'high',
        assignee: null,
        messages: [
            { from: 'customer', text: 'Замовлення #12345 досі не доставлено, хоча минуло вже 5 днів.', date: '10.12.2024 15:30' },
        ],
    },
    {
        id: 1002,
        subject: 'Питання щодо гарантії',
        customerName: 'Марія Шевченко',
        customerEmail: 'm.shevchenko@gmail.com',
        customerPhone: '+380 50 234 5678',
        category: 'Гарантія',
        message: 'Чи поширюється гарантія на механічні пошкодження екрану?',
        date: '10.12.2024 14:15',
        status: 'in_progress',
        priority: 'medium',
        assignee: 'Адмін',
        messages: [
            { from: 'customer', text: 'Чи поширюється гарантія на механічні пошкодження екрану?', date: '10.12.2024 14:15' },
            { from: 'support', text: 'Доброго дня! Гарантія не поширюється на механічні пошкодження. Але ми можемо запропонувати платний ремонт.', date: '10.12.2024 14:45' },
            { from: 'customer', text: 'Скільки це буде коштувати?', date: '10.12.2024 15:00' },
        ],
    },
    {
        id: 1003,
        subject: 'Повернення товару',
        customerName: 'Андрій Петренко',
        customerEmail: 'a.petrenko@ukr.net',
        customerPhone: '+380 63 345 6789',
        category: 'Повернення',
        message: 'Хочу повернути товар, він не підійшов за розміром.',
        date: '09.12.2024 11:20',
        status: 'resolved',
        priority: 'low',
        assignee: 'Менеджер',
        messages: [
            { from: 'customer', text: 'Хочу повернути товар, він не підійшов за розміром.', date: '09.12.2024 11:20' },
            { from: 'support', text: 'Доброго дня! Для повернення заповніть заявку та відправте товар назад.', date: '09.12.2024 12:00' },
            { from: 'customer', text: 'Дякую, відправив!', date: '09.12.2024 16:30' },
            { from: 'support', text: 'Отримали, кошти повернено на вашу картку.', date: '10.12.2024 10:00' },
        ],
    },
    {
        id: 1004,
        subject: 'Не працює промокод',
        customerName: 'Наталія Бондаренко',
        customerEmail: 'n.bondarenko@gmail.com',
        customerPhone: '+380 97 456 7890',
        category: 'Оплата',
        message: 'Промокод WINTER2024 не застосовується при оформленні замовлення.',
        date: '09.12.2024 10:00',
        status: 'closed',
        priority: 'low',
        assignee: 'Адмін',
        messages: [
            { from: 'customer', text: 'Промокод WINTER2024 не застосовується.', date: '09.12.2024 10:00' },
            { from: 'support', text: 'Промокод діє при замовленні від 1000 грн. Ваша сума 800 грн.', date: '09.12.2024 10:30' },
            { from: 'customer', text: 'Зрозуміло, дякую!', date: '09.12.2024 11:00' },
        ],
    },
    {
        id: 1005,
        subject: 'Бракований товар',
        customerName: 'Віктор Мельник',
        customerEmail: 'v.melnyk@i.ua',
        customerPhone: '+380 66 567 8901',
        category: 'Якість',
        message: 'Отримав навушники з дефектом - не працює правий навушник.',
        date: '08.12.2024 16:45',
        status: 'new',
        priority: 'high',
        assignee: null,
        messages: [
            { from: 'customer', text: 'Отримав навушники з дефектом - не працює правий навушник.', date: '08.12.2024 16:45' },
        ],
    },
];

export default function AdminSupportPage() {
    const [tickets, setTickets] = useState(ticketsData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'all' | TicketStatus>('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState('');

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            ticket.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            ticket.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === 'all' || ticket.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: TicketStatus) => {
        const config = {
            new: { className: 'bg-blue-100 text-blue-800', label: 'Нове', icon: ExclamationCircleIcon },
            in_progress: { className: 'bg-yellow-100 text-yellow-800', label: 'В роботі', icon: ClockIcon },
            resolved: { className: 'bg-green-100 text-green-800', label: 'Вирішено', icon: CheckCircleIcon },
            closed: { className: 'bg-gray-100 text-gray-800', label: 'Закрито', icon: CheckCircleIcon },
        };
        const { className, label, icon: Icon } = config[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
            </span>
        );
    };

    const getPriorityBadge = (priority: TicketPriority) => {
        const config = {
            high: 'bg-red-100 text-red-800',
            medium: 'bg-yellow-100 text-yellow-800',
            low: 'bg-gray-100 text-gray-800',
        };
        const labels = { high: 'Високий', medium: 'Середній', low: 'Низький' };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config[priority]}`}>
                {labels[priority]}
            </span>
        );
    };

    const handleSendReply = () => {
        if (selectedTicket && replyText.trim()) {
            const newMessage = { from: 'support' as const, text: replyText, date: new Date().toLocaleString('uk-UA') };
            setTickets(tickets.map(t =>
                t.id === selectedTicket.id
                    ? { ...t, messages: [...t.messages, newMessage], status: 'in_progress' as TicketStatus }
                    : t
            ));
            setSelectedTicket({
                ...selectedTicket,
                messages: [...selectedTicket.messages, newMessage],
                status: 'in_progress',
            });
            setReplyText('');
        }
    };

    const updateTicketStatus = (id: number, status: TicketStatus) => {
        setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
        if (selectedTicket?.id === id) {
            setSelectedTicket({ ...selectedTicket, status });
        }
    };

    // Stats
    const stats = {
        total: tickets.length,
        new: tickets.filter(t => t.status === 'new').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        highPriority: tickets.filter(t => t.priority === 'high' && t.status !== 'closed').length,
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Підтримка</h1>
                <p className="text-gray-600">Звернення клієнтів та тікети</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <ChatBubbleLeftRightIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього звернень</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ExclamationCircleIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
                            <p className="text-sm text-gray-500">Нових</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <ClockIcon className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                            <p className="text-sm text-gray-500">В роботі</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.highPriority}</p>
                            <p className="text-sm text-gray-500">Термінових</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Tickets list */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Filters */}
                    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Пошук..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                            />
                        </div>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                        >
                            <option value="all">Всі статуси</option>
                            <option value="new">Нові</option>
                            <option value="in_progress">В роботі</option>
                            <option value="resolved">Вирішені</option>
                            <option value="closed">Закриті</option>
                        </select>
                    </div>

                    {/* Tickets */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {filteredTickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                                        selectedTicket?.id === ticket.id ? 'bg-teal-50' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <p className="font-medium text-gray-900 text-sm">#{ticket.id}</p>
                                        {getPriorityBadge(ticket.priority)}
                                    </div>
                                    <p className="font-medium text-gray-900 text-sm mb-1 truncate">{ticket.subject}</p>
                                    <p className="text-xs text-gray-500 mb-2">{ticket.customerName}</p>
                                    <div className="flex items-center justify-between">
                                        {getStatusBadge(ticket.status)}
                                        <span className="text-xs text-gray-400">{ticket.date}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ticket detail */}
                <div className="lg:col-span-2">
                    {selectedTicket ? (
                        <div className="bg-white rounded-xl shadow-sm h-full flex flex-col">
                            {/* Header */}
                            <div className="p-4 border-b">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h2 className="font-semibold text-gray-900">{selectedTicket.subject}</h2>
                                        <p className="text-sm text-gray-500">Тікет #{selectedTicket.id}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedTicket.status)}
                                        {getPriorityBadge(selectedTicket.priority)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <UserIcon className="w-4 h-4" />
                                        {selectedTicket.customerName}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <EnvelopeIcon className="w-4 h-4" />
                                        {selectedTicket.customerEmail}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <PhoneIcon className="w-4 h-4" />
                                        {selectedTicket.customerPhone}
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[400px]">
                                {selectedTicket.messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`flex ${msg.from === 'support' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] rounded-lg p-3 ${
                                            msg.from === 'support'
                                                ? 'bg-teal-600 text-white'
                                                : 'bg-gray-100 text-gray-900'
                                        }`}>
                                            <p className="text-sm">{msg.text}</p>
                                            <p className={`text-xs mt-1 ${
                                                msg.from === 'support' ? 'text-teal-200' : 'text-gray-500'
                                            }`}>
                                                {msg.date}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Reply */}
                            {selectedTicket.status !== 'closed' && (
                                <div className="p-4 border-t">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Введіть відповідь..."
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                        />
                                        <button
                                            onClick={handleSendReply}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                        >
                                            <PaperAirplaneIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        {selectedTicket.status !== 'resolved' && (
                                            <button
                                                onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                                                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                                            >
                                                Позначити вирішеним
                                            </button>
                                        )}
                                        <button
                                            onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            Закрити тікет
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm h-full flex items-center justify-center">
                            <div className="text-center">
                                <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Виберіть звернення зі списку</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
