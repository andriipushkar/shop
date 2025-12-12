'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  CubeIcon,
  ArrowsPointingOutIcon,
  QrCodeIcon,
  PrinterIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Location {
  id: string;
  code: string;
  name: string;
  type: 'zone' | 'rack' | 'shelf' | 'bin';
  parentId: string | null;
  warehouse: string;
  warehouseId: string;
  capacity: number;
  used: number;
  products: number;
  status: 'active' | 'inactive' | 'full';
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  maxWeight?: number;
  temperature?: string;
  children?: Location[];
}

// Моковані дані місць зберігання
const mockLocations: Location[] = [
  {
    id: '1',
    code: 'A',
    name: 'Зона A - Електроніка',
    type: 'zone',
    parentId: null,
    warehouse: 'Головний склад',
    warehouseId: '1',
    capacity: 1000,
    used: 650,
    products: 245,
    status: 'active',
    children: [
      {
        id: '1-1',
        code: 'A-01',
        name: 'Стелаж A-01',
        type: 'rack',
        parentId: '1',
        warehouse: 'Головний склад',
        warehouseId: '1',
        capacity: 200,
        used: 180,
        products: 85,
        status: 'active',
        maxWeight: 500,
        children: [
          { id: '1-1-1', code: 'A-01-01', name: 'Полиця 1', type: 'shelf', parentId: '1-1', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 48, products: 24, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-1-2', code: 'A-01-02', name: 'Полиця 2', type: 'shelf', parentId: '1-1', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 50, products: 28, status: 'full', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-1-3', code: 'A-01-03', name: 'Полиця 3', type: 'shelf', parentId: '1-1', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 42, products: 18, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-1-4', code: 'A-01-04', name: 'Полиця 4', type: 'shelf', parentId: '1-1', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 40, products: 15, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
        ],
      },
      {
        id: '1-2',
        code: 'A-02',
        name: 'Стелаж A-02',
        type: 'rack',
        parentId: '1',
        warehouse: 'Головний склад',
        warehouseId: '1',
        capacity: 200,
        used: 120,
        products: 65,
        status: 'active',
        maxWeight: 500,
        children: [
          { id: '1-2-1', code: 'A-02-01', name: 'Полиця 1', type: 'shelf', parentId: '1-2', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 30, products: 16, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-2-2', code: 'A-02-02', name: 'Полиця 2', type: 'shelf', parentId: '1-2', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 45, products: 22, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-2-3', code: 'A-02-03', name: 'Полиця 3', type: 'shelf', parentId: '1-2', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 25, products: 15, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
          { id: '1-2-4', code: 'A-02-04', name: 'Полиця 4', type: 'shelf', parentId: '1-2', warehouse: 'Головний склад', warehouseId: '1', capacity: 50, used: 20, products: 12, status: 'active', dimensions: { width: 120, height: 40, depth: 60 } },
        ],
      },
    ],
  },
  {
    id: '2',
    code: 'B',
    name: 'Зона B - Аксесуари',
    type: 'zone',
    parentId: null,
    warehouse: 'Головний склад',
    warehouseId: '1',
    capacity: 800,
    used: 420,
    products: 380,
    status: 'active',
    children: [
      {
        id: '2-1',
        code: 'B-01',
        name: 'Стелаж B-01',
        type: 'rack',
        parentId: '2',
        warehouse: 'Головний склад',
        warehouseId: '1',
        capacity: 300,
        used: 220,
        products: 180,
        status: 'active',
        maxWeight: 300,
      },
      {
        id: '2-2',
        code: 'B-02',
        name: 'Стелаж B-02',
        type: 'rack',
        parentId: '2',
        warehouse: 'Головний склад',
        warehouseId: '1',
        capacity: 300,
        used: 200,
        products: 200,
        status: 'active',
        maxWeight: 300,
      },
    ],
  },
  {
    id: '3',
    code: 'C',
    name: 'Зона C - Великогабаритні',
    type: 'zone',
    parentId: null,
    warehouse: 'Головний склад',
    warehouseId: '1',
    capacity: 200,
    used: 85,
    products: 42,
    status: 'active',
    temperature: '+15...+25°C',
  },
  {
    id: '4',
    code: 'COLD',
    name: 'Холодильна камера',
    type: 'zone',
    parentId: null,
    warehouse: 'Головний склад',
    warehouseId: '1',
    capacity: 100,
    used: 0,
    products: 0,
    status: 'inactive',
    temperature: '+2...+8°C',
  },
];

const typeConfig = {
  zone: { label: 'Зона', color: 'bg-purple-100 text-purple-700', icon: ArrowsPointingOutIcon },
  rack: { label: 'Стелаж', color: 'bg-blue-100 text-blue-700', icon: CubeIcon },
  shelf: { label: 'Полиця', color: 'bg-green-100 text-green-700', icon: MapPinIcon },
  bin: { label: 'Комірка', color: 'bg-yellow-100 text-yellow-700', icon: CubeIcon },
};

const statusConfig = {
  active: { label: 'Активне', color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Неактивне', color: 'bg-gray-100 text-gray-700' },
  full: { label: 'Заповнено', color: 'bg-red-100 text-red-700' },
};

interface LocationRowProps {
  location: Location;
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}

function LocationRow({ location, level, expandedIds, toggleExpand, onEdit, onDelete }: LocationRowProps) {
  const hasChildren = location.children && location.children.length > 0;
  const isExpanded = expandedIds.has(location.id);
  const TypeIcon = typeConfig[location.type].icon;
  const usagePercent = Math.round((location.used / location.capacity) * 100);

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(location.id)}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig[location.type].color}`}>
              {location.code}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{location.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig[location.type].color}`}>
            {typeConfig[location.type].label}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600">{location.warehouse}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-20 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">{usagePercent}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-600">{location.products}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[location.status].color}`}>
            {statusConfig[location.status].label}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(location)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Редагувати"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
              title="QR-код"
            >
              <QrCodeIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(location)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Видалити"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded && location.children!.map(child => (
        <LocationRow
          key={child.id}
          location={child}
          level={level + 1}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export default function LocationsPage() {
  const [locations] = useState<Location[]>(mockLocations);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['1', '1-1']));
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Статистика
  const stats = {
    total: 0,
    zones: 0,
    racks: 0,
    shelves: 0,
    bins: 0,
    full: 0,
  };

  const countLocations = (locs: Location[]) => {
    locs.forEach(loc => {
      stats.total++;
      if (loc.type === 'zone') stats.zones++;
      if (loc.type === 'rack') stats.racks++;
      if (loc.type === 'shelf') stats.shelves++;
      if (loc.type === 'bin') stats.bins++;
      if (loc.status === 'full') stats.full++;
      if (loc.children) countLocations(loc.children);
    });
  };
  countLocations(locations);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (locs: Location[]) => {
      locs.forEach(loc => {
        if (loc.children && loc.children.length > 0) {
          allIds.add(loc.id);
          collectIds(loc.children);
        }
      });
    };
    collectIds(locations);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setShowModal(true);
  };

  const handleDelete = (location: Location) => {
    if (confirm(`Видалити "${location.name}"?`)) {
      // API call
      console.log('Delete:', location.id);
    }
  };

  // Фільтрація (тільки верхній рівень для спрощення)
  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = warehouseFilter === 'all' || location.warehouseId === warehouseFilter;
    const matchesType = typeFilter === 'all' || location.type === typeFilter;
    return matchesSearch && matchesWarehouse && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Місця зберігання</h1>
          <p className="text-gray-600">Управління стелажами, полицями та комірками</p>
        </div>
        <button
          onClick={() => { setEditingLocation(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Додати місце
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Всього місць</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Зон</div>
          <div className="text-2xl font-bold text-purple-600">{stats.zones}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Стелажів</div>
          <div className="text-2xl font-bold text-blue-600">{stats.racks}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Полиць</div>
          <div className="text-2xl font-bold text-green-600">{stats.shelves}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Комірок</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.bins}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Заповнених</div>
          <div className="text-2xl font-bold text-red-600">{stats.full}</div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за кодом або назвою..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі склади</option>
              <option value="1">Головний склад</option>
              <option value="2">Магазин &quot;Центр&quot;</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Всі типи</option>
              <option value="zone">Зони</option>
              <option value="rack">Стелажі</option>
              <option value="shelf">Полиці</option>
              <option value="bin">Комірки</option>
            </select>
            <button
              onClick={expandAll}
              className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              Розгорнути все
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              Згорнути все
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <PrinterIcon className="w-5 h-5" />
              Друк QR
            </button>
          </div>
        </div>
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Код</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Назва</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Склад</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Заповненість</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Товарів</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLocations.map(location => (
                <LocationRow
                  key={location.id}
                  location={location}
                  level={0}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальне вікно створення/редагування */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingLocation ? 'Редагувати місце' : 'Додати місце зберігання'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Код *</label>
                  <input
                    type="text"
                    defaultValue={editingLocation?.code || ''}
                    placeholder="A-01-02"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
                  <select
                    defaultValue={editingLocation?.type || 'shelf'}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="zone">Зона</option>
                    <option value="rack">Стелаж</option>
                    <option value="shelf">Полиця</option>
                    <option value="bin">Комірка</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва *</label>
                <input
                  type="text"
                  defaultValue={editingLocation?.name || ''}
                  placeholder="Полиця для смартфонів"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Склад *</label>
                  <select
                    defaultValue={editingLocation?.warehouseId || '1'}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="1">Головний склад</option>
                    <option value="2">Магазин &quot;Центр&quot;</option>
                    <option value="3">Дропшипінг</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Батьківське місце</label>
                  <select
                    defaultValue={editingLocation?.parentId || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Немає (верхній рівень)</option>
                    <option value="1">A - Зона A - Електроніка</option>
                    <option value="2">B - Зона B - Аксесуари</option>
                    <option value="1-1">A-01 - Стелаж A-01</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ємність (од.)</label>
                  <input
                    type="number"
                    defaultValue={editingLocation?.capacity || 50}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Макс. вага (кг)</label>
                  <input
                    type="number"
                    defaultValue={editingLocation?.maxWeight || ''}
                    placeholder="100"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Розміри (ШxВxГ, см)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    defaultValue={editingLocation?.dimensions?.width || ''}
                    placeholder="Ширина"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    defaultValue={editingLocation?.dimensions?.height || ''}
                    placeholder="Висота"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    defaultValue={editingLocation?.dimensions?.depth || ''}
                    placeholder="Глибина"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Температурний режим</label>
                <input
                  type="text"
                  defaultValue={editingLocation?.temperature || ''}
                  placeholder="+15...+25°C"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                {editingLocation ? 'Зберегти' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
