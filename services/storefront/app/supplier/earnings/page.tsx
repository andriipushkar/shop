'use client';

/**
 * Supplier Earnings Page
 * Сторінка прибутків постачальника
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SupplierService, EarningsReport, Payout } from '@/lib/dropshipping/supplier-service';

const supplierService = new SupplierService();

export default function SupplierEarningsPage() {
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  // Mock supplier ID
  const supplierId = 'SUP-123';

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Calculate date range based on period
      const to = new Date();
      const from = new Date();

      switch (period) {
        case 'week':
          from.setDate(from.getDate() - 7);
          break;
        case 'month':
          from.setMonth(from.getMonth() - 1);
          break;
        case 'year':
          from.setFullYear(from.getFullYear() - 1);
          break;
      }

      const earningsData = await supplierService.getEarnings(supplierId, { from, to });
      const payoutsData = await supplierService.getPendingPayouts(supplierId);

      setReport(earningsData);
      setPayouts(payoutsData);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);

    if (!amount || amount <= 0) {
      alert('Введіть коректну суму');
      return;
    }

    if (report && amount > report.netEarnings) {
      alert('Сума перевищує доступний баланс');
      return;
    }

    try {
      await supplierService.requestPayout(supplierId, amount);
      setShowPayoutModal(false);
      setPayoutAmount('');
      await loadData();
    } catch (error) {
      console.error('Error requesting payout:', error);
      alert('Помилка запиту на виплату');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/supplier" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
                ← Повернутися до панелі
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Прибутки та виплати</h1>
            </div>
            <button
              onClick={() => setShowPayoutModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Запросити виплату
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Period Selector */}
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                period === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Тиждень
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 text-sm font-medium ${
                period === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Місяць
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                period === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Рік
            </button>
          </div>
        </div>

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <SummaryCard
                title="Загальний дохід"
                value={`₴${report.totalEarnings.toLocaleString()}`}
                color="blue"
              />
              <SummaryCard
                title="Комісія платформи"
                value={`₴${report.totalCommission.toLocaleString()}`}
                color="orange"
              />
              <SummaryCard
                title="Чистий прибуток"
                value={`₴${report.netEarnings.toLocaleString()}`}
                color="green"
              />
              <SummaryCard
                title="Кількість замовлень"
                value={report.totalOrders.toString()}
                color="purple"
              />
            </div>

            {/* Earnings Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Прибуток за період</h2>
              <div className="space-y-4">
                {report.breakdown.map((day) => (
                  <div key={day.date} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">
                        {new Date(day.date).toLocaleDateString('uk-UA', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-sm text-gray-500">{day.orders} замовлень</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="h-8 bg-gray-200 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${Math.min((day.earnings / report.totalEarnings) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right min-w-[120px]">
                        <p className="font-semibold text-green-600">
                          ₴{day.earnings.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          -₴{day.commission.toLocaleString()} комісія
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commission Breakdown */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Розбивка комісії</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Валовий дохід</span>
                  <span className="font-semibold">₴{report.totalEarnings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-red-600">
                  <span>Комісія платформи ({((report.totalCommission / report.totalEarnings) * 100).toFixed(1)}%)</span>
                  <span className="font-semibold">-₴{report.totalCommission.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center text-lg">
                  <span className="font-semibold">Чистий прибуток</span>
                  <span className="font-bold text-green-600">
                    ₴{report.netEarnings.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Payout History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Історія виплат</h2>
          {payouts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Немає запитів на виплату</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сума</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Спосіб</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payout.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payout.requestedAt).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₴{payout.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getPaymentMethodLabel(payout.method)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PayoutStatusBadge status={payout.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Request Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Запросити виплату</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Доступно для виплати: <span className="font-semibold text-green-600">
                  ₴{report?.netEarnings.toLocaleString()}
                </span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сума виплати (₴)
              </label>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                min="0"
                max={report?.netEarnings}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPayoutModal(false);
                  setPayoutAmount('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleRequestPayout}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Запросити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, color }: {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: 'Очікує', color: 'bg-yellow-100 text-yellow-800' },
    processing: { label: 'Обробляється', color: 'bg-blue-100 text-blue-800' },
    completed: { label: 'Завершено', color: 'bg-green-100 text-green-800' },
    failed: { label: 'Помилка', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}

function getPaymentMethodLabel(method: string): string {
  const methods: Record<string, string> = {
    bank_transfer: 'Банківський переказ',
    paypal: 'PayPal',
    card: 'Картка',
  };

  return methods[method] || method;
}
