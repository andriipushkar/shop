'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type Period = 'day' | 'week' | 'month' | 'year'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['analytics-sales', period],
    queryFn: () => api.getSalesChart(period),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
  })

  const revenueChartData = {
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

  const ordersChartData = {
    labels: salesData?.labels || [],
    datasets: [
      {
        label: 'Orders',
        data: salesData?.orders || [],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderRadius: 6,
      },
    ],
  }

  // Mock data for order status distribution
  const orderStatusData = {
    labels: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    datasets: [
      {
        data: [12, 19, 8, 15, 45, 6],
        backgroundColor: [
          'rgba(251, 191, 36, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(99, 102, 241, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  }

  // Mock data for top products
  const topProducts = [
    { name: 'Product A', sales: 150, revenue: 45000 },
    { name: 'Product B', sales: 120, revenue: 36000 },
    { name: 'Product C', sales: 98, revenue: 29400 },
    { name: 'Product D', sales: 85, revenue: 25500 },
    { name: 'Product E', sales: 72, revenue: 21600 },
  ]

  // Mock data for traffic sources
  const trafficSources = [
    { source: 'Direct', visits: 5420, percentage: 35 },
    { source: 'Google', visits: 4100, percentage: 26 },
    { source: 'Social Media', visits: 3200, percentage: 21 },
    { source: 'Referral', visits: 1850, percentage: 12 },
    { source: 'Email', visits: 930, percentage: 6 },
  ]

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  }

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  }

  if (statsLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Track your store performance</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="input w-40"
        >
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(stats?.total_revenue || 0)}
          change={+12.5}
          icon={CurrencyDollarIcon}
        />
        <MetricCard
          title="Total Orders"
          value={stats?.total_orders?.toLocaleString() || '0'}
          change={+8.2}
          icon={ShoppingCartIcon}
        />
        <MetricCard
          title="Customers"
          value={stats?.total_customers?.toLocaleString() || '0'}
          change={+5.4}
          icon={UsersIcon}
        />
        <MetricCard
          title="Avg. Order Value"
          value={formatCurrency(
            stats?.total_orders ? stats.total_revenue / stats.total_orders : 0
          )}
          change={+3.1}
          icon={EyeIcon}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          <Line data={revenueChartData} options={chartOptions} />
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders per Day</h2>
          <Bar data={ordersChartData} options={chartOptions} />
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h2>
          <div className="h-64">
            <Doughnut data={orderStatusData} options={doughnutOptions} />
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-900">{product.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.revenue)}
                  </p>
                  <p className="text-xs text-gray-500">{product.sales} sales</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h2>
          <div className="space-y-4">
            {trafficSources.map((source, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{source.source}</span>
                  <span className="text-gray-500">
                    {source.visits.toLocaleString()} ({source.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${source.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-900">3.2%</p>
            <p className="text-xs text-blue-600 mt-1">+0.5% from last period</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600 mb-1">Return Customer Rate</p>
            <p className="text-2xl font-bold text-green-900">42%</p>
            <p className="text-xs text-green-600 mt-1">+3% from last period</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600 mb-1">Cart Abandonment</p>
            <p className="text-2xl font-bold text-purple-900">68%</p>
            <p className="text-xs text-purple-600 mt-1">-2% from last period</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string
  value: string
  change: number
  icon: React.ComponentType<{ className?: string }>
}) {
  const isPositive = change >= 0

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-primary-50 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
      </div>
      <div className="flex items-center mt-4">
        {isPositive ? (
          <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
        ) : (
          <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
        )}
        <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{change}%
        </span>
        <span className="text-sm text-gray-500 ml-1">vs last period</span>
      </div>
    </div>
  )
}
