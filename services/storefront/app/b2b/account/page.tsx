/**
 * B2B Account Dashboard
 * Особистий кабінет B2B клієнта
 */

'use client';

import { useState, useEffect } from 'react';
import type { CreditAccount, Invoice, CreditTransaction, B2BOrder } from '@/lib/b2b/types';

export default function B2BAccountPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'payments' | 'settings'>('overview');
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccountData();
  }, []);

  const fetchAccountData = async () => {
    try {
      const [creditRes, invoicesRes, ordersRes] = await Promise.all([
        fetch('/api/b2b/credit'),
        fetch('/api/b2b/invoices?status=all'),
        fetch('/api/b2b/orders')
      ]);

      const [creditData, invoicesData, ordersData] = await Promise.all([
        creditRes.json(),
        invoicesRes.json(),
        ordersRes.json()
      ]);

      setCreditAccount(creditData.account);
      setTransactions(creditData.recentTransactions);
      setInvoices(invoicesData.invoices);
      setOrders(ordersData.orders);
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPriceList = (format: 'xlsx' | 'csv' | 'xml' | 'yml') => {
    window.open(`/api/b2b/price-list?format=${format}&includeImages=true&includeStock=true`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Особистий кабінет
        </h1>
        <p className="text-gray-600">ТОВ "Компанія" • ЄДРПОУ: 12345678</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Огляд', icon: '📊' },
              { id: 'orders', label: 'Замовлення', icon: '📦' },
              { id: 'invoices', label: 'Рахунки', icon: '📄' },
              { id: 'payments', label: 'Платежі', icon: '💳' },
              { id: 'settings', label: 'Налаштування', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && creditAccount && (
            <div className="space-y-6">
              {/* Credit Account Card */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
                <h2 className="text-xl font-semibold mb-4">Кредитний рахунок</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Кредитний ліміт</div>
                    <div className="text-3xl font-bold">
                      {creditAccount.creditLimit.toLocaleString('uk-UA')} грн
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Використано</div>
                    <div className="text-3xl font-bold">
                      {creditAccount.usedCredit.toLocaleString('uk-UA')} грн
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Доступно</div>
                    <div className="text-3xl font-bold">
                      {creditAccount.availableCredit.toLocaleString('uk-UA')} грн
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Використання кредиту</span>
                    <span>{((creditAccount.usedCredit / creditAccount.creditLimit) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-900 rounded-full h-3">
                    <div
                      className="bg-white h-3 rounded-full transition-all"
                      style={{ width: `${(creditAccount.usedCredit / creditAccount.creditLimit) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    Термін оплати: <span className="font-semibold">{creditAccount.paymentTermDays} днів</span>
                  </div>
                  {creditAccount.overdueDays > 0 && (
                    <div className="bg-red-500 px-3 py-1 rounded-full text-sm font-semibold">
                      ⚠️ Прострочення: {creditAccount.overdueDays} днів
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-1">Всього замовлень</div>
                  <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-1">Незакриті рахунки</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {invoices.filter(inv => inv.remainingAmount > 0).length}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-1">Прострочені</div>
                  <div className="text-2xl font-bold text-red-600">
                    {invoices.filter(inv => inv.isOverdue).length}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-1">Останній платіж</div>
                  <div className="text-2xl font-bold text-green-600">
                    {transactions.find(t => t.type === 'payment')?.amount.toLocaleString('uk-UA') || '—'} грн
                  </div>
                </div>
              </div>

              {/* Download Price Lists */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Завантажити прайс-лист</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { format: 'xlsx', label: 'Excel (XLSX)', icon: '📊' },
                    { format: 'csv', label: 'CSV', icon: '📝' },
                    { format: 'xml', label: 'XML', icon: '🔖' },
                    { format: 'yml', label: 'YML (Маркетплейси)', icon: '🏪' }
                  ].map(item => (
                    <button
                      key={item.format}
                      onClick={() => handleDownloadPriceList(item.format as any)}
                      className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <span className="text-3xl mb-2">{item.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Manager */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Ваш менеджер</h3>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-900">Іван Петренко</div>
                    <div className="text-blue-700 text-sm">Менеджер B2B відділу</div>
                    <div className="mt-2 space-y-1 text-sm text-blue-800">
                      <div>📞 +380 44 123 45 67</div>
                      <div>📧 ivan.petrenko@example.com</div>
                      <div>💬 Telegram: @ivan_manager</div>
                    </div>
                  </div>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Написати
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Історія замовлень</h2>
                <select className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option>Всі замовлення</option>
                  <option>В обробці</option>
                  <option>Доставлено</option>
                  <option>Скасовано</option>
                </select>
              </div>

              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-lg font-semibold text-blue-600">
                          Замовлення #{order.orderNumber}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString('uk-UA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {order.total.toLocaleString('uk-UA')} грн
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'delivered' ? 'Доставлено' :
                             order.status === 'processing' ? 'Обробляється' :
                             order.status === 'pending' ? 'В обробці' : order.status}
                          </span>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                            order.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.paymentStatus === 'paid' ? 'Оплачено' :
                             order.paymentStatus === 'partial' ? 'Часткова оплата' :
                             'Не оплачено'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-600 mb-2">Товари:</div>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.name} x {item.quantity}</span>
                            <span className="font-semibold">{item.lineTotal.toLocaleString('uk-UA')} грн</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm">
                        Деталі
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm">
                        Повторити замовлення
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Рахунки</h2>
                <select className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option>Всі рахунки</option>
                  <option>Незакриті</option>
                  <option>Прострочені</option>
                  <option>Оплачені</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Рахунок</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Замовлення</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Дата</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Сума</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Оплачено</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Залишок</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Термін</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">{invoice.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{invoice.orderId}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(invoice.createdAt).toLocaleDateString('uk-UA')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {invoice.amount.toLocaleString('uk-UA')} грн
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          {invoice.paidAmount.toLocaleString('uk-UA')} грн
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600">
                          {invoice.remainingAmount.toLocaleString('uk-UA')} грн
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(invoice.dueDate).toLocaleDateString('uk-UA')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {invoice.remainingAmount === 0 ? (
                            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                              Оплачено
                            </span>
                          ) : invoice.isOverdue ? (
                            <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded">
                              Прострочено
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                              До сплати
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Історія платежів</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Дата</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Тип</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Опис</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Сума</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map(txn => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(txn.createdAt).toLocaleDateString('uk-UA')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            txn.type === 'payment' ? 'bg-green-100 text-green-800' :
                            txn.type === 'order' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {txn.type === 'payment' ? 'Платіж' :
                             txn.type === 'order' ? 'Замовлення' :
                             'Коригування'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{txn.description}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${
                          txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.amount > 0 ? '+' : ''}{txn.amount.toLocaleString('uk-UA')} грн
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Налаштування</h2>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Інформація про компанію</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Назва компанії</label>
                    <input
                      type="text"
                      defaultValue="ТОВ Компанія"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">ЄДРПОУ / ІПН</label>
                    <input
                      type="text"
                      defaultValue="12345678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Контактна особа</label>
                    <input
                      type="text"
                      defaultValue="Петро Іванович"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue="company@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Телефон</label>
                    <input
                      type="tel"
                      defaultValue="+380 44 123 45 67"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Адреса</label>
                    <input
                      type="text"
                      defaultValue="вул. Хрещатик 1, Київ"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  Зберегти зміни
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Сповіщення</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3 w-4 h-4" />
                    <span className="text-sm text-gray-700">Email сповіщення про нові замовлення</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3 w-4 h-4" />
                    <span className="text-sm text-gray-700">SMS про зміну статусу замовлення</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 w-4 h-4" />
                    <span className="text-sm text-gray-700">Сповіщення про нові акції та пропозиції</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
