'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  description?: string;
}

export default function KPICard({
  title,
  value,
  trend,
  icon,
  prefix = '',
  suffix = '',
  description,
}: KPICardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
  const trendBgColor = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-gray-900">
              {prefix}
              {typeof value === 'number' ? value.toLocaleString('uk-UA') : value}
              {suffix}
            </p>
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {trend !== undefined && (
            <div className="mt-2 flex items-center">
              <div className={`flex items-center ${trendBgColor} rounded-full px-2 py-1`}>
                {isPositive ? (
                  <ArrowUpIcon className={`w-4 h-4 ${trendColor}`} />
                ) : (
                  <ArrowDownIcon className={`w-4 h-4 ${trendColor}`} />
                )}
                <span className={`text-sm font-medium ${trendColor} ml-1`}>
                  {Math.abs(trend).toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-gray-500 ml-2">
                порівняно з попереднім періодом
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
