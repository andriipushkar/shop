/**
 * Tests for RFM Customer Analysis
 */
import {
  calculateRFMScores,
  getCustomerSegment,
  analyzeCustomer,
  analyzeAllCustomers,
  getSegmentInsights,
  CUSTOMER_SEGMENTS,
  CustomerData,
  OrderData,
} from '@/lib/analytics/rfm-analysis';

// Helper to create test customer data
function createCustomer(
  id: string,
  orders: Partial<OrderData>[] = [],
  createdDaysAgo: number = 365
): CustomerData {
  const now = new Date();
  return {
    id,
    name: `Customer ${id}`,
    email: `customer${id}@example.com`,
    createdAt: new Date(now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000),
    orders: orders.map((o, i) => ({
      id: `order-${id}-${i}`,
      date: o.date || now,
      total: o.total || 1000,
      status: o.status || 'completed',
    })),
  };
}

describe('RFM Analysis', () => {
  const referenceDate = new Date('2024-01-15');

  describe('calculateRFMScores', () => {
    it('should return minimum scores for customer with no completed orders', () => {
      const customer = createCustomer('1', [
        { status: 'cancelled', total: 1000 },
      ]);

      const scores = calculateRFMScores(customer, referenceDate);

      expect(scores.recency).toBe(1);
      expect(scores.frequency).toBe(1);
      expect(scores.monetary).toBe(1);
      expect(scores.total).toBe(3);
    });

    it('should calculate recency score based on days since last order', () => {
      // Order 5 days ago = score 5
      const customer1 = createCustomer('1', [
        { date: new Date(referenceDate.getTime() - 5 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);
      expect(calculateRFMScores(customer1, referenceDate).recency).toBe(5);

      // Order 20 days ago = score 4
      const customer2 = createCustomer('2', [
        { date: new Date(referenceDate.getTime() - 20 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);
      expect(calculateRFMScores(customer2, referenceDate).recency).toBe(4);

      // Order 60 days ago = score 3
      const customer3 = createCustomer('3', [
        { date: new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);
      expect(calculateRFMScores(customer3, referenceDate).recency).toBe(3);

      // Order 120 days ago = score 2
      const customer4 = createCustomer('4', [
        { date: new Date(referenceDate.getTime() - 120 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);
      expect(calculateRFMScores(customer4, referenceDate).recency).toBe(2);

      // Order 200 days ago = score 1
      const customer5 = createCustomer('5', [
        { date: new Date(referenceDate.getTime() - 200 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);
      expect(calculateRFMScores(customer5, referenceDate).recency).toBe(1);
    });

    it('should calculate frequency score based on order count', () => {
      // 1 order = score 1
      const customer1 = createCustomer('1', [{ total: 1000 }]);
      expect(calculateRFMScores(customer1, referenceDate).frequency).toBe(1);

      // 2 orders = score 2
      const customer2 = createCustomer('2', [{ total: 1000 }, { total: 1000 }]);
      expect(calculateRFMScores(customer2, referenceDate).frequency).toBe(2);

      // 5 orders = score 4
      const customer3 = createCustomer('3', Array(5).fill({ total: 1000 }));
      expect(calculateRFMScores(customer3, referenceDate).frequency).toBe(4);

      // 10 orders = score 5
      const customer4 = createCustomer('4', Array(10).fill({ total: 1000 }));
      expect(calculateRFMScores(customer4, referenceDate).frequency).toBe(5);
    });

    it('should calculate monetary score based on total spending', () => {
      // 2000 UAH = score 1
      const customer1 = createCustomer('1', [{ total: 2000 }]);
      expect(calculateRFMScores(customer1, referenceDate).monetary).toBe(1);

      // 7000 UAH = score 2
      const customer2 = createCustomer('2', [{ total: 7000 }]);
      expect(calculateRFMScores(customer2, referenceDate).monetary).toBe(2);

      // 15000 UAH = score 3
      const customer3 = createCustomer('3', [{ total: 15000 }]);
      expect(calculateRFMScores(customer3, referenceDate).monetary).toBe(3);

      // 30000 UAH = score 4
      const customer4 = createCustomer('4', [{ total: 30000 }]);
      expect(calculateRFMScores(customer4, referenceDate).monetary).toBe(4);

      // 60000 UAH = score 5
      const customer5 = createCustomer('5', [{ total: 60000 }]);
      expect(calculateRFMScores(customer5, referenceDate).monetary).toBe(5);
    });

    it('should only count completed orders', () => {
      const customer = createCustomer('1', [
        { total: 50000, status: 'completed' },
        { total: 50000, status: 'cancelled' },
        { total: 50000, status: 'refunded' },
      ]);

      const scores = calculateRFMScores(customer, referenceDate);
      expect(scores.frequency).toBe(1); // Only 1 completed order
      expect(scores.monetary).toBe(5); // 50000 UAH from completed order
    });
  });

  describe('getCustomerSegment', () => {
    it('should return Champions for scores 13-15', () => {
      expect(getCustomerSegment({ recency: 5, frequency: 5, monetary: 5, total: 15 }).id).toBe('champions');
      expect(getCustomerSegment({ recency: 5, frequency: 4, monetary: 4, total: 13 }).id).toBe('champions');
    });

    it('should return Loyal Customers for scores 10-12', () => {
      expect(getCustomerSegment({ recency: 4, frequency: 4, monetary: 4, total: 12 }).id).toBe('loyal_customers');
      expect(getCustomerSegment({ recency: 4, frequency: 3, monetary: 3, total: 10 }).id).toBe('loyal_customers');
    });

    it('should return At Risk for scores 4-5', () => {
      expect(getCustomerSegment({ recency: 2, frequency: 2, monetary: 1, total: 5 }).id).toBe('at_risk');
      expect(getCustomerSegment({ recency: 2, frequency: 1, monetary: 1, total: 4 }).id).toBe('at_risk');
    });

    it('should return Hibernating for scores 1-3', () => {
      expect(getCustomerSegment({ recency: 1, frequency: 1, monetary: 1, total: 3 }).id).toBe('hibernating');
    });
  });

  describe('analyzeCustomer', () => {
    it('should return complete analysis for customer', () => {
      const customer = createCustomer('1', [
        { date: new Date(referenceDate.getTime() - 5 * 24 * 60 * 60 * 1000), total: 25000 },
        { date: new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000), total: 15000 },
        { date: new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000), total: 10000 },
      ], 100);

      const result = analyzeCustomer(customer, referenceDate);

      expect(result.customerId).toBe('1');
      expect(result.customerName).toBe('Customer 1');
      expect(result.scores).toBeDefined();
      expect(result.segment).toBeDefined();
      expect(result.metrics.totalOrders).toBe(3);
      expect(result.metrics.totalSpent).toBe(50000);
      expect(result.metrics.averageOrderValue).toBeCloseTo(16666.67, 0);
    });

    it('should calculate days since last order correctly', () => {
      const customer = createCustomer('1', [
        { date: new Date(referenceDate.getTime() - 10 * 24 * 60 * 60 * 1000), total: 1000 },
      ]);

      const result = analyzeCustomer(customer, referenceDate);
      expect(result.metrics.daysSinceLastOrder).toBe(10);
    });
  });

  describe('analyzeAllCustomers', () => {
    it('should analyze multiple customers and provide summary', () => {
      const customers = [
        createCustomer('1', [{ total: 60000, date: referenceDate }]),
        createCustomer('2', [{ total: 1000, date: new Date(referenceDate.getTime() - 200 * 24 * 60 * 60 * 1000) }]),
        createCustomer('3', [{ total: 20000, date: new Date(referenceDate.getTime() - 20 * 24 * 60 * 60 * 1000) }]),
      ];

      const { results, summary } = analyzeAllCustomers(customers, referenceDate);

      expect(results.length).toBe(3);
      expect(summary).toBeDefined();

      // Check summary has entries for all segments
      for (const segment of CUSTOMER_SEGMENTS) {
        expect(summary[segment.id]).toBeDefined();
        expect(summary[segment.id].count).toBeGreaterThanOrEqual(0);
        expect(summary[segment.id].percentage).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate segment percentages correctly', () => {
      const customers = [
        createCustomer('1', Array(10).fill({ total: 10000, date: referenceDate })),
        createCustomer('2', Array(10).fill({ total: 10000, date: referenceDate })),
      ];

      const { summary } = analyzeAllCustomers(customers, referenceDate);

      const totalPercentage = Object.values(summary).reduce((sum, s) => sum + s.percentage, 0);
      expect(totalPercentage).toBe(100);
    });
  });

  describe('getSegmentInsights', () => {
    it('should return insights for champions', () => {
      const insights = getSegmentInsights('champions');

      expect(insights.actions.length).toBeGreaterThan(0);
      expect(insights.kpis.length).toBeGreaterThan(0);
      expect(insights.emailTemplates.length).toBeGreaterThan(0);
    });

    it('should return insights for at_risk customers', () => {
      const insights = getSegmentInsights('at_risk');

      expect(insights.actions).toContain('Win-back кампанія');
      expect(insights.kpis).toContain('Reactivation rate');
    });

    it('should return empty arrays for unknown segment', () => {
      const insights = getSegmentInsights('unknown');

      expect(insights.actions).toEqual([]);
      expect(insights.kpis).toEqual([]);
      expect(insights.emailTemplates).toEqual([]);
    });
  });

  describe('CUSTOMER_SEGMENTS configuration', () => {
    it('should have valid segment configurations', () => {
      for (const segment of CUSTOMER_SEGMENTS) {
        expect(segment.id).toBeDefined();
        expect(segment.name).toBeDefined();
        expect(segment.nameUk).toBeDefined();
        expect(segment.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(segment.minScore).toBeLessThanOrEqual(segment.maxScore);
        expect(segment.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should cover all possible RFM score totals (3-15)', () => {
      for (let score = 3; score <= 15; score++) {
        const segment = CUSTOMER_SEGMENTS.find(
          s => score >= s.minScore && score <= s.maxScore
        );
        expect(segment).toBeDefined();
      }
    });

    it('should have no overlapping score ranges', () => {
      for (let i = 0; i < CUSTOMER_SEGMENTS.length; i++) {
        for (let j = i + 1; j < CUSTOMER_SEGMENTS.length; j++) {
          const seg1 = CUSTOMER_SEGMENTS[i];
          const seg2 = CUSTOMER_SEGMENTS[j];

          const overlap =
            (seg1.minScore <= seg2.maxScore && seg1.maxScore >= seg2.minScore) ||
            (seg2.minScore <= seg1.maxScore && seg2.maxScore >= seg1.minScore);

          if (overlap) {
            // Segments should not overlap
            expect(seg1.maxScore).toBeLessThan(seg2.minScore);
          }
        }
      }
    });
  });
});
