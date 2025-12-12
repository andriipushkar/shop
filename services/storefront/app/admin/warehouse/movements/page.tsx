'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  EyeIcon,
  PrinterIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

interface Movement {
  id: string;
  type: 'receipt' | 'shipment' | 'transfer' | 'writeoff' | 'adjustment' | 'return';
  documentNumber: string;
  date: string;
  time: string;
  warehouse: string;
  warehouseFrom?: string;
  warehouseTo?: string;
  supplier?: string;
  customer?: string;
  user: string;
  items: number;
  quantity: number;
  totalAmount: number;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
}

// Моковані дані рухів
const mockMovements: Movement[] = [
  {
    id: '1',
    type: 'receipt',
    documentNumber: 'REC-2024-0156',
    date: '2024-01-16',
    time: '14:32',
    warehouse: 'Головний склад',
    supplier: 'ТОВ "Електроніка Плюс"',
    user: 'Олена Петренко',
    items: 15,
    quantity: 120,
    totalAmount: 485000,
    status: 'completed',
  },
  {
    id: '2',
    type: 'shipment',
    documentNumber: 'SHP-2024-0892',
    date: '2024-01-16',
    time: '13:15',
    warehouse: 'Головний склад',
    customer: 'Іван Коваль',
    user: 'Марія Шевченко',
    items: 3,
    quantity: 5,
    totalAmount: 125000,
    status: 'completed',
    notes: 'Замовлення ORD-2024-1234',
  },
  {
    id: '3',
    type: 'transfer',
    documentNumber: 'TRF-2024-0045',
    date: '2024-01-16',
    time: '11:45',
    warehouse: 'Переміщення',
    warehouseFrom: 'Головний склад',
    warehouseTo: 'Магазин "Центр"',
    user: 'Андрій Мельник',
    items: 8,
    quantity: 25,
    totalAmount: 78000,
    status: 'completed',
  },
  {
    id: '4',
    type: 'writeoff',
    documentNumber: 'WO-2024-0012',
    date: '2024-01-16',
    time: '10:20',
    warehouse: 'Головний склад',
    user: 'Олена Петренко',
    items: 2,
    quantity: 3,
    totalAmount: 15500,
    status: 'completed',
    notes: 'Пошкодження при транспортуванні',
  },
  {
    id: '5',
    type: 'receipt',
    documentNumber: 'REC-2024-0155',
    date: '2024-01-15',
    time: '16:45',
    warehouse: 'Магазин "Центр"',
    supplier: 'ФОП Коваленко',
    user: 'Сергій Бондар',
    items: 20,
    quantity: 150,
    totalAmount: 125000,
    status: 'completed',
  },
  {
    id: '6',
    type: 'shipment',
    documentNumber: 'SHP-2024-0891',
    date: '2024-01-15',
    time: '15:30',
    warehouse: 'Головний склад',
    customer: 'ТОВ "Рітейл Груп"',
    user: 'Марія Шевченко',
    items: 12,
    quantity: 48,
    totalAmount: 890000,
    status: 'completed',
    notes: 'Оптове замовлення B2B',
  },
  {
    id: '7',
    type: 'return',
    documentNumber: 'RET-2024-0023',
    date: '2024-01-15',
    time: '14:00',
    warehouse: 'Головний склад',
    customer: 'Петро Іваненко',
    user: 'Олена Петренко',
    items: 1,
    quantity: 1,
    totalAmount: 42000,
    status: 'completed',
    notes: 'Повернення iPhone - не підійшов колір',
  },
  {
    id: '8',
    type: 'adjustment',
    documentNumber: 'ADJ-2024-0008',
    date: '2024-01-15',
    time: '12:00',
    warehouse: 'Головний склад',
    user: 'Олена Петренко',
    items: 5,
    quantity: -8,
    totalAmount: -24000,
    status: 'completed',
    notes: 'Корегування після інвентаризації INV-2024-0003',
  },
  {
    id: '9',
    type: 'transfer',
    documentNumber: 'TRF-2024-0044',
    date: '2024-01-14',
    time: '17:30',
    warehouse: 'Переміщення',
    warehouseFrom: 'Магазин "Центр"',
    warehouseTo: 'Головний склад',
    user: 'Сергій Бондар',
    items: 3,
    quantity: 10,
    totalAmount: 25000,
    status: 'pending',
    notes: 'Очікує підтвердження',
  },
  {
    id: '10',
    type: 'shipment',
    documentNumber: 'SHP-2024-0890',
    date: '2024-01-14',
    time: '16:00',
    warehouse: 'Головний склад',
    customer: 'Анна Сидоренко',
    user: 'Марія Шевченко',
    items: 2,
    quantity: 2,
    totalAmount: 17000,
    status: 'cancelled',
    notes: 'Клієнт скасував замовлення',
  },
];

const typeConfig = {
  receipt: { label: 'Приймання', color: 'bg-green-100 text-green-700', icon: ArrowDownIcon, sign: '+' },
  shipment: { label: 'Відвантаження', color: 'bg-blue-100 text-blue-700', icon: ArrowUpIcon, sign: '-' },
  transfer: { label: 'Переміщення', color: 'bg-purple-100 text-purple-700', icon: ArrowsRightLeftIcon, sign: '~' },
  writeoff: { label: 'Списання', color: 'bg-red-100 text-red-700', icon: ExclamationTriangleIcon, sign: '-' },
  adjustment: { label: 'Корегування', color: 'bg-yellow-100 text-yellow-700', icon: DocumentTextIcon, sign: '±' },
  return: { label: 'Повернення', color: 'bg-indigo-100 text-indigo-700', icon: ArrowDownIcon, sign: '+' },
};

const statusConfig = {
  completed: { label: 'Проведено', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Очікує', color: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'Скасовано', color: 'bg-gray-100 text-gray-500 line-through' },
};

export default function MovementsPage() {
  const [movements] = useState<Movement[]>(mockMovements);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Статистика
  const stats = {
    total: movements.length,
    receipts: movements.filter(m => m.type === 'receipt' && m.status === 'completed').reduce((s, m) => s + m.quantity, 0),
    shipments: movements.filter(m => m.type === 'shipment' && m.status === 'completed').reduce((s, m) => s + m.quantity, 0),
    totalIn: movements.filter(m => ['receipt', 'return'].includes(m.type) && m.status === 'completed').reduce((s, m) => s + m.totalAmount, 0),
    totalOut: movements.filter(m => ['shipment', 'writeoff'].includes(m.type) && m.status === 'completed').reduce((s, m) => s + m.totalAmount, 0),
  };

  // Фільтрація
  const filteredMovements = movements.filter(movement => {
    const matchesSearch =
      movement.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.customer?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || movement.type === typeFilter;
    const matchesWarehouse = warehouseFilter === 'all' ||
      movement.warehouse === warehouseFilter ||
      movement.warehouseFrom === warehouseFilter ||
      movement.warehouseTo === warehouseFilter;
    const matchesStatus = statusFilter === 'all' || movement.status === statusFilter;
    const matchesDateFrom = !dateFrom || movement.date >= dateFrom;
    const matchesDateTo = !dateTo || movement.date <= dateTo;
    return matchesSearch && matchesType && matchesWarehouse && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // Групування по датах
  const groupedMovements = filteredMovements.reduce((groups, movement) => {
    const date = movement.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(movement);
    return groups;
  }, {} as Record<string, Movement[]>);

  const sortedDates = Object.keys(groupedMovements).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Сьогодні';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Вчора';

    return date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Історія рухів</h1>
          <p className="text-gray-600">Журнал всіх складських операцій</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <ArrowDownTrayIcon className="w-5 h-5" />
          Експорт
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Операцій</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Прийнято (шт)</div>
          <div className="text-2xl font-bold text-green-600">+{stats.receipts}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Відвантажено (шт)</div>
          <div className="text-2xl font-bold text-blue-600">-{stats.shipments}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Прихід (₴)</div>
          <div className="text-2xl font-bold text-green-600">+{(stats.totalIn / 1000).toFixed(0)}K</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Розхід (₴)</div>
          <div className="text-2xl font-bold text-red-600">-{(stats.totalOut / 1000).toFixed(0)}K</div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за номером, постачальником або клієнтом..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі типи</option>
              <option value="receipt">Приймання</option>
              <option value="shipment">Відвантаження</option>
              <option value="transfer">Переміщення</option>
              <option value="writeoff">Списання</option>
              <option value="adjustment">Корегування</option>
              <option value="return">Повернення</option>
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі статуси</option>
              <option value="completed">Проведені</option>
              <option value="pending">Очікують</option>
              <option value="cancelled">Скасовані</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Від"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="До"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Журнал рухів */}
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date}>
            {/* Заголовок дати */}
            <div className="flex items-center gap-3 mb-3">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-500">{formatDate(date)}</h3>
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400">{groupedMovements[date].length} операцій</span>
            </div>

            {/* Список операцій */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {groupedMovements[date].map(movement => {
                  const TypeIcon = typeConfig[movement.type].icon;
                  return (
                    <div
                      key={movement.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${movement.status === 'cancelled' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Іконка типу */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig[movement.type].color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>

                        {/* Основна інформація */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/admin/warehouse/movements/${movement.id}`}
                                  className="font-medium text-gray-900 hover:text-teal-600"
                                >
                                  {movement.documentNumber}
                                </Link>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig[movement.type].color}`}>
                                  {typeConfig[movement.type].label}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[movement.status].color}`}>
                                  {statusConfig[movement.status].label}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <ClockIcon className="w-4 h-4" />
                                  {movement.time}
                                </span>
                                {movement.type === 'transfer' ? (
                                  <span className="flex items-center gap-1">
                                    {movement.warehouseFrom} → {movement.warehouseTo}
                                  </span>
                                ) : (
                                  <span>{movement.warehouse}</span>
                                )}
                                {(movement.supplier || movement.customer) && (
                                  <span className="flex items-center gap-1">
                                    <UserIcon className="w-4 h-4" />
                                    {movement.supplier || movement.customer}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Кількість та сума */}
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{movement.items} поз.</span>
                                <span className={`font-medium ${
                                  ['receipt', 'return'].includes(movement.type) ? 'text-green-600' :
                                  ['shipment', 'writeoff'].includes(movement.type) ? 'text-red-600' :
                                  'text-gray-900'
                                }`}>
                                  {typeConfig[movement.type].sign}{Math.abs(movement.quantity)} шт.
                                </span>
                              </div>
                              <div className={`text-lg font-semibold ${
                                movement.totalAmount >= 0 ? 'text-gray-900' : 'text-red-600'
                              }`}>
                                {movement.totalAmount >= 0 ? '' : '-'}{Math.abs(movement.totalAmount).toLocaleString()} ₴
                              </div>
                            </div>
                          </div>

                          {/* Примітки */}
                          {movement.notes && (
                            <div className="mt-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded">
                              {movement.notes}
                            </div>
                          )}

                          {/* Виконавець */}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              Виконав: {movement.user}
                            </span>
                            <div className="flex items-center gap-1">
                              <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded" title="Переглянути">
                                <EyeIcon className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Друк">
                                <PrinterIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {sortedDates.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <CubeIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <div className="text-gray-500">Операцій не знайдено</div>
            <div className="text-sm text-gray-400">Спробуйте змінити параметри фільтрації</div>
          </div>
        )}
      </div>

      {/* Пагінація */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Показано {filteredMovements.length} з {movements.length} операцій
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50" disabled>
            Попередня
          </button>
          <button className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded">1</button>
          <button className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50" disabled>
            Наступна
          </button>
        </div>
      </div>
    </div>
  );
}
