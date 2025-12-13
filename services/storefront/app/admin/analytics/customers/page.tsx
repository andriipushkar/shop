'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
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
  LineChart,
  Line,
} from 'recharts';

export default function CustomerAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCustomerAnalytics();
  }, [dateRange]);

  const fetchCustomerAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/analytics/customers?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch customer analytics:', error);
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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
              <h1 className="text-3xl font-bold text-gray-900">Аналітика клієнтів</h1>
              <p className="text-gray-600 mt-1">
                Сегментація, утримання та lifetime value клієнтів
              </p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* New vs Returning Customers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Нові vs Повторні клієнти
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Нові клієнти', value: data.newVsReturning.new },
                    { name: 'Повторні клієнти', value: data.newVsReturning.returning },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) =>
                    `${entry.name}: ${entry.value} (${((entry.value / (data.newVsReturning.new + data.newVsReturning.returning)) * 100).toFixed(1)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">Нові</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.newVsReturning.new}
                </p>
                <p className="text-xs text-gray-500">
                  {data.newVsReturning.newPercentage.toFixed(1)}%
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm text-gray-600">Повторні</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.newVsReturning.returning}
                </p>
                <p className="text-xs text-gray-500">
                  {data.newVsReturning.returningPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Customer Retention */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Утримання клієнтів
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.retention}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" style={{ fontSize: '12px' }} />
                <YAxis style={{ fontSize: '12px' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border">
                          <p className="font-medium">{payload[0].payload.period}</p>
                          <p className="text-sm text-gray-600">
                            Нові: {payload[0].payload.newUsers}
                          </p>
                          <p className="text-sm text-gray-600">
                            Повернулись: {payload[0].payload.returningUsers}
                          </p>
                          <p className="text-sm text-gray-600">
                            Утримання: {payload[0].value?.toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="retentionRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Рівень утримання (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RFM Segmentation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            RFM Сегментація клієнтів
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Сегментація на основі Recency (давність), Frequency (частота) та Monetary (грошова цінність)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.rfmSegmentation}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="segment" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border">
                        <p className="font-medium">{payload[0].payload.segment}</p>
                        <p className="text-sm text-gray-600">
                          Клієнтів: {payload[0].value}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          R: {payload[0].payload.recency} | F: {payload[0].payload.frequency} | M:{' '}
                          {payload[0].payload.monetary}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="userCount" fill="#3b82f6" name="Кількість клієнтів" />
            </BarChart>
          </ResponsiveContainer>

          {/* Segment Descriptions */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.rfmSegmentation.map((segment: any, index: number) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{segment.segment}</h4>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                    {segment.userCount}
                  </span>
                </div>
                <div className="flex gap-2 text-xs text-gray-600">
                  <span className="bg-gray-100 px-2 py-1 rounded">R: {segment.recency}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">F: {segment.frequency}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">M: {segment.monetary}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Lifetime Value */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Топ клієнтів за Lifetime Value
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Замовлень
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Всього витрачено
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Середній чек
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Перше замовлення
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Останнє замовлення
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Днів з останнього
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.customerLifetimeValue.slice(0, 20).map((customer: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {customer.userId.substring(0, 10)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {customer.totalOrders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">
                      ₴{customer.totalSpent.toLocaleString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      ₴{customer.averageOrderValue.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {new Date(customer.firstOrderDate).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {new Date(customer.lastOrderDate).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          customer.daysSinceLastOrder <= 30
                            ? 'bg-green-100 text-green-800'
                            : customer.daysSinceLastOrder <= 90
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {customer.daysSinceLastOrder}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cohort Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Когортний аналіз
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Утримання користувачів по місяцях з моменту реєстрації
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                    Когорта
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Користувачів
                  </th>
                  {[0, 1, 2, 3, 4, 5, 6].map((month) => (
                    <th
                      key={month}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                    >
                      Міс {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.cohortAnalysis.slice(0, 6).map((cohort: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                      {cohort.cohort}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                      {cohort.users}
                    </td>
                    {[0, 1, 2, 3, 4, 5, 6].map((month) => {
                      const retention = cohort.retention[`month_${month}`];
                      return (
                        <td
                          key={month}
                          className="px-4 py-3 whitespace-nowrap text-sm text-center"
                        >
                          <div
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              retention >= 50
                                ? 'bg-green-100 text-green-800'
                                : retention >= 25
                                ? 'bg-yellow-100 text-yellow-800'
                                : retention > 0
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {retention > 0 ? `${retention.toFixed(0)}%` : '-'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
