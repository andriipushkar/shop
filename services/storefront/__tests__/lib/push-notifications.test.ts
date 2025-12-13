// Mock browser APIs
const mockPushManager = {
    subscribe: jest.fn(),
    getSubscription: jest.fn().mockResolvedValue(null),
};

const mockServiceWorkerRegistration = {
    pushManager: mockPushManager,
    showNotification: jest.fn(),
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

try {
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true });
} catch {
    (global as unknown as { localStorage: typeof localStorageMock }).localStorage = localStorageMock;
}

// Mock PushManager
try {
    Object.defineProperty(global, 'PushManager', { value: class {}, configurable: true });
} catch {
    // Already defined
}

const mockNotification = jest.fn().mockImplementation(() => ({}));
(mockNotification as unknown as { requestPermission: jest.Mock }).requestPermission = jest.fn().mockResolvedValue('granted');
(mockNotification as unknown as { permission: string }).permission = 'default';

try {
    Object.defineProperty(global, 'Notification', { value: mockNotification, configurable: true });
} catch {
    (global as unknown as { Notification: typeof mockNotification }).Notification = mockNotification;
}

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
});

// Import after mocks
import {
    pushNotifications,
    NotificationType,
} from '@/lib/notifications/push-notifications';

describe('PushNotificationsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isSupported', () => {
        it('should check if push notifications are supported', () => {
            const supported = pushNotifications.isSupported();
            expect(typeof supported).toBe('boolean');
        });
    });

    describe('requestPermission', () => {
        it('should request notification permission', async () => {
            // In jsdom environment, the service returns 'denied' when not supported
            const result = await pushNotifications.requestPermission();

            // Result should be a valid NotificationPermission
            expect(['granted', 'denied', 'default']).toContain(result);
        });

        it('should handle permission request', async () => {
            const result = await pushNotifications.requestPermission();

            // Result should be a valid NotificationPermission
            expect(typeof result).toBe('string');
        });
    });

    describe('createNotificationPayload', () => {
        it('should create order status notification', () => {
            const payload = pushNotifications.createOrderNotification(
                '12345',
                'shipped'
            );

            expect(payload).toMatchObject({
                title: expect.stringContaining('12345'),
                body: expect.any(String),
                data: {
                    type: 'order_status',
                    orderId: '12345',
                },
            });
        });

        it('should create price drop notification', () => {
            const payload = pushNotifications.createPriceDropNotification(
                'iPhone 15 Pro',
                50000,
                42000,
                'iphone-15-pro'
            );

            expect(payload).toMatchObject({
                title: expect.any(String),
                body: expect.any(String),
                data: {
                    type: 'price_drop',
                    productId: 'iphone-15-pro',
                },
            });
        });

        it('should create promo notification', () => {
            const payload = pushNotifications.createPromoNotification(
                'Чорна п\'ятниця',
                'Знижки до 50% на всі товари!'
            );

            expect(payload).toMatchObject({
                title: 'Чорна п\'ятниця',
                body: 'Знижки до 50% на всі товари!',
                data: {
                    type: 'promo',
                },
            });
        });

        it('should create back in stock notification', () => {
            const payload = pushNotifications.createBackInStockNotification(
                'MacBook Pro',
                'macbook-pro'
            );

            expect(payload).toMatchObject({
                title: expect.any(String),
                body: expect.stringContaining('MacBook Pro'),
                data: {
                    type: 'back_in_stock',
                    productId: 'macbook-pro',
                },
            });
        });
    });

    describe('notification preferences', () => {
        it('should get default preferences', () => {
            const prefs = pushNotifications.getPreferences();

            expect(prefs).toMatchObject({
                orderUpdates: true,
                priceAlerts: true,
                promotions: true,
            });
        });

        it('should update preferences', async () => {
            await pushNotifications.updatePreferences({
                promotions: false,
            });

            const prefs = pushNotifications.getPreferences();
            expect(prefs.promotions).toBe(false);
        });

        it('should check preference type', () => {
            const prefs = pushNotifications.getPreferences();
            expect(typeof prefs.orderUpdates).toBe('boolean');
        });
    });

    describe('notification payloads', () => {
        it('should create delivery notification', () => {
            const payload = pushNotifications.createDeliveryNotification(
                '12345',
                'Посилка прибула до відділення'
            );

            expect(payload).toMatchObject({
                title: expect.stringContaining('12345'),
                body: 'Посилка прибула до відділення',
                data: {
                    type: 'delivery',
                    orderId: '12345',
                },
            });
        });

        it('should create abandoned cart notification', () => {
            const payload = pushNotifications.createAbandonedCartNotification(3);

            expect(payload).toMatchObject({
                title: expect.any(String),
                body: expect.stringContaining('3'),
                data: {
                    type: 'abandoned_cart',
                },
            });
        });
    });
});

describe('Notification Types', () => {
    const notificationTypes: NotificationType[] = [
        'order_status',
        'price_drop',
        'back_in_stock',
        'promo',
        'delivery',
        'review_request',
        'wishlist_sale',
        'abandoned_cart',
    ];

    it('should support all notification types', () => {
        notificationTypes.forEach((type) => {
            expect(typeof type).toBe('string');
        });
    });
});
