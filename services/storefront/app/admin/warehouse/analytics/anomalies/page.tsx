'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import {
  detectBulkAnomalies,
  generateMockSalesHistory,
  type AnomalyAlert,
} from '@/lib/warehouse-analytics';

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
}

// Моковані дані продуктів
const mockProducts: ProductData[] = [
  { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', category: 'Смартфони' },
  { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-256', category: 'Смартфони' },
  { id: '3', name: 'MacBook Pro 14" M3', sku: 'APL-MBP14-M3', category: 'Ноутбуки' },
  { id: '4', name: 'AirPods Pro 2', sku: 'APL-APP2', category: 'Аксесуари' },
  { id: '5', name: 'Samsung Galaxy Watch 6', sku: 'SAM-GW6', category: 'Аксесуари' },
  { id: '6', name: 'ASUS ROG Strix G16', sku: 'ASUS-ROG-G16', category: 'Ноутбуки' },
  { id: '7', name: 'Xiaomi 14 Ultra', sku: 'XIA-14U', category: 'Смартфони' },
  { id: '8', name: 'Sony WH-1000XM5', sku: 'SONY-XM5', category: 'Аксесуари' },
];

export default function AnomaliesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [sensitivity, setSensitivity] = useState(2.5);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyAlert | null>(null);

  // Виявлення аномалій
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const productsWithHistory = mockProducts.map(product => {
        const history = generateMockSalesHistory(
          product.id,
          90,
          product.category === 'Смартфони' ? 3 : product.category === 'Ноутбуки' ? 1 : 5,
          0.6 // Більша варіація для демонстрації аномалій
        );
        return {
          id: product.id,
          name: product.name,
          salesHistory: history,
        };
      });

      const results = detectBulkAnomalies(productsWithHistory);
      setAnomalies(results);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [sensitivity]);

  // Фільтрація
  const filteredAnomalies = useMemo(() => {
    return anomalies
      .filter(a => !dismissedAnomalies.has(a.id))
      .filter(a => severityFilter === 'all' || a.severity === severityFilter)
      .filter(a => typeFilter === 'all' || a.type === typeFilter)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }, [anomalies, severityFilter, typeFilter, dismissedAnomalies]);

  // Статистика
  const stats = useMemo(() => {
    const active = anomalies.filter(a => !dismissedAnomalies.has(a.id));
    return {
      total: active.length,
      critical: active.filter(a => a.severity === 'critical').length,
      high: active.filter(a => a.severity === 'high').length,
      medium: active.filter(a => a.severity === 'medium').length,
      low: active.filter(a => a.severity === 'low').length,
      spikes: active.filter(a => a.type === 'spike').length,
      drops: active.filter(a => a.type === 'drop').length,
      zeroSales: active.filter(a => a.type === 'zero_sales').length,
    };
  }, [anomalies, dismissedAnomalies]);

  const dismissAnomaly = (id: string) => {
    setDismissedAnomalies(prev => new Set([...prev, id]));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-600" />;
      case 'high':
        return <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <InformationCircleIcon className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'spike':
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />;
      case 'drop':
        return <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />;
      case 'zero_sales':
        return <XMarkIcon className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'spike': return 'Сплеск продажів';
      case 'drop': return 'Падіння продажів';
      case 'zero_sales': return 'Нульові продажі';
      case 'unusual_pattern': return 'Незвичний патерн';
      default: return type;
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
          <h1 className="text-2xl font-bold text-gray-900">Виявлення аномалій</h1>
          <p className="text-gray-600">AI-аналіз відхилень від нормального попиту</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/warehouse/analytics/forecast"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Прогнози
          </Link>
          <Link
            href="/admin/warehouse/analytics/reorder"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Точки замовлення
          </Link>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <BellAlertIcon className="w-6 h-6 text-gray-600" />
            <span className="text-sm text-gray-600">Всього аномалій</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>

        <button
          onClick={() => setSeverityFilter('critical')}
          className={`rounded-xl p-4 shadow-sm border transition-colors text-left ${
            severityFilter === 'critical' ? 'ring-2 ring-red-500' : ''
          } bg-red-50 border-red-200 hover:bg-red-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
            <span className="text-sm text-red-700">Критичні</span>
          </div>
          <div className="text-3xl font-bold text-red-700">{stats.critical}</div>
        </button>

        <button
          onClick={() => setSeverityFilter('high')}
          className={`rounded-xl p-4 shadow-sm border transition-colors text-left ${
            severityFilter === 'high' ? 'ring-2 ring-orange-500' : ''
          } bg-orange-50 border-orange-200 hover:bg-orange-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
            <span className="text-sm text-orange-700">Високі</span>
          </div>
          <div className="text-3xl font-bold text-orange-700">{stats.high}</div>
        </button>

        <button
          onClick={() => setSeverityFilter('medium')}
          className={`rounded-xl p-4 shadow-sm border transition-colors text-left ${
            severityFilter === 'medium' ? 'ring-2 ring-yellow-500' : ''
          } bg-yellow-50 border-yellow-200 hover:bg-yellow-100`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            <span className="text-sm text-yellow-700">Середні</span>
          </div>
          <div className="text-3xl font-bold text-yellow-700">{stats.medium}</div>
        </button>
      </div>

      {/* Типи аномалій */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setTypeFilter('spike')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            typeFilter === 'spike' ? 'ring-2 ring-green-500 bg-green-50' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Сплески</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.spikes}</div>
          <div className="text-xs text-gray-500">Раптове зростання продажів</div>
        </button>

        <button
          onClick={() => setTypeFilter('drop')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            typeFilter === 'drop' ? 'ring-2 ring-red-500 bg-red-50' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
            <span className="font-medium text-gray-900">Падіння</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.drops}</div>
          <div className="text-xs text-gray-500">Раптове зниження продажів</div>
        </button>

        <button
          onClick={() => setTypeFilter('zero_sales')}
          className={`rounded-xl p-4 shadow-sm border transition-colors ${
            typeFilter === 'zero_sales' ? 'ring-2 ring-gray-500 bg-gray-100' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XMarkIcon className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Нульові продажі</span>
          </div>
          <div className="text-2xl font-bold text-gray-600">{stats.zeroSales}</div>
          <div className="text-xs text-gray-500">Продажі відсутні</div>
        </button>
      </div>

      {/* Налаштування чутливості */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Чутливість виявлення:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1.5"
              max="4"
              step="0.5"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm font-medium text-gray-900">{sensitivity}σ</span>
          </div>
          <div className="text-xs text-gray-500">
            (менше = більше аномалій, більше = менше аномалій)
          </div>

          <div className="ml-auto flex items-center gap-2">
            {severityFilter !== 'all' && (
              <button
                onClick={() => setSeverityFilter('all')}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Скинути фільтр
              </button>
            )}
            {typeFilter !== 'all' && (
              <button
                onClick={() => setTypeFilter('all')}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Скинути тип
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Список аномалій */}
      <div className="space-y-4">
        {filteredAnomalies.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800">Аномалій не виявлено</h3>
            <p className="text-green-700 mt-1">
              Всі продажі знаходяться в межах нормального діапазону
            </p>
          </div>
        ) : (
          filteredAnomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`bg-white rounded-xl shadow-sm border p-4 ${
                anomaly.severity === 'critical' ? 'border-red-300' :
                anomaly.severity === 'high' ? 'border-orange-300' :
                anomaly.severity === 'medium' ? 'border-yellow-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(anomaly.severity)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{anomaly.productName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity === 'critical' ? 'Критичний' :
                         anomaly.severity === 'high' ? 'Високий' :
                         anomaly.severity === 'medium' ? 'Середній' : 'Низький'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {getTypeIcon(anomaly.type)}
                        {getTypeText(anomaly.type)}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{anomaly.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {new Date(anomaly.date).toLocaleDateString('uk-UA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      <span>
                        Очікувано: <strong>{anomaly.expectedValue.toFixed(1)}</strong>
                      </span>
                      <span>
                        Фактично: <strong className={anomaly.actualValue > anomaly.expectedValue ? 'text-green-600' : 'text-red-600'}>
                          {anomaly.actualValue}
                        </strong>
                      </span>
                      <span>
                        Відхилення: <strong>{anomaly.deviation.toFixed(1)}σ</strong>
                      </span>
                    </div>

                    {/* Можливі причини */}
                    {anomaly.possibleCauses.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Можливі причини:</div>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {anomaly.possibleCauses.map((cause, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedAnomaly(anomaly)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Деталі"
                  >
                    <EyeIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => dismissAnomaly(anomaly.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Відхилити"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Інформація про методологію */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Методологія виявлення</h4>
            <p className="text-sm text-blue-800">
              Система використовує статистичний аналіз на основі стандартного відхилення (Z-score).
              Значення, що виходять за межі {sensitivity}σ від середнього, класифікуються як аномалії.
              Чим більше відхилення, тим вища серйозність.
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs text-blue-700">
              <span><strong>&gt;4σ</strong> = Критичний</span>
              <span><strong>3-4σ</strong> = Високий</span>
              <span><strong>2.5-3σ</strong> = Середній</span>
              <span><strong>&lt;2.5σ</strong> = Низький</span>
            </div>
          </div>
        </div>
      </div>

      {/* Модальне вікно деталей */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Деталі аномалії</h3>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Товар</div>
                <div className="font-medium text-gray-900">{selectedAnomaly.productName}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Тип</div>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedAnomaly.type)}
                    <span className="font-medium text-gray-900">{getTypeText(selectedAnomaly.type)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Серйозність</div>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedAnomaly.severity)}`}>
                    {selectedAnomaly.severity === 'critical' ? 'Критичний' :
                     selectedAnomaly.severity === 'high' ? 'Високий' :
                     selectedAnomaly.severity === 'medium' ? 'Середній' : 'Низький'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Очікувано</div>
                  <div className="text-xl font-bold text-gray-900">{selectedAnomaly.expectedValue.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Фактично</div>
                  <div className={`text-xl font-bold ${
                    selectedAnomaly.actualValue > selectedAnomaly.expectedValue ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedAnomaly.actualValue}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Відхилення</div>
                  <div className="text-xl font-bold text-gray-900">{selectedAnomaly.deviation.toFixed(2)}σ</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-2">Повідомлення</div>
                <p className="text-gray-700">{selectedAnomaly.message}</p>
              </div>

              {selectedAnomaly.possibleCauses.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Можливі причини</div>
                  <ul className="space-y-1">
                    {selectedAnomaly.possibleCauses.map((cause, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700">
                        <span className="w-2 h-2 bg-teal-500 rounded-full" />
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  dismissAnomaly(selectedAnomaly.id);
                  setSelectedAnomaly(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Відхилити
              </button>
              <Link
                href={`/admin/warehouse/analytics/forecast?product=${selectedAnomaly.productId}`}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Переглянути прогноз
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
