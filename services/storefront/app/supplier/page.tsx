'use client';

/**
 * Supplier Dashboard
 * Панель постачальника
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SupplierService, SupplierProduct, SupplierOrder } from '@/lib/dropshipping/supplier-service';

const supplierService = new SupplierService();

export default function SupplierDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
    newOrders: 0,
    totalOrders: 0,
    earnings: 0,
    lowStockCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<SupplierOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock supplier ID - in production, get from auth context
  const supplierId = 'SUP-123';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load products
      const products = await supplierService.getProducts(supplierId);
      const lowStock = products.filter(p => p.stock < 10);

      // Load orders
      const orders = await supplierService.getSupplierOrders(supplierId);
      const newOrders = orders.filter(o => o.status === 'new');

      // Calculate earnings
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const earnings = await supplierService.getEarnings(supplierId, {
        from: thisMonth,
        to: new Date(),
      });

      setStats({
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === 'approved').length,
        pendingProducts: products.filter(p => p.status === 'pending').length,
        newOrders: newOrders.length,
        totalOrders: orders.length,
        earnings: earnings.netEarnings,
        lowStockCount: lowStock.length,
      });

      setRecentOrders(orders.slice(0, 5));
      setLowStockProducts(lowStock.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Завантаження...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Кабінет постачальника</h1>
            <div className="flex space-x-4">
              <Link
                href="/supplier/products"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Товари
              </Link>
              <Link
                href="/supplier/orders"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Замовлення
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Всього товарів"
            value={stats.totalProducts}
            subtitle={`${stats.activeProducts} активних`}
            color="blue"
          />
          <StatCard
            title="Нові замовлення"
            value={stats.newOrders}
            subtitle={`${stats.totalOrders} всього`}
            color="green"
          />
          <StatCard
            title="Прибуток за місяць"
            value={`₴${stats.earnings.toLocaleString()}`}
            subtitle="Чистий прибуток"
            color="purple"
          />
          <StatCard
            title="Низькі залишки"
            value={stats.lowStockCount}
            subtitle="Товарів потребують поповнення"
            color="orange"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Швидкі дії</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/supplier/products/new"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Додати товар</span>
            </Link>
            <Link
              href="/supplier/products/import"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium">Імпортувати товари</span>
            </Link>
            <Link
              href="/supplier/earnings"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">Запросити виплату</span>
            </Link>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Останні замовлення</h2>
            <Link href="/supplier/orders" className="text-blue-600 hover:text-blue-800">
              Всі замовлення →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Немає замовлень</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Замовлення</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сума</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₴{order.supplierTotal.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/supplier/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Переглянути
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Низькі залишки</h2>
              <Link href="/supplier/products?filter=low-stock" className="text-blue-600 hover:text-blue-800">
                Всі товари →
              </Link>
            </div>
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-600 font-bold">{product.stock} шт</p>
                    <Link
                      href={`/supplier/products/${product.id}/edit`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Оновити
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: {
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
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
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}
