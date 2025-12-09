'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { EyeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { OrderDetailModal } from './OrderDetailModal'
import toast from 'react-hot-toast'

const ORDER_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function OrdersPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, status],
    queryFn: () => api.getOrders({ page, limit: 20, status }),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Order status updated')
    },
  })

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order)
  }

  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600">Manage customer orders</p>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 max-w-xs">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Order</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Items</th>
                    <th className="table-header">Total</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.items?.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="table-cell">
                        <div>{order.customer_name || '-'}</div>
                        <div className="text-sm text-gray-500">
                          {order.customer_email || order.customer_phone}
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="table-cell">{order.items_count || order.items?.length}</td>
                      <td className="table-cell font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="table-cell">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className="text-xs rounded-full border-0 py-1 pl-2 pr-6 focus:ring-2 focus:ring-primary-500"
                          style={{
                            backgroundColor: getStatusColor(order.status).bg,
                            color: getStatusColor(order.status).text,
                          }}
                        >
                          {ORDER_STATUSES.filter((s) => s.value).map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Showing page {page} of {data.total_pages}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.total_pages}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  )
}

function getStatusColor(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#FEF3C7', text: '#92400E' },
    confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
    processing: { bg: '#E0E7FF', text: '#3730A3' },
    shipped: { bg: '#EDE9FE', text: '#5B21B6' },
    delivered: { bg: '#D1FAE5', text: '#065F46' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  }
  return colors[status] || { bg: '#F3F4F6', text: '#374151' }
}
