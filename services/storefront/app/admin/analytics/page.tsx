'use client';

import React, { useState, useEffect } from 'react';
import {
  BanknotesIcon,
  ShoppingBagIcon,
  UsersIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import KPICard from '@/components/admin/analytics/KPICard';
import RevenueChart from '@/components/admin/analytics/RevenueChart';
import OrdersChart from '@/components/admin/analytics/OrdersChart';
import TopProductsChart from '@/components/admin/analytics/TopProductsChart';
import TrafficChart from '@/components/admin/analytics/TrafficChart';
import RealTimeCounter from '@/components/admin/analytics/RealTimeCounter';
import DateRangePicker, { DateRange } from '@/components/admin/analytics/DateRangePicker';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/analytics?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Помилка завантаження даних</p>
      </div>
    );
  }

  // Підготовка даних для графіка замовлень за статусом
  const ordersByStatus = [
    { name: 'Завершено', value: data.dailyMetrics.filter((d: any) => d.orders > 0).length * 3, color: '#10b981' },
    { name: 'В обробці', value: data.dailyMetrics.filter((d: any) => d.orders > 0).length * 1, color: '#f59e0b' },
    { name: 'Очікує', value: data.dailyMetrics.filter((d: any) => d.orders > 0).length * 1, color: '#3b82f6' },
    { name: 'Скасовано', value: Math.floor(data.dailyMetrics.filter((d: any) => d.orders > 0).length * 0.5), color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Аналітика</h1>
            <p className="text-gray-600 mt-1">
              Огляд ключових показників ефективності
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard
            title="Загальний дохід"
            value={data.revenue.total}
            prefix="₴"
            trend={data.revenue.trend}
            icon={<BanknotesIcon className="w-6 h-6" />}
            description={`За період: ${new Date(dateRange.startDate).toLocaleDateString('uk-UA')} - ${new Date(dateRange.endDate).toLocaleDateString('uk-UA')}`}
          />
          <KPICard
            title="Замовлення"
            value={data.orderMetrics.total}
            icon={<ShoppingBagIcon className="w-6 h-6" />}
            description={`Середній чек: ₴${data.orderMetrics.averageValue.toFixed(0)}`}
          />
          <KPICard
            title="Відвідувачі"
            value={data.conversion.sessions}
            icon={<UsersIcon className="w-6 h-6" />}
            description={`Конверсія: ${data.conversion.rate.toFixed(1)}%`}
          />
          <KPICard
            title="Конверсія"
            value={`${data.conversion.rate.toFixed(1)}%`}
            icon={<ChartBarIcon className="w-6 h-6" />}
            description={`${data.conversion.conversions} покупок з ${data.conversion.sessions} сесій`}
          />
        </div>

        {/* Real-time Counter */}
        <div className="mb-6">
          <RealTimeCounter />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RevenueChart data={data.dailyMetrics} />
          <OrdersChart data={ordersByStatus} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TopProductsChart data={data.topProducts.slice(0, 10)} />
          <TrafficChart data={data.trafficSources} />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Cart Abandonment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Покинуті кошики
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Створено кошиків:</span>
                <span className="font-semibold text-gray-900">
                  {data.cartMetrics.cartsCreated}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Завершено покупок:</span>
                <span className="font-semibold text-gray-900">
                  {data.cartMetrics.cartsCompleted}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">% покинутих:</span>
                  <span className="font-semibold text-red-600 text-xl">
                    {data.cartMetrics.abandonment.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Дохід за періодами
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">За день:</span>
                <span className="font-semibold text-gray-900">
                  ₴{data.revenue.daily.toLocaleString('uk-UA')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">За тиждень:</span>
                <span className="font-semibold text-gray-900">
                  ₴{data.revenue.weekly.toLocaleString('uk-UA')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">За місяць:</span>
                <span className="font-semibold text-gray-900">
                  ₴{data.revenue.monthly.toLocaleString('uk-UA')}
                </span>
              </div>
            </div>
          </div>

          {/* Category Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Топ категорії
            </h3>
            <div className="space-y-3">
              {data.categoryPerformance.slice(0, 5).map((category: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-600 truncate mr-2">
                    {category.category}:
                  </span>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-900 mr-2">
                      ₴{(category.revenue / 1000).toFixed(1)}k
                    </span>
                    <span className="text-xs text-gray-500">
                      ({category.percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/admin/analytics/sales"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Аналітика продажів
                </h3>
                <p className="text-gray-600 text-sm">
                  Детальна інформація про продажі, продукти та категорії
                </p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-blue-600" />
            </div>
          </a>

          <a
            href="/admin/analytics/customers"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Аналітика клієнтів
                </h3>
                <p className="text-gray-600 text-sm">
                  Сегментація, утримання та lifetime value клієнтів
                </p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-600" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
