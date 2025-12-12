'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  CubeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  ArrowPathIcon,
  EyeIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface SerialNumber {
  id: string;
  serial: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  status: 'in_stock' | 'sold' | 'reserved' | 'returned' | 'defective' | 'warranty';
  warehouse: string;
  location: string;
  batch?: {
    number: string;
    expiryDate?: string;
    manufactureDate?: string;
  };
  purchaseInfo?: {
    supplier: string;
    date: string;
    price: number;
    documentNumber: string;
  };
  saleInfo?: {
    customer: string;
    date: string;
    price: number;
    orderNumber: string;
  };
  warrantyEnd?: string;
  history: {
    date: string;
    action: string;
    user: string;
    details?: string;
  }[];
}

// Моковані серійні номери
const mockSerials: SerialNumber[] = [
  {
    id: '1',
    serial: 'F2LXKH3JQ7MN',
    product: { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001' },
    status: 'in_stock',
    warehouse: 'Головний склад',
    location: 'A-01-02',
    batch: { number: 'LOT-2024-001', manufactureDate: '2024-01-01' },
    purchaseInfo: {
      supplier: 'ТОВ "Електроніка Плюс"',
      date: '2024-01-10',
      price: 38000,
      documentNumber: 'REC-2024-0145',
    },
    warrantyEnd: '2026-01-10',
    history: [
      { date: '2024-01-10', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2024-0145' },
    ],
  },
  {
    id: '2',
    serial: 'G4MPRT8NX2KL',
    product: { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001' },
    status: 'sold',
    warehouse: 'Головний склад',
    location: '-',
    batch: { number: 'LOT-2024-001', manufactureDate: '2024-01-01' },
    purchaseInfo: {
      supplier: 'ТОВ "Електроніка Плюс"',
      date: '2024-01-10',
      price: 38000,
      documentNumber: 'REC-2024-0145',
    },
    saleInfo: {
      customer: 'Іван Петренко',
      date: '2024-01-15',
      price: 42000,
      orderNumber: 'ORD-2024-1234',
    },
    warrantyEnd: '2026-01-15',
    history: [
      { date: '2024-01-10', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2024-0145' },
      { date: '2024-01-15', action: 'Продано', user: 'Марія Шевченко', details: 'ORD-2024-1234' },
    ],
  },
  {
    id: '3',
    serial: 'H7NQWP5VY9ZX',
    product: { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001' },
    status: 'reserved',
    warehouse: 'Головний склад',
    location: 'A-01-02',
    batch: { number: 'LOT-2024-001', manufactureDate: '2024-01-01' },
    purchaseInfo: {
      supplier: 'ТОВ "Електроніка Плюс"',
      date: '2024-01-10',
      price: 38000,
      documentNumber: 'REC-2024-0145',
    },
    warrantyEnd: '2026-01-10',
    history: [
      { date: '2024-01-10', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2024-0145' },
      { date: '2024-01-16', action: 'Зарезервовано', user: 'Система', details: 'ORD-2024-1567' },
    ],
  },
  {
    id: '4',
    serial: 'K2RSTU6WA3BC',
    product: { id: '3', name: 'MacBook Pro 14" M3', sku: 'LAPTOP-001' },
    status: 'warranty',
    warehouse: 'Сервісний центр',
    location: '-',
    batch: { number: 'LOT-2023-089', manufactureDate: '2023-11-15' },
    purchaseInfo: {
      supplier: 'Імпорт Трейд',
      date: '2023-12-01',
      price: 75000,
      documentNumber: 'REC-2023-0892',
    },
    saleInfo: {
      customer: 'Олексій Бондар',
      date: '2023-12-15',
      price: 85000,
      orderNumber: 'ORD-2023-8756',
    },
    warrantyEnd: '2025-12-15',
    history: [
      { date: '2023-12-01', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2023-0892' },
      { date: '2023-12-15', action: 'Продано', user: 'Марія Шевченко', details: 'ORD-2023-8756' },
      { date: '2024-01-14', action: 'Гарантійний ремонт', user: 'Сервіс', details: 'Заміна клавіатури' },
    ],
  },
  {
    id: '5',
    serial: 'L8DEFG7HI4JK',
    product: { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-002' },
    status: 'returned',
    warehouse: 'Головний склад',
    location: 'A-01-03',
    batch: { number: 'LOT-2024-002', manufactureDate: '2024-01-05' },
    purchaseInfo: {
      supplier: 'ТОВ "Електроніка Плюс"',
      date: '2024-01-12',
      price: 34000,
      documentNumber: 'REC-2024-0152',
    },
    saleInfo: {
      customer: 'Марина Коваль',
      date: '2024-01-13',
      price: 38000,
      orderNumber: 'ORD-2024-1345',
    },
    warrantyEnd: '2026-01-12',
    history: [
      { date: '2024-01-12', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2024-0152' },
      { date: '2024-01-13', action: 'Продано', user: 'Марія Шевченко', details: 'ORD-2024-1345' },
      { date: '2024-01-15', action: 'Повернено', user: 'Олена Петренко', details: 'Не підійшов розмір екрану' },
    ],
  },
  {
    id: '6',
    serial: 'M9NOPQ0RS5TU',
    product: { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-002' },
    status: 'defective',
    warehouse: 'Головний склад',
    location: 'DEF-01',
    batch: { number: 'LOT-2024-002', manufactureDate: '2024-01-05' },
    purchaseInfo: {
      supplier: 'ТОВ "Електроніка Плюс"',
      date: '2024-01-12',
      price: 34000,
      documentNumber: 'REC-2024-0152',
    },
    history: [
      { date: '2024-01-12', action: 'Прийнято на склад', user: 'Олена Петренко', details: 'REC-2024-0152' },
      { date: '2024-01-12', action: 'Виявлено дефект', user: 'Олена Петренко', details: 'Подряпини на екрані' },
    ],
  },
];

const statusConfig = {
  in_stock: { label: 'На складі', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  sold: { label: 'Продано', color: 'bg-blue-100 text-blue-700', icon: TruckIcon },
  reserved: { label: 'Зарезервовано', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
  returned: { label: 'Повернено', color: 'bg-purple-100 text-purple-700', icon: ArrowPathIcon },
  defective: { label: 'Брак', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
  warranty: { label: 'На гарантії', color: 'bg-orange-100 text-orange-700', icon: ExclamationTriangleIcon },
};

export default function SerialsPage() {
  const [serials] = useState<SerialNumber[]>(mockSerials);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [selectedSerial, setSelectedSerial] = useState<SerialNumber | null>(null);

  // Статистика
  const stats = {
    total: serials.length,
    inStock: serials.filter(s => s.status === 'in_stock').length,
    sold: serials.filter(s => s.status === 'sold').length,
    reserved: serials.filter(s => s.status === 'reserved').length,
    defective: serials.filter(s => s.status === 'defective').length,
    warranty: serials.filter(s => s.status === 'warranty').length,
  };

  // Унікальні продукти
  const products = [...new Set(serials.map(s => s.product.name))];

  // Фільтрація
  const filteredSerials = serials.filter(serial => {
    const matchesSearch =
      serial.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serial.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serial.product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || serial.status === statusFilter;
    const matchesProduct = productFilter === 'all' || serial.product.name === productFilter;
    return matchesSearch && matchesStatus && matchesProduct;
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Серійні номери та партії</h1>
          <p className="text-gray-600">Облік товарів з серійними номерами</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <ArrowDownTrayIcon className="w-5 h-5" />
          Експорт
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Всього</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">На складі</div>
          <div className="text-2xl font-bold text-green-600">{stats.inStock}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Продано</div>
          <div className="text-2xl font-bold text-blue-600">{stats.sold}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Резерв</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.reserved}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">На гарантії</div>
          <div className="text-2xl font-bold text-orange-600">{stats.warranty}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Брак</div>
          <div className="text-2xl font-bold text-red-600">{stats.defective}</div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за серійним номером, товаром або SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі статуси</option>
              <option value="in_stock">На складі</option>
              <option value="sold">Продано</option>
              <option value="reserved">Зарезервовано</option>
              <option value="returned">Повернено</option>
              <option value="defective">Брак</option>
              <option value="warranty">На гарантії</option>
            </select>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі товари</option>
              {products.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Серійний номер</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Партія</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Розташування</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Гарантія до</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSerials.map(serial => {
                const StatusIcon = statusConfig[serial.status].icon;
                const isWarrantyExpiring = serial.warrantyEnd &&
                  new Date(serial.warrantyEnd) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <tr key={serial.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <QrCodeIcon className="w-5 h-5 text-gray-400" />
                        <span className="font-mono font-medium text-gray-900">{serial.serial}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{serial.product.name}</div>
                      <div className="text-xs text-gray-500">SKU: {serial.product.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      {serial.batch ? (
                        <div>
                          <div className="text-sm text-gray-900">{serial.batch.number}</div>
                          {serial.batch.expiryDate && (
                            <div className="text-xs text-red-500">До: {serial.batch.expiryDate}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[serial.status].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig[serial.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {serial.location !== '-' ? (
                        <div>
                          <div className="text-sm text-gray-900">{serial.warehouse}</div>
                          <div className="text-xs text-teal-600 font-medium">{serial.location}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">{serial.warehouse}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {serial.warrantyEnd ? (
                        <div className={`flex items-center gap-1 ${isWarrantyExpiring ? 'text-orange-600' : 'text-gray-600'}`}>
                          <CalendarIcon className="w-4 h-4" />
                          <span className="text-sm">{serial.warrantyEnd}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedSerial(serial)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                          title="Переглянути"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Друк"
                        >
                          <PrinterIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальне вікно деталей */}
      {selectedSerial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center">
                    <QrCodeIcon className="w-7 h-7 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 font-mono">{selectedSerial.serial}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[selectedSerial.status].color}`}>
                        {statusConfig[selectedSerial.status].label}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSerial(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Товар */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Товар</h3>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <CubeIcon className="w-10 h-10 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{selectedSerial.product.name}</div>
                    <div className="text-sm text-gray-500">SKU: {selectedSerial.product.sku}</div>
                  </div>
                </div>
              </div>

              {/* Партія */}
              {selectedSerial.batch && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Партія</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Номер партії</div>
                      <div className="font-medium text-gray-900">{selectedSerial.batch.number}</div>
                    </div>
                    {selectedSerial.batch.manufactureDate && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500">Дата виробництва</div>
                        <div className="font-medium text-gray-900">{selectedSerial.batch.manufactureDate}</div>
                      </div>
                    )}
                    {selectedSerial.batch.expiryDate && (
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-xs text-red-600">Термін придатності</div>
                        <div className="font-medium text-red-700">{selectedSerial.batch.expiryDate}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Інформація про закупівлю */}
              {selectedSerial.purchaseInfo && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Закупівля</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Постачальник</div>
                      <div className="font-medium text-gray-900">{selectedSerial.purchaseInfo.supplier}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Дата</div>
                      <div className="font-medium text-gray-900">{selectedSerial.purchaseInfo.date}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Ціна закупівлі</div>
                      <div className="font-medium text-gray-900">{selectedSerial.purchaseInfo.price.toLocaleString()} ₴</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Документ</div>
                      <div className="font-medium text-teal-600">{selectedSerial.purchaseInfo.documentNumber}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Інформація про продаж */}
              {selectedSerial.saleInfo && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Продаж</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600">Покупець</div>
                      <div className="font-medium text-blue-900">{selectedSerial.saleInfo.customer}</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600">Дата</div>
                      <div className="font-medium text-blue-900">{selectedSerial.saleInfo.date}</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600">Ціна продажу</div>
                      <div className="font-medium text-blue-900">{selectedSerial.saleInfo.price.toLocaleString()} ₴</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600">Замовлення</div>
                      <div className="font-medium text-blue-700">{selectedSerial.saleInfo.orderNumber}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Гарантія */}
              {selectedSerial.warrantyEnd && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Гарантія</h3>
                  <div className="p-4 bg-green-50 rounded-lg flex items-center gap-3">
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    <div>
                      <div className="font-medium text-green-900">Діє до {selectedSerial.warrantyEnd}</div>
                      <div className="text-sm text-green-700">
                        {Math.ceil((new Date(selectedSerial.warrantyEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} днів залишилось
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Історія */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Історія</h3>
                <div className="space-y-3">
                  {selectedSerial.history.map((event, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{event.action}</span>
                          <span className="text-sm text-gray-500">{event.date}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {event.user}
                          {event.details && <span className="text-gray-400"> • {event.details}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setSelectedSerial(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Закрити
              </button>
              <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Друк етикетки
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
