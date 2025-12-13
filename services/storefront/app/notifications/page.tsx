'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notificationService, type Notification } from '@/lib/notifications/push-service';

const NOTIFICATION_TYPES = [
    { value: '', label: 'Всі сповіщення' },
    { value: 'order_status', label: 'Статус замовлення' },
    { value: 'price_drop', label: 'Зниження ціни' },
    { value: 'back_in_stock', label: 'Товар в наявності' },
    { value: 'promotion', label: 'Акції та знижки' },
] as const;

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [selectedType, setSelectedType] = useState<Notification['type'] | ''>('');
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
        // Sync with server
        notificationService.syncWithServer();
    }, []);

    useEffect(() => {
        filterNotifications();
    }, [notifications, selectedType, showUnreadOnly]);

    const loadNotifications = () => {
        const allNotifications = notificationService.getNotifications();
        setNotifications(allNotifications);
        setIsLoading(false);
    };

    const filterNotifications = () => {
        let filtered = [...notifications];

        if (selectedType) {
            filtered = filtered.filter((n) => n.type === selectedType);
        }

        if (showUnreadOnly) {
            filtered = filtered.filter((n) => !n.read);
        }

        setFilteredNotifications(filtered);
    };

    const handleMarkAsRead = async (notificationId: string) => {
        await notificationService.markAsRead(notificationId);
        loadNotifications();
    };

    const handleMarkAllAsRead = async () => {
        await notificationService.markAllAsRead();
        loadNotifications();
    };

    const handleDelete = async (notificationId: string) => {
        if (confirm('Ви впевнені, що хочете видалити це сповіщення?')) {
            await notificationService.deleteNotification(notificationId);
            loadNotifications();
        }
    };

    const handleDeleteAll = async () => {
        if (confirm('Ви впевнені, що хочете видалити всі сповіщення? Цю дію неможливо скасувати.')) {
            await notificationService.deleteAllNotifications();
            loadNotifications();
        }
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'order_status':
                return (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                );
            case 'price_drop':
                return (
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                    </div>
                );
            case 'back_in_stock':
                return (
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                );
            case 'promotion':
                return (
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                    </div>
                );
        }
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return `Сьогодні о ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (isYesterday) {
            return `Вчора о ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                hour: '2-digit',
                minute: '2-digit',
            });
        }
    };

    const getNotificationLink = (notification: Notification): string => {
        if (notification.data?.actionUrl) {
            return notification.data.actionUrl;
        }

        switch (notification.type) {
            case 'order_status':
                return notification.data?.orderId
                    ? `/profile/orders/${notification.data.orderId}`
                    : '/profile/orders';
            case 'price_drop':
            case 'back_in_stock':
                return notification.data?.productId
                    ? `/product/${notification.data.productId}`
                    : '/';
            case 'promotion':
                return '/sale';
            default:
                return '/';
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Сповіщення</h1>
                    <p className="text-gray-600">
                        {unreadCount > 0
                            ? `У вас ${unreadCount} непрочитаних сповіщень`
                            : 'Немає непрочитаних сповіщень'}
                    </p>
                </div>

                {/* Filters and Actions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                        {/* Filter Controls */}
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                            {/* Type Filter */}
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as Notification['type'] | '')}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {NOTIFICATION_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>

                            {/* Unread Filter */}
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showUnreadOnly}
                                    onChange={(e) => setShowUnreadOnly(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Тільки непрочитані</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    Позначити всі прочитаними
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={handleDeleteAll}
                                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Видалити всі
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notifications List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                        <div className="flex flex-col items-center justify-center text-center">
                            <svg className="w-20 h-20 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {showUnreadOnly || selectedType
                                    ? 'Сповіщення не знайдено'
                                    : 'Немає сповіщень'}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {showUnreadOnly || selectedType
                                    ? 'Спробуйте змінити фільтри'
                                    : 'Тут з\'являться ваші сповіщення'}
                            </p>
                            <Link
                                href="/profile/notifications"
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Налаштувати сповіщення
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-6 hover:bg-gray-50 transition-colors ${
                                    !notification.read ? 'bg-blue-50' : ''
                                }`}
                            >
                                <div className="flex items-start space-x-4">
                                    {/* Icon */}
                                    <div className="flex-shrink-0">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-2">
                                            <Link
                                                href={getNotificationLink(notification)}
                                                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                                                className="flex-1"
                                            >
                                                <h3 className={`text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors ${
                                                    !notification.read ? 'font-semibold' : ''
                                                }`}>
                                                    {notification.title}
                                                </h3>
                                            </Link>
                                            {!notification.read && (
                                                <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                                            )}
                                        </div>

                                        <p className="text-gray-700 mb-3">
                                            {notification.message}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-500">
                                                {formatDate(notification.createdAt)}
                                            </p>

                                            <div className="flex items-center space-x-2">
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => handleMarkAsRead(notification.id)}
                                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        Позначити прочитаним
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(notification.id)}
                                                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                                                >
                                                    Видалити
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Settings Link */}
                <div className="mt-8 text-center">
                    <Link
                        href="/profile/notifications"
                        className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Налаштування сповіщень</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
