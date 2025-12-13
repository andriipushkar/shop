/**
 * Tests for Returns Analytics
 */
import {
  calculateReturnMetrics,
  analyzeProductReturns,
  analyzePreventableReturns,
  calculateReturnsTrend,
  getReturnsDashboardSummary,
  formatReturnStatus,
  RETURN_REASONS,
  ReturnRequest,
  ReturnItem,
} from '@/lib/analytics/returns-analytics';

// Helper to create test return request
function createReturnRequest(
  id: string,
  reason: ReturnRequest['reason'] = 'defective',
  refundAmount: number = 1000,
  status: ReturnRequest['status'] = 'completed',
  options: Partial<ReturnRequest> = {}
): ReturnRequest {
  const now = new Date();
  return {
    id,
    orderId: `order-${id}`,
    orderDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    returnRequestDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    returnCompletedDate: status === 'completed' ? now : undefined,
    customerId: `customer-${id}`,
    customerName: `Customer ${id}`,
    items: [
      {
        productId: `product-${id}`,
        productName: `Product ${id}`,
        sku: `SKU-${id}`,
        quantity: 1,
        unitPrice: refundAmount,
        condition: 'new',
        isResellable: true,
      },
    ],
    reason,
    status,
    refundAmount,
    refundMethod: 'original_payment',
    shippingCost: 50,
    restockingFee: 0,
    resolution: status === 'completed' ? 'full_refund' : undefined,
    customerSatisfaction: 4,
    ...options,
  };
}

describe('Returns Analytics', () => {
  describe('RETURN_REASONS', () => {
    it('should have all required return reasons', () => {
      const reasonIds = RETURN_REASONS.map(r => r.id);
      expect(reasonIds).toContain('defective');
      expect(reasonIds).toContain('not_as_described');
      expect(reasonIds).toContain('wrong_item');
      expect(reasonIds).toContain('changed_mind');
      expect(reasonIds).toContain('size_fit');
    });

    it('should have Ukrainian translations', () => {
      for (const reason of RETURN_REASONS) {
        expect(reason.nameUk).toBeDefined();
        expect(reason.descriptionUk).toBeDefined();
      }
    });

    it('should have prevention tips for preventable reasons', () => {
      const preventableReasons = RETURN_REASONS.filter(r => r.isPreventable);
      for (const reason of preventableReasons) {
        expect(reason.preventionTips.length).toBeGreaterThan(0);
        expect(reason.preventionTipsUk.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateReturnMetrics', () => {
    it('should calculate total returns', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000),
        createReturnRequest('2', 'wrong_item', 2000),
        createReturnRequest('3', 'changed_mind', 1500),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      expect(metrics.totalReturns).toBe(3);
      expect(metrics.totalReturnValue).toBe(4500);
    });

    it('should calculate return rate', () => {
      const returns = [
        createReturnRequest('1'),
        createReturnRequest('2'),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      expect(metrics.returnRate).toBe(2);
    });

    it('should calculate average return value', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000),
        createReturnRequest('2', 'defective', 2000),
        createReturnRequest('3', 'defective', 3000),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      expect(metrics.averageReturnValue).toBe(2000);
    });

    it('should break down by reason', () => {
      const returns = [
        createReturnRequest('1', 'defective'),
        createReturnRequest('2', 'defective'),
        createReturnRequest('3', 'wrong_item'),
        createReturnRequest('4', 'changed_mind'),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      const defectiveBreakdown = metrics.reasonBreakdown.find(r => r.reason === 'defective');
      expect(defectiveBreakdown?.count).toBe(2);
      expect(defectiveBreakdown?.percentage).toBe(50);
    });

    it('should calculate customer satisfaction average', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', { customerSatisfaction: 5 }),
        createReturnRequest('2', 'defective', 1000, 'completed', { customerSatisfaction: 3 }),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      expect(metrics.customerSatisfactionAvg).toBe(4);
    });

    it('should handle empty returns', () => {
      const metrics = calculateReturnMetrics([], 100);

      expect(metrics.totalReturns).toBe(0);
      expect(metrics.returnRate).toBe(0);
      expect(metrics.averageReturnValue).toBe(0);
    });

    it('should calculate cost of returns', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          shippingCost: 50,
          restockingFee: 100,
        }),
      ];

      const metrics = calculateReturnMetrics(returns, 100);

      expect(metrics.costOfReturns).toBe(1150); // 1000 + 50 + 100
    });
  });

  describe('analyzeProductReturns', () => {
    it('should group returns by product', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
        createReturnRequest('2', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
        createReturnRequest('3', 'wrong_item', 2000, 'completed', {
          items: [{ productId: 'prod-2', productName: 'Product 2', sku: 'SKU-2', quantity: 1, unitPrice: 2000, condition: 'new', isResellable: true }],
        }),
      ];

      const analysis = analyzeProductReturns(returns, { 'prod-1': 100, 'prod-2': 50 });

      const prod1 = analysis.find(a => a.productId === 'prod-1');
      const prod2 = analysis.find(a => a.productId === 'prod-2');

      expect(prod1?.totalReturned).toBe(2);
      expect(prod2?.totalReturned).toBe(1);
    });

    it('should calculate return rate per product', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
      ];

      const analysis = analyzeProductReturns(returns, { 'prod-1': 10 });

      const prod1 = analysis.find(a => a.productId === 'prod-1');
      expect(prod1?.returnRate).toBe(10); // 1 returned / 10 sold = 10%
    });

    it('should identify top return reasons per product', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
        createReturnRequest('2', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
        createReturnRequest('3', 'quality_issues', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
      ];

      const analysis = analyzeProductReturns(returns, { 'prod-1': 100 });

      const prod1 = analysis.find(a => a.productId === 'prod-1');
      expect(prod1?.topReasons[0].reason).toBe('defective');
      expect(prod1?.topReasons[0].count).toBe(2);
    });

    it('should sort products by return rate (highest first)', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-1', productName: 'Product 1', sku: 'SKU-1', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
        createReturnRequest('2', 'defective', 1000, 'completed', {
          items: [{ productId: 'prod-2', productName: 'Product 2', sku: 'SKU-2', quantity: 1, unitPrice: 1000, condition: 'new', isResellable: true }],
        }),
      ];

      const analysis = analyzeProductReturns(returns, { 'prod-1': 100, 'prod-2': 10 });

      // prod-2 has higher return rate (10% vs 1%)
      expect(analysis[0].productId).toBe('prod-2');
    });
  });

  describe('analyzePreventableReturns', () => {
    it('should identify preventable returns', () => {
      const returns = [
        createReturnRequest('1', 'defective'), // preventable
        createReturnRequest('2', 'wrong_item'), // preventable
        createReturnRequest('3', 'changed_mind'), // not preventable
      ];

      const analysis = analyzePreventableReturns(returns);

      expect(analysis.preventableCount).toBe(2);
      expect(analysis.preventablePercentage).toBeCloseTo(67, 0);
    });

    it('should group preventable by reason', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000),
        createReturnRequest('2', 'defective', 2000),
        createReturnRequest('3', 'not_as_described', 1500),
      ];

      const analysis = analyzePreventableReturns(returns);

      const defectiveReason = analysis.byReason.find(r => r.reason === 'defective');
      expect(defectiveReason?.count).toBe(2);
      expect(defectiveReason?.value).toBe(3000);
    });

    it('should calculate potential savings', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000),
        createReturnRequest('2', 'wrong_item', 2000),
      ];

      const analysis = analyzePreventableReturns(returns);

      // Potential savings = 50% of preventable value
      expect(analysis.potentialSavings).toBe(1500);
    });
  });

  describe('calculateReturnsTrend', () => {
    it('should group returns by period', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          returnRequestDate: new Date('2024-01-15'),
        }),
        createReturnRequest('2', 'defective', 1000, 'completed', {
          returnRequestDate: new Date('2024-01-20'),
        }),
        createReturnRequest('3', 'defective', 1000, 'completed', {
          returnRequestDate: new Date('2024-02-10'),
        }),
      ];

      const ordersByPeriod = {
        '2024-01': 100,
        '2024-02': 80,
      };

      const trend = calculateReturnsTrend(returns, ordersByPeriod, 'monthly');

      expect(trend.length).toBe(2);
      const jan = trend.find(t => t.period === '2024-01');
      const feb = trend.find(t => t.period === '2024-02');

      expect(jan?.returns).toBe(2);
      expect(feb?.returns).toBe(1);
    });

    it('should calculate return rate per period', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          returnRequestDate: new Date('2024-01-15'),
        }),
      ];

      const ordersByPeriod = { '2024-01': 50 };

      const trend = calculateReturnsTrend(returns, ordersByPeriod, 'monthly');

      expect(trend[0].returnRate).toBe(2); // 1/50 = 2%
    });

    it('should count preventable returns per period', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000, 'completed', {
          returnRequestDate: new Date('2024-01-15'),
        }),
        createReturnRequest('2', 'changed_mind', 1000, 'completed', {
          returnRequestDate: new Date('2024-01-20'),
        }),
      ];

      const ordersByPeriod = { '2024-01': 100 };

      const trend = calculateReturnsTrend(returns, ordersByPeriod, 'monthly');

      expect(trend[0].preventableReturns).toBe(1);
    });
  });

  describe('getReturnsDashboardSummary', () => {
    it('should return overview metrics', () => {
      const returns = [
        createReturnRequest('1', 'defective', 1000),
        createReturnRequest('2', 'wrong_item', 2000),
      ];

      const summary = getReturnsDashboardSummary(returns, 100);

      expect(summary.overview.totalReturns).toBe(2);
      expect(summary.overview.totalRefunded).toBe(3000);
      expect(summary.overview.returnRate).toBe(2);
    });

    it('should generate alerts for high return rate', () => {
      const returns = Array(15).fill(null).map((_, i) =>
        createReturnRequest(`${i}`, 'defective', 1000)
      );

      const summary = getReturnsDashboardSummary(returns, 100);

      // 15% return rate should trigger critical alert
      expect(summary.alerts.some(a => a.type === 'critical')).toBe(true);
    });

    it('should identify top issues', () => {
      const returns = [
        createReturnRequest('1', 'defective'),
        createReturnRequest('2', 'defective'),
        createReturnRequest('3', 'wrong_item'),
      ];

      const summary = getReturnsDashboardSummary(returns, 100);

      expect(summary.topIssues.length).toBeGreaterThan(0);
      expect(summary.topIssues[0].issue).toBe('Defective Product');
      expect(summary.topIssues[0].issueUk).toBe('Бракований товар');
    });

    it('should return KPIs with status', () => {
      const returns = [createReturnRequest('1', 'defective')];

      const summary = getReturnsDashboardSummary(returns, 100);

      expect(summary.kpis.length).toBe(4);
      for (const kpi of summary.kpis) {
        expect(['good', 'warning', 'critical']).toContain(kpi.status);
        expect(kpi.nameUk).toBeDefined();
      }
    });
  });

  describe('formatReturnStatus', () => {
    it('should format all statuses correctly', () => {
      const statuses: ReturnRequest['status'][] = [
        'requested',
        'approved',
        'rejected',
        'shipped_back',
        'received',
        'inspected',
        'refunded',
        'completed',
        'cancelled',
      ];

      for (const status of statuses) {
        const formatted = formatReturnStatus(status);
        expect(formatted.label).toBeDefined();
        expect(formatted.labelUk).toBeDefined();
        expect(formatted.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have Ukrainian translations', () => {
      expect(formatReturnStatus('requested').labelUk).toBe('Запит подано');
      expect(formatReturnStatus('completed').labelUk).toBe('Завершено');
      expect(formatReturnStatus('rejected').labelUk).toBe('Відхилено');
    });
  });
});
