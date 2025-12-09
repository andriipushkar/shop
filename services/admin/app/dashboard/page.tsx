'use client'

import { useQuery } from '@tanstack/react-query'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  UsersIcon,
  CubeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import api, { DashboardStats, SalesData } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
  })

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData>({
    queryKey: ['sales-chart'],
    queryFn: () => api.getSalesChart('week'),
  })

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => api.getRecentOrders(5),
  })

  const chartData = {
    labels: salesData?.labels || [],
    datasets: [
      {
        label: 'Revenue',
        data: salesData?.data || [],
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your store.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={stats?.total_orders || 0}
          icon={ShoppingCartIcon}
          trend={{ value: stats?.orders_today || 0, label: 'today' }}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.total_revenue || 0)}
          icon={CurrencyDollarIcon}
          trend={{ value: formatCurrency(stats?.revenue_today || 0), label: 'today' }}
        />
        <StatCard
          title="Total Customers"
          value={stats?.total_customers || 0}
          icon={UsersIcon}
        />
        <StatCard
          title="Total Products"
          value={stats?.total_products || 0}
          icon={CubeIcon}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Pending Orders"
          value={stats?.pending_orders || 0}
          icon={ClockIcon}
          variant="warning"
        />
        <StatCard
          title="Low Stock Products"
          value={stats?.low_stock_products || 0}
          icon={ExclamationTriangleIcon}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Overview</h2>
          {salesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          {ordersLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="table-header">Order</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders?.items?.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">#{order.id.slice(0, 8)}</td>
                      <td className="table-cell">{order.customer_name || order.customer_email}</td>
                      <td className="table-cell">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="table-cell">{formatCurrency(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}
