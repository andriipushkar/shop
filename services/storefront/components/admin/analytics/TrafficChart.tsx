'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrafficSource } from '@/lib/analytics/metrics';

interface TrafficChartProps {
  data: TrafficSource[];
  height?: number;
}

export default function TrafficChart({ data, height = 350 }: TrafficChartProps) {
  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{data.source}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">Сесії: {data.sessions}</p>
            <p className="text-gray-600">Конверсії: {data.conversions}</p>
            <p className="text-gray-600">
              Дохід: ₴{data.revenue.toLocaleString('uk-UA')}
            </p>
            <p className="text-gray-600">Частка: {data.percentage.toFixed(1)}%</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    return `${entry.source} (${entry.percentage.toFixed(1)}%)`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Джерела трафіку
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="sessions"
            label={renderLabel}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => entry.payload.source}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Таблиця деталей */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Джерело
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сесії
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Конверсії
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дохід
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                %
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((source, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {source.source}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                  {source.sessions.toLocaleString('uk-UA')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                  {source.conversions.toLocaleString('uk-UA')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                  ₴{source.revenue.toLocaleString('uk-UA')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                  {source.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
