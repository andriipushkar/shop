'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  CubeIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  FunnelIcon,
  TableCellsIcon,
  ChartPieIcon,
  DocumentChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface ReportData {
  stockValue: number;
  stockValueChange: number;
  turnoverRate: number;
  turnoverRateChange: number;
  avgDaysInStock: number;
  avgDaysInStockChange: number;
  deadStockValue: number;
  deadStockPercent: number;
}

interface CategoryStock {
  name: string;
  value: number;
  quantity: number;
  percent: number;
  color: string;
}

interface MovementStats {
  period: string;
  receipts: number;
  shipments: number;
  transfers: number;
}

interface TopProduct {
  name: string;
  sku: string;
  sales: number;
  revenue: number;
  margin: number;
  trend: 'up' | 'down' | 'stable';
}

// Моковані дані
const reportData: ReportData = {
  stockValue: 2850000,
  stockValueChange: 12.5,
  turnoverRate: 4.2,
  turnoverRateChange: 0.3,
  avgDaysInStock: 45,
  avgDaysInStockChange: -5,
  deadStockValue: 125000,
  deadStockPercent: 4.4,
};

const categoryStock: CategoryStock[] = [
  { name: 'Смартфони', value: 1250000, quantity: 850, percent: 44, color: 'bg-blue-500' },
  { name: 'Ноутбуки', value: 780000, quantity: 120, percent: 27, color: 'bg-green-500' },
  { name: 'Аксесуари', value: 420000, quantity: 2500, percent: 15, color: 'bg-yellow-500' },
  { name: 'Телевізори', value: 280000, quantity: 45, percent: 10, color: 'bg-purple-500' },
  { name: 'Інше', value: 120000, quantity: 350, percent: 4, color: 'bg-gray-500' },
];

const movementStats: MovementStats[] = [
  { period: 'Січень', receipts: 450, shipments: 380, transfers: 25 },
  { period: 'Лютий', receipts: 520, shipments: 490, transfers: 32 },
  { period: 'Березень', receipts: 380, shipments: 420, transfers: 18 },
  { period: 'Квітень', receipts: 610, shipments: 550, transfers: 45 },
  { period: 'Травень', receipts: 480, shipments: 510, transfers: 28 },
  { period: 'Червень', receipts: 550, shipments: 480, transfers: 35 },
];

const topProducts: TopProduct[] = [
  { name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001', sales: 156, revenue: 6552000, margin: 18.5, trend: 'up' },
  { name: 'MacBook Pro 14" M3', sku: 'LAPTOP-001', sales: 42, revenue: 3570000, margin: 15.2, trend: 'up' },
  { name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-002', sales: 98, revenue: 3724000, margin: 16.8, trend: 'stable' },
  { name: 'AirPods Pro 2', sku: 'ACC-001', sales: 245, revenue: 2082500, margin: 22.3, trend: 'up' },
  { name: 'ASUS ROG Strix G16', sku: 'LAPTOP-002', sales: 35, revenue: 1925000, margin: 14.5, trend: 'down' },
];

const slowMovingProducts = [
  { name: 'Xiaomi Mi Band 6', sku: 'ACC-015', daysInStock: 120, quantity: 45, value: 67500 },
  { name: 'Huawei Watch GT 2', sku: 'ACC-018', daysInStock: 95, quantity: 28, value: 112000 },
  { name: 'OnePlus Buds Z', sku: 'ACC-022', daysInStock: 88, quantity: 60, value: 54000 },
  { name: 'Realme 8 Pro', sku: 'PHONE-025', daysInStock: 75, quantity: 15, value: 135000 },
];

const abcAnalysis = {
  A: { products: 125, value: 2137500, percent: 75 },
  B: { products: 280, value: 570000, percent: 20 },
  C: { products: 450, value: 142500, percent: 5 },
};

const xyzAnalysis = {
  X: { products: 180, description: 'Стабільний попит' },
  Y: { products: 320, description: 'Помірні коливання' },
  Z: { products: 355, description: 'Нестабільний попит' },
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('month');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  const maxMovement = Math.max(...movementStats.flatMap(s => [s.receipts, s.shipments]));

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Звіти та аналітика</h1>
          <p className="text-gray-600">Аналіз складських операцій та ефективності</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Всі склади</option>
            <option value="main">Головний склад</option>
            <option value="store">Магазин &quot;Центр&quot;</option>
            <option value="dropship">Дропшипінг</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="week">Тиждень</option>
            <option value="month">Місяць</option>
            <option value="quarter">Квартал</option>
            <option value="year">Рік</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <ArrowDownTrayIcon className="w-5 h-5" />
            Експорт
          </button>
        </div>
      </div>

      {/* Ключові показники */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <CurrencyDollarIcon className="w-8 h-8 text-teal-600" />
            <span className={`flex items-center gap-1 text-sm ${reportData.stockValueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {reportData.stockValueChange >= 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
              {Math.abs(reportData.stockValueChange)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(reportData.stockValue / 1000000).toFixed(2)}M ₴</div>
          <div className="text-sm text-gray-500">Вартість запасів</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <ChartBarIcon className="w-8 h-8 text-blue-600" />
            <span className={`flex items-center gap-1 text-sm ${reportData.turnoverRateChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {reportData.turnoverRateChange >= 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
              {Math.abs(reportData.turnoverRateChange)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{reportData.turnoverRate}x</div>
          <div className="text-sm text-gray-500">Оборотність запасів</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <ClockIcon className="w-8 h-8 text-purple-600" />
            <span className={`flex items-center gap-1 text-sm ${reportData.avgDaysInStockChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {reportData.avgDaysInStockChange <= 0 ? <ArrowTrendingDownIcon className="w-4 h-4" /> : <ArrowTrendingUpIcon className="w-4 h-4" />}
              {Math.abs(reportData.avgDaysInStockChange)} дн.
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{reportData.avgDaysInStock} дн.</div>
          <div className="text-sm text-gray-500">Середній час на складі</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
            <span className="text-sm text-gray-500">{reportData.deadStockPercent}%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(reportData.deadStockValue / 1000).toFixed(0)}K ₴</div>
          <div className="text-sm text-gray-500">Неліквідні запаси</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Структура запасів по категоріях */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ChartPieIcon className="w-5 h-5 text-teal-600" />
            Структура запасів по категоріях
          </h2>
          <div className="space-y-4">
            {categoryStock.map(category => (
              <div key={category.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                  <span className="text-sm text-gray-500">{category.value.toLocaleString()} ₴ ({category.percent}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${category.color}`}
                    style={{ width: `${category.percent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{category.quantity.toLocaleString()} од.</div>
              </div>
            ))}
          </div>
        </div>

        {/* Рух товарів */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-teal-600" />
            Рух товарів за період
          </h2>
          <div className="space-y-3">
            {movementStats.map(stat => (
              <div key={stat.period} className="flex items-center gap-3">
                <div className="w-16 text-sm text-gray-600">{stat.period}</div>
                <div className="flex-1 flex gap-1">
                  <div
                    className="h-6 bg-green-500 rounded-l"
                    style={{ width: `${(stat.receipts / maxMovement) * 50}%` }}
                    title={`Приймання: ${stat.receipts}`}
                  />
                  <div
                    className="h-6 bg-blue-500 rounded-r"
                    style={{ width: `${(stat.shipments / maxMovement) * 50}%` }}
                    title={`Відвантаження: ${stat.shipments}`}
                  />
                </div>
                <div className="w-24 text-xs text-gray-500 text-right">
                  +{stat.receipts} / -{stat.shipments}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-sm text-gray-600">Приймання</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-sm text-gray-600">Відвантаження</span>
            </div>
          </div>
        </div>

        {/* Топ продукти */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-teal-600" />
            Топ-5 товарів за продажами
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Товар</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Продано</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Дохід</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Маржа</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Тренд</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.map((product, index) => (
                  <tr key={product.sku} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center bg-gray-100 rounded text-xs font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">{product.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-600">{product.sales}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      {(product.revenue / 1000000).toFixed(2)}M ₴
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-600">{product.margin}%</td>
                    <td className="px-3 py-2 text-center">
                      {product.trend === 'up' && <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mx-auto" />}
                      {product.trend === 'down' && <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mx-auto" />}
                      {product.trend === 'stable' && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ABC/XYZ аналіз */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TableCellsIcon className="w-5 h-5 text-teal-600" />
            ABC/XYZ аналіз
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* ABC */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">ABC аналіз (за вартістю)</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-lg font-bold">A</span>
                    <div>
                      <div className="font-medium text-gray-900">{abcAnalysis.A.products} товарів</div>
                      <div className="text-xs text-gray-500">{abcAnalysis.A.percent}% вартості</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{(abcAnalysis.A.value / 1000000).toFixed(2)}M ₴</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-yellow-500 text-white rounded-lg font-bold">B</span>
                    <div>
                      <div className="font-medium text-gray-900">{abcAnalysis.B.products} товарів</div>
                      <div className="text-xs text-gray-500">{abcAnalysis.B.percent}% вартості</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{(abcAnalysis.B.value / 1000).toFixed(0)}K ₴</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg font-bold">C</span>
                    <div>
                      <div className="font-medium text-gray-900">{abcAnalysis.C.products} товарів</div>
                      <div className="text-xs text-gray-500">{abcAnalysis.C.percent}% вартості</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{(abcAnalysis.C.value / 1000).toFixed(0)}K ₴</div>
                  </div>
                </div>
              </div>
            </div>

            {/* XYZ */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">XYZ аналіз (за стабільністю)</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-lg font-bold">X</span>
                    <div>
                      <div className="font-medium text-gray-900">{xyzAnalysis.X.products} товарів</div>
                      <div className="text-xs text-gray-500">{xyzAnalysis.X.description}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg font-bold">Y</span>
                    <div>
                      <div className="font-medium text-gray-900">{xyzAnalysis.Y.products} товарів</div>
                      <div className="text-xs text-gray-500">{xyzAnalysis.Y.description}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-lg font-bold">Z</span>
                    <div>
                      <div className="font-medium text-gray-900">{xyzAnalysis.Z.products} товарів</div>
                      <div className="text-xs text-gray-500">{xyzAnalysis.Z.description}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Повільно рухомі товари */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
          Повільно рухомі товари (Dead Stock)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Товар</th>
                <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Днів на складі</th>
                <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Кількість</th>
                <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Вартість</th>
                <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Рекомендація</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slowMovingProducts.map((product) => (
                <tr key={product.sku} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">{product.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      product.daysInStock > 90 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {product.daysInStock} дн.
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{product.quantity} од.</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{product.value.toLocaleString()} ₴</td>
                  <td className="px-4 py-3 text-center">
                    <button className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                      Розпродаж
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Швидкі звіти */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <DocumentChartBarIcon className="w-8 h-8 text-teal-600" />
          <div className="text-left">
            <div className="font-medium text-gray-900">Інвентаризація</div>
            <div className="text-sm text-gray-500">Звіт за місяць</div>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <CubeIcon className="w-8 h-8 text-blue-600" />
          <div className="text-left">
            <div className="font-medium text-gray-900">Залишки</div>
            <div className="text-sm text-gray-500">Поточний стан</div>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <TruckIcon className="w-8 h-8 text-green-600" />
          <div className="text-left">
            <div className="font-medium text-gray-900">Рух товарів</div>
            <div className="text-sm text-gray-500">За період</div>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <CalendarIcon className="w-8 h-8 text-purple-600" />
          <div className="text-left">
            <div className="font-medium text-gray-900">Закупівлі</div>
            <div className="text-sm text-gray-500">Аналіз постачальників</div>
          </div>
        </button>
      </div>
    </div>
  );
}
