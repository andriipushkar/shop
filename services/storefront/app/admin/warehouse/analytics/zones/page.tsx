'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FireIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  InformationCircleIcon,
  MapIcon,
  ChartBarIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
  classifyHotColdZones,
  type HotColdZone,
} from '@/lib/warehouse-analytics';

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  location: string;
  turnoverRate: number;
  monthlyPicks: number;
}

// Моковані дані продуктів з локаціями
const mockProducts: ProductData[] = [
  { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'APL-IP15P-256', category: 'Смартфони', location: 'A-01-01', turnoverRate: 12.5, monthlyPicks: 156 },
  { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'SAM-S24U-256', category: 'Смартфони', location: 'A-01-02', turnoverRate: 10.2, monthlyPicks: 98 },
  { id: '3', name: 'MacBook Pro 14" M3', sku: 'APL-MBP14-M3', category: 'Ноутбуки', location: 'B-02-01', turnoverRate: 4.5, monthlyPicks: 42 },
  { id: '4', name: 'AirPods Pro 2', sku: 'APL-APP2', category: 'Аксесуари', location: 'A-02-01', turnoverRate: 18.3, monthlyPicks: 245 },
  { id: '5', name: 'Samsung Galaxy Watch 6', sku: 'SAM-GW6', category: 'Аксесуари', location: 'A-02-02', turnoverRate: 8.7, monthlyPicks: 65 },
  { id: '6', name: 'ASUS ROG Strix G16', sku: 'ASUS-ROG-G16', category: 'Ноутбуки', location: 'B-02-02', turnoverRate: 3.2, monthlyPicks: 35 },
  { id: '7', name: 'Xiaomi 14 Ultra', sku: 'XIA-14U', category: 'Смартфони', location: 'A-01-03', turnoverRate: 7.8, monthlyPicks: 78 },
  { id: '8', name: 'Sony WH-1000XM5', sku: 'SONY-XM5', category: 'Аксесуари', location: 'A-02-03', turnoverRate: 6.5, monthlyPicks: 54 },
  { id: '9', name: 'Google Pixel 8 Pro', sku: 'GOO-PX8P', category: 'Смартфони', location: 'C-01-01', turnoverRate: 2.1, monthlyPicks: 15 },
  { id: '10', name: 'Dell XPS 15', sku: 'DELL-XPS15', category: 'Ноутбуки', location: 'C-01-02', turnoverRate: 1.8, monthlyPicks: 12 },
  { id: '11', name: 'Huawei Watch GT 4', sku: 'HUA-GT4', category: 'Аксесуари', location: 'C-02-01', turnoverRate: 0.5, monthlyPicks: 3 },
  { id: '12', name: 'OnePlus Buds Pro 2', sku: 'OP-BP2', category: 'Аксесуари', location: 'C-02-02', turnoverRate: 0.8, monthlyPicks: 5 },
];

// Структура складу (5x4 сітка)
const warehouseLayout = {
  rows: 4,
  cols: 5,
  zones: [
    { id: 'A-01', row: 0, col: 0, label: 'A-01' },
    { id: 'A-02', row: 0, col: 1, label: 'A-02' },
    { id: 'A-03', row: 0, col: 2, label: 'A-03' },
    { id: 'A-04', row: 0, col: 3, label: 'A-04' },
    { id: 'A-05', row: 0, col: 4, label: 'A-05' },
    { id: 'B-01', row: 1, col: 0, label: 'B-01' },
    { id: 'B-02', row: 1, col: 1, label: 'B-02' },
    { id: 'B-03', row: 1, col: 2, label: 'B-03' },
    { id: 'B-04', row: 1, col: 3, label: 'B-04' },
    { id: 'B-05', row: 1, col: 4, label: 'B-05' },
    { id: 'C-01', row: 2, col: 0, label: 'C-01' },
    { id: 'C-02', row: 2, col: 1, label: 'C-02' },
    { id: 'C-03', row: 2, col: 2, label: 'C-03' },
    { id: 'C-04', row: 2, col: 3, label: 'C-04' },
    { id: 'C-05', row: 2, col: 4, label: 'C-05' },
    { id: 'D-01', row: 3, col: 0, label: 'D-01' },
    { id: 'D-02', row: 3, col: 1, label: 'D-02' },
    { id: 'D-03', row: 3, col: 2, label: 'D-03' },
    { id: 'D-04', row: 3, col: 3, label: 'D-04' },
    { id: 'D-05', row: 3, col: 4, label: 'D-05' },
  ],
};

export default function ZonesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState<HotColdZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Класифікація зон
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const productsForAnalysis = mockProducts.map(p => ({
        id: p.id,
        name: p.name,
        turnoverRate: p.turnoverRate,
        pickFrequency: p.monthlyPicks,
      }));

      const results = classifyHotColdZones(productsForAnalysis);
      setZones(results);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Отримати тип зони
  const getZoneType = (zoneId: string): 'hot' | 'warm' | 'cold' | 'frozen' | 'empty' => {
    const zone = zones.find(z => z.zone === zoneId);
    return zone?.type || 'empty';
  };

  // Отримати колір зони
  const getZoneColor = (type: string) => {
    switch (type) {
      case 'hot': return 'bg-red-500';
      case 'warm': return 'bg-orange-400';
      case 'cold': return 'bg-blue-400';
      case 'frozen': return 'bg-blue-700';
      default: return 'bg-gray-200';
    }
  };

  const getZoneBgColor = (type: string) => {
    switch (type) {
      case 'hot': return 'bg-red-100 border-red-300';
      case 'warm': return 'bg-orange-100 border-orange-300';
      case 'cold': return 'bg-blue-100 border-blue-300';
      case 'frozen': return 'bg-blue-200 border-blue-400';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  // Статистика
  const stats = useMemo(() => {
    return {
      hot: zones.filter(z => z.type === 'hot').length,
      warm: zones.filter(z => z.type === 'warm').length,
      cold: zones.filter(z => z.type === 'cold').length,
      frozen: zones.filter(z => z.type === 'frozen').length,
      totalProducts: mockProducts.length,
      totalPicks: mockProducts.reduce((sum, p) => sum + p.monthlyPicks, 0),
    };
  }, [zones]);

  // Рекомендації щодо переміщення
  const recommendations = useMemo(() => {
    const results: { product: ProductData; currentZone: string; suggestedZone: string; reason: string }[] = [];

    // Знайти товари в холодних зонах з високим оборотом
    mockProducts.forEach(product => {
      const currentZoneId = product.location.split('-').slice(0, 2).join('-');
      const zoneInfo = zones.find(z => z.zone === currentZoneId);

      if (zoneInfo?.type === 'cold' || zoneInfo?.type === 'frozen') {
        if (product.turnoverRate > 5) {
          results.push({
            product,
            currentZone: currentZoneId,
            suggestedZone: 'A-01',
            reason: 'Високий оборот, перемістити в гарячу зону',
          });
        }
      } else if (zoneInfo?.type === 'hot') {
        if (product.turnoverRate < 2) {
          results.push({
            product,
            currentZone: currentZoneId,
            suggestedZone: 'C-01',
            reason: 'Низький оборот, звільнити гарячу зону',
          });
        }
      }
    });

    return results;
  }, [zones]);

  const selectedZoneInfo = selectedZone ? zones.find(z => z.zone === selectedZone) : null;
  const productsInSelectedZone = selectedZone
    ? mockProducts.filter(p => p.location.startsWith(selectedZone))
    : [];

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
          <h1 className="text-2xl font-bold text-gray-900">Гарячі/Холодні зони</h1>
          <p className="text-gray-600">Оптимізація розміщення товарів на складі</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 text-sm ${viewMode === 'map' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <ChartBarIcon className="w-5 h-5" />
            </button>
          </div>
          <Link
            href="/admin/warehouse/analytics/wave-picking"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Wave Picking
          </Link>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FireIcon className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">Гарячі зони</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.hot}</div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-orange-400 rounded-full" />
            <span className="text-sm text-orange-700">Теплі зони</span>
          </div>
          <div className="text-2xl font-bold text-orange-700">{stats.warm}</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-blue-400 rounded-full" />
            <span className="text-sm text-blue-700">Холодні зони</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.cold}</div>
        </div>

        <div className="bg-blue-100 border border-blue-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-blue-700 rounded-full" />
            <span className="text-sm text-blue-800">Заморожені</span>
          </div>
          <div className="text-2xl font-bold text-blue-800">{stats.frozen}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Товарів</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowPathIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Пікінгів/міс.</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalPicks}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Карта складу */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Карта складу</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded" /> Гаряча
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-400 rounded" /> Тепла
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-400 rounded" /> Холодна
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-700 rounded" /> Заморожена
                </span>
              </div>
            </div>

            {/* Вхід/Вихід */}
            <div className="mb-4 flex justify-between text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">→ Вхід</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">← Вихід (пікінг)</span>
              </span>
            </div>

            {/* Сітка складу */}
            <div className="grid grid-cols-5 gap-2">
              {warehouseLayout.zones.map((zone) => {
                const zoneType = getZoneType(zone.id);
                const zoneInfo = zones.find(z => z.zone === zone.id);
                const productsCount = mockProducts.filter(p => p.location.startsWith(zone.id)).length;
                const isSelected = selectedZone === zone.id;

                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZone(isSelected ? null : zone.id)}
                    className={`aspect-square rounded-lg border-2 p-2 transition-all ${
                      getZoneBgColor(zoneType)
                    } ${isSelected ? 'ring-2 ring-teal-500 ring-offset-2' : 'hover:opacity-80'}`}
                  >
                    <div className="h-full flex flex-col justify-between">
                      <div className="text-xs font-bold text-gray-700">{zone.label}</div>
                      <div className="text-center">
                        <div className={`w-8 h-8 mx-auto rounded-full ${getZoneColor(zoneType)} flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{productsCount}</span>
                        </div>
                      </div>
                      {zoneInfo && (
                        <div className="text-[10px] text-gray-600 text-center">
                          {zoneInfo.accessFrequency}/день
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Прохід */}
            <div className="mt-2 flex justify-center">
              <div className="w-full h-8 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">
                Центральний прохід
              </div>
            </div>
          </div>
        </div>

        {/* Деталі зони */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
            {selectedZone && selectedZoneInfo ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Зона {selectedZone}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedZoneInfo.type === 'hot' ? 'bg-red-100 text-red-700' :
                    selectedZoneInfo.type === 'warm' ? 'bg-orange-100 text-orange-700' :
                    selectedZoneInfo.type === 'cold' ? 'bg-blue-100 text-blue-700' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {selectedZoneInfo.type === 'hot' ? 'Гаряча' :
                     selectedZoneInfo.type === 'warm' ? 'Тепла' :
                     selectedZoneInfo.type === 'cold' ? 'Холодна' : 'Заморожена'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Опис</div>
                    <div className="text-gray-900">{selectedZoneInfo.description}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Частота доступу</div>
                    <div className="text-xl font-bold text-gray-900">{selectedZoneInfo.accessFrequency} раз/день</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Рекомендоване розміщення</div>
                    <div className="text-gray-900">{selectedZoneInfo.recommendedLocation}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500 mb-2">Товари в зоні ({productsInSelectedZone.length})</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {productsInSelectedZone.map(product => (
                        <div key={product.id} className="p-2 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{product.location}</span>
                            <span>{product.monthlyPicks} пікінгів</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <MapIcon className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-center">Виберіть зону на карті для перегляду деталей</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Рекомендації щодо переміщення */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowsRightLeftIcon className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Рекомендації щодо переміщення</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Товар</th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Поточна зона</th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500"></th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Рекомендована</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Причина</th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Дія</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recommendations.map((rec, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{rec.product.name}</div>
                      <div className="text-sm text-gray-500">{rec.product.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        getZoneType(rec.currentZone) === 'hot' ? 'bg-red-100 text-red-700' :
                        getZoneType(rec.currentZone) === 'cold' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rec.currentZone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-400">→</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        rec.suggestedZone.startsWith('A') ? 'bg-red-100 text-red-700' :
                        rec.suggestedZone.startsWith('C') ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rec.suggestedZone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rec.reason}</td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href="/admin/warehouse/transfer/new"
                        className="px-3 py-1 text-sm bg-teal-100 text-teal-700 rounded hover:bg-teal-200"
                      >
                        Перемістити
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Інформація */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Принцип Hot/Cold Zone</h4>
            <p className="text-sm text-blue-800">
              <strong>Гарячі зони</strong> (ближче до виходу) — для товарів з високим оборотом (більше 10 пікінгів/день).
              <strong> Холодні зони</strong> (далі від виходу) — для товарів з низьким оборотом.
              Правильне розміщення скорочує час пікінгу на 20-40%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
