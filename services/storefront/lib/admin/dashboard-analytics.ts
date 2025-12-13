// Admin Dashboard Analytics Service

export interface DashboardStats {
    revenue: RevenueStats;
    orders: OrderStats;
    customers: CustomerStats;
    products: ProductStats;
    realtime: RealtimeStats;
}

export interface RevenueStats {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
    thisYear: number;
    growth: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    chartData: ChartDataPoint[];
}

export interface OrderStats {
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    returned: number;
    averageOrderValue: number;
    conversionRate: number;
    chartData: ChartDataPoint[];
}

export interface CustomerStats {
    total: number;
    new: number;
    returning: number;
    active: number;
    churnRate: number;
    lifetime: number;
    segmentation: CustomerSegment[];
}

export interface CustomerSegment {
    name: string;
    count: number;
    percentage: number;
    revenue: number;
}

export interface ProductStats {
    total: number;
    active: number;
    outOfStock: number;
    lowStock: number;
    topSelling: TopProduct[];
    worstSelling: TopProduct[];
    byCategory: CategoryStats[];
}

export interface TopProduct {
    id: string;
    name: string;
    sold: number;
    revenue: number;
    image?: string;
}

export interface CategoryStats {
    id: string;
    name: string;
    productCount: number;
    soldCount: number;
    revenue: number;
    percentage: number;
}

export interface RealtimeStats {
    activeUsers: number;
    ordersInProgress: number;
    cartValue: number;
    pageViews: number;
}

export interface ChartDataPoint {
    date: string;
    value: number;
    label?: string;
}

export interface DateRange {
    start: Date;
    end: Date;
    preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';
}

export interface SalesReport {
    period: DateRange;
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    topProducts: TopProduct[];
    topCategories: CategoryStats[];
    revenueByDay: ChartDataPoint[];
    ordersByDay: ChartDataPoint[];
    paymentMethods: { method: string; count: number; amount: number }[];
    deliveryMethods: { method: string; count: number; amount: number }[];
}

export interface CustomerReport {
    period: DateRange;
    newCustomers: number;
    returningCustomers: number;
    customerLifetimeValue: number;
    topCustomers: {
        id: string;
        name: string;
        email: string;
        orders: number;
        spent: number;
    }[];
    acquisitionChannels: { channel: string; count: number; percentage: number }[];
    geographicDistribution: { region: string; count: number; percentage: number }[];
}

// Mock data generator
function generateMockChartData(days: number, minValue: number, maxValue: number): ChartDataPoint[] {
    const data: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().split('T')[0],
            value: Math.floor(Math.random() * (maxValue - minValue) + minValue),
        });
    }

    return data;
}

function generateMockDashboardStats(): DashboardStats {
    return {
        revenue: {
            today: 45230,
            yesterday: 38500,
            thisWeek: 285000,
            lastWeek: 265000,
            thisMonth: 1250000,
            lastMonth: 1180000,
            thisYear: 14500000,
            growth: {
                daily: 17.5,
                weekly: 7.5,
                monthly: 5.9,
            },
            chartData: generateMockChartData(30, 30000, 80000),
        },
        orders: {
            total: 1547,
            pending: 23,
            processing: 45,
            shipped: 67,
            delivered: 1380,
            cancelled: 18,
            returned: 14,
            averageOrderValue: 2850,
            conversionRate: 3.2,
            chartData: generateMockChartData(30, 30, 80),
        },
        customers: {
            total: 15420,
            new: 342,
            returning: 15078,
            active: 8500,
            churnRate: 2.3,
            lifetime: 8500,
            segmentation: [
                { name: 'VIP', count: 150, percentage: 1, revenue: 2500000 },
                { name: 'Активні', count: 3500, percentage: 23, revenue: 8500000 },
                { name: 'Звичайні', count: 8000, percentage: 52, revenue: 3200000 },
                { name: 'Нові', count: 2500, percentage: 16, revenue: 500000 },
                { name: 'Неактивні', count: 1270, percentage: 8, revenue: 0 },
            ],
        },
        products: {
            total: 5200,
            active: 4800,
            outOfStock: 120,
            lowStock: 280,
            topSelling: [
                { id: '1', name: 'iPhone 15 Pro', sold: 245, revenue: 8575000 },
                { id: '2', name: 'Samsung Galaxy S24', sold: 189, revenue: 5670000 },
                { id: '3', name: 'MacBook Pro 14', sold: 156, revenue: 7800000 },
                { id: '4', name: 'AirPods Pro 2', sold: 342, revenue: 3078000 },
                { id: '5', name: 'iPad Air', sold: 128, revenue: 3200000 },
            ],
            worstSelling: [
                { id: '101', name: 'USB кабель 1м', sold: 2, revenue: 200 },
                { id: '102', name: 'Чохол для навушників', sold: 3, revenue: 450 },
                { id: '103', name: 'Підставка для телефону', sold: 4, revenue: 600 },
                { id: '104', name: 'Захисна плівка', sold: 5, revenue: 250 },
                { id: '105', name: 'Стилус універсальний', sold: 6, revenue: 900 },
            ],
            byCategory: [
                { id: '1', name: 'Смартфони', productCount: 450, soldCount: 1250, revenue: 45000000, percentage: 35 },
                { id: '2', name: 'Ноутбуки', productCount: 280, soldCount: 420, revenue: 38000000, percentage: 30 },
                { id: '3', name: 'Планшети', productCount: 150, soldCount: 380, revenue: 15000000, percentage: 12 },
                { id: '4', name: 'Аксесуари', productCount: 1200, soldCount: 3500, revenue: 8500000, percentage: 7 },
                { id: '5', name: 'Аудіо', productCount: 380, soldCount: 890, revenue: 12000000, percentage: 9 },
                { id: '6', name: 'Інше', productCount: 2740, soldCount: 1560, revenue: 9000000, percentage: 7 },
            ],
        },
        realtime: {
            activeUsers: 234,
            ordersInProgress: 12,
            cartValue: 156000,
            pageViews: 1250,
        },
    };
}

class DashboardAnalyticsService {
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
    private cacheTimeout = 60000; // 1 minute

    // Get dashboard stats
    async getDashboardStats(): Promise<DashboardStats> {
        const cacheKey = 'dashboard_stats';
        const cached = this.getFromCache<DashboardStats>(cacheKey);
        if (cached) return cached;

        // In production, fetch from API
        const stats = generateMockDashboardStats();
        this.setCache(cacheKey, stats);

        return stats;
    }

    // Get sales report
    async getSalesReport(dateRange: DateRange): Promise<SalesReport> {
        const cacheKey = `sales_report_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        const cached = this.getFromCache<SalesReport>(cacheKey);
        if (cached) return cached;

        const report: SalesReport = {
            period: dateRange,
            totalRevenue: 1250000,
            totalOrders: 485,
            averageOrderValue: 2577,
            topProducts: generateMockDashboardStats().products.topSelling,
            topCategories: generateMockDashboardStats().products.byCategory,
            revenueByDay: generateMockChartData(30, 30000, 80000),
            ordersByDay: generateMockChartData(30, 10, 30),
            paymentMethods: [
                { method: 'Картка онлайн', count: 320, amount: 850000 },
                { method: 'Готівка', count: 95, amount: 250000 },
                { method: 'Оплата частинами', count: 70, amount: 150000 },
            ],
            deliveryMethods: [
                { method: 'Нова Пошта', count: 380, amount: 950000 },
                { method: 'Укрпошта', count: 65, amount: 180000 },
                { method: "Кур'єр", count: 40, amount: 120000 },
            ],
        };

        this.setCache(cacheKey, report);
        return report;
    }

    // Get customer report
    async getCustomerReport(dateRange: DateRange): Promise<CustomerReport> {
        const cacheKey = `customer_report_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        const cached = this.getFromCache<CustomerReport>(cacheKey);
        if (cached) return cached;

        const report: CustomerReport = {
            period: dateRange,
            newCustomers: 342,
            returningCustomers: 1205,
            customerLifetimeValue: 8500,
            topCustomers: [
                { id: '1', name: 'Іван Петренко', email: 'ivan@example.com', orders: 45, spent: 125000 },
                { id: '2', name: 'Олена Коваленко', email: 'olena@example.com', orders: 38, spent: 98000 },
                { id: '3', name: 'Михайло Шевченко', email: 'mykhailo@example.com', orders: 32, spent: 87000 },
            ],
            acquisitionChannels: [
                { channel: 'Органічний пошук', count: 450, percentage: 35 },
                { channel: 'Прямий трафік', count: 320, percentage: 25 },
                { channel: 'Соціальні мережі', count: 256, percentage: 20 },
                { channel: 'Реклама', count: 180, percentage: 14 },
                { channel: 'Реферали', count: 80, percentage: 6 },
            ],
            geographicDistribution: [
                { region: 'Київ', count: 450, percentage: 30 },
                { region: 'Харків', count: 180, percentage: 12 },
                { region: 'Одеса', count: 150, percentage: 10 },
                { region: 'Дніпро', count: 135, percentage: 9 },
                { region: 'Львів', count: 120, percentage: 8 },
                { region: 'Інші', count: 465, percentage: 31 },
            ],
        };

        this.setCache(cacheKey, report);
        return report;
    }

    // Get realtime stats (WebSocket in production)
    async getRealtimeStats(): Promise<RealtimeStats> {
        return {
            activeUsers: Math.floor(Math.random() * 100) + 150,
            ordersInProgress: Math.floor(Math.random() * 10) + 5,
            cartValue: Math.floor(Math.random() * 50000) + 100000,
            pageViews: Math.floor(Math.random() * 500) + 1000,
        };
    }

    // Export report
    exportReport(
        reportType: 'sales' | 'customers' | 'products',
        format: 'csv' | 'xlsx' | 'pdf',
        dateRange: DateRange
    ): string | Blob {
        // In production, generate actual file
        const filename = `${reportType}_report_${dateRange.start.toISOString().split('T')[0]}_${dateRange.end.toISOString().split('T')[0]}.${format}`;

        if (format === 'csv') {
            return `Report: ${reportType}\nPeriod: ${dateRange.start} - ${dateRange.end}\n\n[Data would be here]`;
        }

        return new Blob([`${filename} content`], { type: 'application/octet-stream' });
    }

    // Date range presets
    getDateRangePreset(preset: DateRange['preset']): DateRange {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (preset) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'last7days':
                start.setDate(start.getDate() - 7);
                break;
            case 'last30days':
                start.setDate(start.getDate() - 30);
                break;
            case 'thisMonth':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'lastMonth':
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'thisYear':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                start.setDate(start.getDate() - 30);
        }

        return { start, end, preset };
    }

    // Compare periods
    comparePeriods(
        current: ChartDataPoint[],
        previous: ChartDataPoint[]
    ): { change: number; percentage: number; trend: 'up' | 'down' | 'stable' } {
        const currentSum = current.reduce((sum, point) => sum + point.value, 0);
        const previousSum = previous.reduce((sum, point) => sum + point.value, 0);

        const change = currentSum - previousSum;
        const percentage = previousSum > 0 ? (change / previousSum) * 100 : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (percentage > 1) trend = 'up';
        else if (percentage < -1) trend = 'down';

        return { change, percentage: Math.round(percentage * 10) / 10, trend };
    }

    // Cache methods
    private getFromCache<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data as T;
        }
        return null;
    }

    private setCache(key: string, data: unknown): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton instance
export const dashboardAnalytics = new DashboardAnalyticsService();

// React hook
export function useDashboardAnalytics() {
    return dashboardAnalytics;
}
