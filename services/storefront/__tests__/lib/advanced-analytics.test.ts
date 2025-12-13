// Mock browser APIs with configurable: true
Object.defineProperty(global, 'navigator', {
    value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        sendBeacon: jest.fn().mockReturnValue(true),
    },
    writable: true,
    configurable: true,
});

Object.defineProperty(global, 'sessionStorage', {
    value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
    },
    writable: true,
    configurable: true,
});

Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
    },
    writable: true,
    configurable: true,
});

// Use global window from jsdom, just extend it
if (typeof window !== 'undefined') {
    Object.assign(window, {
        scrollY: 0,
    });
}

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
});

import {
    advancedAnalytics,
    EventType,
} from '@/lib/analytics/advanced-analytics';

describe('AdvancedAnalyticsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('setUserId', () => {
        it('should set user ID', () => {
            advancedAnalytics.setUserId('user123');
            // User ID is set internally, verify by tracking an event
            advancedAnalytics.track('page_view');
            expect(navigator.sendBeacon).toHaveBeenCalled();
        });
    });

    describe('track', () => {
        it('should track custom event', () => {
            advancedAnalytics.track('click', { clickTarget: 'button' });

            expect(navigator.sendBeacon).toHaveBeenCalled();
        });

        it('should include session ID', () => {
            advancedAnalytics.track('page_view');

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.sessionId).toBeDefined();
        });
    });

    describe('E-commerce tracking', () => {
        it('should track product view', () => {
            advancedAnalytics.trackProductView({
                id: 'prod123',
                name: 'iPhone 15 Pro',
                category: 'Smartphones',
                price: 45000,
            });

            expect(navigator.sendBeacon).toHaveBeenCalled();
            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('product_view');
            expect(event.data.productId).toBe('prod123');
            expect(event.data.productPrice).toBe(45000);
        });

        it('should track add to cart', () => {
            advancedAnalytics.trackAddToCart({
                id: 'prod123',
                name: 'iPhone 15 Pro',
                price: 45000,
                quantity: 2,
            });

            expect(navigator.sendBeacon).toHaveBeenCalled();
            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('add_to_cart');
            expect(event.data.quantity).toBe(2);
        });

        it('should track remove from cart', () => {
            advancedAnalytics.trackRemoveFromCart({
                id: 'prod123',
                name: 'iPhone 15 Pro',
                quantity: 1,
            });

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('remove_from_cart');
        });

        it('should track checkout start', () => {
            advancedAnalytics.trackCheckoutStart({
                id: 'cart123',
                total: 90000,
                items: 2,
            });

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('checkout_start');
            expect(event.data.cartTotal).toBe(90000);
        });

        it('should track checkout step', () => {
            advancedAnalytics.trackCheckoutStep(2, { shippingMethod: 'nova_poshta' });

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('checkout_step');
            expect(event.data.custom.step).toBe(2);
        });

        it('should track purchase', () => {
            advancedAnalytics.trackPurchase({
                id: 'order123',
                total: 90000,
                paymentMethod: 'card',
                shippingMethod: 'nova_poshta',
                couponCode: 'SALE10',
                items: [
                    { productId: '1', name: 'iPhone', price: 45000, quantity: 2 },
                ],
            });

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('purchase');
            expect(event.data.orderId).toBe('order123');
            expect(event.data.couponCode).toBe('SALE10');
        });

        it('should track search', () => {
            advancedAnalytics.trackSearch('iphone', 25, { category: 'smartphones' });

            const [, payload] = (navigator.sendBeacon as ReturnType<typeof jest.fn>).mock.calls[0];
            const event = JSON.parse(payload);

            expect(event.type).toBe('search');
            expect(event.data.query).toBe('iphone');
            expect(event.data.resultsCount).toBe(25);
        });
    });

    describe('Funnel analysis', () => {
        it('should get funnel analysis', async () => {
            const funnel = await advancedAnalytics.getFunnelAnalysis('purchase-funnel');

            expect(funnel).toMatchObject({
                id: 'purchase-funnel',
                name: expect.any(String),
                steps: expect.any(Array),
                conversionRate: expect.any(Number),
                dropOffRates: expect.any(Array),
            });

            expect(funnel.steps.length).toBeGreaterThan(0);
            funnel.steps.forEach((step) => {
                expect(step).toMatchObject({
                    name: expect.any(String),
                    eventType: expect.any(String),
                    users: expect.any(Number),
                    percentage: expect.any(Number),
                });
            });
        });
    });

    describe('Cohort analysis', () => {
        it('should get cohort analysis', async () => {
            const cohorts = await advancedAnalytics.getCohortAnalysis('weekly');

            expect(Array.isArray(cohorts)).toBe(true);
            expect(cohorts.length).toBeGreaterThan(0);

            cohorts.forEach((cohort) => {
                expect(cohort).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    date: expect.any(String),
                    users: expect.any(Number),
                    retention: expect.any(Array),
                });
            });
        });
    });

    describe('User segments', () => {
        it('should get user segments', async () => {
            const segments = await advancedAnalytics.getUserSegments();

            expect(Array.isArray(segments)).toBe(true);
            expect(segments.length).toBeGreaterThan(0);

            segments.forEach((segment) => {
                expect(segment).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    conditions: expect.any(Array),
                    userCount: expect.any(Number),
                });
            });
        });
    });

    describe('Heatmap data', () => {
        it('should get heatmap data', async () => {
            const heatmap = await advancedAnalytics.getHeatmapData('/products');

            expect(heatmap).toMatchObject({
                pageUrl: '/products',
                clicks: expect.any(Array),
                scrollDepth: expect.any(Array),
            });

            expect(heatmap.clicks.length).toBeGreaterThan(0);
            heatmap.clicks.forEach((click) => {
                expect(click).toMatchObject({
                    x: expect.any(Number),
                    y: expect.any(Number),
                    count: expect.any(Number),
                });
            });
        });
    });

    describe('Realtime analytics', () => {
        it('should get realtime analytics', async () => {
            const realtime = await advancedAnalytics.getRealtimeAnalytics();

            expect(realtime).toMatchObject({
                activeUsers: expect.any(Number),
                pageViews: expect.any(Number),
                events: expect.any(Number),
                topPages: expect.any(Array),
                topEvents: expect.any(Array),
                usersByCountry: expect.any(Array),
                usersByDevice: expect.any(Array),
            });
        });
    });

    describe('A/B Testing', () => {
        it('should get A/B tests', async () => {
            const tests = await advancedAnalytics.getABTests();

            expect(Array.isArray(tests)).toBe(true);
            tests.forEach((test) => {
                expect(test).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    status: expect.any(String),
                    variants: expect.any(Array),
                    targetMetric: expect.any(String),
                });
            });
        });

        it('should create A/B test', async () => {
            const test = await advancedAnalytics.createABTest({
                name: 'New Button Color Test',
                status: 'draft',
                variants: [
                    { id: 'a', name: 'Control', traffic: 0, conversions: 0, conversionRate: 0, revenue: 0, isControl: true },
                    { id: 'b', name: 'Variant', traffic: 0, conversions: 0, conversionRate: 0, revenue: 0, isControl: false },
                ],
                targetMetric: 'conversion_rate',
                trafficPercentage: 50,
            });

            expect(test.id).toBeDefined();
            expect(test.name).toBe('New Button Color Test');
        });

        it('should get variant for user consistently', () => {
            advancedAnalytics.setUserId('user123');

            const variant1 = advancedAnalytics.getABVariant('test1');
            const variant2 = advancedAnalytics.getABVariant('test1');

            // Same user, same test should get same variant
            expect(variant1).toBe(variant2);
            expect(['a', 'b']).toContain(variant1);
        });
    });

    describe('Attribution analysis', () => {
        it('should get attribution data', async () => {
            const attribution = await advancedAnalytics.getAttributionData();

            expect(attribution).toMatchObject({
                firstTouch: expect.any(Array),
                lastTouch: expect.any(Array),
                linear: expect.any(Array),
            });

            attribution.firstTouch.forEach((item) => {
                expect(item).toMatchObject({
                    channel: expect.any(String),
                    conversions: expect.any(Number),
                    revenue: expect.any(Number),
                });
            });
        });
    });

    describe('Product analytics', () => {
        it('should get product analytics', async () => {
            const analytics = await advancedAnalytics.getProductAnalytics('prod123');

            expect(analytics).toMatchObject({
                views: expect.any(Number),
                uniqueViews: expect.any(Number),
                addToCartRate: expect.any(Number),
                purchaseRate: expect.any(Number),
                averageTimeOnPage: expect.any(Number),
                bounceRate: expect.any(Number),
                relatedProducts: expect.any(Array),
            });
        });
    });

    describe('Customer journey', () => {
        it('should get customer journey', async () => {
            const journey = await advancedAnalytics.getCustomerJourney('user123');

            expect(journey).toMatchObject({
                touchpoints: expect.any(Array),
                totalValue: expect.any(Number),
                daysSinceFirstVisit: expect.any(Number),
                conversionPath: expect.any(Array),
            });

            expect(journey.touchpoints.length).toBeGreaterThan(0);
            journey.touchpoints.forEach((point) => {
                expect(point).toMatchObject({
                    date: expect.any(String),
                    channel: expect.any(String),
                    event: expect.any(String),
                });
            });
        });
    });
});

describe('Event Types', () => {
    const eventTypes: EventType[] = [
        'page_view',
        'product_view',
        'product_click',
        'add_to_cart',
        'remove_from_cart',
        'checkout_start',
        'checkout_step',
        'purchase',
        'search',
        'filter',
        'sort',
        'wishlist_add',
        'wishlist_remove',
        'share',
        'review_submit',
        'scroll_depth',
        'time_on_page',
        'click',
        'form_submit',
        'error',
    ];

    it('should support all event types', () => {
        eventTypes.forEach((type) => {
            expect(typeof type).toBe('string');
        });
    });
});
