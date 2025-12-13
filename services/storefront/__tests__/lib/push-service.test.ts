/**
 * @jest-environment jsdom
 */

import { notificationService } from '@/lib/notifications/push-service';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

describe('NotificationService', () => {
    beforeEach(async () => {
        // Clear localStorage before each test
        localStorageMock.clear();
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockClear();

        // Clear all notifications and reset service state
        await notificationService.deleteAllNotifications();
    });

    describe('Notification Management', () => {
        it('should add a notification', async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test Notification',
                message: 'This is a test',
            });

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(1);
            expect(notifications[0].title).toBe('Test Notification');
            expect(notifications[0].read).toBe(false);
        });

        it('should mark notification as read', async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test Notification',
                message: 'This is a test',
            });

            const notifications = notificationService.getNotifications();
            const notificationId = notifications[0].id;

            await notificationService.markAsRead(notificationId);

            const updatedNotifications = notificationService.getNotifications();
            expect(updatedNotifications[0].read).toBe(true);
        });

        it('should delete a notification', async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test Notification',
                message: 'This is a test',
            });

            const notifications = notificationService.getNotifications();
            const notificationId = notifications[0].id;

            await notificationService.deleteNotification(notificationId);

            const updatedNotifications = notificationService.getNotifications();
            expect(updatedNotifications).toHaveLength(0);
        });

        it('should mark all notifications as read', async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test 1',
                message: 'Test message 1',
            });

            await notificationService.addNotification({
                type: 'price_drop',
                title: 'Test 2',
                message: 'Test message 2',
            });

            await notificationService.markAllAsRead();

            const notifications = notificationService.getNotifications();
            expect(notifications.every((n) => n.read)).toBe(true);
        });

        it('should delete all notifications', async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test 1',
                message: 'Test message 1',
            });

            await notificationService.addNotification({
                type: 'price_drop',
                title: 'Test 2',
                message: 'Test message 2',
            });

            await notificationService.deleteAllNotifications();

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(0);
        });
    });

    describe('Notification Filtering', () => {
        beforeEach(async () => {
            await notificationService.addNotification({
                type: 'order_status',
                title: 'Order Update',
                message: 'Your order has been shipped',
            });

            await notificationService.addNotification({
                type: 'price_drop',
                title: 'Price Drop',
                message: 'Price has dropped by 20%',
            });

            await notificationService.addNotification({
                type: 'back_in_stock',
                title: 'Back in Stock',
                message: 'Item is back in stock',
            });
        });

        it('should filter notifications by type', () => {
            const orderNotifications = notificationService.getNotifications({
                type: 'order_status',
            });

            expect(orderNotifications).toHaveLength(1);
            expect(orderNotifications[0].type).toBe('order_status');
        });

        it('should filter unread notifications only', async () => {
            const notifications = notificationService.getNotifications();
            await notificationService.markAsRead(notifications[0].id);

            const unreadNotifications = notificationService.getNotifications({
                unreadOnly: true,
            });

            expect(unreadNotifications).toHaveLength(2);
            expect(unreadNotifications.every((n) => !n.read)).toBe(true);
        });

        it('should limit number of notifications', () => {
            const limitedNotifications = notificationService.getNotifications({
                limit: 2,
            });

            expect(limitedNotifications).toHaveLength(2);
        });
    });

    describe('Unread Count', () => {
        it('should track unread count correctly', async () => {
            expect(notificationService.getUnreadCount()).toBe(0);

            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test 1',
                message: 'Test message 1',
            });

            expect(notificationService.getUnreadCount()).toBe(1);

            await notificationService.addNotification({
                type: 'price_drop',
                title: 'Test 2',
                message: 'Test message 2',
            });

            expect(notificationService.getUnreadCount()).toBe(2);

            const notifications = notificationService.getNotifications();
            await notificationService.markAsRead(notifications[0].id);

            expect(notificationService.getUnreadCount()).toBe(1);
        });

        it('should notify listeners on unread count change', async () => {
            const listener = jest.fn();
            const unsubscribe = notificationService.subscribeToUnreadCount(listener);

            // Should be called immediately with initial count
            expect(listener).toHaveBeenCalledWith(0);

            await notificationService.addNotification({
                type: 'order_status',
                title: 'Test',
                message: 'Test message',
            });

            expect(listener).toHaveBeenCalledWith(1);

            unsubscribe();
        });
    });

    describe('Preferences Management', () => {
        it('should get default preferences', () => {
            const preferences = notificationService.getPreferences();

            expect(preferences.orderStatus.email).toBe(true);
            expect(preferences.orderStatus.push).toBe(true);
            expect(preferences.quietHours.enabled).toBe(false);
        });

        it('should update channel preferences', async () => {
            await notificationService.updateChannelPreferences('orderStatus', {
                email: false,
            });

            const preferences = notificationService.getPreferences();
            expect(preferences.orderStatus.email).toBe(false);
            expect(preferences.orderStatus.push).toBe(true);
        });

        it('should update quiet hours', async () => {
            await notificationService.updateQuietHours({
                enabled: true,
                start: '22:00',
                end: '08:00',
            });

            const preferences = notificationService.getPreferences();
            expect(preferences.quietHours.enabled).toBe(true);
            expect(preferences.quietHours.start).toBe('22:00');
            expect(preferences.quietHours.end).toBe('08:00');
        });

        it('should persist preferences to localStorage', async () => {
            await notificationService.updateChannelPreferences('priceDrop', {
                push: false,
            });

            const saved = localStorageMock.getItem('notification_service_preferences');
            expect(saved).toBeTruthy();

            const parsed = JSON.parse(saved!);
            expect(parsed.priceDrop.push).toBe(false);
        });
    });

    describe('Server Sync', () => {
        it('should sync preferences with server', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            await notificationService.updateChannelPreferences('promotion', {
                email: false,
            });

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/notifications/preferences',
                expect.objectContaining({
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });

        it('should sync notifications from server', async () => {
            const mockNotifications = [
                {
                    id: '1',
                    type: 'order_status',
                    title: 'Server Notification',
                    message: 'From server',
                    read: false,
                    createdAt: new Date().toISOString(),
                },
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ notifications: mockNotifications }),
            });

            await notificationService.syncWithServer();

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(1);
            expect(notifications[0].title).toBe('Server Notification');
        });

        it('should handle sync errors gracefully', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            // Should not throw
            await expect(notificationService.syncWithServer()).resolves.not.toThrow();
        });
    });

    describe('Quiet Hours', () => {
        beforeEach(async () => {
            await notificationService.updateQuietHours({
                enabled: true,
                start: '22:00',
                end: '08:00',
            });
        });

        it('should not send notifications during quiet hours', async () => {
            // Mock current time to be within quiet hours (23:00)
            jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
            jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

            await notificationService.addNotification({
                type: 'promotion',
                title: 'Promo',
                message: 'Should not be added during quiet hours',
            });

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(0);

            jest.restoreAllMocks();
        });

        it('should send notifications outside quiet hours', async () => {
            // Mock current time to be outside quiet hours (10:00)
            jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
            jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

            await notificationService.addNotification({
                type: 'promotion',
                title: 'Promo',
                message: 'Should be added outside quiet hours',
            });

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(1);

            jest.restoreAllMocks();
        });
    });

    describe('Notification Types', () => {
        it('should respect type-specific preferences', async () => {
            // Clear any existing notifications first
            await notificationService.deleteAllNotifications();

            // Disable all channels for promotion
            await notificationService.updateChannelPreferences('promotion', {
                email: false,
                push: false,
                sms: false,
            });

            await notificationService.addNotification({
                type: 'promotion',
                title: 'Promo',
                message: 'Should not be added',
            });

            const notifications = notificationService.getNotifications();
            expect(notifications).toHaveLength(0);
        });

        it('should allow notifications for enabled types', async () => {
            // Clear any existing notifications
            await notificationService.deleteAllNotifications();

            // Disable quiet hours (may be enabled from previous tests)
            await notificationService.updateQuietHours({
                enabled: false,
            });

            // Explicitly enable order_status notifications
            await notificationService.updateChannelPreferences('orderStatus', {
                email: true,
                push: true,
                sms: false,
            });

            // Verify preferences were updated
            const updatedPrefs = notificationService.getPreferences();
            expect(updatedPrefs.orderStatus.email).toBe(true);
            expect(updatedPrefs.orderStatus.push).toBe(true);

            await notificationService.addNotification({
                type: 'order_status',
                title: 'Order Update',
                message: 'Should be added',
            });

            const notifications = notificationService.getNotifications();
            // The notification should be added since we enabled the channel
            expect(notifications.find(n => n.title === 'Order Update')).toBeDefined();
        });
    });
});
