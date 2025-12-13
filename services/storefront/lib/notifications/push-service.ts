// Enhanced Push Notification Service with complete functionality

import { pushNotifications } from './push-notifications';

export interface Notification {
    id: string;
    type: 'order_status' | 'price_drop' | 'back_in_stock' | 'promotion';
    title: string;
    message: string;
    read: boolean;
    createdAt: Date;
    data?: {
        orderId?: string;
        productId?: string;
        promoCode?: string;
        actionUrl?: string;
    };
    icon?: string;
}

export interface NotificationChannel {
    email: boolean;
    push: boolean;
    sms: boolean;
}

export interface UserNotificationPreferences {
    orderStatus: NotificationChannel;
    priceDrop: NotificationChannel;
    backInStock: NotificationChannel;
    promotion: NotificationChannel;
    quietHours: {
        enabled: boolean;
        start: string; // HH:MM format
        end: string; // HH:MM format
    };
}

const DEFAULT_CHANNEL: NotificationChannel = {
    email: true,
    push: true,
    sms: false,
};

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
    orderStatus: { ...DEFAULT_CHANNEL },
    priceDrop: { ...DEFAULT_CHANNEL, email: false },
    backInStock: { ...DEFAULT_CHANNEL, email: false },
    promotion: { ...DEFAULT_CHANNEL, sms: false },
    quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
    },
};

class NotificationService {
    private preferences: UserNotificationPreferences = DEFAULT_PREFERENCES;
    private notifications: Notification[] = [];
    private unreadCount = 0;
    private listeners: Set<(count: number) => void> = new Set();

    constructor() {
        this.loadPreferences();
        this.loadNotifications();
    }

    // Subscribe to unread count changes
    subscribeToUnreadCount(callback: (count: number) => void): () => void {
        this.listeners.add(callback);
        callback(this.unreadCount); // Send initial value
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(): void {
        this.listeners.forEach((callback) => callback(this.unreadCount));
    }

    // Get all notifications
    getNotifications(filters?: {
        type?: Notification['type'];
        unreadOnly?: boolean;
        limit?: number;
    }): Notification[] {
        let filtered = [...this.notifications];

        if (filters?.type) {
            filtered = filtered.filter((n) => n.type === filters.type);
        }

        if (filters?.unreadOnly) {
            filtered = filtered.filter((n) => !n.read);
        }

        if (filters?.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Get recent notifications
    getRecentNotifications(limit = 5): Notification[] {
        return this.getNotifications({ limit });
    }

    // Get unread count
    getUnreadCount(): number {
        return this.unreadCount;
    }

    // Mark notification as read
    async markAsRead(notificationId: string): Promise<void> {
        const notification = this.notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveNotifications();
            this.notifyListeners();

            // Sync with server
            await this.syncNotificationStatus(notificationId, true);
        }
    }

    // Mark all notifications as read
    async markAllAsRead(): Promise<void> {
        this.notifications.forEach((n) => {
            n.read = true;
        });
        this.unreadCount = 0;
        this.saveNotifications();
        this.notifyListeners();

        // Sync with server
        await this.syncAllNotificationsRead();
    }

    // Delete notification
    async deleteNotification(notificationId: string): Promise<void> {
        const index = this.notifications.findIndex((n) => n.id === notificationId);
        if (index !== -1) {
            const notification = this.notifications[index];
            if (!notification.read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.notifyListeners();
            }
            this.notifications.splice(index, 1);
            this.saveNotifications();

            // Sync with server
            await this.deleteNotificationOnServer(notificationId);
        }
    }

    // Delete all notifications
    async deleteAllNotifications(): Promise<void> {
        this.notifications = [];
        this.unreadCount = 0;
        this.saveNotifications();
        this.notifyListeners();

        // Sync with server
        await this.deleteAllNotificationsOnServer();
    }

    // Add new notification
    async addNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<void> {
        const newNotification: Notification = {
            ...notification,
            id: this.generateId(),
            read: false,
            createdAt: new Date(),
        };

        // Check if notification type is enabled
        if (!this.shouldSendNotification(notification.type)) {
            return;
        }

        // Check quiet hours
        if (this.isQuietHours()) {
            return;
        }

        this.notifications.unshift(newNotification);
        this.unreadCount++;
        this.saveNotifications();
        this.notifyListeners();

        // Send push notification if enabled
        const prefs = this.getPreferencesByType(notification.type);
        if (prefs.push) {
            await this.sendPushNotification(newNotification);
        }
    }

    // Get notification preferences
    getPreferences(): UserNotificationPreferences {
        return { ...this.preferences };
    }

    // Update notification preferences
    async updatePreferences(preferences: Partial<UserNotificationPreferences>): Promise<void> {
        this.preferences = {
            ...this.preferences,
            ...preferences,
        };
        this.savePreferences();

        // Sync with server
        await this.syncPreferencesWithServer();
    }

    // Update channel preferences for a specific type
    async updateChannelPreferences(
        type: keyof Omit<UserNotificationPreferences, 'quietHours'>,
        channels: Partial<NotificationChannel>
    ): Promise<void> {
        this.preferences[type] = {
            ...this.preferences[type],
            ...channels,
        };
        this.savePreferences();

        // Sync with server
        await this.syncPreferencesWithServer();
    }

    // Update quiet hours
    async updateQuietHours(quietHours: Partial<UserNotificationPreferences['quietHours']>): Promise<void> {
        this.preferences.quietHours = {
            ...this.preferences.quietHours,
            ...quietHours,
        };
        this.savePreferences();

        // Sync with server
        await this.syncPreferencesWithServer();
    }

    // Subscribe to push notifications
    async subscribeToPush(): Promise<boolean> {
        const subscription = await pushNotifications.subscribe();
        if (subscription) {
            // Enable push for all notification types
            Object.keys(this.preferences).forEach((key) => {
                if (key !== 'quietHours') {
                    this.preferences[key as keyof Omit<UserNotificationPreferences, 'quietHours'>].push = true;
                }
            });
            this.savePreferences();
            await this.syncPreferencesWithServer();
            return true;
        }
        return false;
    }

    // Unsubscribe from push notifications
    async unsubscribeFromPush(): Promise<boolean> {
        const success = await pushNotifications.unsubscribe();
        if (success) {
            // Disable push for all notification types
            Object.keys(this.preferences).forEach((key) => {
                if (key !== 'quietHours') {
                    this.preferences[key as keyof Omit<UserNotificationPreferences, 'quietHours'>].push = false;
                }
            });
            this.savePreferences();
            await this.syncPreferencesWithServer();
        }
        return success;
    }

    // Check if push notifications are enabled
    async isPushEnabled(): Promise<boolean> {
        return await pushNotifications.isSubscribed();
    }

    // Request push notification permission
    async requestPushPermission(): Promise<NotificationPermission> {
        return await pushNotifications.requestPermission();
    }

    // Private helper methods
    private shouldSendNotification(type: Notification['type']): boolean {
        const prefs = this.getPreferencesByType(type);
        return prefs.email || prefs.push || prefs.sms;
    }

    private getPreferencesByType(type: Notification['type']): NotificationChannel {
        switch (type) {
            case 'order_status':
                return this.preferences.orderStatus;
            case 'price_drop':
                return this.preferences.priceDrop;
            case 'back_in_stock':
                return this.preferences.backInStock;
            case 'promotion':
                return this.preferences.promotion;
            default:
                return DEFAULT_CHANNEL;
        }
    }

    private isQuietHours(): boolean {
        if (!this.preferences.quietHours.enabled) {
            return false;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const { start, end } = this.preferences.quietHours;

        // Handle cases where quiet hours span midnight
        if (start > end) {
            return currentTime >= start || currentTime <= end;
        }

        return currentTime >= start && currentTime <= end;
    }

    private async sendPushNotification(notification: Notification): Promise<void> {
        try {
            let payload;
            switch (notification.type) {
                case 'order_status':
                    if (notification.data?.orderId) {
                        payload = pushNotifications.createOrderNotification(
                            notification.data.orderId,
                            'updated'
                        );
                        payload.body = notification.message;
                    }
                    break;
                case 'price_drop':
                    if (notification.data?.productId) {
                        // For simplicity, using generic notification
                        payload = {
                            title: notification.title,
                            body: notification.message,
                            icon: notification.icon || '/icons/price-drop-icon.png',
                            tag: `price-${notification.data.productId}`,
                            data: notification.data,
                        };
                    }
                    break;
                case 'back_in_stock':
                    if (notification.data?.productId) {
                        payload = {
                            title: notification.title,
                            body: notification.message,
                            icon: notification.icon || '/icons/stock-icon.png',
                            tag: `stock-${notification.data.productId}`,
                            data: notification.data,
                        };
                    }
                    break;
                case 'promotion':
                    payload = {
                        title: notification.title,
                        body: notification.message,
                        icon: notification.icon || '/icons/promo-icon.png',
                        tag: 'promo',
                        data: notification.data,
                    };
                    break;
            }

            if (payload) {
                await pushNotifications.showNotification(payload);
            }
        } catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private loadPreferences(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const saved = localStorage.getItem('notification_service_preferences');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.preferences = { ...DEFAULT_PREFERENCES, ...parsed };
            }
        } catch {
            // Ignore
        }
    }

    private savePreferences(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem('notification_service_preferences', JSON.stringify(this.preferences));
        } catch {
            // Ignore
        }
    }

    private loadNotifications(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const saved = localStorage.getItem('notifications');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.notifications = parsed.map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt),
                }));
                this.unreadCount = this.notifications.filter((n) => !n.read).length;
            }
        } catch {
            // Ignore
        }
    }

    private saveNotifications(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            // Keep only last 100 notifications
            const toSave = this.notifications.slice(0, 100);
            localStorage.setItem('notifications', JSON.stringify(toSave));
        } catch {
            // Ignore
        }
    }

    // Server sync methods
    private async syncNotificationStatus(notificationId: string, read: boolean): Promise<void> {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId, read }),
            });
        } catch (error) {
            console.error('Failed to sync notification status:', error);
        }
    }

    private async syncAllNotificationsRead(): Promise<void> {
        try {
            await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Failed to mark all as read on server:', error);
        }
    }

    private async deleteNotificationOnServer(notificationId: string): Promise<void> {
        try {
            await fetch(`/api/notifications?id=${notificationId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to delete notification on server:', error);
        }
    }

    private async deleteAllNotificationsOnServer(): Promise<void> {
        try {
            await fetch('/api/notifications/delete-all', {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to delete all notifications on server:', error);
        }
    }

    private async syncPreferencesWithServer(): Promise<void> {
        try {
            await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.preferences),
            });
        } catch (error) {
            console.error('Failed to sync preferences:', error);
        }
    }

    // Fetch notifications from server
    async syncWithServer(): Promise<void> {
        try {
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const data = await response.json();
                if (data.notifications) {
                    this.notifications = data.notifications.map((n: any) => ({
                        ...n,
                        createdAt: new Date(n.createdAt),
                    }));
                    this.unreadCount = this.notifications.filter((n) => !n.read).length;
                    this.saveNotifications();
                    this.notifyListeners();
                }
            }
        } catch (error) {
            console.error('Failed to sync with server:', error);
        }
    }
}

// Singleton instance
export const notificationService = new NotificationService();

// React hook for notification service
export function useNotificationService() {
    return notificationService;
}
