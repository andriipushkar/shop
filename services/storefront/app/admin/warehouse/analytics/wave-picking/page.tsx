'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  QueueListIcon,
  ClockIcon,
  UserIcon,
  TruckIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  CubeIcon,
  ArrowPathIcon,
  PrinterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import {
  createWavePickingBatches,
  type WavePickingBatch,
} from '@/lib/warehouse-analytics';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  zone: string;
  location: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  items: OrderItem[];
  priority: 'express' | 'standard' | 'economy';
  deadline: string;
  status: 'pending' | 'picking' | 'packed' | 'shipped';
}

// Моковані замовлення
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customer: 'Іван Петренко',
    items: [
      { productId: '1', productName: 'iPhone 15 Pro', quantity: 1, zone: 'A-01', location: 'A-01-01' },
      { productId: '4', productName: 'AirPods Pro 2', quantity: 2, zone: 'A-02', location: 'A-02-01' },
    ],
    priority: 'express',
    deadline: '2024-01-15T14:00:00',
    status: 'pending',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customer: 'Марія Коваль',
    items: [
      { productId: '2', productName: 'Samsung Galaxy S24', quantity: 1, zone: 'A-01', location: 'A-01-02' },
    ],
    priority: 'express',
    deadline: '2024-01-15T14:00:00',
    status: 'pending',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customer: 'Олексій Шевченко',
    items: [
      { productId: '3', productName: 'MacBook Pro 14"', quantity: 1, zone: 'B-02', location: 'B-02-01' },
      { productId: '8', productName: 'Sony WH-1000XM5', quantity: 1, zone: 'A-02', location: 'A-02-03' },
    ],
    priority: 'standard',
    deadline: '2024-01-16T18:00:00',
    status: 'pending',
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    customer: 'Наталія Бондар',
    items: [
      { productId: '5', productName: 'Galaxy Watch 6', quantity: 1, zone: 'A-02', location: 'A-02-02' },
      { productId: '7', productName: 'Xiaomi 14 Ultra', quantity: 1, zone: 'A-01', location: 'A-01-03' },
    ],
    priority: 'standard',
    deadline: '2024-01-16T18:00:00',
    status: 'pending',
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    customer: 'Сергій Мельник',
    items: [
      { productId: '6', productName: 'ASUS ROG Strix', quantity: 1, zone: 'B-02', location: 'B-02-02' },
    ],
    priority: 'economy',
    deadline: '2024-01-17T18:00:00',
    status: 'pending',
  },
  {
    id: '6',
    orderNumber: 'ORD-2024-006',
    customer: 'Ольга Кравченко',
    items: [
      { productId: '4', productName: 'AirPods Pro 2', quantity: 1, zone: 'A-02', location: 'A-02-01' },
    ],
    priority: 'express',
    deadline: '2024-01-15T16:00:00',
    status: 'pending',
  },
  {
    id: '7',
    orderNumber: 'ORD-2024-007',
    customer: 'Дмитро Ткаченко',
    items: [
      { productId: '1', productName: 'iPhone 15 Pro', quantity: 2, zone: 'A-01', location: 'A-01-01' },
      { productId: '5', productName: 'Galaxy Watch 6', quantity: 1, zone: 'A-02', location: 'A-02-02' },
      { productId: '8', productName: 'Sony WH-1000XM5', quantity: 1, zone: 'A-02', location: 'A-02-03' },
    ],
    priority: 'standard',
    deadline: '2024-01-16T12:00:00',
    status: 'pending',
  },
  {
    id: '8',
    orderNumber: 'ORD-2024-008',
    customer: 'Юлія Савченко',
    items: [
      { productId: '9', productName: 'Pixel 8 Pro', quantity: 1, zone: 'C-01', location: 'C-01-01' },
      { productId: '10', productName: 'Dell XPS 15', quantity: 1, zone: 'C-01', location: 'C-01-02' },
    ],
    priority: 'economy',
    deadline: '2024-01-18T18:00:00',
    status: 'pending',
  },
];

export default function WavePickingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [batches, setBatches] = useState<WavePickingBatch[]>([]);
  const [maxOrdersPerBatch, setMaxOrdersPerBatch] = useState(5);
  const [maxItemsPerBatch, setMaxItemsPerBatch] = useState(15);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);

  // Генерація хвиль
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const ordersForPicking = mockOrders
        .filter(o => o.status === 'pending')
        .map(o => ({
          orderId: o.id,
          items: o.items.map(item => ({
            productId: item.productId,
            zone: item.zone,
            quantity: item.quantity,
          })),
          priority: o.priority,
        }));

      const results = createWavePickingBatches(ordersForPicking, maxOrdersPerBatch, maxItemsPerBatch);
      setBatches(results);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [maxOrdersPerBatch, maxItemsPerBatch]);

  // Статистика
  const stats = useMemo(() => {
    return {
      totalBatches: batches.length,
      totalOrders: mockOrders.filter(o => o.status === 'pending').length,
      totalItems: mockOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
      expressOrders: mockOrders.filter(o => o.status === 'pending' && o.priority === 'express').length,
      estimatedTime: batches.reduce((sum, b) => sum + b.estimatedTime, 0),
    };
  }, [batches]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'express': return 'bg-red-100 text-red-700 border-red-200';
      case 'standard': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'economy': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'express': return 'Експрес';
      case 'standard': return 'Стандарт';
      case 'economy': return 'Економ';
      default: return priority;
    }
  };

  const getOrderByBatchOrderId = (orderId: string) => {
    return mockOrders.find(o => o.id === orderId);
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
          <h1 className="text-2xl font-bold text-gray-900">Wave Picking</h1>
          <p className="text-gray-600">Оптимізація збору замовлень хвилями</p>
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
            Оновити хвилі
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <QueueListIcon className="w-5 h-5 text-teal-600" />
            <span className="text-sm text-gray-600">Хвиль</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalBatches}</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TruckIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Замовлень</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-600">Товарів</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
        </div>

        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">Експрес</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.expressOrders}</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">Загальний час</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.estimatedTime} хв</div>
        </div>
      </div>

      {/* Налаштування */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Макс. замовлень в хвилі</label>
            <select
              value={maxOrdersPerBatch}
              onChange={(e) => setMaxOrdersPerBatch(Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={3}>3 замовлення</option>
              <option value={5}>5 замовлень</option>
              <option value={8}>8 замовлень</option>
              <option value={10}>10 замовлень</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Макс. товарів в хвилі</label>
            <select
              value={maxItemsPerBatch}
              onChange={(e) => setMaxItemsPerBatch(Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={10}>10 товарів</option>
              <option value={15}>15 товарів</option>
              <option value={20}>20 товарів</option>
              <option value={30}>30 товарів</option>
            </select>
          </div>
        </div>
      </div>

      {/* Список хвиль */}
      <div className="space-y-4">
        {batches.map((batch, index) => {
          const isExpanded = expandedBatch === batch.batchId;
          const isActive = activeBatch === batch.batchId;
          const batchOrders = batch.orders.map(id => getOrderByBatchOrderId(id)).filter(Boolean) as Order[];

          return (
            <div
              key={batch.batchId}
              className={`bg-white rounded-xl shadow-sm border transition-all ${
                isActive ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-100'
              }`}
            >
              {/* Заголовок хвилі */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      batch.priority === 'express' ? 'bg-red-500' :
                      batch.priority === 'standard' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">Хвиля #{index + 1}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(batch.priority)}`}>
                          {getPriorityText(batch.priority)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span>{batch.orders.length} замовлень</span>
                        <span>{batch.totalItems} товарів</span>
                        <span>{batch.totalProducts} SKU</span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          ~{batch.estimatedTime} хв
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button
                        onClick={() => setActiveBatch(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                      >
                        <PauseIcon className="w-5 h-5" />
                        Призупинити
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveBatch(batch.batchId)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                      >
                        <PlayIcon className="w-5 h-5" />
                        Почати
                      </button>
                    )}
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                      <PrinterIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setExpandedBatch(isExpanded ? null : batch.batchId)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Маршрут по зонах */}
                <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
                  <span className="text-sm text-gray-500">Маршрут:</span>
                  {batch.route.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                        {stop.zone}
                        <span className="text-gray-400 ml-1">({stop.products.reduce((s, p) => s + p.quantity, 0)} шт.)</span>
                      </span>
                      {i < batch.route.length - 1 && <span className="text-gray-300">→</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Деталі хвилі */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3">Замовлення в хвилі</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {batchOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{order.orderNumber}</span>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(order.priority)}`}>
                              {getPriorityText(order.priority)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">{order.customer}</span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <MapPinIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">{item.location}</span>
                                <span className="text-gray-900">{item.productName}</span>
                              </div>
                              <span className="text-gray-500">×{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Товари для збору */}
                  <h4 className="font-medium text-gray-900 mt-6 mb-3">Товари для збору (оптимізований маршрут)</h4>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">№</th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Зона</th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Товар</th>
                          <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Кількість</th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batch.route.flatMap((stop, stopIndex) =>
                          stop.products.map((product, productIndex) => {
                            const orderItem = batchOrders
                              .flatMap(o => o.items)
                              .find(i => i.productId === product.productId);
                            const itemNumber = batch.route
                              .slice(0, stopIndex)
                              .reduce((sum, s) => sum + s.products.length, 0) + productIndex + 1;

                            return (
                              <tr key={`${stop.zone}-${product.productId}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-500">{itemNumber}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-gray-700">
                                    {stop.zone}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="text-sm font-medium text-gray-900">{orderItem?.productName || product.productId}</div>
                                  <div className="text-xs text-gray-500">{orderItem?.location}</div>
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                                  {product.quantity}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {isActive ? (
                                    <button className="p-1 text-gray-400 hover:text-green-600">
                                      <CheckCircleIcon className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Пустий стан */}
      {batches.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <QueueListIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">Немає замовлень для пікінгу</h3>
          <p className="text-gray-500 mt-1">Всі замовлення вже оброблено або очікують на нові</p>
        </div>
      )}

      {/* Інформація */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <QueueListIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Wave Picking оптимізація</h4>
            <p className="text-sm text-blue-800">
              Система автоматично групує замовлення в хвилі за пріоритетом та локацією товарів.
              Оптимізований маршрут мінімізує переміщення по складу та скорочує час збору на 30-40%.
              Експрес-замовлення завжди обробляються першими.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
