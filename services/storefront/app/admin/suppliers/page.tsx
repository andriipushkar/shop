'use client';

/**
 * Admin Supplier Management
 * Адміністрування постачальників
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Supplier, SupplierProduct, SupplierOrder } from '@/lib/dropshipping/supplier-service';
import { CommissionCalculator, CommissionRule } from '@/lib/dropshipping/commission-calculator';

const commissionCalculator = new CommissionCalculator();

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      // Mock data - in production, fetch from API
      const mockSuppliers: Supplier[] = [
        {
          id: 'SUP-001',
          companyName: 'ТОВ "Електроніка Плюс"',
          contactPerson: 'Іван Петренко',
          email: 'ivan@elektronika.ua',
          phone: '+380501234567',
          edrpou: '12345678',
          status: 'pending',
          commissionRate: 15,
          paymentTermDays: 14,
          autoApprove: false,
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'SUP-002',
          companyName: 'ФОП Сидоренко',
          contactPerson: 'Ольга Сидоренко',
          email: 'olga@fashion.ua',
          phone: '+380502345678',
          status: 'active',
          commissionRate: 12,
          paymentTermDays: 14,
          autoApprove: true,
          createdAt: new Date('2024-01-10'),
        },
        {
          id: 'SUP-003',
          companyName: 'Техноград',
          contactPerson: 'Андрій Коваленко',
          email: 'andrii@technograd.ua',
          phone: '+380503456789',
          edrpou: '87654321',
          status: 'active',
          commissionRate: 10,
          paymentTermDays: 7,
          autoApprove: true,
          createdAt: new Date('2024-01-05'),
        },
      ];
      setSuppliers(mockSuppliers);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSupplier = async (supplierId: string) => {
    if (!confirm('Схвалити цього постачальника?')) return;

    try {
      // Update supplier status to active
      setSuppliers(prev =>
        prev.map(s => s.id === supplierId ? { ...s, status: 'active' as const } : s)
      );
    } catch (error) {
      console.error('Error approving supplier:', error);
      alert('Помилка схвалення постачальника');
    }
  };

  const handleSuspendSupplier = async (supplierId: string) => {
    const reason = prompt('Вкажіть причину призупинення:');
    if (!reason) return;

    try {
      setSuppliers(prev =>
        prev.map(s => s.id === supplierId ? { ...s, status: 'suspended' as const } : s)
      );
    } catch (error) {
      console.error('Error suspending supplier:', error);
      alert('Помилка призупинення постачальника');
    }
  };

  const handleSetCommission = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setCommissionRate(supplier.commissionRate.toString());
    setShowCommissionModal(true);
  };

  const handleSaveCommission = () => {
    if (!selectedSupplier) return;

    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert('Введіть коректну ставку комісії (0-100%)');
      return;
    }

    setSuppliers(prev =>
      prev.map(s =>
        s.id === selectedSupplier.id ? { ...s, commissionRate: rate } : s
      )
    );

    setShowCommissionModal(false);
    setSelectedSupplier(null);
    setCommissionRate('');
  };

  const filteredSuppliers = suppliers.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

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
              <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
                ← Повернутися до адмін-панелі
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Управління постачальниками</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Всього"
            count={suppliers.length}
            color="blue"
          />
          <StatCard
            label="Очікують схвалення"
            count={suppliers.filter(s => s.status === 'pending').length}
            color="yellow"
          />
          <StatCard
            label="Активні"
            count={suppliers.filter(s => s.status === 'active').length}
            color="green"
          />
          <StatCard
            label="Призупинені"
            count={suppliers.filter(s => s.status === 'suspended').length}
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Всі
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 text-sm font-medium ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Очікують
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 text-sm font-medium ${
                filter === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Активні
            </button>
            <button
              onClick={() => setFilter('suspended')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                filter === 'suspended'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Призупинені
            </button>
          </div>
        </div>

        {/* Suppliers List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Постачальників не знайдено</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSuppliers.map((supplier) => (
                <div key={supplier.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 mr-3">
                          {supplier.companyName}
                        </h3>
                        <SupplierStatusBadge status={supplier.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><span className="font-medium">Контакт:</span> {supplier.contactPerson}</p>
                          <p><span className="font-medium">Email:</span> {supplier.email}</p>
                          <p><span className="font-medium">Телефон:</span> {supplier.phone}</p>
                        </div>
                        <div>
                          {supplier.edrpou && (
                            <p><span className="font-medium">ЄДРПОУ:</span> {supplier.edrpou}</p>
                          )}
                          <p><span className="font-medium">Комісія:</span> {supplier.commissionRate}%</p>
                          <p><span className="font-medium">Термін оплати:</span> {supplier.paymentTermDays} днів</p>
                          <p>
                            <span className="font-medium">Автосхвалення:</span>{' '}
                            {supplier.autoApprove ? 'Так' : 'Ні'}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Дата реєстрації: {new Date(supplier.createdAt).toLocaleDateString('uk-UA')}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    {supplier.status === 'pending' && (
                      <button
                        onClick={() => handleApproveSupplier(supplier.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Схвалити
                      </button>
                    )}
                    {supplier.status === 'active' && (
                      <button
                        onClick={() => handleSuspendSupplier(supplier.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Призупинити
                      </button>
                    )}
                    <button
                      onClick={() => handleSetCommission(supplier)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Налаштувати комісію
                    </button>
                    <Link
                      href={`/admin/suppliers/${supplier.id}/products`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Товари
                    </Link>
                    <Link
                      href={`/admin/suppliers/${supplier.id}/orders`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Замовлення
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Commission Modal */}
      {showCommissionModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Налаштування комісії</h2>
            <p className="text-gray-600 mb-4">
              Постачальник: {selectedSupplier.companyName}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ставка комісії (%)
              </label>
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Платформа буде утримувати {commissionRate || 0}% від кожної продажі
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold mb-2">Приклад розрахунку:</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Ціна товару:</span>
                  <span>₴1,000</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Комісія ({commissionRate || 0}%):</span>
                  <span>₴{((parseFloat(commissionRate) || 0) * 10).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Постачальник отримає:</span>
                  <span>₴{(1000 - (parseFloat(commissionRate) || 0) * 10).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCommissionModal(false);
                  setSelectedSupplier(null);
                  setCommissionRate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveCommission}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, color }: {
  label: string;
  count: number;
  color: 'blue' | 'yellow' | 'green' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{count}</p>
    </div>
  );
}

function SupplierStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: 'Очікує', color: 'bg-yellow-100 text-yellow-800' },
    active: { label: 'Активний', color: 'bg-green-100 text-green-800' },
    suspended: { label: 'Призупинено', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}
