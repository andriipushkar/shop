'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ProductMetrics } from '@/lib/analytics/metrics';

interface TopProductsChartProps {
  data: ProductMetrics[];
  height?: number;
}

export default function TopProductsChart({ data, height = 400 }: TopProductsChartProps) {
  const formatCurrency = (value: number) => {
    return `₴${value.toLocaleString('uk-UA')}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Дохід' ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Обрізаємо довгі назви продуктів
  const chartData = data.map(item => ({
    ...item,
    shortName: item.productName.length > 20
      ? item.productName.substring(0, 20) + '...'
      : item.productName,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Топ продуктів за доходом
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="shortName"
            angle={-45}
            textAnchor="end"
            height={100}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            formatter={(value) => {
              if (value === 'revenue') return 'Дохід';
              if (value === 'purchased') return 'Продано';
              return value;
            }}
          />
          <Bar dataKey="revenue" fill="#3b82f6" name="Дохід" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
