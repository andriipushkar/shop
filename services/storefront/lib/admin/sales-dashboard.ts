/**
 * Sales Dashboard System
 * Analytics, KPIs, graphs, and performance metrics for admin
 */

// ==================== TYPES ====================

export interface SalesDashboardData {
  overview: SalesOverview;
  charts: ChartData[];
  topProducts: TopProduct[];
  topCategories: TopCategory[];
  recentOrders: RecentOrder[];
  customerMetrics: CustomerMetrics;
  conversionFunnel: ConversionFunnel;
  periodComparison: PeriodComparison;
}

export interface SalesOverview {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  conversionRate: number;
  cartAbandonmentRate: number;
  refundRate: number;
  totalRefunds: number;
}

export interface ChartData {
  id: string;
  type: ChartType;
  title: string;
  data: ChartDataPoint[];
  period: DatePeriod;
  comparison?: ChartDataPoint[];
}

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'donut';

export interface ChartDataPoint {
  label: string;
  value: number;
  date?: Date;
  metadata?: Record<string, unknown>;
}

export interface TopProduct {
  id: string;
  name: string;
  image: string;
  category: string;
  revenue: number;
  quantity: number;
  averagePrice: number;
  trend: TrendDirection;
  trendPercent: number;
}

export interface TopCategory {
  id: string;
  name: string;
  revenue: number;
  orderCount: number;
  productCount: number;
  trend: TrendDirection;
  trendPercent: number;
  percentOfTotal: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: OrderStatus;
  itemCount: number;
  createdAt: Date;
  paymentMethod: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisPeriod: number;
  customerLifetimeValue: number;
  averagePurchaseFrequency: number;
  churnRate: number;
  retentionRate: number;
  customerSatisfactionScore: number;
  nps: number; // Net Promoter Score
}

export interface ConversionFunnel {
  visitors: number;
  productViews: number;
  addToCart: number;
  checkout: number;
  purchase: number;
  rates: {
    viewToCart: number;
    cartToCheckout: number;
    checkoutToPurchase: number;
    overallConversion: number;
  };
}

export interface PeriodComparison {
  currentPeriod: PeriodMetrics;
  previousPeriod: PeriodMetrics;
  changes: {
    revenue: ChangeMetric;
    orders: ChangeMetric;
    averageOrderValue: ChangeMetric;
    customers: ChangeMetric;
    conversionRate: ChangeMetric;
  };
}

export interface PeriodMetrics {
  startDate: Date;
  endDate: Date;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  customers: number;
  conversionRate: number;
}

export interface ChangeMetric {
  absolute: number;
  percent: number;
  trend: TrendDirection;
}

export type TrendDirection = 'up' | 'down' | 'stable';

export type DatePeriod = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardFilters {
  period: DatePeriod;
  dateRange?: DateRange;
  categoryId?: string;
  productIds?: string[];
  customerSegment?: string;
  paymentMethod?: string;
  region?: string;
}

// KPI Types
export interface KPI {
  id: string;
  name: string;
  nameUk: string;
  value: number;
  formattedValue: string;
  target?: number;
  trend: TrendDirection;
  trendPercent: number;
  unit: KPIUnit;
  description?: string;
}

export type KPIUnit = 'currency' | 'percent' | 'number' | 'ratio';

// ==================== CONSTANTS ====================

export const DATE_PERIOD_LABELS: Record<DatePeriod, { en: string; uk: string }> = {
  today: { en: 'Today', uk: 'Сьогодні' },
  yesterday: { en: 'Yesterday', uk: 'Вчора' },
  week: { en: 'This Week', uk: 'Цей тиждень' },
  month: { en: 'This Month', uk: 'Цей місяць' },
  quarter: { en: 'This Quarter', uk: 'Цей квартал' },
  year: { en: 'This Year', uk: 'Цей рік' },
  custom: { en: 'Custom', uk: 'Довільний' },
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, { en: string; uk: string; color: string }> = {
  pending: { en: 'Pending', uk: 'Очікує', color: '#f59e0b' },
  confirmed: { en: 'Confirmed', uk: 'Підтверджено', color: '#3b82f6' },
  processing: { en: 'Processing', uk: 'Обробляється', color: '#8b5cf6' },
  shipped: { en: 'Shipped', uk: 'Відправлено', color: '#06b6d4' },
  delivered: { en: 'Delivered', uk: 'Доставлено', color: '#10b981' },
  cancelled: { en: 'Cancelled', uk: 'Скасовано', color: '#ef4444' },
  refunded: { en: 'Refunded', uk: 'Повернено', color: '#6b7280' },
};

export const DEFAULT_KPIS: Omit<KPI, 'value' | 'formattedValue' | 'trend' | 'trendPercent'>[] = [
  {
    id: 'total_revenue',
    name: 'Total Revenue',
    nameUk: 'Загальний дохід',
    unit: 'currency',
    description: 'Total revenue for the selected period',
  },
  {
    id: 'total_orders',
    name: 'Total Orders',
    nameUk: 'Всього замовлень',
    unit: 'number',
    description: 'Number of orders in the selected period',
  },
  {
    id: 'average_order_value',
    name: 'Average Order Value',
    nameUk: 'Середній чек',
    unit: 'currency',
    description: 'Average value of orders',
  },
  {
    id: 'conversion_rate',
    name: 'Conversion Rate',
    nameUk: 'Конверсія',
    unit: 'percent',
    description: 'Percentage of visitors who made a purchase',
  },
  {
    id: 'cart_abandonment',
    name: 'Cart Abandonment',
    nameUk: 'Покинуті кошики',
    unit: 'percent',
    description: 'Percentage of carts abandoned before checkout',
  },
  {
    id: 'customer_lifetime_value',
    name: 'Customer LTV',
    nameUk: 'LTV клієнта',
    unit: 'currency',
    description: 'Average lifetime value of a customer',
  },
  {
    id: 'new_customers',
    name: 'New Customers',
    nameUk: 'Нові клієнти',
    unit: 'number',
    description: 'Number of first-time customers',
  },
  {
    id: 'returning_customers',
    name: 'Returning Customers',
    nameUk: 'Повторні покупці',
    unit: 'percent',
    description: 'Percentage of returning customers',
  },
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate date range for a given period
 */
export function getDateRangeForPeriod(period: DatePeriod, customRange?: DateRange): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return {
        startDate: today,
        endDate: now,
      };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: today,
      };
    }

    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      return {
        startDate: weekStart,
        endDate: now,
      };
    }

    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: monthStart,
        endDate: now,
      };
    }

    case 'quarter': {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      const quarterStart = new Date(today.getFullYear(), quarterMonth, 1);
      return {
        startDate: quarterStart,
        endDate: now,
      };
    }

    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: yearStart,
        endDate: now,
      };
    }

    case 'custom':
      if (customRange) {
        return customRange;
      }
      // Default to last 30 days if no custom range
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        startDate: thirtyDaysAgo,
        endDate: now,
      };

    default:
      return {
        startDate: today,
        endDate: now,
      };
  }
}

/**
 * Get comparison period (same length, immediately before)
 */
export function getComparisonPeriod(dateRange: DateRange): DateRange {
  const periodLength = dateRange.endDate.getTime() - dateRange.startDate.getTime();

  return {
    startDate: new Date(dateRange.startDate.getTime() - periodLength),
    endDate: new Date(dateRange.startDate.getTime()),
  };
}

/**
 * Calculate trend direction based on change
 */
export function calculateTrend(current: number, previous: number): TrendDirection {
  if (current > previous * 1.01) return 'up';
  if (current < previous * 0.99) return 'down';
  return 'stable';
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format currency for Ukrainian hryvnia
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with abbreviation
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('uk-UA');
}

/**
 * Format KPI value based on unit
 */
export function formatKPIValue(value: number, unit: KPIUnit): string {
  switch (unit) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'number':
      return formatNumber(value);
    case 'ratio':
      return value.toFixed(2);
    default:
      return value.toString();
  }
}

/**
 * Calculate conversion funnel rates
 */
export function calculateFunnelRates(funnel: Omit<ConversionFunnel, 'rates'>): ConversionFunnel {
  const viewToCart = funnel.productViews > 0
    ? (funnel.addToCart / funnel.productViews) * 100
    : 0;

  const cartToCheckout = funnel.addToCart > 0
    ? (funnel.checkout / funnel.addToCart) * 100
    : 0;

  const checkoutToPurchase = funnel.checkout > 0
    ? (funnel.purchase / funnel.checkout) * 100
    : 0;

  const overallConversion = funnel.visitors > 0
    ? (funnel.purchase / funnel.visitors) * 100
    : 0;

  return {
    ...funnel,
    rates: {
      viewToCart,
      cartToCheckout,
      checkoutToPurchase,
      overallConversion,
    },
  };
}

/**
 * Calculate period comparison metrics
 */
export function calculatePeriodComparison(
  current: PeriodMetrics,
  previous: PeriodMetrics
): PeriodComparison {
  const calculateChange = (curr: number, prev: number): ChangeMetric => ({
    absolute: curr - prev,
    percent: calculatePercentChange(curr, prev),
    trend: calculateTrend(curr, prev),
  });

  return {
    currentPeriod: current,
    previousPeriod: previous,
    changes: {
      revenue: calculateChange(current.revenue, previous.revenue),
      orders: calculateChange(current.orders, previous.orders),
      averageOrderValue: calculateChange(current.averageOrderValue, previous.averageOrderValue),
      customers: calculateChange(current.customers, previous.customers),
      conversionRate: calculateChange(current.conversionRate, previous.conversionRate),
    },
  };
}

/**
 * Generate chart data for revenue over time
 */
export function generateRevenueChartData(
  orders: { total: number; createdAt: Date }[],
  period: DatePeriod
): ChartDataPoint[] {
  const dateRange = getDateRangeForPeriod(period);
  const dataPoints: Map<string, number> = new Map();

  // Determine grouping granularity based on period
  const getGroupKey = (date: Date): string => {
    switch (period) {
      case 'today':
      case 'yesterday':
        return `${date.getHours()}:00`;
      case 'week':
        return date.toLocaleDateString('uk-UA', { weekday: 'short' });
      case 'month':
        return date.getDate().toString();
      case 'quarter':
      case 'year':
        return date.toLocaleDateString('uk-UA', { month: 'short' });
      default:
        return date.toLocaleDateString('uk-UA');
    }
  };

  // Initialize all time slots with 0
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const key = getGroupKey(currentDate);
    if (!dataPoints.has(key)) {
      dataPoints.set(key, 0);
    }

    switch (period) {
      case 'today':
      case 'yesterday':
        currentDate.setHours(currentDate.getHours() + 1);
        break;
      case 'week':
      case 'month':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  // Aggregate order data
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    if (orderDate >= dateRange.startDate && orderDate <= dateRange.endDate) {
      const key = getGroupKey(orderDate);
      const existing = dataPoints.get(key) || 0;
      dataPoints.set(key, existing + order.total);
    }
  });

  return Array.from(dataPoints.entries()).map(([label, value]) => ({
    label,
    value,
  }));
}

/**
 * Calculate top products by revenue
 */
export function calculateTopProducts(
  orderItems: {
    productId: string;
    productName: string;
    productImage: string;
    categoryName: string;
    price: number;
    quantity: number;
  }[],
  previousPeriodItems?: typeof orderItems,
  limit: number = 10
): TopProduct[] {
  const productMap = new Map<string, {
    name: string;
    image: string;
    category: string;
    revenue: number;
    quantity: number;
  }>();

  // Aggregate current period
  orderItems.forEach(item => {
    const existing = productMap.get(item.productId);
    if (existing) {
      existing.revenue += item.price * item.quantity;
      existing.quantity += item.quantity;
    } else {
      productMap.set(item.productId, {
        name: item.productName,
        image: item.productImage,
        category: item.categoryName,
        revenue: item.price * item.quantity,
        quantity: item.quantity,
      });
    }
  });

  // Calculate previous period for comparison
  const previousMap = new Map<string, number>();
  if (previousPeriodItems) {
    previousPeriodItems.forEach(item => {
      const existing = previousMap.get(item.productId) || 0;
      previousMap.set(item.productId, existing + item.price * item.quantity);
    });
  }

  // Convert to array and sort
  const products: TopProduct[] = Array.from(productMap.entries())
    .map(([id, data]) => {
      const previousRevenue = previousMap.get(id) || 0;
      const trendPercent = calculatePercentChange(data.revenue, previousRevenue);

      return {
        id,
        name: data.name,
        image: data.image,
        category: data.category,
        revenue: data.revenue,
        quantity: data.quantity,
        averagePrice: data.revenue / data.quantity,
        trend: calculateTrend(data.revenue, previousRevenue),
        trendPercent,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return products;
}

/**
 * Calculate category performance
 */
export function calculateCategoryPerformance(
  orderItems: {
    categoryId: string;
    categoryName: string;
    price: number;
    quantity: number;
  }[],
  previousPeriodItems?: typeof orderItems
): TopCategory[] {
  const categoryMap = new Map<string, {
    name: string;
    revenue: number;
    orderCount: Set<string>;
    productCount: Set<string>;
  }>();

  let totalRevenue = 0;

  orderItems.forEach(item => {
    totalRevenue += item.price * item.quantity;

    const existing = categoryMap.get(item.categoryId);
    if (existing) {
      existing.revenue += item.price * item.quantity;
    } else {
      categoryMap.set(item.categoryId, {
        name: item.categoryName,
        revenue: item.price * item.quantity,
        orderCount: new Set(),
        productCount: new Set(),
      });
    }
  });

  // Calculate previous period
  const previousMap = new Map<string, number>();
  if (previousPeriodItems) {
    previousPeriodItems.forEach(item => {
      const existing = previousMap.get(item.categoryId) || 0;
      previousMap.set(item.categoryId, existing + item.price * item.quantity);
    });
  }

  return Array.from(categoryMap.entries())
    .map(([id, data]) => {
      const previousRevenue = previousMap.get(id) || 0;
      const trendPercent = calculatePercentChange(data.revenue, previousRevenue);

      return {
        id,
        name: data.name,
        revenue: data.revenue,
        orderCount: data.orderCount.size,
        productCount: data.productCount.size,
        trend: calculateTrend(data.revenue, previousRevenue),
        trendPercent,
        percentOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch dashboard data
 */
export async function fetchDashboardData(filters: DashboardFilters): Promise<SalesDashboardData> {
  const params = new URLSearchParams();
  params.set('period', filters.period);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.customerSegment) params.set('customerSegment', filters.customerSegment);
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
  if (filters.region) params.set('region', filters.region);

  const response = await fetch(`/api/admin/dashboard?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return response.json();
}

/**
 * Fetch sales overview
 */
export async function fetchSalesOverview(filters: DashboardFilters): Promise<SalesOverview> {
  const params = new URLSearchParams();
  params.set('period', filters.period);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/overview?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch sales overview');
  }

  return response.json();
}

/**
 * Fetch chart data
 */
export async function fetchChartData(
  chartId: string,
  filters: DashboardFilters
): Promise<ChartData> {
  const params = new URLSearchParams();
  params.set('chartId', chartId);
  params.set('period', filters.period);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/charts?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch chart data');
  }

  return response.json();
}

/**
 * Fetch top products
 */
export async function fetchTopProducts(
  filters: DashboardFilters,
  limit: number = 10
): Promise<TopProduct[]> {
  const params = new URLSearchParams();
  params.set('period', filters.period);
  params.set('limit', limit.toString());

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/top-products?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch top products');
  }

  return response.json();
}

/**
 * Fetch recent orders
 */
export async function fetchRecentOrders(limit: number = 10): Promise<RecentOrder[]> {
  const response = await fetch(`/api/admin/dashboard/recent-orders?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to fetch recent orders');
  }

  return response.json();
}

/**
 * Fetch customer metrics
 */
export async function fetchCustomerMetrics(filters: DashboardFilters): Promise<CustomerMetrics> {
  const params = new URLSearchParams();
  params.set('period', filters.period);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/customer-metrics?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer metrics');
  }

  return response.json();
}

/**
 * Fetch conversion funnel
 */
export async function fetchConversionFunnel(filters: DashboardFilters): Promise<ConversionFunnel> {
  const params = new URLSearchParams();
  params.set('period', filters.period);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/funnel?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch conversion funnel');
  }

  return response.json();
}

/**
 * Export dashboard data
 */
export async function exportDashboardData(
  filters: DashboardFilters,
  format: 'pdf' | 'excel' | 'csv'
): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('period', filters.period);
  params.set('format', format);

  if (filters.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }

  const response = await fetch(`/api/admin/dashboard/export?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to export dashboard data');
  }

  return response.blob();
}

/**
 * Calculate KPIs from dashboard data
 */
export function calculateKPIs(
  overview: SalesOverview,
  previousOverview?: SalesOverview
): KPI[] {
  const kpis: KPI[] = [];

  // Total Revenue
  kpis.push({
    id: 'total_revenue',
    name: 'Total Revenue',
    nameUk: 'Загальний дохід',
    value: overview.totalRevenue,
    formattedValue: formatCurrency(overview.totalRevenue),
    target: previousOverview ? previousOverview.totalRevenue * 1.1 : undefined,
    trend: previousOverview
      ? calculateTrend(overview.totalRevenue, previousOverview.totalRevenue)
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.totalRevenue, previousOverview.totalRevenue)
      : 0,
    unit: 'currency',
  });

  // Total Orders
  kpis.push({
    id: 'total_orders',
    name: 'Total Orders',
    nameUk: 'Всього замовлень',
    value: overview.totalOrders,
    formattedValue: formatNumber(overview.totalOrders),
    trend: previousOverview
      ? calculateTrend(overview.totalOrders, previousOverview.totalOrders)
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.totalOrders, previousOverview.totalOrders)
      : 0,
    unit: 'number',
  });

  // Average Order Value
  kpis.push({
    id: 'average_order_value',
    name: 'Average Order Value',
    nameUk: 'Середній чек',
    value: overview.averageOrderValue,
    formattedValue: formatCurrency(overview.averageOrderValue),
    trend: previousOverview
      ? calculateTrend(overview.averageOrderValue, previousOverview.averageOrderValue)
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.averageOrderValue, previousOverview.averageOrderValue)
      : 0,
    unit: 'currency',
  });

  // Conversion Rate
  kpis.push({
    id: 'conversion_rate',
    name: 'Conversion Rate',
    nameUk: 'Конверсія',
    value: overview.conversionRate,
    formattedValue: formatPercent(overview.conversionRate),
    trend: previousOverview
      ? calculateTrend(overview.conversionRate, previousOverview.conversionRate)
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.conversionRate, previousOverview.conversionRate)
      : 0,
    unit: 'percent',
  });

  // New Customers
  kpis.push({
    id: 'new_customers',
    name: 'New Customers',
    nameUk: 'Нові клієнти',
    value: overview.newCustomers,
    formattedValue: formatNumber(overview.newCustomers),
    trend: previousOverview
      ? calculateTrend(overview.newCustomers, previousOverview.newCustomers)
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.newCustomers, previousOverview.newCustomers)
      : 0,
    unit: 'number',
  });

  // Cart Abandonment Rate (lower is better, so reverse trend)
  kpis.push({
    id: 'cart_abandonment',
    name: 'Cart Abandonment',
    nameUk: 'Покинуті кошики',
    value: overview.cartAbandonmentRate,
    formattedValue: formatPercent(overview.cartAbandonmentRate),
    trend: previousOverview
      ? calculateTrend(previousOverview.cartAbandonmentRate, overview.cartAbandonmentRate) // Reversed!
      : 'stable',
    trendPercent: previousOverview
      ? calculatePercentChange(overview.cartAbandonmentRate, previousOverview.cartAbandonmentRate)
      : 0,
    unit: 'percent',
  });

  return kpis;
}
