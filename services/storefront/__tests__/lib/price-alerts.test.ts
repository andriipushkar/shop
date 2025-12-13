// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
});

import {
    priceAlerts,
    PriceAlertCreateRequest,
} from '@/lib/price-alerts/price-alerts';

describe('PriceAlertService', () => {
    const userId = 'user123';

    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        // Clear all alerts before each test
        priceAlerts.clearAll();
    });

    describe('createAlert', () => {
        it('should create a price alert for any price drop', async () => {
            const request: PriceAlertCreateRequest = {
                productId: 'product123',
                productName: 'iPhone 15 Pro',
                currentPrice: 45000,
                alertType: 'any_drop',
                notifyVia: ['push', 'email'],
            };

            const alert = await priceAlerts.createAlert(userId, request);

            expect(alert).toMatchObject({
                userId,
                productId: 'product123',
                productName: 'iPhone 15 Pro',
                currentPrice: 45000,
                alertType: 'any_drop',
                status: 'active',
            });
            expect(alert.id).toBeDefined();
        });

        it('should create alert with target price', async () => {
            const request: PriceAlertCreateRequest = {
                productId: 'product123',
                productName: 'iPhone 15 Pro',
                currentPrice: 45000,
                targetPrice: 40000,
                alertType: 'target_price',
                notifyVia: ['push'],
            };

            const alert = await priceAlerts.createAlert(userId, request);

            expect(alert.targetPrice).toBe(40000);
            expect(alert.alertType).toBe('target_price');
        });

        it('should create alert with percentage threshold', async () => {
            const request: PriceAlertCreateRequest = {
                productId: 'product123',
                productName: 'iPhone 15 Pro',
                currentPrice: 45000,
                alertType: 'percentage_drop',
                percentageThreshold: 15,
                notifyVia: ['email'],
            };

            const alert = await priceAlerts.createAlert(userId, request);

            expect(alert.alertType).toBe('percentage_drop');
            expect(alert.percentageThreshold).toBe(15);
        });

        it('should set default target price if not provided', async () => {
            const request: PriceAlertCreateRequest = {
                productId: 'product123',
                productName: 'iPhone 15 Pro',
                currentPrice: 45000,
                alertType: 'target_price',
                notifyVia: ['push'],
            };

            const alert = await priceAlerts.createAlert(userId, request);

            // Default is 10% less than current price
            expect(alert.targetPrice).toBe(40500);
        });
    });

    describe('getUserAlerts', () => {
        it('should return empty array for user with no alerts', () => {
            const alerts = priceAlerts.getUserAlerts('new-user');
            expect(alerts).toEqual([]);
        });

        it('should return all alerts for user', async () => {
            await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Product 1',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            await priceAlerts.createAlert(userId, {
                productId: '2',
                productName: 'Product 2',
                currentPrice: 2000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const alerts = priceAlerts.getUserAlerts(userId);

            expect(alerts.length).toBe(2);
        });

        it('should sort alerts by creation date descending', async () => {
            await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'First',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            // Small delay to ensure different timestamps
            await new Promise((r) => setTimeout(r, 10));

            await priceAlerts.createAlert(userId, {
                productId: '2',
                productName: 'Second',
                currentPrice: 2000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const alerts = priceAlerts.getUserAlerts(userId);

            expect(alerts[0].productName).toBe('Second');
            expect(alerts[1].productName).toBe('First');
        });
    });

    describe('getActiveAlerts', () => {
        it('should return only active alerts', async () => {
            await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Active Alert',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const alert2 = await priceAlerts.createAlert(userId, {
                productId: '2',
                productName: 'To Cancel',
                currentPrice: 2000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            await priceAlerts.cancelAlert(alert2.id);

            const activeAlerts = priceAlerts.getActiveAlerts(userId);

            expect(activeAlerts.length).toBe(1);
            expect(activeAlerts[0].productName).toBe('Active Alert');
        });
    });

    describe('hasActiveAlert', () => {
        it('should return true if product has active alert', async () => {
            await priceAlerts.createAlert(userId, {
                productId: 'product123',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const hasAlert = priceAlerts.hasActiveAlert(userId, 'product123');
            expect(hasAlert).toBe(true);
        });

        it('should return false if product has no active alert', () => {
            const hasAlert = priceAlerts.hasActiveAlert(userId, 'no-alert-product');
            expect(hasAlert).toBe(false);
        });
    });

    describe('cancelAlert', () => {
        it('should cancel an active alert', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const result = await priceAlerts.cancelAlert(alert.id);

            expect(result).toBe(true);

            const updated = priceAlerts.getAlert(alert.id);
            expect(updated?.status).toBe('cancelled');
        });

        it('should return false for non-existent alert', async () => {
            const result = await priceAlerts.cancelAlert('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('deleteAlert', () => {
        it('should delete an alert', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const result = await priceAlerts.deleteAlert(alert.id);

            expect(result).toBe(true);

            const deleted = priceAlerts.getAlert(alert.id);
            expect(deleted).toBeUndefined();
        });
    });

    describe('checkPriceDrop', () => {
        it('should trigger for any price drop', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const shouldTrigger = priceAlerts.checkPriceDrop(alert, 999);
            expect(shouldTrigger).toBe(true);

            const shouldNotTrigger = priceAlerts.checkPriceDrop(alert, 1000);
            expect(shouldNotTrigger).toBe(false);
        });

        it('should trigger when target price is reached', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Test',
                currentPrice: 1000,
                targetPrice: 800,
                alertType: 'target_price',
                notifyVia: ['push'],
            });

            const shouldTrigger = priceAlerts.checkPriceDrop(alert, 800);
            expect(shouldTrigger).toBe(true);

            const belowTarget = priceAlerts.checkPriceDrop(alert, 750);
            expect(belowTarget).toBe(true);

            const aboveTarget = priceAlerts.checkPriceDrop(alert, 850);
            expect(aboveTarget).toBe(false);
        });

        it('should trigger when percentage threshold is met', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'percentage_drop',
                percentageThreshold: 10,
                notifyVia: ['push'],
            });

            // 10% drop (1000 -> 900)
            const shouldTrigger = priceAlerts.checkPriceDrop(alert, 900);
            expect(shouldTrigger).toBe(true);

            // Less than 10% drop
            const shouldNotTrigger = priceAlerts.checkPriceDrop(alert, 950);
            expect(shouldNotTrigger).toBe(false);
        });
    });

    describe('processPriceUpdate', () => {
        it('should trigger matching alerts when price drops', async () => {
            await priceAlerts.createAlert(userId, {
                productId: 'product123',
                productName: 'Test',
                currentPrice: 1000,
                targetPrice: 900,
                alertType: 'target_price',
                notifyVia: ['push'],
            });

            const triggered = await priceAlerts.processPriceUpdate('product123', 850);

            expect(triggered.length).toBe(1);
            expect(triggered[0].status).toBe('triggered');
        });

        it('should add price point to history', async () => {
            const alert = await priceAlerts.createAlert(userId, {
                productId: 'product123',
                productName: 'Test',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            await priceAlerts.processPriceUpdate('product123', 950);

            const updated = priceAlerts.getAlert(alert.id);
            expect(updated?.priceHistory.length).toBeGreaterThan(1);
        });
    });

    describe('getStats', () => {
        it('should calculate statistics', async () => {
            await priceAlerts.createAlert(userId, {
                productId: '1',
                productName: 'Active',
                currentPrice: 1000,
                alertType: 'any_drop',
                notifyVia: ['push'],
            });

            const stats = priceAlerts.getStats(userId);

            expect(stats).toMatchObject({
                totalAlerts: expect.any(Number),
                activeAlerts: expect.any(Number),
                triggeredAlerts: expect.any(Number),
                totalSaved: expect.any(Number),
            });
        });
    });

    describe('calculateSavings', () => {
        it('should calculate potential savings', () => {
            const savings = priceAlerts.calculateSavings(1000, 800);

            expect(savings.amount).toBe(200);
            expect(savings.percentage).toBe(20);
        });
    });

    describe('getSuggestedTargetPrice', () => {
        it('should suggest 10% discount', () => {
            const suggested = priceAlerts.getSuggestedTargetPrice(1000);
            expect(suggested).toBe(900);
        });
    });
});
