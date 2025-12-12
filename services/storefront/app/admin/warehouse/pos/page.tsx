'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  ReceiptPercentIcon,
  UserIcon,
  PrinterIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon,
  ShoppingCartIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  image?: string;
  barcode: string;
  inStock: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

// Моковані товари
const mockProducts: Product[] = [
  { id: '1', sku: 'PHONE-001', name: 'iPhone 15 Pro 256GB', price: 42000, barcode: '4820024700016', inStock: 12, category: 'Смартфони' },
  { id: '2', sku: 'PHONE-002', name: 'Samsung Galaxy S24 Ultra', price: 38000, barcode: '4820024700023', inStock: 8, category: 'Смартфони' },
  { id: '3', sku: 'LAPTOP-001', name: 'MacBook Pro 14" M3', price: 85000, barcode: '5901234123457', inStock: 4, category: 'Ноутбуки' },
  { id: '4', sku: 'ACC-001', name: 'AirPods Pro 2', price: 8500, barcode: '7622210449283', inStock: 25, category: 'Аксесуари' },
  { id: '5', sku: 'ACC-002', name: 'Samsung Galaxy Buds 3', price: 5500, barcode: '8710398501424', inStock: 30, category: 'Аксесуари' },
  { id: '6', sku: 'ACC-015', name: 'Захисне скло iPhone 15', price: 350, barcode: '4820024700030', inStock: 150, category: 'Аксесуари' },
  { id: '7', sku: 'ACC-016', name: 'Чохол iPhone 15 Pro', price: 450, barcode: '4820024700047', inStock: 80, category: 'Аксесуари' },
  { id: '8', sku: 'PHONE-003', name: 'iPhone 15 128GB', price: 35000, barcode: '4820024700054', inStock: 15, category: 'Смартфони' },
];

const quickCategories = ['Всі', 'Смартфони', 'Ноутбуки', 'Аксесуари'];

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Всі');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'phone'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Автофокус на пошуку для сканера
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      }
      if (e.key === 'Escape') {
        setShowPayment(false);
        setShowSuccess(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cart.length]);

  // Пошук/сканування товару
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    // Якщо введено штрих-код - одразу додаємо
    const product = mockProducts.find(p => p.barcode === value);
    if (product) {
      addToCart(product);
      setSearchQuery('');
    }
  };

  // Фільтрація товарів
  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    const matchesCategory = categoryFilter === 'Всі' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Додати в кошик
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.inStock) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  };

  // Оновити кількість
  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.product.inStock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Видалити з кошика
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Очистити кошик
  const clearCart = () => {
    if (cart.length === 0 || confirm('Очистити кошик?')) {
      setCart([]);
      setDiscount(0);
      setCustomerPhone('');
    }
  };

  // Розрахунки
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = Math.round(subtotal * (discount / 100));
  const total = subtotal - discountAmount;
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const change = cashReceived ? Math.max(0, Number(cashReceived) - total) : 0;

  // Оплата
  const processPayment = () => {
    if (paymentMethod === 'cash' && Number(cashReceived) < total) {
      alert('Недостатньо коштів!');
      return;
    }
    setShowPayment(false);
    setShowSuccess(true);
    // Тут буде API виклик для збереження продажу
    setTimeout(() => {
      setShowSuccess(false);
      setCart([]);
      setDiscount(0);
      setCashReceived('');
      setCustomerPhone('');
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-gray-100 flex">
      {/* Ліва панель - товари */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Пошук */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Пошук або сканування товару (F2)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-lg border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <button className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2">
              <QrCodeIcon className="w-5 h-5" />
              Сканер
            </button>
          </div>

          {/* Категорії */}
          <div className="flex gap-2 mt-4">
            {quickCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Сітка товарів */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.inStock === 0}
                className={`bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow ${
                  product.inStock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <ShoppingCartIcon className="w-10 h-10 text-gray-300" />
                </div>
                <div className="text-sm text-gray-500 mb-1">{product.sku}</div>
                <div className="font-medium text-gray-900 mb-1 line-clamp-2">{product.name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-teal-600">{product.price.toLocaleString()} ₴</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    product.inStock > 5 ? 'bg-green-100 text-green-700' :
                    product.inStock > 0 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {product.inStock} шт
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Права панель - кошик */}
      <div className="w-96 bg-white shadow-xl flex flex-col">
        {/* Заголовок кошика */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCartIcon className="w-5 h-5" />
              Кошик
              {itemsCount > 0 && (
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-sm">
                  {itemsCount}
                </span>
              )}
            </h2>
            <button
              onClick={clearCart}
              className="text-gray-400 hover:text-red-600"
              title="Очистити"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Список товарів */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCartIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Кошик порожній</p>
              <p className="text-sm">Відскануйте або оберіть товар</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{item.product.name}</div>
                      <div className="text-xs text-gray-500">{item.product.sku}</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100"
                      >
                        <MinusIcon className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        {(item.product.price * item.quantity).toLocaleString()} ₴
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.product.price.toLocaleString()} × {item.quantity}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Знижка та клієнт */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-gray-100 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Телефон клієнта</div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+380..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="w-24">
                <div className="text-xs text-gray-500 mb-1">Знижка %</div>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Підсумок */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Підсумок</span>
              <span>{subtotal.toLocaleString()} ₴</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Знижка ({discount}%)</span>
                <span>-{discountAmount.toLocaleString()} ₴</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>До сплати</span>
              <span>{total.toLocaleString()} ₴</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreditCardIcon className="w-6 h-6" />
            Оплата (F3)
          </button>
        </div>
      </div>

      {/* Модальне вікно оплати */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Оплата</h2>
                <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-2 text-3xl font-bold text-teal-600">{total.toLocaleString()} ₴</div>
            </div>

            <div className="p-6 space-y-4">
              {/* Спосіб оплати */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Спосіб оплати</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors ${
                      paymentMethod === 'cash' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <BanknotesIcon className="w-8 h-8 text-green-600" />
                    <span className="text-sm font-medium">Готівка</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors ${
                      paymentMethod === 'card' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCardIcon className="w-8 h-8 text-blue-600" />
                    <span className="text-sm font-medium">Картка</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('phone')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors ${
                      paymentMethod === 'phone' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DevicePhoneMobileIcon className="w-8 h-8 text-purple-600" />
                    <span className="text-sm font-medium">Apple/Google Pay</span>
                  </button>
                </div>
              </div>

              {/* Готівка */}
              {paymentMethod === 'cash' && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Отримано від клієнта</div>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={total.toString()}
                    className="w-full px-4 py-3 text-2xl text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                  {cashReceived && Number(cashReceived) >= total && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg text-center">
                      <div className="text-sm text-green-600">Решта</div>
                      <div className="text-2xl font-bold text-green-700">{change.toLocaleString()} ₴</div>
                    </div>
                  )}
                  {/* Швидкі суми */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setCashReceived(amount.toString())}
                        className="py-2 px-3 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
                        {amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={processPayment}
                disabled={paymentMethod === 'cash' && Number(cashReceived) < total}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Успішна оплата */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Оплата успішна!</h2>
            <p className="text-gray-500 mb-4">Чек #{Math.floor(Math.random() * 10000)}</p>
            <div className="text-3xl font-bold text-gray-900 mb-6">{total.toLocaleString()} ₴</div>
            {change > 0 && (
              <div className="p-3 bg-green-50 rounded-lg mb-4">
                <div className="text-sm text-green-600">Решта</div>
                <div className="text-xl font-bold text-green-700">{change.toLocaleString()} ₴</div>
              </div>
            )}
            <button className="w-full py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
              <PrinterIcon className="w-5 h-5" />
              Друк чеку
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
