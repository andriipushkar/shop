'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CubeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  BellAlertIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  calculateBulkReorderPoints,
  generateMockSalesHistory,
  type ReorderPoint,
} from '@/lib/warehouse-analytics';

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  price: number;
  supplier: string;
  leadTime: number;
}

// Моковані дані продуктів
const mockProducts: ProductData[] = [
  { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', category: 'Смартфони', currentStock: 45, price: 54999, supplier: 'Apple UA', leadTime: 14 },
  { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-256', category: 'Смартфони', currentStock: 8, price: 49999, supplier: 'Samsung UA', leadTime: 7 },
  { id: '3', name: 'MacBook Pro 14" M3', sku: 'APL-MBP14-M3', category: 'Ноутбуки', currentStock: 3, price: 84999, supplier: 'Apple UA', leadTime: 14 },
  { id: '4', name: 'AirPods Pro 2', sku: 'APL-APP2', category: 'Аксесуари', currentStock: 120, price: 8499, supplier: 'Apple UA', leadTime: 14 },
  { id: '5', name: 'Samsung Galaxy Watch 6', sku: 'SAM-GW6', category: 'Аксесуари', currentStock: 15, price: 12999, supplier: 'Samsung UA', leadTime: 7 },
  { id: '6', name: 'ASUS ROG Strix G16', sku: 'ASUS-ROG-G16', category: 'Ноутбуки', currentStock: 2, price: 62999, supplier: 'ASUS Ukraine', leadTime: 10 },
  { id: '7', name: 'Xiaomi 14 Ultra', sku: 'XIA-14U', category: 'Смартфони', currentStock: 28, price: 39999, supplier: 'Xiaomi UA', leadTime: 5 },
  { id: '8', name: 'Sony WH-1000XM5', sku: 'SONY-XM5', category: 'Аксесуари', currentStock: 54, price: 13999, supplier: 'Sony Ukraine', leadTime: 12 },
  { id: '9', name: 'Google Pixel 8 Pro', sku: 'GOO-PX8P', category: 'Смартфони', currentStock: 5, price: 42999, supplier: 'Google Partners', leadTime: 21 },
  { id: '10', name: 'Dell XPS 15', sku: 'DELL-XPS15', category: 'Ноутбуки', currentStock: 7, price: 72999, supplier: 'Dell Ukraine', leadTime: 8 },
];

export default function ReorderPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [reorderPoints, setReorderPoints] = useState<ReorderPoint[]>([]);
  const [serviceLevel, setServiceLevel] = useState(95);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Розрахунок точок замовлення
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const productsWithHistory = mockProducts.map(product => {
        const history = generateMockSalesHistory(
          product.id,
          90,
          product.category === 'Смартфони' ? 3 : product.category === 'Ноутбуки' ? 1 : 5,
          0.4
        );
        return {
          id: product.id,
          name: product.name,
          stock: product.currentStock,
          salesHistory: history.map(h => h.quantity),
          leadTime: product.leadTime,
        };
      });

      const results = calculateBulkReorderPoints(productsWithHistory, 7);
      setReorderPoints(results);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [serviceLevel]);

  // Фільтрація
  const filteredData = useMemo(() => {
    return reorderPoints.filter(rp => {
      const product = mockProducts.find(p => p.id === rp.productId);
      if (categoryFilter !== 'all' && product?.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && rp.status !== statusFilter) return false;
      return true;
    });
  }, [reorderPoints, categoryFilter, statusFilter]);

  // Статистика
  const stats = useMemo(() => {
    return {
      critical: reorderPoints.filter(r => r.status === 'critical').length,
      reorderNow: reorderPoints.filter(r => r.status === 'reorder_now').length,
      ok: reorderPoints.filter(r => r.status === 'ok').length,
      overstock: reorderPoints.filter(r => r.status === 'overstock').length,
      totalValue: reorderPoints
        .filter(r => r.status === 'reorder_now' || r.status === 'critical')
        .reduce((sum, r) => {
          const product = mockProducts.find(p => p.id === r.productId);
          return sum + (product?.price || 0) * r.reorderQuantity;
        }, 0),
    };
  }, [reorderPoints]);

  const categories = ['all', ...new Set(mockProducts.map(p => p.category))];

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllCritical = () => {
    const criticalIds = reorderPoints
      .filter(r => r.status === 'critical' || r.status === 'reorder_now')
      .map(r => r.productId);
    setSelectedProducts(new Set(criticalIds));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'reorder_now': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'ok': return 'bg-green-100 text-green-700 border-green-200';
      case 'overstock': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'critical': return 'Критично';
      case 'reorder_now': return 'Замовити';
      case 'ok': return 'Норма';
      case 'overstock': return 'Надлишок';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Точки перезамовлення</h1>
          <p className="text-gray-600">Автоматичний розрахунок оптимальних рівнів запасів</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/warehouse/analytics/forecast"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Прогнози
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <ArrowDownTrayIcon className="w-5 h-5" />
            Експорт
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('critical')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            statusFilter === 'critical' ? 'ring-2 ring-red-500' : ''
          } bg-red-50 border-red-200 hover:bg-red-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            <span className="text-sm text-red-700">Критично</span>
          </div>
          <div className="text-3xl font-bold text-red-700">{stats.critical}</div>
        </button>

        <button
          onClick={() => setStatusFilter('reorder_now')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            statusFilter === 'reorder_now' ? 'ring-2 ring-yellow-500' : ''
          } bg-yellow-50 border-yellow-200 hover:bg-yellow-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCartIcon className="w-6 h-6 text-yellow-600" />
            <span className="text-sm text-yellow-700">Замовити</span>
          </div>
          <div className="text-3xl font-bold text-yellow-700">{stats.reorderNow}</div>
        </button>

        <button
          onClick={() => setStatusFilter('ok')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            statusFilter === 'ok' ? 'ring-2 ring-green-500' : ''
          } bg-green-50 border-green-200 hover:bg-green-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
            <span className="text-sm text-green-700">В нормі</span>
          </div>
          <div className="text-3xl font-bold text-green-700">{stats.ok}</div>
        </button>

        <button
          onClick={() => setStatusFilter('overstock')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            statusFilter === 'overstock' ? 'ring-2 ring-blue-500' : ''
          } bg-blue-50 border-blue-200 hover:bg-blue-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon className="w-6 h-6 text-blue-600" />
            <span className="text-sm text-blue-700">Надлишок</span>
          </div>
          <div className="text-3xl font-bold text-blue-700">{stats.overstock}</div>
        </button>

        <div className="rounded-xl p-4 shadow-sm border bg-white border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <BellAlertIcon className="w-6 h-6 text-gray-600" />
            <span className="text-sm text-gray-600">Сума замовлення</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {(stats.totalValue / 1000000).toFixed(2)}M ₴
          </div>
        </div>
      </div>

      {/* Фільтри та налаштування */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Категорія</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі категорії</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі статуси</option>
              <option value="critical">Критично</option>
              <option value="reorder_now">Замовити</option>
              <option value="ok">В нормі</option>
              <option value="overstock">Надлишок</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Рівень сервісу</label>
            <select
              value={serviceLevel}
              onChange={(e) => setServiceLevel(Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={90}>90%</option>
              <option value={95}>95%</option>
              <option value={98}>98%</option>
              <option value={99}>99%</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {selectedProducts.size > 0 && (
              <Link
                href="/admin/warehouse/purchases/new"
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                Замовити ({selectedProducts.size})
              </Link>
            )}
            <button
              onClick={selectAllCritical}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Вибрати критичні
            </button>
          </div>
        </div>
      </div>

      {/* Формула */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Формула розрахунку</h4>
            <p className="text-sm text-blue-800">
              <strong>Точка замовлення</strong> = Страховий запас + (Середні денні продажі × Час поставки)
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Страховий запас</strong> = Z × σ × √(Час поставки), де Z = {serviceLevel === 99 ? '2.33' : serviceLevel === 98 ? '2.05' : serviceLevel === 95 ? '1.65' : '1.28'} (для {serviceLevel}% рівня сервісу)
            </p>
          </div>
        </div>
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === filteredData.length && filteredData.length > 0}
                    onChange={() => {
                      if (selectedProducts.size === filteredData.length) {
                        setSelectedProducts(new Set());
                      } else {
                        setSelectedProducts(new Set(filteredData.map(r => r.productId)));
                      }
                    }}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Залишок</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Сер. продажі</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  <div className="flex items-center justify-end gap-1">
                    <ClockIcon className="w-4 h-4" />
                    Час поставки
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Страх. запас</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Точка замовл.</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Рек. замовлення</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Днів запасу</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((rp) => {
                const product = mockProducts.find(p => p.id === rp.productId);
                const isSelected = selectedProducts.has(rp.productId);

                return (
                  <tr
                    key={rp.productId}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProduct(rp.productId)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{rp.productName}</div>
                      <div className="text-sm text-gray-500">{product?.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        rp.currentStock <= rp.safetyStock ? 'text-red-600' :
                        rp.currentStock <= rp.reorderPoint ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {rp.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {rp.avgDailySales.toFixed(1)}/день
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {rp.leadTimeDays} дн.
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {rp.safetyStock}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {rp.reorderPoint}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rp.status !== 'overstock' && rp.status !== 'ok' ? (
                        <span className="font-medium text-teal-600">{rp.reorderQuantity}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${
                        rp.daysOfStock < 7 ? 'text-red-600 font-medium' :
                        rp.daysOfStock < 14 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {rp.daysOfStock === Infinity ? '∞' : rp.daysOfStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(rp.status)}`}>
                        {getStatusText(rp.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Візуалізація рівнів запасу */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Візуалізація рівнів запасу</h3>
        <div className="space-y-4">
          {filteredData.slice(0, 5).map((rp) => {
            const maxLevel = Math.max(rp.currentStock, rp.reorderPoint * 2, rp.reorderQuantity + rp.reorderPoint);
            const currentPercent = (rp.currentStock / maxLevel) * 100;
            const reorderPercent = (rp.reorderPoint / maxLevel) * 100;
            const safetyPercent = (rp.safetyStock / maxLevel) * 100;

            return (
              <div key={rp.productId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{rp.productName}</span>
                  <span className="text-sm text-gray-500">
                    {rp.currentStock} / {rp.reorderPoint}
                  </span>
                </div>
                <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                  {/* Поточний запас */}
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                      rp.status === 'critical' ? 'bg-red-500' :
                      rp.status === 'reorder_now' ? 'bg-yellow-500' :
                      rp.status === 'overstock' ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(currentPercent, 100)}%` }}
                  />
                  {/* Лінія точки замовлення */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-gray-800"
                    style={{ left: `${reorderPercent}%` }}
                  />
                  {/* Лінія страхового запасу */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-400 opacity-50"
                    style={{ left: `${safetyPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0</span>
                  <span style={{ marginLeft: `${safetyPercent - 10}%` }}>Страховий ({rp.safetyStock})</span>
                  <span style={{ marginLeft: `${reorderPercent - safetyPercent - 20}%` }}>Замовлення ({rp.reorderPoint})</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>В нормі</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span>Замовити</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span>Критично</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Надлишок</span>
          </div>
        </div>
      </div>
    </div>
  );
}
