// Push Notifications Service

export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    tag?: string;
    data?: Record<string, unknown>;
    actions?: NotificationAction[];
    requireInteraction?: boolean;
    silent?: boolean;
}

export interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
}

export type NotificationType =
    | 'order_status'
    | 'price_drop'
    | 'back_in_stock'
    | 'promo'
    | 'delivery'
    | 'review_request'
    | 'wishlist_sale'
    | 'abandoned_cart';

export interface NotificationPreferences {
    orderUpdates: boolean;
    priceAlerts: boolean;
    promotions: boolean;
    stockAlerts: boolean;
    deliveryUpdates: boolean;
    reviewReminders: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    orderUpdates: true,
    priceAlerts: true,
    promotions: true,
    stockAlerts: true,
    deliveryUpdates: true,
    reviewReminders: false,
};

class PushNotificationService {
    private swRegistration: ServiceWorkerRegistration | null = null;
    private subscription: PushSubscriptionJSON | null = null;
    private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
    private vapidPublicKey: string;

    constructor() {
        this.vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        this.loadPreferences();
    }

    // Check if push notifications are supported
    isSupported(): boolean {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    // Get current permission status
    getPermissionStatus(): NotificationPermission {
        if (!this.isSupported()) return 'denied';
        return Notification.permission;
    }

    // Request notification permission
    async requestPermission(): Promise<NotificationPermission> {
        if (!this.isSupported()) {
            console.warn('Push notifications not supported');
            return 'denied';
        }

        const permission = await Notification.requestPermission();
        return permission;
    }

    // Initialize push notifications
    async initialize(): Promise<boolean> {
        if (!this.isSupported()) return false;

        try {
            // Register service worker
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // Check for existing subscription
            const existingSubscription = await this.swRegistration.pushManager.getSubscription();
            if (existingSubscription) {
                this.subscription = existingSubscription.toJSON();
                return true;
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize push notifications:', error);
            return false;
        }
    }

    // Subscribe to push notifications
    async subscribe(): Promise<PushSubscriptionJSON | null> {
        if (!this.swRegistration) {
            await this.initialize();
        }

        if (!this.swRegistration) return null;

        try {
            const permission = await this.requestPermission();
            if (permission !== 'granted') return null;

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
            });

            this.subscription = subscription.toJSON();

            // Send subscription to server
            await this.sendSubscriptionToServer(this.subscription);

            return this.subscription;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            return null;
        }
    }

    // Unsubscribe from push notifications
    async unsubscribe(): Promise<boolean> {
        if (!this.swRegistration) return false;

        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                await this.removeSubscriptionFromServer();
                this.subscription = null;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    }

    // Check if user is subscribed
    async isSubscribed(): Promise<boolean> {
        if (!this.swRegistration) {
            await this.initialize();
        }

        if (!this.swRegistration) return false;

        const subscription = await this.swRegistration.pushManager.getSubscription();
        return subscription !== null;
    }

    // Show local notification
    async showNotification(payload: NotificationPayload): Promise<void> {
        if (!this.swRegistration) return;

        const { title, ...options } = payload;

        await this.swRegistration.showNotification(title, {
            icon: options.icon || '/icons/icon-192x192.png',
            badge: options.badge || '/icons/badge-72x72.png',
            ...options,
        });
    }

    // Send test notification
    async sendTestNotification(): Promise<void> {
        await this.showNotification({
            title: 'Тестове сповіщення',
            body: 'Push-сповіщення працюють коректно!',
            icon: '/icons/icon-192x192.png',
        });
    }

    // Get notification preferences
    getPreferences(): NotificationPreferences {
        return { ...this.preferences };
    }

    // Update notification preferences
    async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
        this.preferences = { ...this.preferences, ...preferences };
        this.savePreferences();

        // Sync with server
        await this.syncPreferencesWithServer();
    }

    // Create notification for specific events
    createOrderNotification(orderId: string, status: string): NotificationPayload {
        const statusMessages: Record<string, string> = {
            confirmed: 'Ваше замовлення підтверджено',
            processing: 'Ваше замовлення обробляється',
            shipped: 'Ваше замовлення відправлено',
            delivered: 'Ваше замовлення доставлено',
            cancelled: 'Ваше замовлення скасовано',
        };

        return {
            title: `Замовлення #${orderId}`,
            body: statusMessages[status] || `Статус: ${status}`,
            icon: '/icons/order-icon.png',
            tag: `order-${orderId}`,
            data: { type: 'order_status', orderId },
            actions: [
                { action: 'view', title: 'Переглянути' },
            ],
        };
    }

    createPriceDropNotification(productName: string, oldPrice: number, newPrice: number, productId: string): NotificationPayload {
        const discount = Math.round((1 - newPrice / oldPrice) * 100);
        return {
            title: 'Ціна знизилась!',
            body: `${productName} тепер ${newPrice} ₴ (-${discount}%)`,
            icon: '/icons/price-drop-icon.png',
            tag: `price-${productId}`,
            data: { type: 'price_drop', productId },
            actions: [
                { action: 'buy', title: 'Купити' },
                { action: 'view', title: 'Детальніше' },
            ],
        };
    }

    createPromoNotification(title: string, description: string, promoCode?: string): NotificationPayload {
        return {
            title,
            body: description,
            icon: '/icons/promo-icon.png',
            tag: 'promo',
            data: { type: 'promo', promoCode },
            actions: promoCode ? [
                { action: 'copy', title: 'Копіювати код' },
                { action: 'shop', title: 'До магазину' },
            ] : [
                { action: 'shop', title: 'До магазину' },
            ],
        };
    }

    createBackInStockNotification(productName: string, productId: string): NotificationPayload {
        return {
            title: 'Товар знову в наявності!',
            body: `${productName} знову доступний для замовлення`,
            icon: '/icons/stock-icon.png',
            tag: `stock-${productId}`,
            data: { type: 'back_in_stock', productId },
            actions: [
                { action: 'buy', title: 'Купити' },
            ],
        };
    }

    createDeliveryNotification(orderId: string, message: string): NotificationPayload {
        return {
            title: `Доставка #${orderId}`,
            body: message,
            icon: '/icons/delivery-icon.png',
            tag: `delivery-${orderId}`,
            data: { type: 'delivery', orderId },
            actions: [
                { action: 'track', title: 'Відстежити' },
            ],
        };
    }

    createAbandonedCartNotification(itemCount: number): NotificationPayload {
        return {
            title: 'Ви забули про кошик',
            body: `У вашому кошику ${itemCount} товар(ів). Завершіть покупку!`,
            icon: '/icons/cart-icon.png',
            tag: 'abandoned-cart',
            data: { type: 'abandoned_cart' },
            actions: [
                { action: 'checkout', title: 'Оформити' },
            ],
        };
    }

    // Private methods
    private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray.buffer;
    }

    private async sendSubscriptionToServer(subscription: PushSubscriptionJSON): Promise<void> {
        try {
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription, preferences: this.preferences }),
            });
        } catch (error) {
            console.error('Failed to send subscription to server:', error);
        }
    }

    private async removeSubscriptionFromServer(): Promise<void> {
        try {
            await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Failed to remove subscription from server:', error);
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

    private loadPreferences(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const saved = localStorage.getItem('notification_preferences');
            if (saved) {
                this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
            }
        } catch {
            // Ignore
        }
    }

    private savePreferences(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem('notification_preferences', JSON.stringify(this.preferences));
        } catch {
            // Ignore
        }
    }
}

// Singleton instance
export const pushNotifications = new PushNotificationService();

// React hook for push notifications
export function usePushNotifications() {
    return pushNotifications;
}
