'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CalculatorIcon,
  TruckIcon,
  CalendarIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  leadTime: number;
  paymentTerms: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  minOrder: number;
  inStock: number;
  image?: string;
}

interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
  total: number;
}

// Моковані постачальники
const mockSuppliers: Supplier[] = [
  { id: '1', name: 'ТОВ "Електроніка Плюс"', email: 'orders@electronics.ua', phone: '+380441234567', leadTime: 5, paymentTerms: '50% передоплата' },
  { id: '2', name: 'ФОП Коваленко', email: 'kovalenko@supplier.com', phone: '+380501234567', leadTime: 3, paymentTerms: 'По факту' },
  { id: '3', name: 'Імпорт Трейд', email: 'import@trade.ua', phone: '+380671234567', leadTime: 14, paymentTerms: '100% передоплата' },
  { id: '4', name: 'Оптова база "Схід"', email: 'east@wholesale.ua', phone: '+380931234567', leadTime: 2, paymentTerms: 'Відстрочка 14 днів' },
];

// Моковані товари постачальника
const mockProducts: Product[] = [
  { id: '1', sku: 'PHONE-001', name: 'iPhone 15 Pro 256GB', price: 42000, minOrder: 5, inStock: 12 },
  { id: '2', sku: 'PHONE-002', name: 'Samsung Galaxy S24 Ultra', price: 38000, minOrder: 5, inStock: 8 },
  { id: '3', sku: 'LAPTOP-001', name: 'MacBook Pro 14" M3', price: 85000, minOrder: 2, inStock: 4 },
  { id: '4', sku: 'LAPTOP-002', name: 'ASUS ROG Strix G16', price: 55000, minOrder: 3, inStock: 6 },
  { id: '5', sku: 'ACC-001', name: 'AirPods Pro 2', price: 8500, minOrder: 10, inStock: 25 },
  { id: '6', sku: 'ACC-002', name: 'Samsung Galaxy Buds 3', price: 5500, minOrder: 10, inStock: 30 },
  { id: '7', sku: 'TV-001', name: 'LG OLED55C4 55"', price: 52000, minOrder: 1, inStock: 3 },
  { id: '8', sku: 'TV-002', name: 'Samsung QN85B 65"', price: 48000, minOrder: 1, inStock: 5 },
];

const warehouses = [
  { id: '1', name: 'Головний склад' },
  { id: '2', name: 'Магазин "Центр"' },
  { id: '3', name: 'Дропшипінг' },
];

export default function NewPurchasePage() {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0].id);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Розрахунок загальної суми
  const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Фільтрація товарів
  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Додати товар
  const addProduct = (product: Product) => {
    const existing = orderItems.find(item => item.product.id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + product.minOrder, total: (item.quantity + product.minOrder) * item.price }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product,
        quantity: product.minOrder,
        price: product.price,
        total: product.minOrder * product.price,
      }]);
    }
    setShowProductSearch(false);
    setSearchQuery('');
  };

  // Оновити кількість
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }
    setOrderItems(orderItems.map(item =>
      item.product.id === productId
        ? { ...item, quantity, total: quantity * item.price }
        : item
    ));
  };

  // Оновити ціну
  const updatePrice = (productId: string, price: number) => {
    setOrderItems(orderItems.map(item =>
      item.product.id === productId
        ? { ...item, price, total: item.quantity * price }
        : item
    ));
  };

  // Видалити товар
  const removeProduct = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product.id !== productId));
  };

  // Автоматичне замовлення (заповнення на основі потреб)
  const autoFillOrder = () => {
    const suggestedItems = mockProducts
      .filter(p => p.inStock < 10)
      .map(product => ({
        product,
        quantity: Math.max(product.minOrder, 20 - product.inStock),
        price: product.price,
        total: Math.max(product.minOrder, 20 - product.inStock) * product.price,
      }));
    setOrderItems(suggestedItems);
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/warehouse/purchases"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Нове замовлення постачальнику</h1>
            <p className="text-gray-600">Створіть замовлення на закупівлю товарів</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={autoFillOrder}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <CalculatorIcon className="w-5 h-5" />
            Авто-замовлення
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основна форма */}
        <div className="lg:col-span-2 space-y-6">
          {/* Постачальник */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-teal-600" />
              Постачальник
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Оберіть постачальника *
                </label>
                <select
                  value={selectedSupplier?.id || ''}
                  onChange={(e) => {
                    const supplier = mockSuppliers.find(s => s.id === e.target.value);
                    setSelectedSupplier(supplier || null);
                    if (supplier) {
                      const date = new Date();
                      date.setDate(date.getDate() + supplier.leadTime);
                      setExpectedDate(date.toISOString().split('T')[0]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Оберіть постачальника</option>
                  {mockSuppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Склад призначення *
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
            </div>

            {selectedSupplier && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Email</div>
                    <div className="font-medium">{selectedSupplier.email}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Телефон</div>
                    <div className="font-medium">{selectedSupplier.phone}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Термін доставки</div>
                    <div className="font-medium">{selectedSupplier.leadTime} днів</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Умови оплати</div>
                    <div className="font-medium">{selectedSupplier.paymentTerms}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Товари */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BuildingStorefrontIcon className="w-5 h-5 text-teal-600" />
                Товари
              </h2>
              <button
                onClick={() => setShowProductSearch(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <PlusIcon className="w-4 h-4" />
                Додати товар
              </button>
            </div>

            {/* Пошук товарів */}
            {showProductSearch && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Пошук товару за назвою або SKU..."
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
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-teal-50 border border-gray-100 text-left"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">SKU: {product.sku} | Мін. замовлення: {product.minOrder}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{product.price.toLocaleString()} ₴</div>
                        <div className="text-sm text-gray-500">На складі: {product.inStock}</div>
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
            {orderItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Товар</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Ціна</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">Кількість</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-500">Сума</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderItems.map(item => (
                      <tr key={item.product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.product.name}</div>
                          <div className="text-sm text-gray-500">SKU: {item.product.sku}</div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updatePrice(item.product.id, Number(e.target.value))}
                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                              className="w-16 px-2 py-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                          {item.quantity < item.product.minOrder && (
                            <div className="text-xs text-red-500 text-center mt-1">
                              Мін: {item.product.minOrder}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {item.total.toLocaleString()} ₴
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeProduct(item.product.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <BuildingStorefrontIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Додайте товари до замовлення</p>
                <p className="text-sm">Натисніть &quot;Додати товар&quot; або використайте &quot;Авто-замовлення&quot;</p>
              </div>
            )}
          </div>

          {/* Примітки */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-teal-600" />
              Примітки
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Додаткові коментарі до замовлення..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {/* Бічна панель */}
        <div className="space-y-6">
          {/* Дата та терміни */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-teal-600" />
              Дати
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата створення
                </label>
                <input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Очікувана дата доставки
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Підсумок */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Підсумок</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Позицій</span>
                <span>{orderItems.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Всього одиниць</span>
                <span>{totalItems}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between text-lg font-bold text-gray-900">
                <span>Разом</span>
                <span>{totalAmount.toLocaleString()} ₴</span>
              </div>
            </div>
          </div>

          {/* Кнопки дій */}
          <div className="space-y-3">
            <button
              disabled={!selectedSupplier || orderItems.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              Відправити постачальнику
            </button>
            <button
              disabled={!selectedSupplier || orderItems.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentTextIcon className="w-5 h-5" />
              Зберегти як чернетку
            </button>
            <Link
              href="/admin/warehouse/purchases"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900"
            >
              Скасувати
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
