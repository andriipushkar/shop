'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface PurchaseOrder {
  id: string;
  number: string;
  supplier: {
    id: string;
    name: string;
    email: string;
  };
  warehouse: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled';
  items: number;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  expectedDate: string;
  receivedDate?: string;
}

// Моковані дані закупівель
const mockPurchases: PurchaseOrder[] = [
  {
    id: '1',
    number: 'PO-2024-001',
    supplier: { id: '1', name: 'ТОВ "Електроніка Плюс"', email: 'orders@electronics.ua' },
    warehouse: 'Головний склад',
    status: 'received',
    items: 15,
    totalAmount: 125000,
    paidAmount: 125000,
    createdAt: '2024-01-10',
    expectedDate: '2024-01-15',
    receivedDate: '2024-01-14',
  },
  {
    id: '2',
    number: 'PO-2024-002',
    supplier: { id: '2', name: 'ФОП Коваленко', email: 'kovalenko@supplier.com' },
    warehouse: 'Магазин "Центр"',
    status: 'partial',
    items: 8,
    totalAmount: 45000,
    paidAmount: 22500,
    createdAt: '2024-01-12',
    expectedDate: '2024-01-18',
  },
  {
    id: '3',
    number: 'PO-2024-003',
    supplier: { id: '3', name: 'Імпорт Трейд', email: 'import@trade.ua' },
    warehouse: 'Головний склад',
    status: 'confirmed',
    items: 25,
    totalAmount: 320000,
    paidAmount: 160000,
    createdAt: '2024-01-14',
    expectedDate: '2024-01-25',
  },
  {
    id: '4',
    number: 'PO-2024-004',
    supplier: { id: '1', name: 'ТОВ "Електроніка Плюс"', email: 'orders@electronics.ua' },
    warehouse: 'Дропшипінг',
    status: 'sent',
    items: 10,
    totalAmount: 78000,
    paidAmount: 0,
    createdAt: '2024-01-15',
    expectedDate: '2024-01-22',
  },
  {
    id: '5',
    number: 'PO-2024-005',
    supplier: { id: '4', name: 'Оптова база "Схід"', email: 'east@wholesale.ua' },
    warehouse: 'Головний склад',
    status: 'draft',
    items: 30,
    totalAmount: 185000,
    paidAmount: 0,
    createdAt: '2024-01-16',
    expectedDate: '2024-01-30',
  },
  {
    id: '6',
    number: 'PO-2024-006',
    supplier: { id: '2', name: 'ФОП Коваленко', email: 'kovalenko@supplier.com' },
    warehouse: 'Магазин "Центр"',
    status: 'cancelled',
    items: 5,
    totalAmount: 15000,
    paidAmount: 0,
    createdAt: '2024-01-08',
    expectedDate: '2024-01-12',
  },
];

const statusConfig = {
  draft: { label: 'Чернетка', color: 'bg-gray-100 text-gray-700', icon: DocumentTextIcon },
  sent: { label: 'Відправлено', color: 'bg-blue-100 text-blue-700', icon: TruckIcon },
  confirmed: { label: 'Підтверджено', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircleIcon },
  partial: { label: 'Частково отримано', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
  received: { label: 'Отримано', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  cancelled: { label: 'Скасовано', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
};

export default function PurchasesPage() {
  const [purchases] = useState<PurchaseOrder[]>(mockPurchases);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Статистика
  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => ['draft', 'sent', 'confirmed'].includes(p.status)).length,
    inTransit: purchases.filter(p => p.status === 'partial').length,
    totalValue: purchases.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + p.totalAmount, 0),
    unpaid: purchases.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0),
  };

  // Унікальні постачальники
  const suppliers = [...new Set(purchases.map(p => p.supplier.name))];

  // Фільтрація
  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch =
      purchase.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.supplier.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || purchase.status === statusFilter;
    const matchesSupplier = supplierFilter === 'all' || purchase.supplier.name === supplierFilter;
    return matchesSearch && matchesStatus && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Закупівлі</h1>
          <p className="text-gray-600">Замовлення постачальникам</p>
        </div>
        <Link
          href="/admin/warehouse/purchases/new"
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Нове замовлення
        </Link>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Всього замовлень</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Очікують</div>
          <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">В дорозі</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.inTransit}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Загальна сума</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalValue.toLocaleString()} ₴</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">До оплати</div>
          <div className="text-2xl font-bold text-red-600">{stats.unpaid.toLocaleString()} ₴</div>
        </div>
      </div>

      {/* Сповіщення */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-yellow-800">Потребують уваги</div>
          <div className="text-sm text-yellow-700">
            2 замовлення очікують підтвердження від постачальників. 1 замовлення прострочене.
          </div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за номером або постачальником..."
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
              <option value="draft">Чернетки</option>
              <option value="sent">Відправлені</option>
              <option value="confirmed">Підтверджені</option>
              <option value="partial">Частково отримані</option>
              <option value="received">Отримані</option>
              <option value="cancelled">Скасовані</option>
            </select>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі постачальники</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <FunnelIcon className="w-5 h-5" />
              Більше фільтрів
            </button>
          </div>
        </div>
      </div>

      {/* Таблиця замовлень */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Номер</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Постачальник</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Склад</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Позицій</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Сума</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Оплачено</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Очікувана дата</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPurchases.map((purchase) => {
                const StatusIcon = statusConfig[purchase.status].icon;
                const paymentPercent = Math.round((purchase.paidAmount / purchase.totalAmount) * 100);
                const isOverdue = new Date(purchase.expectedDate) < new Date() &&
                  !['received', 'cancelled'].includes(purchase.status);

                return (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/warehouse/purchases/${purchase.id}`}
                        className="font-medium text-teal-600 hover:text-teal-700"
                      >
                        {purchase.number}
                      </Link>
                      <div className="text-xs text-gray-500">{purchase.createdAt}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{purchase.supplier.name}</div>
                      <div className="text-xs text-gray-500">{purchase.supplier.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{purchase.warehouse}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[purchase.status].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig[purchase.status].label}
                      </span>
                      {isOverdue && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          Прострочено
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{purchase.items}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {purchase.totalAmount.toLocaleString()} ₴
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${paymentPercent === 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${paymentPercent}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{paymentPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {purchase.receivedDate || purchase.expectedDate}
                      {purchase.receivedDate && (
                        <div className="text-xs text-green-600">Отримано</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                          title="Переглянути"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {purchase.status === 'draft' && (
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Редагувати"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Дублювати"
                        >
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                        {purchase.status === 'confirmed' && (
                          <button
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Прийняти товар"
                          >
                            <ArrowPathIcon className="w-4 h-4" />
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

        {/* Пагінація */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Показано {filteredPurchases.length} з {purchases.length} замовлень
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
    </div>
  );
}
