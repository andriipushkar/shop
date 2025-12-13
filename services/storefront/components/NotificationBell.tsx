'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { notificationService, type Notification } from '@/lib/notifications/push-service';

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to unread count changes
        const unsubscribe = notificationService.subscribeToUnreadCount((count) => {
            setUnreadCount(count);
        });

        // Load recent notifications
        loadNotifications();

        // Sync with server on mount
        notificationService.syncWithServer();

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadNotifications = () => {
        const recent = notificationService.getRecentNotifications(5);
        setNotifications(recent);
    };

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            loadNotifications();
        }
    };

    const handleMarkAsRead = async (notificationId: string, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        await notificationService.markAsRead(notificationId);
        loadNotifications();
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await notificationService.markAsRead(notification.id);
            loadNotifications();
        }
        setIsOpen(false);
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'order_status':
                return (
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                );
            case 'price_drop':
                return (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                );
            case 'back_in_stock':
                return (
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'promotion':
                return (
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                );
            default:
                return null;
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'щойно';
        if (diffMins < 60) return `${diffMins} хв тому`;
        if (diffHours < 24) return `${diffHours} год тому`;
        if (diffDays < 7) return `${diffDays} дн тому`;

        return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
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
                return '/notifications';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={handleToggle}
                className="relative p-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full transition-colors"
                aria-label="Сповіщення"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Сповіщення</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={async () => {
                                    await notificationService.markAllAsRead();
                                    loadNotifications();
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Позначити всі прочитаними
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <p className="text-gray-500">Немає сповіщень</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map((notification) => (
                                    <Link
                                        key={notification.id}
                                        href={getNotificationLink(notification)}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                                            !notification.read ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start space-x-3">
                                            {/* Icon */}
                                            <div className="flex-shrink-0 mt-1">
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium text-gray-900 ${
                                                    !notification.read ? 'font-semibold' : ''
                                                }`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {formatTime(notification.createdAt)}
                                                </p>
                                            </div>

                                            {/* Mark as Read Button */}
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => handleMarkAsRead(notification.id, e)}
                                                    className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"
                                                    aria-label="Позначити як прочитане"
                                                />
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="border-t border-gray-200 px-4 py-3">
                            <Link
                                href="/notifications"
                                onClick={() => setIsOpen(false)}
                                className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Переглянути всі сповіщення
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
