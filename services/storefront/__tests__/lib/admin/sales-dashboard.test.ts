/**
 * Tests for Sales Dashboard System
 */

import {
  getDateRangeForPeriod,
  getComparisonPeriod,
  calculateTrend,
  calculatePercentChange,
  formatCurrency,
  formatPercent,
  formatNumber,
  formatKPIValue,
  calculateFunnelRates,
  calculatePeriodComparison,
  generateRevenueChartData,
  calculateTopProducts,
  calculateKPIs,
  DatePeriod,
  SalesOverview,
  ConversionFunnel,
  PeriodMetrics,
} from '../../../lib/admin/sales-dashboard';

describe('Sales Dashboard System', () => {
  describe('getDateRangeForPeriod', () => {
    it('should return today date range', () => {
      const range = getDateRangeForPeriod('today');
      const today = new Date();

      expect(range.startDate.toDateString()).toBe(today.toDateString());
      expect(range.endDate.toDateString()).toBe(today.toDateString());
    });

    it('should return yesterday date range', () => {
      const range = getDateRangeForPeriod('yesterday');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(range.startDate.toDateString()).toBe(yesterday.toDateString());
    });

    it('should return week date range starting Monday', () => {
      const range = getDateRangeForPeriod('week');

      // Should be Monday of current week
      expect(range.startDate.getDay()).toBe(1); // Monday
    });

    it('should return month date range', () => {
      const range = getDateRangeForPeriod('month');
      const today = new Date();

      expect(range.startDate.getDate()).toBe(1);
      expect(range.startDate.getMonth()).toBe(today.getMonth());
    });

    it('should return quarter date range', () => {
      const range = getDateRangeForPeriod('quarter');
      const today = new Date();
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;

      expect(range.startDate.getMonth()).toBe(quarterMonth);
      expect(range.startDate.getDate()).toBe(1);
    });

    it('should return year date range', () => {
      const range = getDateRangeForPeriod('year');
      const today = new Date();

      expect(range.startDate.getMonth()).toBe(0); // January
      expect(range.startDate.getDate()).toBe(1);
      expect(range.startDate.getFullYear()).toBe(today.getFullYear());
    });

    it('should use custom range when provided', () => {
      const customRange = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
      };

      const range = getDateRangeForPeriod('custom', customRange);

      expect(range.startDate).toEqual(customRange.startDate);
      expect(range.endDate).toEqual(customRange.endDate);
    });
  });

  describe('getComparisonPeriod', () => {
    it('should return period of same length before', () => {
      const dateRange = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-22'), // 7 days
      };

      const comparison = getComparisonPeriod(dateRange);

      // Should be 7 days before
      expect(comparison.endDate.toDateString()).toBe(dateRange.startDate.toDateString());
    });

    it('should maintain same period length', () => {
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const comparison = getComparisonPeriod(dateRange);
      const originalLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();
      const comparisonLength = comparison.endDate.getTime() - comparison.startDate.getTime();

      expect(comparisonLength).toBe(originalLength);
    });
  });

  describe('calculateTrend', () => {
    it('should return up for increase', () => {
      expect(calculateTrend(110, 100)).toBe('up');
    });

    it('should return down for decrease', () => {
      expect(calculateTrend(90, 100)).toBe('down');
    });

    it('should return stable for small change', () => {
      expect(calculateTrend(100.5, 100)).toBe('stable');
    });

    it('should handle zero previous value', () => {
      expect(calculateTrend(100, 0)).toBe('up');
    });
  });

  describe('calculatePercentChange', () => {
    it('should calculate positive change', () => {
      expect(calculatePercentChange(120, 100)).toBe(20);
    });

    it('should calculate negative change', () => {
      expect(calculatePercentChange(80, 100)).toBe(-20);
    });

    it('should handle zero previous value', () => {
      expect(calculatePercentChange(100, 0)).toBe(100);
    });

    it('should return 0 for same values', () => {
      expect(calculatePercentChange(100, 100)).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format with UAH currency', () => {
      const formatted = formatCurrency(1000);

      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
      expect(formatted).toContain('₴');
    });

    it('should format large numbers', () => {
      const formatted = formatCurrency(1000000);

      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
      expect(formatted).toContain('000');
    });

    it('should handle zero', () => {
      const formatted = formatCurrency(0);

      expect(formatted).toContain('0');
    });
  });

  describe('formatPercent', () => {
    it('should format with percent sign', () => {
      const formatted = formatPercent(25.5);

      expect(formatted).toContain('25.5');
      expect(formatted).toContain('%');
    });

    it('should respect decimals parameter', () => {
      const formatted = formatPercent(25.567, 2);

      expect(formatted).toBe('25.57%');
    });

    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });
  });

  describe('formatNumber', () => {
    it('should abbreviate millions', () => {
      const formatted = formatNumber(1500000);

      expect(formatted).toBe('1.5M');
    });

    it('should abbreviate thousands', () => {
      const formatted = formatNumber(1500);

      expect(formatted).toBe('1.5K');
    });

    it('should not abbreviate small numbers', () => {
      const formatted = formatNumber(999);

      expect(formatted).not.toContain('K');
    });
  });

  describe('formatKPIValue', () => {
    it('should format currency KPI', () => {
      const formatted = formatKPIValue(1000, 'currency');

      expect(formatted).toContain('₴');
    });

    it('should format percent KPI', () => {
      const formatted = formatKPIValue(25.5, 'percent');

      expect(formatted).toContain('%');
    });

    it('should format number KPI', () => {
      const formatted = formatKPIValue(1500, 'number');

      expect(formatted).toContain('1');
    });

    it('should format ratio KPI', () => {
      const formatted = formatKPIValue(1.5, 'ratio');

      expect(formatted).toBe('1.50');
    });
  });

  describe('calculateFunnelRates', () => {
    it('should calculate funnel rates correctly', () => {
      const funnel: Omit<ConversionFunnel, 'rates'> = {
        visitors: 10000,
        productViews: 5000,
        addToCart: 1000,
        checkout: 500,
        purchase: 200,
      };

      const result = calculateFunnelRates(funnel);

      expect(result.rates.viewToCart).toBe(20); // 1000/5000 = 20%
      expect(result.rates.cartToCheckout).toBe(50); // 500/1000 = 50%
      expect(result.rates.checkoutToPurchase).toBe(40); // 200/500 = 40%
      expect(result.rates.overallConversion).toBe(2); // 200/10000 = 2%
    });

    it('should handle zero values', () => {
      const funnel: Omit<ConversionFunnel, 'rates'> = {
        visitors: 0,
        productViews: 0,
        addToCart: 0,
        checkout: 0,
        purchase: 0,
      };

      const result = calculateFunnelRates(funnel);

      expect(result.rates.overallConversion).toBe(0);
    });
  });

  describe('calculatePeriodComparison', () => {
    it('should calculate all change metrics', () => {
      const current: PeriodMetrics = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        revenue: 120000,
        orders: 120,
        averageOrderValue: 1000,
        customers: 100,
        conversionRate: 2.5,
      };

      const previous: PeriodMetrics = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        revenue: 100000,
        orders: 100,
        averageOrderValue: 1000,
        customers: 90,
        conversionRate: 2.0,
      };

      const comparison = calculatePeriodComparison(current, previous);

      expect(comparison.changes.revenue.percent).toBe(20);
      expect(comparison.changes.revenue.trend).toBe('up');
      expect(comparison.changes.orders.percent).toBe(20);
      expect(comparison.changes.customers.trend).toBe('up');
    });

    it('should handle negative changes', () => {
      const current: PeriodMetrics = {
        startDate: new Date(),
        endDate: new Date(),
        revenue: 80000,
        orders: 80,
        averageOrderValue: 1000,
        customers: 70,
        conversionRate: 1.5,
      };

      const previous: PeriodMetrics = {
        startDate: new Date(),
        endDate: new Date(),
        revenue: 100000,
        orders: 100,
        averageOrderValue: 1000,
        customers: 90,
        conversionRate: 2.0,
      };

      const comparison = calculatePeriodComparison(current, previous);

      expect(comparison.changes.revenue.percent).toBe(-20);
      expect(comparison.changes.revenue.trend).toBe('down');
    });
  });

  describe('generateRevenueChartData', () => {
    it('should generate chart data for orders', () => {
      const orders = [
        { total: 1000, createdAt: new Date() },
        { total: 1500, createdAt: new Date() },
      ];

      const chartData = generateRevenueChartData(orders, 'today');

      expect(chartData.length).toBeGreaterThan(0);
    });

    it('should aggregate orders by time period', () => {
      const now = new Date();
      const orders = [
        { total: 1000, createdAt: now },
        { total: 500, createdAt: now },
      ];

      const chartData = generateRevenueChartData(orders, 'today');

      // Find the data point for current hour
      const currentHourLabel = `${now.getHours()}:00`;
      const dataPoint = chartData.find(d => d.label === currentHourLabel);

      if (dataPoint) {
        expect(dataPoint.value).toBe(1500); // Sum of both orders
      }
    });

    it('should handle empty orders', () => {
      const chartData = generateRevenueChartData([], 'today');

      expect(chartData.length).toBeGreaterThan(0); // Should have time slots even without orders
      chartData.forEach(point => {
        expect(point.value).toBe(0);
      });
    });
  });

  describe('calculateTopProducts', () => {
    it('should rank products by revenue', () => {
      const orderItems = [
        { productId: 'p1', productName: 'Product 1', productImage: '', categoryName: 'Cat 1', price: 100, quantity: 10 },
        { productId: 'p2', productName: 'Product 2', productImage: '', categoryName: 'Cat 1', price: 200, quantity: 3 },
        { productId: 'p3', productName: 'Product 3', productImage: '', categoryName: 'Cat 2', price: 50, quantity: 20 },
      ];

      const topProducts = calculateTopProducts(orderItems);

      // p1: 100 * 10 = 1000, p2: 200 * 3 = 600, p3: 50 * 20 = 1000
      // p1 and p3 have same revenue, order depends on iteration
      expect(topProducts[0].id).toBe('p1');
      expect(topProducts[0].revenue).toBe(1000);
    });

    it('should respect limit parameter', () => {
      const orderItems = Array.from({ length: 20 }, (_, i) => ({
        productId: `p${i}`,
        productName: `Product ${i}`,
        productImage: '',
        categoryName: 'Cat',
        price: 100,
        quantity: 1,
      }));

      const topProducts = calculateTopProducts(orderItems, undefined, 5);

      expect(topProducts.length).toBe(5);
    });

    it('should calculate trend from previous period', () => {
      const currentItems = [
        { productId: 'p1', productName: 'Product 1', productImage: '', categoryName: 'Cat', price: 100, quantity: 10 },
      ];

      const previousItems = [
        { productId: 'p1', productName: 'Product 1', productImage: '', categoryName: 'Cat', price: 100, quantity: 5 },
      ];

      const topProducts = calculateTopProducts(currentItems, previousItems);

      expect(topProducts[0].trend).toBe('up');
      expect(topProducts[0].trendPercent).toBe(100); // Doubled
    });
  });

  describe('calculateKPIs', () => {
    it('should calculate all KPIs from overview', () => {
      const overview: SalesOverview = {
        totalRevenue: 100000,
        totalOrders: 100,
        averageOrderValue: 1000,
        totalCustomers: 80,
        newCustomers: 20,
        returningCustomers: 60,
        conversionRate: 2.5,
        cartAbandonmentRate: 70,
        refundRate: 2,
        totalRefunds: 2000,
      };

      const kpis = calculateKPIs(overview);

      expect(kpis.length).toBeGreaterThan(0);

      const revenueKPI = kpis.find(k => k.id === 'total_revenue');
      expect(revenueKPI).toBeDefined();
      expect(revenueKPI?.value).toBe(100000);

      const ordersKPI = kpis.find(k => k.id === 'total_orders');
      expect(ordersKPI).toBeDefined();
      expect(ordersKPI?.value).toBe(100);
    });

    it('should calculate trends when previous overview provided', () => {
      const overview: SalesOverview = {
        totalRevenue: 120000,
        totalOrders: 120,
        averageOrderValue: 1000,
        totalCustomers: 100,
        newCustomers: 25,
        returningCustomers: 75,
        conversionRate: 3.0,
        cartAbandonmentRate: 65,
        refundRate: 1.5,
        totalRefunds: 1800,
      };

      const previousOverview: SalesOverview = {
        totalRevenue: 100000,
        totalOrders: 100,
        averageOrderValue: 1000,
        totalCustomers: 80,
        newCustomers: 20,
        returningCustomers: 60,
        conversionRate: 2.5,
        cartAbandonmentRate: 70,
        refundRate: 2,
        totalRefunds: 2000,
      };

      const kpis = calculateKPIs(overview, previousOverview);

      const revenueKPI = kpis.find(k => k.id === 'total_revenue');
      expect(revenueKPI?.trend).toBe('up');
      expect(revenueKPI?.trendPercent).toBe(20);
    });

    it('should have all required KPI properties', () => {
      const overview: SalesOverview = {
        totalRevenue: 100000,
        totalOrders: 100,
        averageOrderValue: 1000,
        totalCustomers: 80,
        newCustomers: 20,
        returningCustomers: 60,
        conversionRate: 2.5,
        cartAbandonmentRate: 70,
        refundRate: 2,
        totalRefunds: 2000,
      };

      const kpis = calculateKPIs(overview);

      kpis.forEach(kpi => {
        expect(kpi.id).toBeTruthy();
        expect(kpi.name).toBeTruthy();
        expect(kpi.nameUk).toBeTruthy();
        expect(typeof kpi.value).toBe('number');
        expect(kpi.formattedValue).toBeTruthy();
        expect(['up', 'down', 'stable']).toContain(kpi.trend);
        expect(typeof kpi.trendPercent).toBe('number');
        expect(['currency', 'percent', 'number', 'ratio']).toContain(kpi.unit);
      });
    });
  });
});
