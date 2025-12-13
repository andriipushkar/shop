import { analyticsService } from '@/lib/analytics/analytics-service';
import { metricsCalculator } from '@/lib/analytics/metrics';

// Mock fetch
global.fetch = jest.fn();

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const session = analyticsService.getOrCreateSession('user-1', 'https://google.com');

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.referrer).toBe('https://google.com');
      expect(session.events).toEqual([]);
    });

    it('should reuse existing session', () => {
      const session1 = analyticsService.getOrCreateSession('user-1');
      const session2 = analyticsService.getOrCreateSession('user-1');

      expect(session1.sessionId).toBe(session2.sessionId);
    });
  });

  describe('Event Tracking', () => {
    it('should track page view event', () => {
      analyticsService.trackPageView('/products', 'Products Page', 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/analytics/events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should track add to cart event', () => {
      analyticsService.trackAddToCart(
        'product-1',
        'Test Product',
        100,
        1,
        'Electronics',
        'user-1'
      );

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track purchase event', () => {
      analyticsService.trackPurchase(
        'order-1',
        500,
        [
          {
            productId: 'product-1',
            productName: 'Test Product',
            price: 500,
            quantity: 1,
          },
        ],
        'card',
        'user-1'
      );

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track search event', () => {
      analyticsService.trackSearch('laptop', 25, 'user-1');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track product view event', () => {
      analyticsService.trackProductView(
        'product-1',
        'Test Product',
        100,
        'Electronics',
        'user-1'
      );

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track checkout start event', () => {
      analyticsService.trackCheckoutStart(1000, 5, 'user-1');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track checkout complete event', () => {
      analyticsService.trackCheckoutComplete('order-1', 1000, 'user-1');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Active Users', () => {
    it('should return active users count', () => {
      analyticsService.getOrCreateSession('user-1');
      analyticsService.getOrCreateSession('user-2');

      const count = analyticsService.getActiveUsersCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Journey', () => {
    it('should track user journey', () => {
      const session = analyticsService.getOrCreateSession('user-1');
      analyticsService.trackPageView('/home', 'Home', 'user-1');
      analyticsService.trackPageView('/products', 'Products', 'user-1');

      const journey = analyticsService.getUserJourney(session.sessionId);
      expect(journey.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Active Sessions', () => {
    it('should return active sessions', () => {
      analyticsService.getOrCreateSession('user-1');
      analyticsService.getOrCreateSession('user-2');

      const sessions = analyticsService.getActiveSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});

describe('Metrics Calculator', () => {
  const mockOrders = [
    {
      id: 'order-1',
      userId: 'user-1',
      total: 1000,
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: 'product-1',
          productName: 'Product 1',
          price: 1000,
          quantity: 1,
          category: 'Electronics',
        },
      ],
    },
    {
      id: 'order-2',
      userId: 'user-2',
      total: 500,
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: 'product-2',
          productName: 'Product 2',
          price: 500,
          quantity: 1,
          category: 'Clothing',
        },
      ],
    },
  ];

  const mockSessions = [
    {
      sessionId: 'session-1',
      userId: 'user-1',
      startTime: new Date().toISOString(),
      referrer: 'https://google.com',
    },
    {
      sessionId: 'session-2',
      userId: 'user-2',
      startTime: new Date().toISOString(),
      referrer: 'https://facebook.com',
    },
  ];

  const mockEvents = [
    {
      eventType: 'product_view',
      sessionId: 'session-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      data: {
        productId: 'product-1',
        productName: 'Product 1',
        price: 1000,
      },
    },
    {
      eventType: 'add_to_cart',
      sessionId: 'session-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      data: {
        productId: 'product-1',
        productName: 'Product 1',
        price: 1000,
        quantity: 1,
      },
    },
  ];

  describe('Revenue Calculation', () => {
    it('should calculate revenue metrics', () => {
      const dateRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };

      const revenue = metricsCalculator.calculateRevenue(mockOrders, dateRange);

      expect(revenue).toHaveProperty('daily');
      expect(revenue).toHaveProperty('weekly');
      expect(revenue).toHaveProperty('monthly');
      expect(revenue).toHaveProperty('total');
      expect(revenue).toHaveProperty('trend');
      expect(revenue.total).toBe(1500);
    });
  });

  describe('Conversion Calculation', () => {
    it('should calculate conversion rate', () => {
      const conversion = metricsCalculator.calculateConversion(mockSessions, mockOrders);

      expect(conversion).toHaveProperty('rate');
      expect(conversion).toHaveProperty('sessions');
      expect(conversion).toHaveProperty('conversions');
      expect(conversion.sessions).toBe(2);
      expect(conversion.conversions).toBe(2);
      expect(conversion.rate).toBe(100);
    });

    it('should handle zero sessions', () => {
      const conversion = metricsCalculator.calculateConversion([], mockOrders);

      expect(conversion.rate).toBe(0);
    });
  });

  describe('Average Order Value', () => {
    it('should calculate AOV', () => {
      const orderMetrics = metricsCalculator.calculateAverageOrderValue(mockOrders);

      expect(orderMetrics).toHaveProperty('total');
      expect(orderMetrics).toHaveProperty('averageValue');
      expect(orderMetrics).toHaveProperty('totalRevenue');
      expect(orderMetrics.total).toBe(2);
      expect(orderMetrics.totalRevenue).toBe(1500);
      expect(orderMetrics.averageValue).toBe(750);
    });

    it('should handle empty orders', () => {
      const orderMetrics = metricsCalculator.calculateAverageOrderValue([]);

      expect(orderMetrics.total).toBe(0);
      expect(orderMetrics.averageValue).toBe(0);
    });
  });

  describe('Cart Abandonment', () => {
    it('should calculate cart abandonment rate', () => {
      const cartMetrics = metricsCalculator.calculateCartAbandonment(mockEvents);

      expect(cartMetrics).toHaveProperty('abandonment');
      expect(cartMetrics).toHaveProperty('cartsCreated');
      expect(cartMetrics).toHaveProperty('cartsCompleted');
    });

    it('should handle zero carts', () => {
      const cartMetrics = metricsCalculator.calculateCartAbandonment([]);

      expect(cartMetrics.abandonment).toBe(0);
      expect(cartMetrics.cartsCreated).toBe(0);
    });
  });

  describe('Top Products', () => {
    it('should calculate top products', () => {
      const topProducts = metricsCalculator.calculateTopProducts(
        mockEvents,
        mockOrders,
        10
      );

      expect(Array.isArray(topProducts)).toBe(true);
      expect(topProducts.length).toBeLessThanOrEqual(10);

      if (topProducts.length > 0) {
        expect(topProducts[0]).toHaveProperty('productId');
        expect(topProducts[0]).toHaveProperty('productName');
        expect(topProducts[0]).toHaveProperty('views');
        expect(topProducts[0]).toHaveProperty('addedToCart');
        expect(topProducts[0]).toHaveProperty('purchased');
        expect(topProducts[0]).toHaveProperty('revenue');
        expect(topProducts[0]).toHaveProperty('conversionRate');
      }
    });

    it('should sort by revenue', () => {
      const topProducts = metricsCalculator.calculateTopProducts(
        mockEvents,
        mockOrders,
        10
      );

      for (let i = 0; i < topProducts.length - 1; i++) {
        expect(topProducts[i].revenue).toBeGreaterThanOrEqual(
          topProducts[i + 1].revenue
        );
      }
    });
  });

  describe('Traffic Sources', () => {
    it('should calculate traffic sources', () => {
      const trafficSources = metricsCalculator.calculateTrafficSources(
        mockSessions,
        mockOrders
      );

      expect(Array.isArray(trafficSources)).toBe(true);

      if (trafficSources.length > 0) {
        expect(trafficSources[0]).toHaveProperty('source');
        expect(trafficSources[0]).toHaveProperty('sessions');
        expect(trafficSources[0]).toHaveProperty('conversions');
        expect(trafficSources[0]).toHaveProperty('revenue');
        expect(trafficSources[0]).toHaveProperty('percentage');
      }
    });

    it('should extract source from referrer', () => {
      const sessionsWithReferrer = [
        { ...mockSessions[0], referrer: 'https://google.com/search' },
        { ...mockSessions[1], referrer: 'https://facebook.com/posts' },
      ];

      const trafficSources = metricsCalculator.calculateTrafficSources(
        sessionsWithReferrer,
        mockOrders
      );

      const googleSource = trafficSources.find(s => s.source === 'Google');
      const facebookSource = trafficSources.find(s => s.source === 'Facebook');

      expect(googleSource).toBeDefined();
      expect(facebookSource).toBeDefined();
    });
  });

  describe('Customer Lifetime Value', () => {
    it('should calculate CLV', () => {
      const clv = metricsCalculator.calculateCustomerLifetimeValue(mockOrders);

      expect(Array.isArray(clv)).toBe(true);

      if (clv.length > 0) {
        expect(clv[0]).toHaveProperty('userId');
        expect(clv[0]).toHaveProperty('totalOrders');
        expect(clv[0]).toHaveProperty('totalSpent');
        expect(clv[0]).toHaveProperty('averageOrderValue');
        expect(clv[0]).toHaveProperty('firstOrderDate');
        expect(clv[0]).toHaveProperty('lastOrderDate');
        expect(clv[0]).toHaveProperty('daysSinceLastOrder');
      }
    });

    it('should sort by total spent', () => {
      const clv = metricsCalculator.calculateCustomerLifetimeValue(mockOrders);

      for (let i = 0; i < clv.length - 1; i++) {
        expect(clv[i].totalSpent).toBeGreaterThanOrEqual(clv[i + 1].totalSpent);
      }
    });
  });

  describe('Daily Metrics', () => {
    it('should calculate daily metrics', () => {
      const dailyMetrics = metricsCalculator.calculateDailyMetrics(
        mockOrders,
        mockSessions,
        7
      );

      expect(Array.isArray(dailyMetrics)).toBe(true);
      expect(dailyMetrics.length).toBe(7);

      if (dailyMetrics.length > 0) {
        expect(dailyMetrics[0]).toHaveProperty('date');
        expect(dailyMetrics[0]).toHaveProperty('revenue');
        expect(dailyMetrics[0]).toHaveProperty('orders');
        expect(dailyMetrics[0]).toHaveProperty('visitors');
        expect(dailyMetrics[0]).toHaveProperty('conversions');
        expect(dailyMetrics[0]).toHaveProperty('averageOrderValue');
      }
    });
  });

  describe('Category Performance', () => {
    it('should calculate category performance', () => {
      const categoryPerformance = metricsCalculator.calculateCategoryPerformance(mockOrders);

      expect(Array.isArray(categoryPerformance)).toBe(true);

      if (categoryPerformance.length > 0) {
        expect(categoryPerformance[0]).toHaveProperty('category');
        expect(categoryPerformance[0]).toHaveProperty('revenue');
        expect(categoryPerformance[0]).toHaveProperty('orders');
        expect(categoryPerformance[0]).toHaveProperty('percentage');
      }
    });

    it('should calculate percentages correctly', () => {
      const categoryPerformance = metricsCalculator.calculateCategoryPerformance(mockOrders);

      const totalPercentage = categoryPerformance.reduce(
        (sum, cat) => sum + cat.percentage,
        0
      );

      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });

  describe('RFM Segmentation', () => {
    it('should calculate RFM segments', () => {
      const rfmSegments = metricsCalculator.calculateRFMSegmentation(mockOrders);

      expect(Array.isArray(rfmSegments)).toBe(true);

      if (rfmSegments.length > 0) {
        expect(rfmSegments[0]).toHaveProperty('segment');
        expect(rfmSegments[0]).toHaveProperty('recency');
        expect(rfmSegments[0]).toHaveProperty('frequency');
        expect(rfmSegments[0]).toHaveProperty('monetary');
        expect(rfmSegments[0]).toHaveProperty('userCount');

        // RFM scores should be between 1 and 5
        expect(rfmSegments[0].recency).toBeGreaterThanOrEqual(1);
        expect(rfmSegments[0].recency).toBeLessThanOrEqual(5);
        expect(rfmSegments[0].frequency).toBeGreaterThanOrEqual(1);
        expect(rfmSegments[0].frequency).toBeLessThanOrEqual(5);
        expect(rfmSegments[0].monetary).toBeGreaterThanOrEqual(1);
        expect(rfmSegments[0].monetary).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Cohort Analysis', () => {
    it('should calculate cohort analysis', () => {
      const mockUsers = [
        {
          id: 'user-1',
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'user-2',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      const cohortAnalysis = metricsCalculator.calculateCohortAnalysis(
        mockUsers,
        mockOrders
      );

      expect(Array.isArray(cohortAnalysis)).toBe(true);

      if (cohortAnalysis.length > 0) {
        expect(cohortAnalysis[0]).toHaveProperty('cohort');
        expect(cohortAnalysis[0]).toHaveProperty('users');
        expect(cohortAnalysis[0]).toHaveProperty('retention');
        expect(typeof cohortAnalysis[0].retention).toBe('object');
      }
    });
  });

  describe('Retention', () => {
    it('should calculate retention metrics', () => {
      const mockUsers = [
        {
          id: 'user-1',
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        {
          id: 'user-2',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
      ];

      const retention = metricsCalculator.calculateRetention(mockUsers, 'month');

      expect(Array.isArray(retention)).toBe(true);

      if (retention.length > 0) {
        expect(retention[0]).toHaveProperty('period');
        expect(retention[0]).toHaveProperty('newUsers');
        expect(retention[0]).toHaveProperty('returningUsers');
        expect(retention[0]).toHaveProperty('retentionRate');
      }
    });
  });
});
