'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import RevenueChart from '@/components/admin/analytics/RevenueChart';
import TopProductsChart from '@/components/admin/analytics/TopProductsChart';
import DateRangePicker, { DateRange } from '@/components/admin/analytics/DateRangePicker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function SalesAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalesAnalytics();
  }, [dateRange]);

  const fetchSalesAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/analytics/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch sales analytics:', error);
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            ₴{payload[0].value.toLocaleString('uk-UA')}
          </p>
          <p className="text-xs text-gray-500">
            {payload[0].payload.percentage?.toFixed(1)}% від загального доходу
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/analytics"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Назад до аналітики
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Аналітика продажів</h1>
              <p className="text-gray-600 mt-1">
                Детальний аналіз продажів, продуктів та категорій
              </p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Загальний дохід</h3>
            <p className="text-3xl font-bold text-gray-900">
              ₴{data.revenue.total.toLocaleString('uk-UA')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Тренд: {data.revenue.trend >= 0 ? '+' : ''}
              {data.revenue.trend.toFixed(1)}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Всього замовлень</h3>
            <p className="text-3xl font-bold text-gray-900">
              {data.orderMetrics.total.toLocaleString('uk-UA')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Середній чек: ₴{data.orderMetrics.averageValue.toFixed(0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Середня вартість замовлення
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              ₴{data.orderMetrics.averageValue.toLocaleString('uk-UA')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Загальний дохід: ₴{(data.orderMetrics.totalRevenue / 1000).toFixed(0)}k
            </p>
          </div>
        </div>

        {/* Charts Row 1 - Revenue Trend */}
        <div className="mb-6">
          <RevenueChart data={data.dailyMetrics} height={350} />
        </div>

        {/* Charts Row 2 - Top Products and Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TopProductsChart data={data.topProducts} height={400} />

          {/* Category Performance Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Розподіл доходу за категоріями
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={data.categoryPerformance.map((cat: any, index: number) => ({
                    ...cat,
                    name: cat.category,
                    value: cat.revenue,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry: any) => `${entry.category} (${entry.percentage.toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.categoryPerformance.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Category Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Категорія
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Дохід
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.categoryPerformance.map((category: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {category.category}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        ₴{category.revenue.toLocaleString('uk-UA')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {category.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Географічний розподіл продажів
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Місто
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сесії
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Замовлення
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дохід
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Конверсія
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.geographicDistribution.map((location: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {location.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {location.sessions.toLocaleString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {location.orders.toLocaleString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      ₴{location.revenue.toLocaleString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {((location.orders / location.sessions) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Замовлення за статусом
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.ordersByStatus).map(([status, count]: [string, any]) => {
              const statusLabels: Record<string, string> = {
                completed: 'Завершено',
                pending: 'Очікує',
                processing: 'В обробці',
                cancelled: 'Скасовано',
              };

              const statusColors: Record<string, string> = {
                completed: 'bg-green-100 text-green-800',
                pending: 'bg-blue-100 text-blue-800',
                processing: 'bg-yellow-100 text-yellow-800',
                cancelled: 'bg-red-100 text-red-800',
              };

              return (
                <div
                  key={status}
                  className={`p-4 rounded-lg ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
                >
                  <p className="text-sm font-medium">
                    {statusLabels[status] || status}
                  </p>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
