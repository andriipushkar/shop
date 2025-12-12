'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  DocumentTextIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import BarcodeScanner from '../../components/BarcodeScanner';

interface WriteoffItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  location: string;
  serialNumber?: string;
  batchNumber?: string;
  reason: string;
  photos: string[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  inStock: number;
  location: string;
  barcode: string;
}

// Моковані товари
const mockProducts: Product[] = [
  { id: '1', sku: 'PHONE-001', name: 'iPhone 15 Pro 256GB', price: 42000, inStock: 12, location: 'A-01-02', barcode: '4820024700016' },
  { id: '2', sku: 'PHONE-002', name: 'Samsung Galaxy S24 Ultra', price: 38000, inStock: 8, location: 'A-01-03', barcode: '4820024700023' },
  { id: '3', sku: 'LAPTOP-001', name: 'MacBook Pro 14" M3', price: 85000, inStock: 4, location: 'C-02-01', barcode: '5901234123457' },
  { id: '4', sku: 'ACC-001', name: 'AirPods Pro 2', price: 8500, inStock: 25, location: 'B-03-05', barcode: '7622210449283' },
  { id: '5', sku: 'ACC-015', name: 'Захисне скло iPhone 15', price: 350, inStock: 150, location: 'B-05-02', barcode: '8710398501424' },
];

const writeoffReasons = [
  { value: 'damaged', label: 'Пошкодження при транспортуванні' },
  { value: 'defect', label: 'Заводський брак' },
  { value: 'expired', label: 'Закінчився термін придатності' },
  { value: 'lost', label: 'Втрата/нестача' },
  { value: 'theft', label: 'Крадіжка' },
  { value: 'sample', label: 'Використано як зразок' },
  { value: 'return_damage', label: 'Пошкоджено при поверненні' },
  { value: 'quality', label: 'Не відповідає якості' },
  { value: 'other', label: 'Інше' },
];

const warehouses = [
  { id: '1', name: 'Головний склад' },
  { id: '2', name: 'Магазин "Центр"' },
  { id: '3', name: 'Дропшипінг' },
];

export default function NewWriteoffPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0].id);
  const [items, setItems] = useState<WriteoffItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [notes, setNotes] = useState('');
  const [documentNumber, setDocumentNumber] = useState(`WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`);
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [globalReason, setGlobalReason] = useState('');

  // Загальна сума списання
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Фільтрація товарів
  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode.includes(searchQuery)
  );

  // Додати товар
  const addProduct = (product: Product) => {
    const existing = items.find(item => item.productId === product.id);
    if (existing) {
      setItems(items.map(item =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.inStock), total: Math.min(item.quantity + 1, product.inStock) * item.price }
          : item
      ));
    } else {
      setItems([...items, {
        id: `item-${Date.now()}`,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
        location: product.location,
        reason: globalReason || 'damaged',
        photos: [],
      }]);
    }
    setShowProductSearch(false);
    setSearchQuery('');
  };

  // Сканування
  const handleScan = (barcode: string) => {
    const product = mockProducts.find(p => p.barcode === barcode);
    if (product) {
      addProduct(product);
    }
    setShowScanner(false);
  };

  // Оновити кількість
  const updateQuantity = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const product = mockProducts.find(p => p.id === item.productId);
    const maxQty = product?.inStock || 0;

    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(items.map(i =>
      i.id === itemId
        ? { ...i, quantity: Math.min(quantity, maxQty), total: Math.min(quantity, maxQty) * i.price }
        : i
    ));
  };

  // Оновити причину
  const updateReason = (itemId: string, reason: string) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, reason } : item
    ));
  };

  // Видалити товар
  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  // Застосувати глобальну причину
  const applyGlobalReason = () => {
    if (globalReason) {
      setItems(items.map(item => ({ ...item, reason: globalReason })));
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Списання товару</h1>
            <p className="text-gray-600">Оформлення акту списання</p>
          </div>
        </div>
      </div>

      {/* Попередження */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-red-800">Увага!</div>
          <div className="text-sm text-red-700">
            Списання товару є незворотною операцією. Переконайтесь, що вказали правильну причину та кількість.
            Рекомендуємо додати фото пошкоджень для документування.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основна форма */}
        <div className="lg:col-span-2 space-y-6">
          {/* Дані документа */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-teal-600" />
              Дані акту списання
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Номер документа
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Склад *
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата списання
                </label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Відповідальна особа *
                </label>
                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder="ПІБ працівника"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Загальна причина списання
              </label>
              <div className="flex gap-2">
                <select
                  value={globalReason}
                  onChange={(e) => setGlobalReason(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Оберіть причину...</option>
                  {writeoffReasons.map(reason => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
                <button
                  onClick={applyGlobalReason}
                  disabled={!globalReason || items.length === 0}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  Застосувати до всіх
                </button>
              </div>
            </div>
          </div>

          {/* Товари */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                Товари для списання
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <CameraIcon className="w-4 h-4" />
                  Сканер
                </button>
                <button
                  onClick={() => setShowProductSearch(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <PlusIcon className="w-4 h-4" />
                  Додати товар
                </button>
              </div>
            </div>

            {/* Пошук товарів */}
            {showProductSearch && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Пошук за назвою, SKU або штрих-кодом..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-red-50 border border-gray-100 text-left"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {product.sku} | Місце: {product.location}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{product.price.toLocaleString()} ₴</div>
                        <div className="text-sm text-gray-500">Залишок: {product.inStock}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setShowProductSearch(false); setSearchQuery(''); }}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Закрити
                </button>
              </div>
            )}

            {/* Список товарів */}
            {items.length > 0 ? (
              <div className="space-y-4">
                {items.map(item => {
                  const product = mockProducts.find(p => p.id === item.productId);
                  return (
                    <div key={item.id} className="p-4 bg-red-50 rounded-lg border border-red-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            SKU: {item.sku} | Місце: {item.location} | Макс: {product?.inStock || 0}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Кількість</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                              className="w-16 px-2 py-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Причина</label>
                          <select
                            value={item.reason}
                            onChange={(e) => updateReason(item.id, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            {writeoffReasons.map(reason => (
                              <option key={reason.value} value={reason.value}>{reason.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Сума списання</label>
                          <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-red-600 font-medium">
                            {item.total.toLocaleString()} ₴
                          </div>
                        </div>
                      </div>

                      {/* Фото */}
                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 mb-1">Фото пошкоджень</label>
                        <div className="flex items-center gap-2">
                          <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                            <PhotoIcon className="w-4 h-4 text-gray-400" />
                            Додати фото
                          </button>
                          {item.photos.length > 0 && (
                            <span className="text-sm text-gray-500">{item.photos.length} фото</span>
                          )}
                        </div>
                      </div>

                      {/* Серійний номер / Партія */}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Серійний номер</label>
                          <input
                            type="text"
                            placeholder="SN..."
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Номер партії</label>
                          <input
                            type="text"
                            placeholder="LOT..."
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Додайте товари для списання</p>
                <p className="text-sm">Використовуйте кнопку &quot;Додати товар&quot; або сканер</p>
              </div>
            )}
          </div>

          {/* Примітки */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Примітки до акту</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Детальний опис обставин списання, висновки комісії..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {/* Бічна панель */}
        <div className="space-y-6">
          {/* Підсумок */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Підсумок списання</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Позицій</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Одиниць товару</span>
                <span>{totalItems}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900">Сума збитків</span>
                <span className="text-red-600">{totalAmount.toLocaleString()} ₴</span>
              </div>
            </div>
          </div>

          {/* Статистика причин */}
          {items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">За причинами</h2>
              <div className="space-y-2">
                {writeoffReasons
                  .filter(reason => items.some(item => item.reason === reason.value))
                  .map(reason => {
                    const count = items.filter(item => item.reason === reason.value).length;
                    const amount = items
                      .filter(item => item.reason === reason.value)
                      .reduce((sum, item) => sum + item.total, 0);
                    return (
                      <div key={reason.value} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{reason.label}</span>
                        <span className="text-gray-900">{count} шт. / {amount.toLocaleString()} ₴</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Кнопки дій */}
          <div className="space-y-3">
            <button
              disabled={items.length === 0 || !responsiblePerson}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ExclamationTriangleIcon className="w-5 h-5" />
              Провести списання
            </button>
            <button
              disabled={items.length === 0}
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

          {/* Підказка */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-800">
              <strong>Порада:</strong> Для списання дорогих товарів рекомендуємо:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Створити комісію (мін. 3 особи)</li>
                <li>Зафіксувати пошкодження на фото</li>
                <li>Вказати серійні номери</li>
                <li>Зберегти копію акту</li>
              </ul>
            </div>
          </div>
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
