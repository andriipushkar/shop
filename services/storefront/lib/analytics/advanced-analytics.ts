// Advanced Analytics Service

export interface AnalyticsEvent {
    id: string;
    type: EventType;
    userId?: string;
    sessionId: string;
    data: EventData;
    timestamp: string;
    url: string;
    referrer?: string;
    userAgent: string;
    device: DeviceInfo;
    geo?: GeoInfo;
}

export type EventType =
    | 'page_view'
    | 'product_view'
    | 'product_click'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'checkout_start'
    | 'checkout_step'
    | 'purchase'
    | 'search'
    | 'filter'
    | 'sort'
    | 'wishlist_add'
    | 'wishlist_remove'
    | 'share'
    | 'review_submit'
    | 'scroll_depth'
    | 'time_on_page'
    | 'click'
    | 'form_submit'
    | 'error';

export interface EventData {
    // Product events
    productId?: string;
    productName?: string;
    productCategory?: string;
    productPrice?: number;
    quantity?: number;

    // Cart events
    cartId?: string;
    cartTotal?: number;
    cartItems?: number;

    // Order events
    orderId?: string;
    orderTotal?: number;
    paymentMethod?: string;
    shippingMethod?: string;
    couponCode?: string;

    // Search events
    query?: string;
    resultsCount?: number;
    filters?: Record<string, unknown>;

    // Engagement events
    scrollDepth?: number;
    timeOnPage?: number;
    clickTarget?: string;

    // Custom data
    custom?: Record<string, unknown>;
}

export interface DeviceInfo {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
    screenWidth: number;
    screenHeight: number;
}

export interface GeoInfo {
    country?: string;
    region?: string;
    city?: string;
    ip?: string;
}

export interface UserSegment {
    id: string;
    name: string;
    conditions: SegmentCondition[];
    userCount: number;
    createdAt: string;
}

export interface SegmentCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: unknown;
}

export interface Funnel {
    id: string;
    name: string;
    steps: FunnelStep[];
    conversionRate: number;
    dropOffRates: number[];
}

export interface FunnelStep {
    name: string;
    eventType: EventType;
    conditions?: Record<string, unknown>;
    users: number;
    percentage: number;
}

export interface Cohort {
    id: string;
    name: string;
    date: string;
    users: number;
    retention: number[];
}

export interface HeatmapData {
    pageUrl: string;
    clicks: ClickPoint[];
    scrollDepth: ScrollDepthData[];
    attentionMap: AttentionPoint[];
}

export interface ClickPoint {
    x: number;
    y: number;
    count: number;
    element?: string;
}

export interface ScrollDepthData {
    depth: number;
    users: number;
    percentage: number;
}

export interface AttentionPoint {
    x: number;
    y: number;
    duration: number;
}

export interface RealtimeAnalytics {
    activeUsers: number;
    pageViews: number;
    events: number;
    topPages: { url: string; users: number }[];
    topEvents: { type: EventType; count: number }[];
    usersByCountry: { country: string; users: number }[];
    usersByDevice: { device: string; users: number }[];
}

export interface ABTest {
    id: string;
    name: string;
    status: 'draft' | 'running' | 'paused' | 'completed';
    variants: ABVariant[];
    targetMetric: string;
    trafficPercentage: number;
    startDate?: string;
    endDate?: string;
    winner?: string;
    statisticalSignificance?: number;
}

export interface ABVariant {
    id: string;
    name: string;
    traffic: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    isControl: boolean;
}

class AdvancedAnalyticsService {
    private events: AnalyticsEvent[] = [];
    private sessionId: string;
    private userId?: string;
    private pageViewStart?: number;
    private scrollTracked = false;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.initializeTracking();
    }

    // Initialize automatic tracking
    private initializeTracking(): void {
        if (typeof window === 'undefined') return;

        // Track page views
        this.trackPageView();

        // Track scroll depth
        this.trackScrollDepth();

        // Track time on page
        this.trackTimeOnPage();

        // Track clicks
        this.trackClicks();

        // Track errors
        this.trackErrors();

        // Listen for route changes (Next.js)
        if (typeof window !== 'undefined') {
            window.addEventListener('popstate', () => this.trackPageView());
        }
    }

    // Set user ID
    setUserId(userId: string): void {
        this.userId = userId;
    }

    // Track custom event
    track(type: EventType, data: EventData = {}): void {
        const event: AnalyticsEvent = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            userId: this.userId,
            sessionId: this.sessionId,
            data,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            referrer: typeof document !== 'undefined' ? document.referrer : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            device: this.getDeviceInfo(),
        };

        this.events.push(event);
        this.sendToServer(event);
    }

    // E-commerce tracking
    trackProductView(product: { id: string; name: string; category?: string; price: number }): void {
        this.track('product_view', {
            productId: product.id,
            productName: product.name,
            productCategory: product.category,
            productPrice: product.price,
        });
    }

    trackAddToCart(product: { id: string; name: string; price: number; quantity: number }): void {
        this.track('add_to_cart', {
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            quantity: product.quantity,
        });
    }

    trackRemoveFromCart(product: { id: string; name: string; quantity: number }): void {
        this.track('remove_from_cart', {
            productId: product.id,
            productName: product.name,
            quantity: product.quantity,
        });
    }

    trackCheckoutStart(cart: { id: string; total: number; items: number }): void {
        this.track('checkout_start', {
            cartId: cart.id,
            cartTotal: cart.total,
            cartItems: cart.items,
        });
    }

    trackCheckoutStep(step: number, data: Record<string, unknown> = {}): void {
        this.track('checkout_step', {
            custom: { step, ...data },
        });
    }

    trackPurchase(order: {
        id: string;
        total: number;
        paymentMethod: string;
        shippingMethod: string;
        couponCode?: string;
        items: { productId: string; name: string; price: number; quantity: number }[];
    }): void {
        this.track('purchase', {
            orderId: order.id,
            orderTotal: order.total,
            paymentMethod: order.paymentMethod,
            shippingMethod: order.shippingMethod,
            couponCode: order.couponCode,
            custom: { items: order.items },
        });
    }

    trackSearch(query: string, resultsCount: number, filters?: Record<string, unknown>): void {
        this.track('search', {
            query,
            resultsCount,
            filters,
        });
    }

    // Funnel analysis
    async getFunnelAnalysis(funnelId: string): Promise<Funnel> {
        // In production, fetch from API
        return {
            id: funnelId,
            name: 'Воронка покупки',
            steps: [
                { name: 'Перегляд товару', eventType: 'product_view', users: 10000, percentage: 100 },
                { name: 'Додано в кошик', eventType: 'add_to_cart', users: 2500, percentage: 25 },
                { name: 'Початок оформлення', eventType: 'checkout_start', users: 1500, percentage: 15 },
                { name: 'Покупка', eventType: 'purchase', users: 800, percentage: 8 },
            ],
            conversionRate: 8,
            dropOffRates: [75, 40, 46.7],
        };
    }

    // Cohort analysis
    async getCohortAnalysis(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<Cohort[]> {
        // In production, fetch from API
        const cohorts: Cohort[] = [];
        const now = new Date();

        for (let i = 0; i < 8; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i * 7);

            const retention = [100];
            for (let j = 1; j <= 7 - i; j++) {
                retention.push(Math.round(retention[j - 1] * (0.7 + Math.random() * 0.2)));
            }

            cohorts.push({
                id: i.toString(),
                name: `Тиждень ${i + 1}`,
                date: date.toISOString().split('T')[0],
                users: Math.floor(Math.random() * 500) + 200,
                retention,
            });
        }

        return cohorts;
    }

    // User segments
    async getUserSegments(): Promise<UserSegment[]> {
        return [
            {
                id: '1',
                name: 'VIP клієнти',
                conditions: [
                    { field: 'totalPurchases', operator: 'greater_than', value: 10000 },
                ],
                userCount: 150,
                createdAt: new Date().toISOString(),
            },
            {
                id: '2',
                name: 'Нові користувачі',
                conditions: [
                    { field: 'createdAt', operator: 'greater_than', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                ],
                userCount: 2500,
                createdAt: new Date().toISOString(),
            },
            {
                id: '3',
                name: 'Покинуті кошики',
                conditions: [
                    { field: 'lastCartAbandonedAt', operator: 'greater_than', value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                ],
                userCount: 890,
                createdAt: new Date().toISOString(),
            },
            {
                id: '4',
                name: 'Активні покупці',
                conditions: [
                    { field: 'lastPurchaseAt', operator: 'greater_than', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                ],
                userCount: 3200,
                createdAt: new Date().toISOString(),
            },
        ];
    }

    // Heatmap data
    async getHeatmapData(pageUrl: string): Promise<HeatmapData> {
        // In production, fetch from API
        const clicks: ClickPoint[] = [];
        const scrollDepth: ScrollDepthData[] = [];

        // Generate mock click data
        for (let i = 0; i < 100; i++) {
            clicks.push({
                x: Math.floor(Math.random() * 1920),
                y: Math.floor(Math.random() * 3000),
                count: Math.floor(Math.random() * 50) + 1,
            });
        }

        // Generate scroll depth data
        for (let depth = 0; depth <= 100; depth += 10) {
            const users = Math.round(1000 * Math.pow(0.85, depth / 10));
            scrollDepth.push({
                depth,
                users,
                percentage: users / 10,
            });
        }

        return {
            pageUrl,
            clicks,
            scrollDepth,
            attentionMap: [],
        };
    }

    // Realtime analytics
    async getRealtimeAnalytics(): Promise<RealtimeAnalytics> {
        return {
            activeUsers: Math.floor(Math.random() * 100) + 150,
            pageViews: Math.floor(Math.random() * 500) + 1000,
            events: Math.floor(Math.random() * 1000) + 2000,
            topPages: [
                { url: '/', users: 45 },
                { url: '/products', users: 32 },
                { url: '/products/iphone-15', users: 28 },
                { url: '/cart', users: 15 },
                { url: '/checkout', users: 8 },
            ],
            topEvents: [
                { type: 'page_view', count: 450 },
                { type: 'product_view', count: 280 },
                { type: 'add_to_cart', count: 45 },
                { type: 'search', count: 120 },
                { type: 'purchase', count: 12 },
            ],
            usersByCountry: [
                { country: 'Україна', users: 180 },
                { country: 'Польща', users: 15 },
                { country: 'Німеччина', users: 8 },
                { country: 'США', users: 5 },
            ],
            usersByDevice: [
                { device: 'mobile', users: 120 },
                { device: 'desktop', users: 75 },
                { device: 'tablet', users: 13 },
            ],
        };
    }

    // A/B Testing
    async getABTests(): Promise<ABTest[]> {
        return [
            {
                id: '1',
                name: 'Колір кнопки купити',
                status: 'running',
                variants: [
                    { id: 'a', name: 'Зелений (контроль)', traffic: 5000, conversions: 150, conversionRate: 3.0, revenue: 450000, isControl: true },
                    { id: 'b', name: 'Помаранчевий', traffic: 5000, conversions: 175, conversionRate: 3.5, revenue: 525000, isControl: false },
                ],
                targetMetric: 'conversion_rate',
                trafficPercentage: 100,
                startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                statisticalSignificance: 92,
            },
            {
                id: '2',
                name: 'Макет сторінки товару',
                status: 'completed',
                variants: [
                    { id: 'a', name: 'Класичний', traffic: 10000, conversions: 280, conversionRate: 2.8, revenue: 840000, isControl: true },
                    { id: 'b', name: 'Новий дизайн', traffic: 10000, conversions: 350, conversionRate: 3.5, revenue: 1050000, isControl: false },
                ],
                targetMetric: 'conversion_rate',
                trafficPercentage: 50,
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                winner: 'b',
                statisticalSignificance: 98,
            },
        ];
    }

    async createABTest(test: Omit<ABTest, 'id'>): Promise<ABTest> {
        const newTest: ABTest = {
            ...test,
            id: Date.now().toString(),
        };

        // Save to server
        await fetch('/api/analytics/ab-tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTest),
        }).catch(() => {});

        return newTest;
    }

    // Get variant for user
    getABVariant(testId: string): string {
        // Use user ID or session ID for consistent assignment
        const seed = this.userId || this.sessionId;
        const hash = this.hashCode(seed + testId);
        return hash % 2 === 0 ? 'a' : 'b';
    }

    // Attribution analysis
    async getAttributionData(): Promise<{
        firstTouch: { channel: string; conversions: number; revenue: number }[];
        lastTouch: { channel: string; conversions: number; revenue: number }[];
        linear: { channel: string; conversions: number; revenue: number }[];
    }> {
        const channels = [
            { channel: 'Органічний пошук', conversions: 450, revenue: 1350000 },
            { channel: 'Прямий трафік', conversions: 320, revenue: 960000 },
            { channel: 'Соціальні мережі', conversions: 180, revenue: 540000 },
            { channel: 'Платна реклама', conversions: 250, revenue: 750000 },
            { channel: 'Email', conversions: 150, revenue: 450000 },
            { channel: 'Реферали', conversions: 80, revenue: 240000 },
        ];

        return {
            firstTouch: channels,
            lastTouch: channels.map((c) => ({
                ...c,
                conversions: Math.round(c.conversions * (0.8 + Math.random() * 0.4)),
                revenue: Math.round(c.revenue * (0.8 + Math.random() * 0.4)),
            })),
            linear: channels.map((c) => ({
                ...c,
                conversions: Math.round(c.conversions * (0.9 + Math.random() * 0.2)),
                revenue: Math.round(c.revenue * (0.9 + Math.random() * 0.2)),
            })),
        };
    }

    // Product analytics
    async getProductAnalytics(productId?: string): Promise<{
        views: number;
        uniqueViews: number;
        addToCartRate: number;
        purchaseRate: number;
        averageTimeOnPage: number;
        bounceRate: number;
        relatedProducts: { id: string; name: string; correlation: number }[];
    }> {
        return {
            views: Math.floor(Math.random() * 5000) + 1000,
            uniqueViews: Math.floor(Math.random() * 3000) + 800,
            addToCartRate: Math.round((Math.random() * 10 + 5) * 10) / 10,
            purchaseRate: Math.round((Math.random() * 3 + 1) * 10) / 10,
            averageTimeOnPage: Math.floor(Math.random() * 120) + 30,
            bounceRate: Math.round((Math.random() * 30 + 20) * 10) / 10,
            relatedProducts: [
                { id: '1', name: 'Чохол для iPhone', correlation: 0.85 },
                { id: '2', name: 'Захисне скло', correlation: 0.78 },
                { id: '3', name: 'AirPods Pro', correlation: 0.65 },
            ],
        };
    }

    // Customer journey
    async getCustomerJourney(userId: string): Promise<{
        touchpoints: {
            date: string;
            channel: string;
            event: EventType;
            data?: Record<string, unknown>;
        }[];
        totalValue: number;
        daysSinceFirstVisit: number;
        conversionPath: string[];
    }> {
        return {
            touchpoints: [
                { date: '2024-01-15', channel: 'google', event: 'page_view' },
                { date: '2024-01-15', channel: 'google', event: 'product_view', data: { productId: '123' } },
                { date: '2024-01-17', channel: 'direct', event: 'add_to_cart' },
                { date: '2024-01-18', channel: 'email', event: 'page_view' },
                { date: '2024-01-18', channel: 'email', event: 'purchase', data: { orderId: '456' } },
            ],
            totalValue: 15000,
            daysSinceFirstVisit: 45,
            conversionPath: ['Органічний пошук', 'Прямий трафік', 'Email'],
        };
    }

    // Private methods
    private trackPageView(): void {
        this.pageViewStart = Date.now();
        this.scrollTracked = false;
        this.track('page_view');
    }

    private trackScrollDepth(): void {
        if (typeof window === 'undefined') return;

        let maxScrollDepth = 0;

        const handleScroll = () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollTop = window.scrollY;
            const currentDepth = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

            if (currentDepth > maxScrollDepth) {
                maxScrollDepth = currentDepth;

                // Track at certain thresholds
                if ([25, 50, 75, 100].includes(maxScrollDepth) && !this.scrollTracked) {
                    this.track('scroll_depth', { scrollDepth: maxScrollDepth });
                    if (maxScrollDepth === 100) {
                        this.scrollTracked = true;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
    }

    private trackTimeOnPage(): void {
        if (typeof window === 'undefined') return;

        const handleUnload = () => {
            if (this.pageViewStart) {
                const timeOnPage = Math.round((Date.now() - this.pageViewStart) / 1000);
                this.track('time_on_page', { timeOnPage });
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                handleUnload();
            }
        });
    }

    private trackClicks(): void {
        if (typeof document === 'undefined') return;

        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const clickTarget = target.tagName + (target.className ? '.' + target.className.split(' ')[0] : '');

            // Track significant clicks
            if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('[data-track]')) {
                this.track('click', { clickTarget });
            }
        });
    }

    private trackErrors(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('error', (e) => {
            this.track('error', {
                custom: {
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno,
                },
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.track('error', {
                custom: {
                    message: e.reason?.message || 'Unhandled promise rejection',
                    type: 'unhandledrejection',
                },
            });
        });
    }

    private getDeviceInfo(): DeviceInfo {
        if (typeof window === 'undefined') {
            return { type: 'desktop', os: 'unknown', browser: 'unknown', screenWidth: 0, screenHeight: 0 };
        }

        const ua = navigator.userAgent;
        let type: DeviceInfo['type'] = 'desktop';

        if (/mobile/i.test(ua)) {
            type = 'mobile';
        } else if (/tablet|ipad/i.test(ua)) {
            type = 'tablet';
        }

        let os = 'unknown';
        if (/windows/i.test(ua)) os = 'Windows';
        else if (/mac/i.test(ua)) os = 'macOS';
        else if (/linux/i.test(ua)) os = 'Linux';
        else if (/android/i.test(ua)) os = 'Android';
        else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';

        let browser = 'unknown';
        if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
        else if (/firefox/i.test(ua)) browser = 'Firefox';
        else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
        else if (/edge/i.test(ua)) browser = 'Edge';

        return {
            type,
            os,
            browser,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
        };
    }

    private generateSessionId(): string {
        if (typeof sessionStorage !== 'undefined') {
            let sessionId = sessionStorage.getItem('analytics_session_id');
            if (!sessionId) {
                sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                sessionStorage.setItem('analytics_session_id', sessionId);
            }
            return sessionId;
        }
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private async sendToServer(event: AnalyticsEvent): Promise<void> {
        try {
            // Use sendBeacon for reliability
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                navigator.sendBeacon('/api/analytics/events', JSON.stringify(event));
            } else {
                await fetch('/api/analytics/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event),
                    keepalive: true,
                });
            }
        } catch {
            // Store locally for retry
            this.storeEventLocally(event);
        }
    }

    private storeEventLocally(event: AnalyticsEvent): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const stored = localStorage.getItem('analytics_queue') || '[]';
            const queue: AnalyticsEvent[] = JSON.parse(stored);
            queue.push(event);
            localStorage.setItem('analytics_queue', JSON.stringify(queue.slice(-100)));
        } catch {
            // Ignore storage errors
        }
    }
}

// Singleton instance
export const advancedAnalytics = new AdvancedAnalyticsService();

// React hook
export function useAdvancedAnalytics() {
    return advancedAnalytics;
}
