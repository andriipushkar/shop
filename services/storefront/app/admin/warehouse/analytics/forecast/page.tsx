'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  CubeIcon,
  ArrowPathIcon,
  FunnelIcon,
  InformationCircleIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import {
  forecastDemand,
  generateMockSalesHistory,
  type ForecastResult,
  type ProductSalesHistory,
} from '@/lib/warehouse-analytics';

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  price: number;
}

// Моковані дані продуктів
const mockProducts: ProductData[] = [
  { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', category: 'Смартфони', currentStock: 45, price: 54999 },
  { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-256', category: 'Смартфони', currentStock: 32, price: 49999 },
  { id: '3', name: 'MacBook Pro 14" M3', sku: 'APL-MBP14-M3', category: 'Ноутбуки', currentStock: 18, price: 84999 },
  { id: '4', name: 'AirPods Pro 2', sku: 'APL-APP2', category: 'Аксесуари', currentStock: 120, price: 8499 },
  { id: '5', name: 'Samsung Galaxy Watch 6', sku: 'SAM-GW6', category: 'Аксесуари', currentStock: 65, price: 12999 },
  { id: '6', name: 'ASUS ROG Strix G16', sku: 'ASUS-ROG-G16', category: 'Ноутбуки', currentStock: 12, price: 62999 },
  { id: '7', name: 'Xiaomi 14 Ultra', sku: 'XIA-14U', category: 'Смартфони', currentStock: 28, price: 39999 },
  { id: '8', name: 'Sony WH-1000XM5', sku: 'SONY-XM5', category: 'Аксесуари', currentStock: 54, price: 13999 },
];

export default function ForecastPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>(mockProducts[0].id);
  const [forecastDays, setForecastDays] = useState(30);
  const [leadTime, setLeadTime] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [forecasts, setForecasts] = useState<Map<string, ForecastResult>>(new Map());
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Генеруємо прогнози для всіх продуктів
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const newForecasts = new Map<string, ForecastResult>();

      mockProducts.forEach(product => {
        // Генеруємо історію продажів (90 днів)
        const salesHistory = generateMockSalesHistory(
          product.id,
          90,
          product.category === 'Смартфони' ? 3 : product.category === 'Ноутбуки' ? 1 : 5,
          0.4
        );

        // Додаємо revenue до кожного запису
        const dailySalesWithRevenue = salesHistory.map(sale => ({
          ...sale,
          revenue: sale.quantity * product.price,
        }));

        const history: ProductSalesHistory = {
          productId: product.id,
          productName: product.name,
          dailySales: dailySalesWithRevenue,
        };

        const result = forecastDemand(history, product.currentStock, forecastDays, leadTime);
        newForecasts.set(product.id, result);
      });

      setForecasts(newForecasts);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [forecastDays, leadTime]);

  const currentForecast = forecasts.get(selectedProduct);
  const currentProduct = mockProducts.find(p => p.id === selectedProduct);

  // Фільтрація продуктів
  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return mockProducts;
    return mockProducts.filter(p => p.category === categoryFilter);
  }, [categoryFilter]);

  // Критичні товари (скоро закінчаться)
  const criticalProducts = useMemo(() => {
    return Array.from(forecasts.entries())
      .filter(([_, forecast]) => forecast.daysUntilStockout !== null && forecast.daysUntilStockout <= 14)
      .sort((a, b) => (a[1].daysUntilStockout || 999) - (b[1].daysUntilStockout || 999))
      .slice(0, 5);
  }, [forecasts]);

  const categories = ['all', ...new Set(mockProducts.map(p => p.category))];

  // Макс значення для графіка
  const maxForecastValue = currentForecast
    ? Math.max(...currentForecast.forecast.map(f => f.upper))
    : 10;

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
          <h1 className="text-2xl font-bold text-gray-900">Прогнозування попиту</h1>
          <p className="text-gray-600">AI-аналітика на основі історичних даних</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/warehouse/analytics/reorder"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Точки замовлення
          </Link>
          <Link
            href="/admin/warehouse/analytics/anomalies"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Аномалії
          </Link>
        </div>
      </div>

      {/* Критичні сповіщення */}
      {criticalProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BellAlertIcon className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Критичні прогнози</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {criticalProducts.map(([productId, forecast]) => {
              const product = mockProducts.find(p => p.id === productId);
              return (
                <button
                  key={productId}
                  onClick={() => setSelectedProduct(productId)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    selectedProduct === productId
                      ? 'bg-red-200 border-2 border-red-400'
                      : 'bg-white border border-red-100 hover:border-red-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{product?.name}</div>
                  <div className="text-xs text-red-600 mt-1">
                    {forecast.daysUntilStockout} днів до закінчення
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Параметри */}
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
            <label className="block text-sm text-gray-600 mb-1">Горизонт прогнозу</label>
            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={14}>14 днів</option>
              <option value={30}>30 днів</option>
              <option value={60}>60 днів</option>
              <option value={90}>90 днів</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Час поставки</label>
            <select
              value={leadTime}
              onChange={(e) => setLeadTime(Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={3}>3 дні</option>
              <option value={7}>7 днів</option>
              <option value={14}>14 днів</option>
              <option value={21}>21 день</option>
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
            <InformationCircleIcon className="w-4 h-4" />
            <span>Прогноз оновлено: {new Date().toLocaleTimeString('uk-UA')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Список продуктів */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Товари</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredProducts.map(product => {
                const forecast = forecasts.get(product.id);
                const isSelected = selectedProduct === product.id;
                const isCritical = forecast?.daysUntilStockout !== null && (forecast?.daysUntilStockout || 999) <= 14;

                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product.id)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-teal-50 border-2 border-teal-500'
                        : isCritical
                        ? 'bg-red-50 border border-red-200 hover:border-red-300'
                        : 'bg-gray-50 border border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                      {forecast && (
                        <span className={`text-xs ${
                          forecast.trend === 'growing' ? 'text-green-600' :
                          forecast.trend === 'declining' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {forecast.trend === 'growing' && '↑'}
                          {forecast.trend === 'declining' && '↓'}
                          {forecast.trend === 'stable' && '→'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{product.sku}</span>
                      <span className="text-xs text-gray-600">{product.currentStock} шт.</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Деталі прогнозу */}
        <div className="lg:col-span-3 space-y-6">
          {currentForecast && currentProduct && (
            <>
              {/* Ключові метрики */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CubeIcon className="w-5 h-5 text-teal-600" />
                    <span className="text-sm text-gray-600">Поточний запас</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{currentForecast.currentStock}</div>
                  <div className="text-xs text-gray-500">одиниць</div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ChartBarIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-600">Сер. продажі/день</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{currentForecast.avgDailySales}</div>
                  <div className="text-xs text-gray-500">одиниць</div>
                </div>

                <div className={`rounded-xl p-4 shadow-sm border ${
                  currentForecast.daysUntilStockout !== null && currentForecast.daysUntilStockout <= 14
                    ? 'bg-red-50 border-red-200'
                    : currentForecast.daysUntilStockout !== null && currentForecast.daysUntilStockout <= 30
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarIcon className={`w-5 h-5 ${
                      currentForecast.daysUntilStockout !== null && currentForecast.daysUntilStockout <= 14
                        ? 'text-red-600'
                        : 'text-purple-600'
                    }`} />
                    <span className="text-sm text-gray-600">До закінчення</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {currentForecast.daysUntilStockout !== null ? currentForecast.daysUntilStockout : '∞'}
                  </div>
                  <div className="text-xs text-gray-500">днів</div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    {currentForecast.trend === 'growing' ? (
                      <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                    ) : currentForecast.trend === 'declining' ? (
                      <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
                    ) : (
                      <ArrowPathIcon className="w-5 h-5 text-gray-600" />
                    )}
                    <span className="text-sm text-gray-600">Тренд</span>
                  </div>
                  <div className={`text-2xl font-bold ${
                    currentForecast.trend === 'growing' ? 'text-green-600' :
                    currentForecast.trend === 'declining' ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {currentForecast.trendPercent > 0 ? '+' : ''}{currentForecast.trendPercent}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentForecast.trend === 'growing' ? 'Зростання' :
                     currentForecast.trend === 'declining' ? 'Спад' : 'Стабільно'}
                  </div>
                </div>
              </div>

              {/* Рекомендація щодо замовлення */}
              {currentForecast.recommendedReorderDate && (
                <div className={`rounded-xl p-4 ${
                  new Date(currentForecast.recommendedReorderDate) <= new Date()
                    ? 'bg-red-100 border border-red-300'
                    : 'bg-yellow-100 border border-yellow-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <ExclamationTriangleIcon className={`w-6 h-6 ${
                      new Date(currentForecast.recommendedReorderDate) <= new Date()
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`} />
                    <div>
                      <div className="font-semibold text-gray-900">
                        {new Date(currentForecast.recommendedReorderDate) <= new Date()
                          ? 'Потрібно замовити зараз!'
                          : 'Рекомендована дата замовлення'}
                      </div>
                      <div className="text-sm text-gray-700">
                        {new Date(currentForecast.recommendedReorderDate).toLocaleDateString('uk-UA', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                        {' '}(з урахуванням часу поставки {leadTime} днів)
                      </div>
                    </div>
                    <Link
                      href="/admin/warehouse/purchases/new"
                      className="ml-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Створити замовлення
                    </Link>
                  </div>
                </div>
              )}

              {/* Графік прогнозу */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Прогноз продажів на {forecastDays} днів
                </h3>
                <div className="h-64 relative">
                  {/* Вісь Y */}
                  <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs text-gray-500">
                    <span>{maxForecastValue}</span>
                    <span>{Math.round(maxForecastValue / 2)}</span>
                    <span>0</span>
                  </div>

                  {/* Графік */}
                  <div className="ml-14 h-full flex items-end gap-1 pr-4 pb-6 overflow-x-auto">
                    {currentForecast.forecast.slice(0, Math.min(forecastDays, 60)).map((day, index) => {
                      const height = (day.predicted / maxForecastValue) * 100;
                      const upperHeight = (day.upper / maxForecastValue) * 100;
                      const lowerHeight = (day.lower / maxForecastValue) * 100;

                      return (
                        <div key={day.date} className="flex-1 min-w-[8px] relative group">
                          {/* Інтервал довіри */}
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-teal-100 rounded-t"
                            style={{ height: `${upperHeight}%` }}
                          />
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-white"
                            style={{ height: `${lowerHeight}%` }}
                          />
                          {/* Прогноз */}
                          <div
                            className="absolute bottom-0 left-1/4 right-1/4 bg-teal-500 rounded-t"
                            style={{ height: `${height}%` }}
                          />

                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              <div>{new Date(day.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</div>
                              <div>Прогноз: {day.predicted}</div>
                              <div className="text-gray-400">({day.lower} - {day.upper})</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Легенда */}
                  <div className="absolute bottom-0 left-14 right-0 flex items-center justify-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-teal-500 rounded" />
                      <span>Прогноз</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-teal-100 rounded" />
                      <span>Інтервал довіри 95%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Сезонність */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Сезонні індекси</h3>
                <div className="grid grid-cols-12 gap-2">
                  {['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'].map((month, i) => {
                    const index = currentForecast.seasonalityIndex[i];
                    const height = Math.min(index * 50, 100);
                    const isCurrentMonth = new Date().getMonth() === i;

                    return (
                      <div key={month} className="text-center">
                        <div className="h-20 flex items-end justify-center mb-1">
                          <div
                            className={`w-full rounded-t ${
                              isCurrentMonth ? 'bg-teal-500' :
                              index > 1.1 ? 'bg-green-400' :
                              index < 0.9 ? 'bg-red-300' : 'bg-gray-300'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className={`text-xs ${isCurrentMonth ? 'font-bold text-teal-600' : 'text-gray-500'}`}>
                          {month}
                        </div>
                        <div className="text-xs text-gray-400">
                          {index.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-400 rounded" />
                    <span>Високий сезон (&gt;1.1)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-300 rounded" />
                    <span>Нормальний</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-300 rounded" />
                    <span>Низький сезон (&lt;0.9)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
