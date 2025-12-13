'use client';

/**
 * Supplier Orders Management
 * Управління замовленнями постачальника
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SupplierService, SupplierOrder } from '@/lib/dropshipping/supplier-service';

const supplierService = new SupplierService();

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  // Mock supplier ID
  const supplierId = 'SUP-123';

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, statusFilter, searchQuery]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await supplierService.getSupplierOrders(supplierId);
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        o => o.id.toLowerCase().includes(query) ||
             o.platformOrderId.toLowerCase().includes(query) ||
             o.trackingNumber?.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const handleConfirmOrder = async (orderId: string) => {
    if (!confirm('Підтвердити замовлення?')) return;

    try {
      await supplierService.confirmOrder(orderId);
      await loadOrders();
    } catch (error) {
      console.error('Error confirming order:', error);
      alert('Помилка підтвердження замовлення');
    }
  };

  const handleShipOrder = async () => {
    if (!selectedOrder || !trackingNumber) return;

    try {
      await supplierService.shipOrder(selectedOrder.id, {
        trackingNumber,
        trackingUrl: trackingUrl || undefined,
      });
      setShowShipModal(false);
      setTrackingNumber('');
      setTrackingUrl('');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error) {
      console.error('Error shipping order:', error);
      alert('Помилка відправки замовлення');
    }
  };

  const openShipModal = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setShowShipModal(true);
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
          <div>
            <Link href="/supplier" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
              ← Повернутися до панелі
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Замовлення</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пошук</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID замовлення або трекінг..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Всі статуси</option>
                <option value="new">Нові</option>
                <option value="confirmed">Підтверджені</option>
                <option value="shipped">Відправлені</option>
                <option value="delivered">Доставлені</option>
                <option value="cancelled">Скасовані</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Нові" count={orders.filter(o => o.status === 'new').length} color="blue" />
          <StatCard label="Підтверджені" count={orders.filter(o => o.status === 'confirmed').length} color="yellow" />
          <StatCard label="Відправлені" count={orders.filter(o => o.status === 'shipped').length} color="purple" />
          <StatCard label="Доставлені" count={orders.filter(o => o.status === 'delivered').length} color="green" />
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Замовлень не знайдено</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Замовлення {order.id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Платформа: {order.platformOrderId}
                      </p>
                      <p className="text-sm text-gray-500">
                        Дата: {new Date(order.createdAt).toLocaleDateString('uk-UA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <OrderStatusBadge status={order.status} />
                      <p className="text-lg font-bold text-gray-900 mt-2">
                        ₴{order.supplierTotal.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Комісія: ₴{order.platformCommission.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Товари:</h4>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name} (SKU: {item.sku})</span>
                          <span>{item.quantity} × ₴{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Адреса доставки:</h4>
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
                      {order.shippingAddress.postalCode}, {order.shippingAddress.country}
                    </p>
                  </div>

                  {/* Tracking */}
                  {order.trackingNumber && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Трекінг:</h4>
                      <p className="text-sm text-gray-600">
                        {order.trackingNumber}
                        {order.trackingUrl && (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            Відстежити
                          </a>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-3">
                    {order.status === 'new' && (
                      <button
                        onClick={() => handleConfirmOrder(order.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Підтвердити
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => openShipModal(order)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Відправити
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Ship Order Modal */}
      {showShipModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Відправити замовлення</h2>
            <p className="text-gray-600 mb-4">Замовлення: {selectedOrder.id}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Трекінг-номер *
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Введіть номер відстеження"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL відстеження (опціонально)
              </label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowShipModal(false);
                  setTrackingNumber('');
                  setTrackingUrl('');
                  setSelectedOrder(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleShipOrder}
                disabled={!trackingNumber}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Підтвердити відправку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-800',
    green: 'bg-green-100 text-green-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colors[color as keyof typeof colors]}`}>{count}</p>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    new: { label: 'Новий', color: 'bg-blue-100 text-blue-800' },
    confirmed: { label: 'Підтверджено', color: 'bg-yellow-100 text-yellow-800' },
    shipped: { label: 'Відправлено', color: 'bg-purple-100 text-purple-800' },
    delivered: { label: 'Доставлено', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Скасовано', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;

  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}
