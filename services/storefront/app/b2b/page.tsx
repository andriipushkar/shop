/**
 * B2B Portal Main Page
 * Головна сторінка B2B порталу
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CreditInfo {
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
  overdueDays: number;
}

interface QuickOrderItem {
  sku: string;
  quantity: number;
}

export default function B2BPortalPage() {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [quickOrderItems, setQuickOrderItems] = useState<QuickOrderItem[]>([
    { sku: '', quantity: 1 }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditInfo();
  }, []);

  const fetchCreditInfo = async () => {
    try {
      const response = await fetch('/api/b2b/credit');
      const data = await response.json();
      setCreditInfo(data.account);
    } catch (error) {
      console.error('Error fetching credit info:', error);
    } finally {
      setLoading(false);
    }
  };

  const addQuickOrderRow = () => {
    setQuickOrderItems([...quickOrderItems, { sku: '', quantity: 1 }]);
  };

  const updateQuickOrderItem = (index: number, field: 'sku' | 'quantity', value: string | number) => {
    const newItems = [...quickOrderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setQuickOrderItems(newItems);
  };

  const removeQuickOrderRow = (index: number) => {
    const newItems = quickOrderItems.filter((_, i) => i !== index);
    setQuickOrderItems(newItems);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Вітаємо в B2B порталі!
        </h1>
        <p className="text-gray-600">
          Оптові закупівлі з вигідними цінами та персональним сервісом
        </p>
      </div>

      {/* Credit Account Status */}
      {!loading && creditInfo && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Кредитний ліміт</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Загальний ліміт</div>
              <div className="text-2xl font-bold text-gray-900">
                {creditInfo.creditLimit.toLocaleString('uk-UA')} грн
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Використано</div>
              <div className="text-2xl font-bold text-orange-600">
                {creditInfo.usedCredit.toLocaleString('uk-UA')} грн
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Доступно</div>
              <div className="text-2xl font-bold text-green-600">
                {creditInfo.availableCredit.toLocaleString('uk-UA')} грн
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Прострочення</div>
              <div className={`text-2xl font-bold ${creditInfo.overdueDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {creditInfo.overdueDays > 0 ? `${creditInfo.overdueDays} днів` : 'Немає'}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${(creditInfo.usedCredit / creditInfo.creditLimit) * 100}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Використано {((creditInfo.usedCredit / creditInfo.creditLimit) * 100).toFixed(1)}% від ліміту
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/b2b/quick-order"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md p-6 transition group"
        >
          <div className="flex items-center justify-between mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <svg className="w-6 h-6 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Швидке замовлення</h3>
          <p className="text-blue-100">Excel-подібний інтерфейс для швидкого оформлення</p>
        </Link>

        <Link
          href="/b2b/account"
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md p-6 transition group"
        >
          <div className="flex items-center justify-between mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg className="w-6 h-6 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Особистий кабінет</h3>
          <p className="text-green-100">Рахунки, платежі, історія замовлень</p>
        </Link>

        <button
          onClick={() => window.open('/api/b2b/price-list?format=xlsx', '_blank')}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-md p-6 transition group text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <svg className="w-6 h-6 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Завантажити прайс</h3>
          <p className="text-purple-100">Актуальний прайс-лист у форматі Excel</p>
        </button>
      </div>

      {/* Mini Quick Order */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Швидке замовлення по артикулу</h2>
        <div className="space-y-3">
          {quickOrderItems.map((item, index) => (
            <div key={index} className="flex gap-3">
              <input
                type="text"
                placeholder="Введіть артикул (SKU)"
                value={item.sku}
                onChange={(e) => updateQuickOrderItem(index, 'sku', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Кількість"
                min="1"
                value={item.quantity}
                onChange={(e) => updateQuickOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {quickOrderItems.length > 1 && (
                <button
                  onClick={() => removeQuickOrderRow(index)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={addQuickOrderRow}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            + Додати рядок
          </button>
          <Link
            href="/b2b/quick-order"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Перейти до повного інтерфейсу
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Останні замовлення</h2>
          <Link href="/b2b/account" className="text-blue-600 hover:text-blue-700">
            Всі замовлення →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Номер</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Дата</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Сума</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Статус</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Оплата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-blue-600">ORD-003</td>
                <td className="px-4 py-3 text-sm text-gray-700">12.12.2025</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">150 000 грн</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                    В обробці
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded">
                    Не оплачено
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-blue-600">ORD-002</td>
                <td className="px-4 py-3 text-sm text-gray-700">04.12.2025</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">21 000 грн</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                    Обробляється
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded">
                    Не оплачено
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-blue-600">ORD-001</td>
                <td className="px-4 py-3 text-sm text-gray-700">14.11.2025</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">60 000 грн</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                    Доставлено
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                    Оплачено
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
