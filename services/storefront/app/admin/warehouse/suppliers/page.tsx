'use client';

import { useState } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  TruckIcon,
  StarIcon,
  EyeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface Supplier {
  id: string;
  name: string;
  code: string;
  type: 'manufacturer' | 'distributor' | 'wholesaler' | 'dropship';
  status: 'active' | 'inactive' | 'blocked';
  contact: {
    person: string;
    phone: string;
    email: string;
    website?: string;
  };
  address: {
    city: string;
    street: string;
    zip: string;
  };
  bankDetails?: {
    iban: string;
    bankName: string;
    edrpou: string;
  };
  terms: {
    paymentDays: number;
    paymentType: string;
    minOrder: number;
    deliveryDays: number;
    currency: string;
  };
  rating: number;
  stats: {
    totalOrders: number;
    totalAmount: number;
    avgDeliveryDays: number;
    returnRate: number;
  };
  categories: string[];
  notes?: string;
  createdAt: string;
}

// Моковані постачальники
const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'ТОВ "Електроніка Плюс"',
    code: 'SUP-001',
    type: 'distributor',
    status: 'active',
    contact: {
      person: 'Олександр Петренко',
      phone: '+380441234567',
      email: 'orders@electronics-plus.ua',
      website: 'www.electronics-plus.ua',
    },
    address: {
      city: 'Київ',
      street: 'вул. Промислова 25',
      zip: '03150',
    },
    bankDetails: {
      iban: 'UA213223130000026007233566001',
      bankName: 'ПриватБанк',
      edrpou: '12345678',
    },
    terms: {
      paymentDays: 14,
      paymentType: '50% передоплата',
      minOrder: 10000,
      deliveryDays: 3,
      currency: 'UAH',
    },
    rating: 4.8,
    stats: {
      totalOrders: 156,
      totalAmount: 4850000,
      avgDeliveryDays: 2.8,
      returnRate: 0.5,
    },
    categories: ['Смартфони', 'Планшети', 'Аксесуари'],
    notes: 'Основний постачальник Apple продукції',
    createdAt: '2023-01-15',
  },
  {
    id: '2',
    name: 'ФОП Коваленко І.М.',
    code: 'SUP-002',
    type: 'wholesaler',
    status: 'active',
    contact: {
      person: 'Ігор Коваленко',
      phone: '+380501234567',
      email: 'kovalenko@gmail.com',
    },
    address: {
      city: 'Харків',
      street: 'вул. Сумська 100',
      zip: '61000',
    },
    terms: {
      paymentDays: 0,
      paymentType: 'По факту',
      minOrder: 5000,
      deliveryDays: 2,
      currency: 'UAH',
    },
    rating: 4.2,
    stats: {
      totalOrders: 89,
      totalAmount: 1250000,
      avgDeliveryDays: 2.1,
      returnRate: 1.2,
    },
    categories: ['Аксесуари', 'Чохли', 'Захисне скло'],
    createdAt: '2023-03-20',
  },
  {
    id: '3',
    name: 'Імпорт Трейд',
    code: 'SUP-003',
    type: 'manufacturer',
    status: 'active',
    contact: {
      person: 'Марія Шевченко',
      phone: '+380671234567',
      email: 'import@trade.ua',
      website: 'www.importtrade.ua',
    },
    address: {
      city: 'Одеса',
      street: 'вул. Портова 15',
      zip: '65000',
    },
    bankDetails: {
      iban: 'UA503052990000026005013456789',
      bankName: 'Укрсиббанк',
      edrpou: '87654321',
    },
    terms: {
      paymentDays: 30,
      paymentType: '100% передоплата',
      minOrder: 50000,
      deliveryDays: 14,
      currency: 'USD',
    },
    rating: 4.5,
    stats: {
      totalOrders: 42,
      totalAmount: 8500000,
      avgDeliveryDays: 12.5,
      returnRate: 0.8,
    },
    categories: ['Ноутбуки', 'Комп\'ютери', 'Монітори'],
    notes: 'Прямий імпорт з Китаю',
    createdAt: '2022-11-10',
  },
  {
    id: '4',
    name: 'Оптова база "Схід"',
    code: 'SUP-004',
    type: 'wholesaler',
    status: 'active',
    contact: {
      person: 'Андрій Мельник',
      phone: '+380931234567',
      email: 'east@wholesale.ua',
    },
    address: {
      city: 'Дніпро',
      street: 'вул. Робоча 50',
      zip: '49000',
    },
    terms: {
      paymentDays: 7,
      paymentType: 'Відстрочка 7 днів',
      minOrder: 3000,
      deliveryDays: 1,
      currency: 'UAH',
    },
    rating: 3.9,
    stats: {
      totalOrders: 210,
      totalAmount: 2100000,
      avgDeliveryDays: 1.2,
      returnRate: 2.1,
    },
    categories: ['Кабелі', 'Зарядки', 'Аксесуари'],
    createdAt: '2023-05-01',
  },
  {
    id: '5',
    name: 'DropShip Pro',
    code: 'SUP-005',
    type: 'dropship',
    status: 'active',
    contact: {
      person: 'Олена Бондар',
      phone: '+380661234567',
      email: 'partner@dropshippro.ua',
      website: 'www.dropshippro.ua',
    },
    address: {
      city: 'Київ',
      street: 'вул. Логістична 10',
      zip: '02000',
    },
    terms: {
      paymentDays: 0,
      paymentType: 'При відправці',
      minOrder: 0,
      deliveryDays: 1,
      currency: 'UAH',
    },
    rating: 4.0,
    stats: {
      totalOrders: 520,
      totalAmount: 3200000,
      avgDeliveryDays: 1.5,
      returnRate: 3.5,
    },
    categories: ['Різне', 'Електроніка', 'Гаджети'],
    notes: 'Дропшипінг партнер для довгого хвоста товарів',
    createdAt: '2023-08-15',
  },
  {
    id: '6',
    name: 'TechWorld Ltd',
    code: 'SUP-006',
    type: 'distributor',
    status: 'inactive',
    contact: {
      person: 'John Smith',
      phone: '+48123456789',
      email: 'orders@techworld.pl',
      website: 'www.techworld.pl',
    },
    address: {
      city: 'Варшава',
      street: 'ul. Handlowa 25',
      zip: '00-001',
    },
    terms: {
      paymentDays: 30,
      paymentType: '100% передоплата',
      minOrder: 100000,
      deliveryDays: 7,
      currency: 'EUR',
    },
    rating: 4.6,
    stats: {
      totalOrders: 12,
      totalAmount: 1500000,
      avgDeliveryDays: 6.5,
      returnRate: 0.2,
    },
    categories: ['Побутова техніка', 'Телевізори'],
    notes: 'Польський дистриб\'ютор, тимчасово призупинено через логістику',
    createdAt: '2023-02-20',
  },
];

const typeConfig = {
  manufacturer: { label: 'Виробник', color: 'bg-purple-100 text-purple-700' },
  distributor: { label: 'Дистриб\'ютор', color: 'bg-blue-100 text-blue-700' },
  wholesaler: { label: 'Оптовик', color: 'bg-green-100 text-green-700' },
  dropship: { label: 'Дропшипінг', color: 'bg-yellow-100 text-yellow-700' },
};

const statusConfig = {
  active: { label: 'Активний', color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Неактивний', color: 'bg-gray-100 text-gray-700' },
  blocked: { label: 'Заблокований', color: 'bg-red-100 text-red-700' },
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star}>
          {rating >= star ? (
            <StarIconSolid className="w-4 h-4 text-yellow-400" />
          ) : rating >= star - 0.5 ? (
            <StarIconSolid className="w-4 h-4 text-yellow-400 opacity-50" />
          ) : (
            <StarIcon className="w-4 h-4 text-gray-300" />
          )}
        </span>
      ))}
      <span className="text-sm text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers] = useState<Supplier[]>(mockSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Статистика
  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.status === 'active').length,
    totalOrders: suppliers.reduce((sum, s) => sum + s.stats.totalOrders, 0),
    totalAmount: suppliers.reduce((sum, s) => sum + s.stats.totalAmount, 0),
  };

  // Фільтрація
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || supplier.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    if (confirm(`Видалити постачальника "${supplier.name}"?`)) {
      console.log('Delete:', supplier.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Постачальники</h1>
          <p className="text-gray-600">Довідник постачальників та партнерів</p>
        </div>
        <button
          onClick={() => { setEditingSupplier(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Додати постачальника
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Всього постачальників</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Активних</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Всього замовлень</div>
          <div className="text-2xl font-bold text-blue-600">{stats.totalOrders}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Загальна сума</div>
          <div className="text-2xl font-bold text-gray-900">{(stats.totalAmount / 1000000).toFixed(1)}M ₴</div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за назвою, кодом або email..."
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
              <option value="manufacturer">Виробники</option>
              <option value="distributor">Дистриб&apos;ютори</option>
              <option value="wholesaler">Оптовики</option>
              <option value="dropship">Дропшипінг</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі статуси</option>
              <option value="active">Активні</option>
              <option value="inactive">Неактивні</option>
              <option value="blocked">Заблоковані</option>
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Постачальник</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Контакт</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Умови</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Рейтинг</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Замовлень</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <BuildingOfficeIcon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        <div className="text-xs text-gray-500">{supplier.code} • {supplier.address.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig[supplier.type].color}`}>
                      {typeConfig[supplier.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{supplier.contact.person}</div>
                    <div className="text-xs text-gray-500">{supplier.contact.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{supplier.terms.paymentType}</div>
                    <div className="text-xs text-gray-500">
                      Мін: {supplier.terms.minOrder.toLocaleString()} {supplier.terms.currency} •
                      Доставка: {supplier.terms.deliveryDays} дн.
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RatingStars rating={supplier.rating} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-medium text-gray-900">{supplier.stats.totalOrders}</div>
                    <div className="text-xs text-gray-500">{(supplier.stats.totalAmount / 1000000).toFixed(1)}M ₴</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[supplier.status].color}`}>
                      {statusConfig[supplier.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedSupplier(supplier)}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                        title="Переглянути"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Редагувати"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                        title="Статистика"
                      >
                        <ChartBarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Видалити"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальне вікно перегляду */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center">
                    <BuildingOfficeIcon className="w-7 h-7 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedSupplier.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">{selectedSupplier.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig[selectedSupplier.type].color}`}>
                        {typeConfig[selectedSupplier.type].label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[selectedSupplier.status].color}`}>
                        {statusConfig[selectedSupplier.status].label}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Статистика */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{selectedSupplier.stats.totalOrders}</div>
                  <div className="text-xs text-gray-500">Замовлень</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{(selectedSupplier.stats.totalAmount / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-gray-500">Сума (₴)</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{selectedSupplier.stats.avgDeliveryDays}</div>
                  <div className="text-xs text-gray-500">Дн. доставки</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{selectedSupplier.stats.returnRate}%</div>
                  <div className="text-xs text-gray-500">Повернень</div>
                </div>
              </div>

              {/* Контактна інформація */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Контактна інформація</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <PhoneIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedSupplier.contact.phone}</div>
                      <div className="text-xs text-gray-500">{selectedSupplier.contact.person}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedSupplier.contact.email}</div>
                      <div className="text-xs text-gray-500">Email</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                    <MapPinIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedSupplier.address.city}, {selectedSupplier.address.street}
                      </div>
                      <div className="text-xs text-gray-500">{selectedSupplier.address.zip}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Умови співпраці */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Умови співпраці</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedSupplier.terms.paymentType}</div>
                      <div className="text-xs text-gray-500">Оплата, відстрочка {selectedSupplier.terms.paymentDays} дн.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <TruckIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedSupplier.terms.deliveryDays} днів</div>
                      <div className="text-xs text-gray-500">Термін доставки</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedSupplier.terms.minOrder.toLocaleString()} {selectedSupplier.terms.currency}
                      </div>
                      <div className="text-xs text-gray-500">Мінімальне замовлення</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <StarIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <RatingStars rating={selectedSupplier.rating} />
                      <div className="text-xs text-gray-500">Рейтинг</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Категорії */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Категорії товарів</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSupplier.categories.map(cat => (
                    <span key={cat} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Банківські реквізити */}
              {selectedSupplier.bankDetails && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Банківські реквізити</h3>
                  <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">IBAN:</span>
                      <span className="font-mono text-gray-900">{selectedSupplier.bankDetails.iban}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Банк:</span>
                      <span className="text-gray-900">{selectedSupplier.bankDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">ЄДРПОУ:</span>
                      <span className="text-gray-900">{selectedSupplier.bankDetails.edrpou}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Примітки */}
              {selectedSupplier.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Примітки</h3>
                  <p className="text-sm text-gray-600 p-3 bg-yellow-50 rounded-lg">{selectedSupplier.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Закрити
              </button>
              <button
                onClick={() => { handleEdit(selectedSupplier); setSelectedSupplier(null); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Редагувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно створення/редагування */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSupplier ? 'Редагувати постачальника' : 'Новий постачальник'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Назва компанії *</label>
                  <input
                    type="text"
                    defaultValue={editingSupplier?.name || ''}
                    placeholder='ТОВ "Назва"'
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
                  <input
                    type="text"
                    defaultValue={editingSupplier?.code || ''}
                    placeholder="SUP-007"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
                  <select
                    defaultValue={editingSupplier?.type || 'wholesaler'}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="manufacturer">Виробник</option>
                    <option value="distributor">Дистриб&apos;ютор</option>
                    <option value="wholesaler">Оптовик</option>
                    <option value="dropship">Дропшипінг</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Контактна особа</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ПІБ *</label>
                    <input
                      type="text"
                      defaultValue={editingSupplier?.contact.person || ''}
                      placeholder="Іван Петренко"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Телефон *</label>
                    <input
                      type="tel"
                      defaultValue={editingSupplier?.contact.phone || ''}
                      placeholder="+380501234567"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      defaultValue={editingSupplier?.contact.email || ''}
                      placeholder="email@company.ua"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Сайт</label>
                    <input
                      type="url"
                      defaultValue={editingSupplier?.contact.website || ''}
                      placeholder="www.company.ua"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Умови співпраці</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тип оплати</label>
                    <select
                      defaultValue={editingSupplier?.terms.paymentType || ''}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="По факту">По факту</option>
                      <option value="50% передоплата">50% передоплата</option>
                      <option value="100% передоплата">100% передоплата</option>
                      <option value="Відстрочка 7 днів">Відстрочка 7 днів</option>
                      <option value="Відстрочка 14 днів">Відстрочка 14 днів</option>
                      <option value="Відстрочка 30 днів">Відстрочка 30 днів</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                    <select
                      defaultValue={editingSupplier?.terms.currency || 'UAH'}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="UAH">UAH (гривня)</option>
                      <option value="USD">USD (долар)</option>
                      <option value="EUR">EUR (євро)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Мін. замовлення</label>
                    <input
                      type="number"
                      defaultValue={editingSupplier?.terms.minOrder || ''}
                      placeholder="5000"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Термін доставки (днів)</label>
                    <input
                      type="number"
                      defaultValue={editingSupplier?.terms.deliveryDays || ''}
                      placeholder="3"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітки</label>
                <textarea
                  defaultValue={editingSupplier?.notes || ''}
                  placeholder="Додаткова інформація про постачальника..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                {editingSupplier ? 'Зберегти' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
