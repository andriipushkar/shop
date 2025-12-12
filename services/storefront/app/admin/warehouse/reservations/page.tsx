'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  UserIcon,
  CubeIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Reservation {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    image?: string;
  };
  quantity: number;
  warehouse: string;
  location: string;
  type: 'order' | 'manual' | 'transfer' | 'preorder';
  reference: {
    type: string;
    number: string;
    id: string;
  };
  customer?: {
    name: string;
    email: string;
  };
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'released' | 'fulfilled';
  createdBy: string;
  notes?: string;
}

// Моковані резервування
const mockReservations: Reservation[] = [
  {
    id: '1',
    product: { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001' },
    quantity: 2,
    warehouse: 'Головний склад',
    location: 'A-01-02',
    type: 'order',
    reference: { type: 'Замовлення', number: 'ORD-2024-1567', id: '1567' },
    customer: { name: 'Олексій Бондар', email: 'bondar@example.com' },
    createdAt: '2024-01-16 14:30',
    expiresAt: '2024-01-18 14:30',
    status: 'active',
    createdBy: 'Система',
  },
  {
    id: '2',
    product: { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-002' },
    quantity: 1,
    warehouse: 'Головний склад',
    location: 'A-01-03',
    type: 'order',
    reference: { type: 'Замовлення', number: 'ORD-2024-1568', id: '1568' },
    customer: { name: 'Марина Коваль', email: 'koval@example.com' },
    createdAt: '2024-01-16 15:00',
    expiresAt: '2024-01-18 15:00',
    status: 'active',
    createdBy: 'Система',
  },
  {
    id: '3',
    product: { id: '3', name: 'MacBook Pro 14" M3', sku: 'LAPTOP-001' },
    quantity: 1,
    warehouse: 'Головний склад',
    location: 'C-02-01',
    type: 'preorder',
    reference: { type: 'Передзамовлення', number: 'PRE-2024-0089', id: '89' },
    customer: { name: 'ТОВ "Рітейл Груп"', email: 'orders@retail.ua' },
    createdAt: '2024-01-15 10:00',
    expiresAt: '2024-01-22 10:00',
    status: 'active',
    createdBy: 'Марія Шевченко',
    notes: 'B2B клієнт, очікує підтвердження оплати',
  },
  {
    id: '4',
    product: { id: '4', name: 'AirPods Pro 2', sku: 'ACC-001' },
    quantity: 5,
    warehouse: 'Магазин "Центр"',
    location: 'B-03-05',
    type: 'transfer',
    reference: { type: 'Переміщення', number: 'TRF-2024-0045', id: '45' },
    createdAt: '2024-01-16 11:45',
    expiresAt: '2024-01-17 11:45',
    status: 'active',
    createdBy: 'Андрій Мельник',
  },
  {
    id: '5',
    product: { id: '1', name: 'iPhone 15 Pro 256GB', sku: 'PHONE-001' },
    quantity: 1,
    warehouse: 'Головний склад',
    location: 'A-01-02',
    type: 'manual',
    reference: { type: 'Ручний резерв', number: 'RES-2024-0012', id: '12' },
    customer: { name: 'Петро Іваненко', email: 'ivanenko@example.com' },
    createdAt: '2024-01-14 16:00',
    expiresAt: '2024-01-16 16:00',
    status: 'expired',
    createdBy: 'Олена Петренко',
    notes: 'Клієнт не підтвердив замовлення',
  },
  {
    id: '6',
    product: { id: '2', name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-002' },
    quantity: 2,
    warehouse: 'Головний склад',
    location: 'A-01-03',
    type: 'order',
    reference: { type: 'Замовлення', number: 'ORD-2024-1520', id: '1520' },
    customer: { name: 'Анна Сидоренко', email: 'sydorenko@example.com' },
    createdAt: '2024-01-13 09:00',
    expiresAt: '2024-01-15 09:00',
    status: 'fulfilled',
    createdBy: 'Система',
  },
  {
    id: '7',
    product: { id: '4', name: 'AirPods Pro 2', sku: 'ACC-001' },
    quantity: 3,
    warehouse: 'Головний склад',
    location: 'B-03-05',
    type: 'order',
    reference: { type: 'Замовлення', number: 'ORD-2024-1510', id: '1510' },
    createdAt: '2024-01-12 14:00',
    expiresAt: '2024-01-14 14:00',
    status: 'released',
    createdBy: 'Система',
    notes: 'Клієнт скасував замовлення',
  },
];

const typeConfig = {
  order: { label: 'Замовлення', color: 'bg-blue-100 text-blue-700', icon: ShoppingCartIcon },
  manual: { label: 'Ручний', color: 'bg-purple-100 text-purple-700', icon: UserIcon },
  transfer: { label: 'Переміщення', color: 'bg-indigo-100 text-indigo-700', icon: ArrowPathIcon },
  preorder: { label: 'Передзамовлення', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
};

const statusConfig = {
  active: { label: 'Активний', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  expired: { label: 'Прострочений', color: 'bg-red-100 text-red-700', icon: ExclamationTriangleIcon },
  released: { label: 'Скасовано', color: 'bg-gray-100 text-gray-500', icon: XCircleIcon },
  fulfilled: { label: 'Виконано', color: 'bg-blue-100 text-blue-700', icon: CheckCircleIcon },
};

export default function ReservationsPage() {
  const [reservations] = useState<Reservation[]>(mockReservations);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  // Статистика
  const stats = {
    total: reservations.filter(r => r.status === 'active').length,
    totalQuantity: reservations.filter(r => r.status === 'active').reduce((s, r) => s + r.quantity, 0),
    expiringSoon: reservations.filter(r => {
      if (r.status !== 'active') return false;
      const expiresAt = new Date(r.expiresAt.replace(' ', 'T'));
      const hoursLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    }).length,
    expired: reservations.filter(r => r.status === 'expired').length,
  };

  // Фільтрація
  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch =
      reservation.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reservation.product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reservation.reference.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reservation.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || reservation.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || reservation.status === statusFilter;
    const matchesWarehouse = warehouseFilter === 'all' || reservation.warehouse === warehouseFilter;
    return matchesSearch && matchesType && matchesStatus && matchesWarehouse;
  });

  // Перевірка чи скоро закінчується
  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt.replace(' ', 'T'));
    const hoursLeft = (expires.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft <= 24 && hoursLeft > 0;
  };

  const getTimeLeft = (expiresAt: string) => {
    const expires = new Date(expiresAt.replace(' ', 'T'));
    const diff = expires.getTime() - Date.now();
    if (diff <= 0) return 'Прострочено';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} дн. ${hours % 24} год.`;
    }
    return `${hours} год. ${minutes} хв.`;
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Резервування</h1>
          <p className="text-gray-600">Перегляд зарезервованих товарів</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <ClockIcon className="w-5 h-5" />
          Новий резерв
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Активних резервів</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Зарезервовано (шт)</div>
          <div className="text-2xl font-bold text-blue-600">{stats.totalQuantity}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Закінчуються</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Прострочених</div>
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
        </div>
      </div>

      {/* Попередження */}
      {stats.expiringSoon > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-yellow-800">Увага!</div>
            <div className="text-sm text-yellow-700">
              {stats.expiringSoon} резервувань закінчуються протягом 24 годин. Перевірте статус замовлень.
            </div>
          </div>
        </div>
      )}

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за товаром, номером або клієнтом..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі типи</option>
              <option value="order">Замовлення</option>
              <option value="manual">Ручні</option>
              <option value="transfer">Переміщення</option>
              <option value="preorder">Передзамовлення</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі статуси</option>
              <option value="active">Активні</option>
              <option value="expired">Прострочені</option>
              <option value="released">Скасовані</option>
              <option value="fulfilled">Виконані</option>
            </select>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі склади</option>
              <option value="Головний склад">Головний склад</option>
              <option value="Магазин &quot;Центр&quot;">Магазин &quot;Центр&quot;</option>
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Товар</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Кількість</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Посилання</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Клієнт</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Залишилось</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReservations.map(reservation => {
                const TypeIcon = typeConfig[reservation.type].icon;
                const StatusIcon = statusConfig[reservation.status].icon;
                const expiringSoon = reservation.status === 'active' && isExpiringSoon(reservation.expiresAt);

                return (
                  <tr
                    key={reservation.id}
                    className={`hover:bg-gray-50 ${expiringSoon ? 'bg-yellow-50' : ''} ${reservation.status === 'expired' ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <CubeIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{reservation.product.name}</div>
                          <div className="text-xs text-gray-500">
                            SKU: {reservation.product.sku} • {reservation.location}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-lg text-gray-900">{reservation.quantity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig[reservation.type].color}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeConfig[reservation.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/${reservation.reference.type === 'Замовлення' ? 'orders' : 'warehouse/transfers'}/${reservation.reference.id}`}
                        className="text-teal-600 hover:text-teal-700 font-medium"
                      >
                        {reservation.reference.number}
                      </Link>
                      <div className="text-xs text-gray-500">{reservation.reference.type}</div>
                    </td>
                    <td className="px-4 py-3">
                      {reservation.customer ? (
                        <div>
                          <div className="text-sm text-gray-900">{reservation.customer.name}</div>
                          <div className="text-xs text-gray-500">{reservation.customer.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[reservation.status].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig[reservation.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {reservation.status === 'active' ? (
                        <div className={`text-sm font-medium ${expiringSoon ? 'text-yellow-600' : 'text-gray-600'}`}>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            {getTimeLeft(reservation.expiresAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                          title="Переглянути"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {reservation.status === 'active' && (
                          <button
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Скасувати резерв"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
