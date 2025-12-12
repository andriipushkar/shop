'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BuildingStorefrontIcon,
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  findOptimalShipmentSource,
  type ShipFromStoreResult,
} from '@/lib/warehouse-analytics';

interface Warehouse {
  id: string;
  name: string;
  type: 'warehouse' | 'store';
  location: { lat: number; lng: number };
  address: string;
  stock: Map<string, number>;
  shippingCostPerKm: number;
  processingTime: number; // години
}

interface OrderToFulfill {
  id: string;
  orderNumber: string;
  customer: string;
  address: string;
  location: { lat: number; lng: number };
  items: { productId: string; productName: string; quantity: number }[];
  priority: 'express' | 'standard';
}

// Моковані склади та магазини
const mockWarehouses: Warehouse[] = [
  {
    id: 'wh-1',
    name: 'Головний склад',
    type: 'warehouse',
    location: { lat: 50.4501, lng: 30.5234 }, // Київ центр
    address: 'м. Київ, вул. Хрещатик, 1',
    stock: new Map([
      ['1', 50], ['2', 30], ['3', 20], ['4', 100], ['5', 40],
      ['6', 15], ['7', 25], ['8', 35], ['9', 10], ['10', 8],
    ]),
    shippingCostPerKm: 2.5,
    processingTime: 4,
  },
  {
    id: 'store-1',
    name: 'Магазин "Центр"',
    type: 'store',
    location: { lat: 50.4547, lng: 30.5238 },
    address: 'м. Київ, вул. Велика Васильківська, 15',
    stock: new Map([
      ['1', 5], ['2', 3], ['4', 20], ['5', 10], ['8', 5],
    ]),
    shippingCostPerKm: 3.0,
    processingTime: 1,
  },
  {
    id: 'store-2',
    name: 'Магазин "Лівобережний"',
    type: 'store',
    location: { lat: 50.4312, lng: 30.6156 },
    address: 'м. Київ, пр. Бажана, 10',
    stock: new Map([
      ['1', 3], ['2', 5], ['4', 15], ['7', 8],
    ]),
    shippingCostPerKm: 3.0,
    processingTime: 1,
  },
  {
    id: 'store-3',
    name: 'Магазин "Оболонь"',
    type: 'store',
    location: { lat: 50.5012, lng: 30.4987 },
    address: 'м. Київ, пр. Оболонський, 25',
    stock: new Map([
      ['1', 4], ['3', 2], ['4', 12], ['5', 6], ['8', 8],
    ]),
    shippingCostPerKm: 3.0,
    processingTime: 1,
  },
  {
    id: 'wh-2',
    name: 'Регіональний склад (Одеса)',
    type: 'warehouse',
    location: { lat: 46.4825, lng: 30.7233 },
    address: 'м. Одеса, вул. Середньофонтанська, 50',
    stock: new Map([
      ['1', 20], ['2', 15], ['3', 10], ['4', 50], ['5', 25],
      ['6', 8], ['7', 12], ['8', 20],
    ]),
    shippingCostPerKm: 2.0,
    processingTime: 6,
  },
];

// Моковані замовлення для фулфілменту
const mockOrders: OrderToFulfill[] = [
  {
    id: 'ord-1',
    orderNumber: 'ORD-2024-101',
    customer: 'Олександр Мельник',
    address: 'м. Київ, вул. Саксаганського, 45',
    location: { lat: 50.4389, lng: 30.5124 },
    items: [
      { productId: '1', productName: 'iPhone 15 Pro', quantity: 1 },
      { productId: '4', productName: 'AirPods Pro 2', quantity: 1 },
    ],
    priority: 'express',
  },
  {
    id: 'ord-2',
    orderNumber: 'ORD-2024-102',
    customer: 'Марина Ковальчук',
    address: 'м. Київ, пр. Бажана, 36',
    location: { lat: 50.4256, lng: 30.6289 },
    items: [
      { productId: '2', productName: 'Samsung Galaxy S24', quantity: 1 },
    ],
    priority: 'standard',
  },
  {
    id: 'ord-3',
    orderNumber: 'ORD-2024-103',
    customer: 'Петро Шевченко',
    address: 'м. Одеса, вул. Дерибасівська, 10',
    location: { lat: 46.4846, lng: 30.7392 },
    items: [
      { productId: '3', productName: 'MacBook Pro 14"', quantity: 1 },
      { productId: '8', productName: 'Sony WH-1000XM5', quantity: 1 },
    ],
    priority: 'standard',
  },
  {
    id: 'ord-4',
    orderNumber: 'ORD-2024-104',
    customer: 'Анна Бондаренко',
    address: 'м. Київ, пр. Оболонський, 52',
    location: { lat: 50.5089, lng: 30.5012 },
    items: [
      { productId: '4', productName: 'AirPods Pro 2', quantity: 2 },
      { productId: '5', productName: 'Galaxy Watch 6', quantity: 1 },
    ],
    priority: 'express',
  },
  {
    id: 'ord-5',
    orderNumber: 'ORD-2024-105',
    customer: 'Ігор Савченко',
    address: 'м. Київ, вул. Хрещатик, 28',
    location: { lat: 50.4505, lng: 30.5220 },
    items: [
      { productId: '1', productName: 'iPhone 15 Pro', quantity: 2 },
      { productId: '7', productName: 'Xiaomi 14 Ultra', quantity: 1 },
    ],
    priority: 'standard',
  },
];

export default function ShipFromStorePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<Map<string, ShipFromStoreResult>>(new Map());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<Map<string, string>>(new Map());

  // Розрахунок оптимальних джерел
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const newResults = new Map<string, ShipFromStoreResult>();
      const newSelectedSource = new Map<string, string>();

      mockOrders.forEach(order => {
        const warehousesForOrder = mockWarehouses.map(wh => ({
          id: wh.id,
          name: wh.name,
          type: wh.type,
          location: wh.location,
          stock: wh.stock, // Keep as Map
          shippingCostPerKm: wh.shippingCostPerKm,
          processingTime: wh.processingTime,
        }));

        const result = findOptimalShipmentSource(
          order.id,
          order.items,
          order.location,
          warehousesForOrder
        );

        newResults.set(order.id, result);
        newSelectedSource.set(order.id, result.recommendedSource.warehouseId);
      });

      setResults(newResults);
      setSelectedSource(newSelectedSource);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Статистика
  const stats = useMemo(() => {
    let totalOrders = mockOrders.length;
    let fromStores = 0;
    let fromWarehouses = 0;
    let totalCost = 0;
    let expressCount = 0;

    results.forEach((result, orderId) => {
      const order = mockOrders.find(o => o.id === orderId);
      const source = mockWarehouses.find(w => w.id === selectedSource.get(orderId));

      if (source?.type === 'store') fromStores++;
      else fromWarehouses++;

      totalCost += result.recommendedSource.shippingCost;
      if (order?.priority === 'express') expressCount++;
    });

    return {
      totalOrders,
      fromStores,
      fromWarehouses,
      totalCost: Math.round(totalCost),
      expressCount,
      avgDeliveryTime: 1.5, // Середній час в днях
    };
  }, [results, selectedSource]);

  const getSourceById = (id: string) => mockWarehouses.find(w => w.id === id);

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
          <h1 className="text-2xl font-bold text-gray-900">Ship-from-Store</h1>
          <p className="text-gray-600">Оптимізація відвантаження з найближчої точки</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/warehouse/analytics/zones"
            className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg hover:bg-teal-50"
          >
            Карта зон
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <ArrowPathIcon className="w-5 h-5" />
            Перерахувати
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TruckIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Всього</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 shadow-sm border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <BuildingStorefrontIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-purple-700">З магазинів</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{stats.fromStores}</div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-700">Зі складів</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.fromWarehouses}</div>
        </div>

        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">Експрес</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.expressCount}</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CurrencyDollarIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Вартість</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalCost} ₴</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Сер. доставка</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.avgDeliveryTime} дн.</div>
        </div>
      </div>

      {/* Карта джерел */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Джерела відвантаження</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {mockWarehouses.map(wh => {
            const ordersFromHere = Array.from(selectedSource.entries())
              .filter(([_, sourceId]) => sourceId === wh.id).length;

            return (
              <div
                key={wh.id}
                className={`p-4 rounded-lg border-2 ${
                  wh.type === 'store'
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {wh.type === 'store' ? (
                    <BuildingStorefrontIcon className="w-5 h-5 text-purple-600" />
                  ) : (
                    <CubeIcon className="w-5 h-5 text-blue-600" />
                  )}
                  <span className="font-medium text-gray-900">{wh.name}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">{wh.address}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Замовлень:</span>
                  <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                    ordersFromHere > 0
                      ? wh.type === 'store' ? 'bg-purple-200 text-purple-800' : 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {ordersFromHere}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Список замовлень */}
      <div className="space-y-4">
        {mockOrders.map(order => {
          const result = results.get(order.id);
          const isExpanded = expandedOrder === order.id;
          const currentSourceId = selectedSource.get(order.id);
          const currentSource = currentSourceId ? getSourceById(currentSourceId) : null;

          if (!result) return null;

          return (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          order.priority === 'express'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {order.priority === 'express' ? 'Експрес' : 'Стандарт'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{order.customer}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Рекомендоване джерело */}
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Джерело</div>
                      <div className="flex items-center gap-2">
                        {currentSource?.type === 'store' ? (
                          <BuildingStorefrontIcon className="w-4 h-4 text-purple-600" />
                        ) : (
                          <CubeIcon className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="font-medium text-gray-900">{currentSource?.name}</span>
                      </div>
                    </div>

                    {/* Метрики */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-gray-500">Відстань</div>
                        <div className="font-medium">{result.recommendedSource.distance.toFixed(1)} км</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">Доставка</div>
                        <div className="font-medium">{result.recommendedSource.estimatedDeliveryDays} дн.</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">Вартість</div>
                        <div className="font-medium">{Math.round(result.recommendedSource.shippingCost)} ₴</div>
                      </div>
                    </div>

                    {/* Статус наявності */}
                    <div className="flex items-center">
                      {result.recommendedSource.hasAllItems ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
                          <CheckCircleIcon className="w-4 h-4" />
                          Все є
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                          <ExclamationTriangleIcon className="w-4 h-4" />
                          Часткова
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Товари */}
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{order.address}</span>
                  <span className="mx-2">•</span>
                  {order.items.map((item, i) => (
                    <span key={i}>
                      {item.productName} ×{item.quantity}
                      {i < order.items.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>

              {/* Альтернативи */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3">Альтернативні джерела</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.alternatives.map(alt => {
                      const altSource = getSourceById(alt.warehouseId);
                      const isSelected = currentSourceId === alt.warehouseId;

                      return (
                        <button
                          key={alt.warehouseId}
                          onClick={() => {
                            const newSelected = new Map(selectedSource);
                            newSelected.set(order.id, alt.warehouseId);
                            setSelectedSource(newSelected);
                          }}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {altSource?.type === 'store' ? (
                                <BuildingStorefrontIcon className="w-4 h-4 text-purple-600" />
                              ) : (
                                <CubeIcon className="w-4 h-4 text-blue-600" />
                              )}
                              <span className="font-medium text-gray-900">{alt.warehouseName}</span>
                            </div>
                            {isSelected && (
                              <CheckCircleIcon className="w-5 h-5 text-teal-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">{alt.reason}</div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Оцінка: {alt.score.toFixed(0)}</span>
                            {altSource?.type === 'store' && (
                              <span className="text-purple-600">Швидка обробка</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Інформація */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Ship-from-Store алгоритм</h4>
            <p className="text-sm text-blue-800">
              Система автоматично вибирає оптимальне джерело для кожного замовлення на основі:
              відстані до клієнта, наявності товару, вартості доставки та часу обробки.
              Магазини мають швидшу обробку (1-2 год), але обмежений асортимент.
              Склади мають повний асортимент, але довший час обробки.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
