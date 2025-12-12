'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  TruckIcon,
  CameraIcon,
  DocumentTextIcon,
  UserIcon,
  MapPinIcon,
  PhoneIcon,
  QrCodeIcon,
  CheckCircleIcon,
  PrinterIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import BarcodeScanner from '../../components/BarcodeScanner';

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reserved: number;
  picked: number;
  location: string;
  barcode: string;
}

interface Order {
  id: string;
  number: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  address: string;
  delivery: string;
  items: OrderItem[];
  status: 'pending' | 'picking' | 'packed' | 'shipped';
  total: number;
  createdAt: string;
}

// Мокові замовлення
const mockOrders: Order[] = [
  {
    id: '1',
    number: 'ORD-2024-1234',
    customer: { name: 'Іван Петренко', phone: '+380501234567', email: 'ivan@example.com' },
    address: 'м. Київ, вул. Хрещатик 22, кв. 15',
    delivery: 'Нова Пошта',
    items: [
      { id: '1', sku: 'PHONE-001', name: 'iPhone 15 Pro 256GB', quantity: 1, reserved: 1, picked: 0, location: 'A-01-02', barcode: '4820024700016' },
      { id: '2', sku: 'ACC-001', name: 'AirPods Pro 2', quantity: 2, reserved: 2, picked: 0, location: 'B-03-05', barcode: '4820024700023' },
    ],
    status: 'pending',
    total: 59000,
    createdAt: '2024-01-16 14:30',
  },
  {
    id: '2',
    number: 'ORD-2024-1235',
    customer: { name: 'Марія Коваль', phone: '+380671234567', email: 'maria@example.com' },
    address: 'м. Львів, вул. Франка 10',
    delivery: 'Укрпошта',
    items: [
      { id: '3', sku: 'LAPTOP-001', name: 'MacBook Pro 14" M3', quantity: 1, reserved: 1, picked: 0, location: 'C-02-01', barcode: '5901234123457' },
    ],
    status: 'pending',
    total: 85000,
    createdAt: '2024-01-16 15:15',
  },
];

const warehouses = [
  { id: '1', name: 'Головний склад' },
  { id: '2', name: 'Магазин "Центр"' },
];

export default function NewShipmentPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0].id);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<'order' | 'item'>('order');
  const [ttn, setTtn] = useState('');
  const [notes, setNotes] = useState('');

  // Фільтрація замовлень
  const filteredOrders = mockOrders.filter(order =>
    order.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer.phone.includes(searchQuery)
  );

  // Вибір замовлення
  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderItems(order.items.map(item => ({ ...item, picked: 0 })));
    setSearchQuery('');
  };

  // Сканування товару
  const handleScan = (barcode: string) => {
    if (scanMode === 'order') {
      // Пошук замовлення за штрих-кодом (якщо на ньому є штрих-код)
      const order = mockOrders.find(o => o.number.includes(barcode));
      if (order) {
        selectOrder(order);
      }
    } else {
      // Пошук товару в замовленні
      const itemIndex = orderItems.findIndex(item => item.barcode === barcode);
      if (itemIndex >= 0) {
        const item = orderItems[itemIndex];
        if (item.picked < item.quantity) {
          updatePicked(item.id, item.picked + 1);
        }
      }
    }
    setShowScanner(false);
  };

  // Оновити кількість зібраного
  const updatePicked = (itemId: string, picked: number) => {
    setOrderItems(orderItems.map(item =>
      item.id === itemId ? { ...item, picked: Math.min(picked, item.quantity) } : item
    ));
  };

  // Перевірка чи все зібрано
  const isFullyPicked = orderItems.length > 0 && orderItems.every(item => item.picked === item.quantity);
  const pickedCount = orderItems.reduce((sum, item) => sum + item.picked, 0);
  const totalCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Швидке збирання (зібрати все)
  const pickAll = () => {
    setOrderItems(orderItems.map(item => ({ ...item, picked: item.quantity })));
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/warehouse"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Відвантаження товару</h1>
            <p className="text-gray-600">Збір та відправка замовлення</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ліва панель - замовлення */}
        <div className="lg:col-span-2 space-y-6">
          {/* Пошук замовлення */}
          {!selectedOrder && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClipboardDocumentListIcon className="w-5 h-5 text-teal-600" />
                Виберіть замовлення
              </h2>

              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Пошук за номером, клієнтом або телефоном..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <button
                  onClick={() => { setScanMode('order'); setShowScanner(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <QrCodeIcon className="w-5 h-5" />
                  Сканувати
                </button>
              </div>

              <div className="space-y-2">
                {filteredOrders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => selectOrder(order)}
                    className="w-full p-4 text-left bg-gray-50 rounded-lg hover:bg-teal-50 border border-gray-100 hover:border-teal-200 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{order.number}</div>
                        <div className="text-sm text-gray-600">{order.customer.name}</div>
                        <div className="text-xs text-gray-500">{order.items.length} позицій • {order.delivery}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{order.total.toLocaleString()} ₴</div>
                        <div className="text-xs text-gray-500">{order.createdAt}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Деталі замовлення */}
          {selectedOrder && (
            <>
              {/* Інформація про замовлення */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5 text-teal-600" />
                    Замовлення {selectedOrder.number}
                  </h2>
                  <button
                    onClick={() => { setSelectedOrder(null); setOrderItems([]); }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Змінити замовлення
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <UserIcon className="w-4 h-4" />
                      Клієнт
                    </div>
                    <div className="font-medium text-gray-900">{selectedOrder.customer.name}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <PhoneIcon className="w-3 h-3" />
                      {selectedOrder.customer.phone}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <MapPinIcon className="w-4 h-4" />
                      Доставка
                    </div>
                    <div className="font-medium text-gray-900">{selectedOrder.delivery}</div>
                    <div className="text-sm text-gray-600">{selectedOrder.address}</div>
                  </div>
                </div>
              </div>

              {/* Збір товарів */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TruckIcon className="w-5 h-5 text-teal-600" />
                    Збір товарів
                    <span className="text-sm font-normal text-gray-500">
                      ({pickedCount}/{totalCount})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={pickAll}
                      className="text-sm text-teal-600 hover:text-teal-700"
                    >
                      Зібрати все
                    </button>
                    <button
                      onClick={() => { setScanMode('item'); setShowScanner(true); }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      <CameraIcon className="w-4 h-4" />
                      Сканувати
                    </button>
                  </div>
                </div>

                {/* Прогрес збору */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Прогрес збору</span>
                    <span className="font-medium text-gray-900">
                      {totalCount > 0 ? Math.round((pickedCount / totalCount) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${isFullyPicked ? 'bg-green-500' : 'bg-teal-500'}`}
                      style={{ width: `${totalCount > 0 ? (pickedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Список товарів */}
                <div className="space-y-2">
                  {orderItems.map(item => {
                    const isPicked = item.picked === item.quantity;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isPicked
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isPicked ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {isPicked ? (
                              <CheckCircleIcon className="w-6 h-6" />
                            ) : (
                              <span className="font-medium">{item.picked}/{item.quantity}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              SKU: {item.sku} • Місце: <span className="font-medium text-teal-600">{item.location}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePicked(item.id, item.picked - 1)}
                              disabled={item.picked === 0}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-medium">
                              {item.picked}/{item.quantity}
                            </span>
                            <button
                              onClick={() => updatePicked(item.id, item.picked + 1)}
                              disabled={item.picked >= item.quantity}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ТТН та примітки */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Дані відправлення</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Номер ТТН
                    </label>
                    <input
                      type="text"
                      value={ttn}
                      onChange={(e) => setTtn(e.target.value)}
                      placeholder="20450000000000"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Примітки
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Коментар до відправлення..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Права панель - підсумок */}
        <div className="space-y-6">
          {selectedOrder && (
            <>
              {/* Підсумок */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Підсумок</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Позицій</span>
                    <span>{orderItems.length}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Товарів</span>
                    <span>{totalCount}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Зібрано</span>
                    <span className={isFullyPicked ? 'text-green-600 font-medium' : ''}>
                      {pickedCount} / {totalCount}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>Сума</span>
                    <span>{selectedOrder.total.toLocaleString()} ₴</span>
                  </div>
                </div>
              </div>

              {/* Швидкі дії */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Швидкі дії</h2>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <PrinterIcon className="w-5 h-5 text-gray-600" />
                    Друк накладної
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <PrinterIcon className="w-5 h-5 text-gray-600" />
                    Друк етикетки
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <DocumentTextIcon className="w-5 h-5 text-gray-600" />
                    Видаткова накладна
                  </button>
                </div>
              </div>

              {/* Кнопки дій */}
              <div className="space-y-3">
                <button
                  disabled={!isFullyPicked}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TruckIcon className="w-5 h-5" />
                  Відвантажити
                </button>
                <button
                  disabled={pickedCount === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  Зберегти як чернетку
                </button>
                <Link
                  href="/admin/warehouse"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900"
                >
                  Скасувати
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Сканер штрих-кодів */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
      />
    </div>
  );
}
